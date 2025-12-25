const winston = require('winston');
const Freelancer = require('../../models/Freelancer/freelancer.model');
const mongoose = require('mongoose');
const { StatusCodes } = require('../../../../utils/constants/statusCodes');
const { APIError } = require('../../../../utils/errorHandler');
const asyncHandler = require('../../../../utils/asyncHandler');
const bcrypt = require('bcryptjs');
const { createToken } = require('../../../../middleware/auth');
const { Role } = require('../../models/role/role.model');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
  transports: [new winston.transports.File({ filename: 'logs/freelancer.log' }), new winston.transports.Console()]
});

// === LOGIN ===
exports.freelancerLogin = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const freelancer = await Freelancer.findOne({ email }).select('+password').populate('role');
  if (!freelancer || !freelancer.isActive) {
    throw new APIError('Invalid credentials', StatusCodes.UNAUTHORIZED);
  }

  const isMatch = await bcrypt.compare(password, freelancer.password);
  if (!isMatch) {
    throw new APIError('Invalid credentials', StatusCodes.UNAUTHORIZED);
  }

  const token = createToken(freelancer);
  const freelancerData = freelancer.toObject();
  delete freelancerData.password;

  res.status(StatusCodes.OK).json({
    success: true,
    token,
    freelancer: freelancerData
  });
});

// === CREATE FREELANCER ===
exports.createFreelancer = asyncHandler(async (req, res) => {
  const data = req.body;

  /* ================= DUPLICATE CHECK ================= */
  const existing = await Freelancer.findOne({
    $or: [
      { email: data.email },
      {
        'mobile.country_code': data.mobile.country_code,
        'mobile.number': data.mobile.number
      }
    ]
  });

  if (existing)
    throw new APIError('Email or mobile already exists', StatusCodes.CONFLICT);

  if (!data.is_mobile_verified)
    throw new APIError('Mobile must be verified', StatusCodes.BAD_REQUEST);

  /* ================= ROLE ================= */
  const role = await Role.findOne({ name: 'Freelancer' });
  if (!role)
    throw new APIError('Role not found', StatusCodes.NOT_FOUND);

  /* ================= SERVICES (MULTIPLE) ================= */
  if (data.services_offered) {
    if (!Array.isArray(data.services_offered)) {
      throw new APIError('services_offered must be an array', StatusCodes.BAD_REQUEST);
    }

    data.services_offered.forEach((s, index) => {
      if (!mongoose.Types.ObjectId.isValid(s.service)) {
        throw new APIError(
          `Invalid service ID at index ${index}`,
          StatusCodes.BAD_REQUEST
        );
      }
    });
  }

  /* ================= PREPARE DATA ================= */
  data.role = role._id;
  data.password = await bcrypt.hash(data.password, 10);

  data.status_info = { status: 0 }; // Pending
  data.documents = [];
  data.performance = {};
  data.onboarding_status = 'registered';

  // ✅ KEEP SERVICES IF SENT
  data.services_offered = data.services_offered || [];

  /* ================= CREATE ================= */
  const freelancer = await Freelancer.create(data);

  await freelancer.populate([
    { path: 'role' },
    { path: 'services_offered.service' },
    { path: 'payment.preferred_currency' }
  ]);

  /* ================= RESPONSE ================= */
  res.status(StatusCodes.CREATED).json({
    success: true,
    message: 'Registration successful. Awaiting admin approval.',
    freelancer: {
      _id: freelancer._id,
      email: freelancer.email,
      full_name: freelancer.full_name,
      onboarding_status: freelancer.onboarding_status,
  
    }
  });
});



// === GET ALL FREELANCERS (Admin) ===
exports.getAllFreelancers = asyncHandler(async (req, res) => {
  const { page = 1, limit, status, city, service } = req.query;

  const query = {};

  if (status !== undefined) query['status_info.status'] = Number(status);
  if (city) query['location.city'] = { $regex: city, $options: 'i' };
 if (service && mongoose.Types.ObjectId.isValid(service)) {
    query['services_offered.service'] = service;
  }

  let freelancersQuery = Freelancer.find(query)
    .select('-password')
    .populate('role', 'name')
 .populate({
        path: 'services_offered.service',
        select: 'name description'
      })    .populate('payment.preferred_currency', 'code symbol')
    .sort({ createdAt: -1 });

  let pagination = null;
  if (limit) {
    const pageNum = Math.max(Number(page), 1);
    const limitNum = Math.max(Number(limit), 1);
    freelancersQuery = freelancersQuery.skip((pageNum - 1) * limitNum).limit(limitNum);

    const total = await Freelancer.countDocuments(query);
    pagination = { page: pageNum, limit: limitNum, total, totalPages: Math.ceil(total / limitNum) };
  }

  const freelancers = await freelancersQuery.lean();

  res.status(StatusCodes.OK).json({ success: true, freelancers, pagination });
});
// === GET PROFILE (Logged-in Freelancer) ===
exports.getFreelancerProfile = asyncHandler(async (req, res) => {
  console.log(req.user.id)
  const freelancer = await Freelancer.findById(req.user.id)
    .select('-password')
    .populate('role', 'name')
    .populate({
      path: 'services_offered.service',
      select: 'name description'
    })
    .populate('payment.preferred_currency', 'code symbol')
    .lean();


  res.status(StatusCodes.OK).json({
    success: true,
    freelancer
  });
});

// === UPDATE PROFILE ===
// controller.js
exports.updateFreelancerProfile = asyncHandler(async (req, res) => {
  const freelancer = await Freelancer.findById(req.user.id);
  if (!freelancer) throw new APIError('Freelancer not found', StatusCodes.NOT_FOUND);

  const data = req.body;

  // 1. Handle Nested Objects (Parsing JSON strings from FormData)
  if (data.name) freelancer.name = typeof data.name === 'string' ? JSON.parse(data.name) : data.name;
  if (data.professional) freelancer.professional = typeof data.professional === 'string' ? JSON.parse(data.professional) : data.professional;
  if (data.location) freelancer.location = typeof data.location === 'string' ? JSON.parse(data.location) : data.location;
  if (data.payment) freelancer.payment = typeof data.payment === 'string' ? JSON.parse(data.payment) : data.payment;
  
  // 2. Handle Languages
  if (data.languages) {
    freelancer.languages = typeof data.languages === 'string' ? JSON.parse(data.languages) : data.languages;
  }

  // 3. Handle Services Offered (The Rate Card Data)
  if (data.services_offered) {
    const services = typeof data.services_offered === 'string' ? JSON.parse(data.services_offered) : data.services_offered;
    // Map services to ensure they match the service_schema (service, price_range, unit)
    freelancer.services_offered = services.map(s => ({
      service: s.service?._id || s.service,
      description: s.description,
      price_range: s.price_range,
      unit: s.unit,
      is_active: s.is_active !== false
    }));
  }

  // 4. Handle Profile Image
  if (req.files?.profile_image?.[0]) {
    freelancer.profile_image = req.files.profile_image[0].path;
  }

  // 5. Handle Document Uploads (Appending new docs to existing ones)
  const docTypes = ['resume', 'identityProof', 'addressProof', 'certificate'];
  docTypes.forEach(type => {
    if (req.files?.[type]?.[0]) {
      // Remove old doc of same type if it exists or just push new
      freelancer.documents = freelancer.documents.filter(d => d.type !== type);
      freelancer.documents.push({
        type: type,
        path: req.files[type][0].path,
        uploaded_at: new Date()
      });
    }
  });

  // 6. Onboarding status logic
  const hasRequiredDocs = freelancer.documents.some(d => d.type === 'identityProof') && 
                          freelancer.documents.some(d => d.type === 'addressProof');
  const hasServices = freelancer.services_offered.length > 0;

  if (freelancer.onboarding_status !== 'approved') {
    freelancer.onboarding_status = (hasRequiredDocs && hasServices && freelancer.location?.city)
      ? 'profile_submitted'
      : 'profile_incomplete';
  }

  await freelancer.save();
  
  // Populate for the frontend response
  await freelancer.populate([
    { path: 'role' },
    { path: 'services_offered.service' },
    { path: 'payment.preferred_currency' }
  ]);

  res.status(StatusCodes.OK).json({
    success: true,
    message: 'Profile updated successfully',
    onboarding_status: freelancer.onboarding_status,
    freelancer
  });
});
// === ADD / UPDATE RATE CARD ===
exports.addRateCard = asyncHandler(async (req, res) => {
  const freelancerId = req.user?.id || req.user?._id;
  if (!freelancerId) {
    throw new APIError('Unauthorized', StatusCodes.UNAUTHORIZED);
  }

  const { serviceId, price_range, unit, description } = req.body;

  if (!serviceId || !price_range) {
    throw new APIError(
      'serviceId and price_range are required',
      StatusCodes.BAD_REQUEST
    );
  }

  if (!mongoose.Types.ObjectId.isValid(serviceId)) {
    throw new APIError('Invalid serviceId', StatusCodes.BAD_REQUEST);
  }

  const freelancer = await Freelancer.findById(freelancerId);
  if (!freelancer) {
    throw new APIError('Freelancer not found', StatusCodes.NOT_FOUND);
  }

  // 🔍 Find service inside services_offered
  const serviceItem = freelancer.services_offered.find(
    s => s.service.toString() === serviceId
  );

  if (!serviceItem) {
    throw new APIError(
      'Service not found in freelancer services',
      StatusCodes.NOT_FOUND
    );
  }

  // ✅ Update rate card fields
  serviceItem.price_range = price_range.trim();

  if (unit) serviceItem.unit = unit.trim();
  if (description) serviceItem.description = description.trim();

  await freelancer.save();

  res.status(StatusCodes.OK).json({
    success: true,
    message: 'Rate card updated successfully',
    rate_card: serviceItem
  });
});

// === ADMIN: UPDATE STATUS ===
exports.updateFreelancerStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status, rejection_reason } = req.body;

  const freelancer = await Freelancer.findById(id);
  if (!freelancer) throw new APIError('Not found', StatusCodes.NOT_FOUND);

  freelancer.status_info.status = Number(status);
  if (status == 1) {
    freelancer.status_info.approved_at = new Date();
    freelancer.status_info.approved_by = req.user._id;
    freelancer.onboarding_status = 'approved';
  } else if (status == 2) {
    freelancer.status_info.rejected_at = new Date();
    freelancer.status_info.rejected_by = req.user._id;
    freelancer.status_info.rejection_reason = rejection_reason;
    freelancer.onboarding_status = 'rejected';
  }

  await freelancer.save();

  res.status(StatusCodes.OK).json({
    success: true,
    message: 'Status updated',
    onboarding_status: freelancer.onboarding_status
  });
});