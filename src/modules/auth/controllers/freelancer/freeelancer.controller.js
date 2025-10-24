// controllers/freelancer/freelancer.controller.js

const winston = require('winston');
const Freelancer = require('../../models/Freelancer/freelancer.model');
const { StatusCodes } = require('../../../../utils/constants/statusCodes');
const { APIError } = require('../../../../utils/errorHandler');
const asyncHandler = require('../../../../utils/asyncHandler');
const bcrypt = require('bcryptjs');
const { createToken } = require('../../../../middleware/auth');
const { Role } = require('../../models/role/role.model');

// Configure Winston logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'logs/freelancer.log' }),
    new winston.transports.Console()
  ]
});

// Freelancer Login
exports.freelancerLogin = asyncHandler(async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // Find freelancer and populate role
    const freelancer = await Freelancer.findOne({ email })
      .select('+password')
      .populate({
        path: 'role',
        model: Role,
      });

    if (!freelancer) {
      throw new APIError('Invalid credentials', StatusCodes.UNAUTHORIZED);
    }

    // Compare hashed password
    const isMatch = await bcrypt.compare(password, freelancer.password);
    if (!isMatch) {
      throw new APIError('Invalid credentials', StatusCodes.UNAUTHORIZED);
    }

    // Generate token
    const token = createToken(freelancer);

    // Convert to object & remove password
    const freelancerResponse = freelancer.toObject();
    delete freelancerResponse.password;

    res.status(StatusCodes.OK).json({
      success: true,
      message: 'Login successful',
      token,
      freelancer: freelancerResponse,
    });
  } catch (error) {
    if (!error.message) error.message = 'Unidentified error';
    next(error);
  }
});

// Create Freelancer
exports.createFreelancer = asyncHandler(async (req, res, next) => {
  const freelancerData = req.body;

  // Validate required fields
  if (!freelancerData.email) {
    throw new APIError('Email is required', StatusCodes.BAD_REQUEST);
  }

  // Check duplicate freelancer
  const existingFreelancer = await Freelancer.findOne({
    $or: [
      { email: freelancerData.email.toLowerCase().trim() },
      { mobile: freelancerData.mobile }
    ]
  });

  if (existingFreelancer) {
    if (existingFreelancer.email === freelancerData.email.toLowerCase().trim()) {
      logger.warn(`Freelancer creation failed: Duplicate email - ${freelancerData.email}`);
      throw new APIError('Freelancer email already exists', StatusCodes.CONFLICT);
    }
    if (existingFreelancer.mobile === freelancerData.mobile) {
      logger.warn(`Freelancer creation failed: Duplicate mobile - ${freelancerData.mobile}`);
      throw new APIError('Freelancer mobile number already exists', StatusCodes.CONFLICT);
    }
  }

  // Mobile verification check
  if (!freelancerData.is_mobile_verified) {
    throw new APIError('Mobile must be verified', StatusCodes.BAD_REQUEST);
  }

  const freelancerRole = await Role.findOne({ name: 'Freelancer' });
  if (!freelancerRole) {
    throw new APIError('Freelancer role not available', StatusCodes.NOT_FOUND);
  }
  freelancerData.role = freelancerRole._id;

  // Ensure status_info exists
  freelancerData.status_info = freelancerData.status_info || {};
  freelancerData.status_info.status = 0; // 0 = pending

  // Hash password
  freelancerData.password = await bcrypt.hash(freelancerData.password, 10);

  // Parse servicesOffered if sent as string
  if (freelancerData.servicesOffered) {
    let parsedServices = freelancerData.servicesOffered;
    if (typeof parsedServices === 'string') {
      try {
        parsedServices = JSON.parse(parsedServices);
        freelancerData.servicesOffered = parsedServices;
      } catch (error) {
        throw new APIError('Invalid servicesOffered format', StatusCodes.BAD_REQUEST);
      }
    }

    // Validate servicesOffered structure
    if (!Array.isArray(freelancerData.servicesOffered) ||
        freelancerData.servicesOffered.length === 0) {
      throw new APIError('At least one service is required', StatusCodes.BAD_REQUEST);
    }

    for (const service of freelancerData.servicesOffered) {
      if (!service.title || typeof service.title !== 'string') {
        throw new APIError('Each service must have a valid title', StatusCodes.BAD_REQUEST);
      }
    }
  }

  // Handle uploaded documents
  freelancerData.documents = {};

  if (req.files) {
    const fileHandlers = {
      resume: () => {
        freelancerData.documents.resume = {
          type: 'resume',
          path: req.files.resume[0].path,
          verified: false,
          uploaded_at: new Date()
        };
      },
      portfolio: () => {
        freelancerData.documents.portfolio = {
          type: 'portfolio',
          path: req.files.portfolio[0].path,
          verified: false,
          uploaded_at: new Date()
        };
      },
      identityProof: () => {
        freelancerData.documents.identity_proof = {
          type: 'identity_proof',
          path: req.files.identityProof[0].path,
          verified: false,
          uploaded_at: new Date()
        };
      },
      addressProof: () => {
        freelancerData.documents.address_proof = {
          type: 'address_proof',
          path: req.files.addressProof[0].path,
          verified: false,
          uploaded_at: new Date()
        };
      }
    };

    // Handle certificates as array
    if (req.files.certificates) {
      freelancerData.documents.certificates = req.files.certificates.map(file => ({
        type: 'certificate',
        path: file.path,
        verified: false,
        uploaded_at: new Date()
      }));
    }

    Object.keys(req.files).forEach(fileType => {
      if (fileHandlers[fileType]) {
        fileHandlers[fileType]();
      }
    });
  }

  // Validate at least one document is provided
  const hasDocuments = Object.keys(freelancerData.documents).some(key => {
    const doc = freelancerData.documents[key];
    if (key === 'certificates') {
      return Array.isArray(doc) && doc.length > 0;
    }
    return doc !== undefined;
  });

  if (!hasDocuments) {
    throw new APIError('At least one document is required', StatusCodes.BAD_REQUEST);
  }

  try {
    // Create freelancer
    const freelancer = await Freelancer.create(freelancerData);

    // Log creation in change history
    freelancer.meta.change_history = freelancer.meta.change_history || [];
    freelancer.meta.change_history.push({
      updated_by: req.user?._id || null, // If created by admin, req.user may be available
      updated_at: new Date(),
      changes: ['Freelancer created']
    });
    await freelancer.save();

    logger.info(`Freelancer created successfully: ${freelancer._id}`);

    res.status(StatusCodes.CREATED).json({
      success: true,
      message: 'Freelancer created successfully',
      data: {
        freelancer: {
          id: freelancer._id,
          email: freelancer.email,
          full_name: freelancer.full_name,
          servicesOffered: freelancer.servicesOffered,
          status: freelancer.status_info.status
        }
      }
    });
  } catch (error) {
    logger.error(`Freelancer creation failed: ${error.message}`);

    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => err.message);
      throw new APIError(`Validation failed: ${errors.join(', ')}`, StatusCodes.BAD_REQUEST);
    }

    if (error.code === 11000) {
      const field = Object.keys(error.keyValue)[0];
      throw new APIError(`${field} already exists`, StatusCodes.CONFLICT);
    }

    throw new APIError('Server error while creating freelancer', StatusCodes.INTERNAL_SERVER_ERROR);
  }
});

// Get All Freelancers
exports.getAllFreelancers = asyncHandler(async (req, res, next) => {
  const { page = 1, limit = 10, status, freelancerId } = req.query;

  if (freelancerId) {
    try {
      const freelancer = await Freelancer.findById(freelancerId)
        .select('-password')
        .lean();

      if (!freelancer) {
        return res.status(StatusCodes.NOT_FOUND).json({
          success: false,
          message: 'Freelancer not found'
        });
      }

      logger.info(`Retrieved freelancer with ID: ${freelancerId}`);
      return res.status(StatusCodes.OK).json({
        success: true,
        freelancer
      });
    } catch (error) {
      if (error.name === 'CastError') {
        return res.status(StatusCodes.BAD_REQUEST).json({
          success: false,
          message: 'Invalid freelancer ID format'
        });
      }
      next(error);
    }
  }

  const query = status ? { 'status_info.status': parseInt(status) } : {};

  const freelancers = await Freelancer.find(query)
    .select('-password')
    .skip((page - 1) * limit)
    .limit(Number(limit))
    .lean();

  const total = await Freelancer.countDocuments(query);

  logger.info(`Retrieved ${freelancers.length} freelancers`);
  res.status(StatusCodes.OK).json({
    success: true,
    pagination: {
      page: Number(page),
      limit: Number(limit),
      total
    },
    freelancers,
  });
});

// Get Freelancer Profile
exports.getFreelancerProfile = asyncHandler(async (req, res, next) => {
  try {
    console.log("✅ Freelancer ID from req.user:", req.user?.id); // 👈 Debug log

    const freelancer = await Freelancer.findById(req.user.id).populate('role').lean();
    if (!freelancer) {
      throw new APIError('Freelancer not found', StatusCodes.NOT_FOUND);
    }

    delete freelancer.password;

    res.status(StatusCodes.OK).json({
      success: true,
      freelancer,
    });
  } catch (error) {
    if (!error.message) error.message = 'Unidentified error';
    next(error);
  }
});

// Change Password
exports.changePassword = asyncHandler(async (req, res, next) => {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body;

    if (newPassword !== confirmPassword) {
      throw new APIError('New passwords do not match', StatusCodes.BAD_REQUEST);
    }

    const freelancer = await Freelancer.findById(req.user.id).select('+password');

    if (!freelancer) {
      throw new APIError('Freelancer not found', StatusCodes.NOT_FOUND);
    }

    const isMatch = await bcrypt.compare(currentPassword, freelancer.password);
    if (!isMatch) {
      throw new APIError('Current password is incorrect', StatusCodes.UNAUTHORIZED);
    }

    freelancer.password = await bcrypt.hash(newPassword, 10);

    freelancer.meta.updated_at = Date.now();
    freelancer.meta.change_history = freelancer.meta.change_history || [];
    freelancer.meta.change_history.push({
      updated_by: req.user._id,
      updated_at: new Date(),
      changes: ['Password changed']
    });

    await freelancer.save();

    logger.info(`Password changed for freelancer: ${freelancer._id}`);
    res.status(StatusCodes.OK).json({
      success: true,
      message: 'Password changed successfully'
    });
  } catch (error) {
    if (!error.message) error.message = 'Unidentified error';
    next(error);
  }
});

// Update Document
exports.updateDocument = asyncHandler(async (req, res, next) => {
  try {
    const { documentId } = req.params;

    if (!req.file) {
      throw new APIError('File is required for update', StatusCodes.BAD_REQUEST);
    }

    const freelancer = await Freelancer.findById(req.user.id);

    if (!freelancer) {
      throw new APIError('Freelancer not found', StatusCodes.NOT_FOUND);
    }

    let document = null;
    let documentField = null;

    for (const [type, docField] of Object.entries(freelancer.documents.toObject())) {
      if (docField && docField._id?.toString() === documentId) {
        document = freelancer.documents[type];
        documentField = type;
        break;
      }
    }

    if (!document) {
      throw new APIError('Document not found', StatusCodes.NOT_FOUND);
    }

    if (document.verified) {
      throw new APIError('Cannot update verified document', StatusCodes.FORBIDDEN);
    }

    document.path = req.file.path;
    document.uploaded_at = new Date();

    freelancer.meta.updated_at = new Date();
    freelancer.meta.change_history = freelancer.meta.change_history || [];
    freelancer.meta.change_history.push({
      updated_by: req.user._id,
      updated_at: new Date(),
      changes: [`Document ${documentField} path updated`]
    });

    await freelancer.save();

    logger.info(`Document ${documentId} path updated for freelancer: ${freelancer._id}`);
    res.status(StatusCodes.OK).json({
      success: true,
      message: 'Document path updated successfully',
      freelancer: {
        id: freelancer._id,
        documents: freelancer.documents
      }
    });
  } catch (error) {
    if (!error.message) error.message = 'Unidentified error';
    if (error instanceof multer.MulterError) {
      return next(new APIError('File upload error: ' + error.message, StatusCodes.BAD_REQUEST));
    } else if (error.message.includes('Only images')) {
      return next(new APIError(error.message, StatusCodes.BAD_REQUEST));
    }
    next(error);
  }
});

// Update Freelancer
exports.updateFreelancer = asyncHandler(async (req, res, next) => {
  if (!req.user) {
    logger.warn('Unauthorized freelancer update attempt');
    throw new APIError('Unauthorized: User not found', StatusCodes.UNAUTHORIZED);
  }

  const freelancer = await Freelancer.findById(req.params.id);
  if (!freelancer) {
    logger.warn(`Freelancer not found for update: ${req.params.id}`);
    throw new APIError('Freelancer not found', StatusCodes.NOT_FOUND);
  }

  const updatedData = req.body;
  if (updatedData.email && updatedData.email !== freelancer.email) {
    const existingFreelancer = await Freelancer.findOne({ email: updatedData.email });
    if (existingFreelancer) {
      logger.warn(`Update failed: Email already in use - ${updatedData.email}`);
      throw new APIError('Email already in use', StatusCodes.CONFLICT);
    }
  }

  Object.assign(freelancer, updatedData);
  freelancer.meta.updated_at = Date.now();
  freelancer.meta.change_history = freelancer.meta.change_history || [];
  freelancer.meta.change_history.push({
    updated_by: req.user._id,
    updated_at: new Date(),
    changes: Object.keys(updatedData).map(key => `${key} updated`)
  });

  const updatedFreelancer = await freelancer.save();

  logger.info(`Freelancer updated successfully: ${freelancer._id}`);
  res.status(StatusCodes.OK).json({
    success: true,
    message: 'Freelancer updated successfully',
    freelancer: {
      id: updatedFreelancer._id,
      email: updatedFreelancer.email,
      full_name: updatedFreelancer.full_name,
      servicesOffered: updatedFreelancer.servicesOffered
    }
  });
});

// Delete Freelancer
exports.deleteFreelancer = asyncHandler(async (req, res, next) => {
  if (!req.user) {
    logger.warn('Unauthorized freelancer deletion attempt');
    throw new APIError('Unauthorized: User not found', StatusCodes.UNAUTHORIZED);
  }

  const freelancer = await Freelancer.findById(req.params.id);
  if (!freelancer) {
    logger.warn(`Freelancer not found for deletion: ${req.params.id}`);
    throw new APIError('Freelancer not found', StatusCodes.NOT_FOUND);
  }

  freelancer.meta.updated_at = new Date();
  freelancer.meta.change_history = freelancer.meta.change_history || [];
  freelancer.meta.change_history.push({
    updated_by: req.user._id,
    updated_at: new Date(),
    changes: ['Freelancer deleted']
  });

  await freelancer.save();
  await freelancer.deleteOne();

  logger.info(`Freelancer deleted successfully: ${freelancer._id}`);
  res.status(StatusCodes.OK).json({
    success: true,
    message: 'Freelancer deleted successfully'
  });
});

// Update Freelancer Status
exports.updateFreelancerStatus = asyncHandler(async (req, res, next) => {
  const { status, rejection_reason } = req.body;

  const freelancer = await Freelancer.findById(req.params.id);
  if (!freelancer) {
    logger.warn(`Freelancer not found for status update: ${req.params.id}`);
    throw new APIError('Freelancer not found', StatusCodes.NOT_FOUND);
  }

  freelancer.status_info.status = parseInt(status);
  freelancer.status_info.rejection_reason = rejection_reason || freelancer.status_info.rejection_reason;
  if (status === 1) {
    freelancer.status_info.approved_at = Date.now();
    freelancer.status_info.approved_by = req.user._id;
  }

  freelancer.meta.updated_at = new Date();
  freelancer.meta.change_history = freelancer.meta.change_history || [];
  freelancer.meta.change_history.push({
    updated_by: req.user._id,
    updated_at: new Date(),
    changes: [`Status updated to ${status}`]
  });

  await freelancer.save();

  logger.info(`Freelancer status updated: ${freelancer._id}, status: ${status}`);
  res.status(StatusCodes.OK).json({
    success: true,
    message: 'Freelancer status updated',
    freelancer: {
      id: freelancer._id,
      status_info: freelancer.status_info
    }
  });
});

// Update Document Verification
exports.updateDocumentVerification = asyncHandler(async (req, res) => {
  const { freelancerId, documentId, verified, reason, suggestion } = req.body;

  const freelancer = await Freelancer.findById(freelancerId);
  if (!freelancer) {
    throw new APIError('Freelancer not found', StatusCodes.NOT_FOUND);
  }

  let document = null;
  let documentField = null;

  for (const [type, docField] of Object.entries(freelancer.documents.toObject())) {
    if (docField && docField._id?.toString() === documentId) {
      document = freelancer.documents[type];
      documentField = type;
      break;
    }
  }

  if (!document) {
    throw new APIError(
      'Document not found or not uploaded properly. Please re-upload.',
      StatusCodes.BAD_REQUEST
    );
  }

  if (verified) {
    document.verified = true;
    document.reason = null;
    document.suggestion = null;
  } else {
    document.verified = false;
    document.reason = reason || 'Document not valid';
    document.suggestion = suggestion || 'Please re-upload with correct details';
  }

  freelancer.meta.updated_at = new Date();
  freelancer.meta.change_history = freelancer.meta.change_history || [];
  freelancer.meta.change_history.push({
    updated_by: req.user?._id,
    updated_at: new Date(),
    changes: [
      `Document ${documentField} verification set to ${verified ? 'APPROVED' : 'REJECTED'}`
    ]
  });

  await freelancer.save();

  logger.info(`Document verification updated for freelancer: ${freelancer._id}, document: ${documentField}`);
  res.status(StatusCodes.OK).json({
    success: true,
    message: verified
      ? 'Document approved successfully'
      : 'Document rejected, please re-upload',
    freelancer: {
      id: freelancer._id,
      documents: freelancer.documents
    }
  });
});

// Get Change History
exports.getChangeHistory = asyncHandler(async (req, res, next) => {
  try {
    const { freelancerId } = req.params;
    const { page = 1, limit = 10 } = req.query;

    const freelancer = await Freelancer.findById(freelancerId)
      .select('meta.change_history')
      .lean();

    if (!freelancer) {
      logger.warn(`Freelancer not found for change history: ${freelancerId}`);
      throw new APIError('Freelancer not found', StatusCodes.NOT_FOUND);
    }

    const changeHistory = freelancer.meta.change_history || [];
    const total = changeHistory.length;

    // Paginate the change history
    const startIndex = (page - 1) * limit;
    const paginatedHistory = changeHistory.slice(startIndex, startIndex + Number(limit));

    logger.info(`Retrieved change history for freelancer: ${freelancerId}, page: ${page}, limit: ${limit}`);
    res.status(StatusCodes.OK).json({
      success: true,
      message: 'Change history retrieved successfully',
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total
      },
      change_history: paginatedHistory
    });
  } catch (error) {
    if (error.name === 'CastError') {
      logger.warn(`Invalid freelancer ID format: ${freelancerId}`);
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message: 'Invalid freelancer ID format'
      });
    }
    if (!error.message) error.message = 'Unidentified error';
    next(error);
  }
});