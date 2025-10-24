const winston = require('winston');
const VendorB2C = require('../../models/Vendor/B2cvendor.model');
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
    new winston.transports.File({ filename: 'logs/vendor.log' }),
    new winston.transports.Console()
  ]
});

// Vendor Login
exports.vendorLogin = asyncHandler(async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // Find vendor and populate role
    const vendor = await VendorB2C.findOne({ email })
      .select('+password')
      .populate({
        path: 'role',
        model: Role,
      });

    if (!vendor) {
      throw new APIError('Invalid credentials', StatusCodes.UNAUTHORIZED);
    }

    // Compare hashed password
    const isMatch = await bcrypt.compare(password, vendor.password);
    if (!isMatch) {
      throw new APIError('Invalid credentials', StatusCodes.UNAUTHORIZED);
    }

    // Generate token
    const token = createToken(vendor);

    // Convert to object & remove password
    const vendorResponse = vendor.toObject();
    delete vendorResponse.password;

    res.status(StatusCodes.OK).json({
      success: true,
      message: 'Login successful',
      token,
      vendor: vendorResponse,
    });
  } catch (error) {
    if (!error.message) error.message = 'Unidentified error';
    next(error);
  }
});

// Create Vendor
exports.createVendor = asyncHandler(async (req, res, next) => {
  const vendorData = req.body;

  // Validate required fields
  if (!vendorData.email) {
    throw new APIError('Email is required', StatusCodes.BAD_REQUEST);
  }

  // Check duplicate vendor
  const existingVendor = await VendorB2C.findOne({
    $or: [
      { email: vendorData.email.toLowerCase().trim() },
      { mobile: vendorData.mobile }
    ]
  });

  if (existingVendor) {
    if (existingVendor.email === vendorData.email.toLowerCase().trim()) {
      logger.warn(`Vendor creation failed: Duplicate email - ${vendorData.email}`);
      throw new APIError('Vendor email already exists', StatusCodes.CONFLICT);
    }
    if (existingVendor.mobile === vendorData.mobile) {
      logger.warn(`Vendor creation failed: Duplicate mobile - ${vendorData.mobile}`);
      throw new APIError('Vendor mobile number already exists', StatusCodes.CONFLICT);
    }
  }

  // Mobile verification check
  if (!vendorData.is_mobile_verified) {
    throw new APIError('Mobile must be verified', StatusCodes.BAD_REQUEST);
  }

  const vendorRole = await Role.findOne({ name: 'Vendor-B2C' });
  if (!vendorRole) {
    throw new APIError('Vendor role not available', StatusCodes.NOT_FOUND);
  }
  vendorData.role = vendorRole._id;

  // Ensure status_info exists
  vendorData.status_info = vendorData.status_info || {};
  vendorData.status_info.status = 0; // 0 = pending

  // Hash password
  vendorData.password = await bcrypt.hash(vendorData.password, 10);

  // Parse categories if sent as string
  if (vendorData.store_details && vendorData.store_details.categories) {
    let parsedCategories = vendorData.store_details.categories;
    if (typeof parsedCategories === 'string') {
      try {
        parsedCategories = JSON.parse(parsedCategories);
        vendorData.store_details.categories = parsedCategories;
      } catch (error) {
        throw new APIError('Invalid categories format', StatusCodes.BAD_REQUEST);
      }
    }

    // Validate categories structure
    if (!Array.isArray(vendorData.store_details.categories) ||
        vendorData.store_details.categories.length === 0) {
      throw new APIError('At least one category is required', StatusCodes.BAD_REQUEST);
    }

    for (const category of vendorData.store_details.categories) {
      if (!category.name || typeof category.name !== 'string') {
        throw new APIError('Each category must have a valid name', StatusCodes.BAD_REQUEST);
      }
    }
  }

  // Handle logo upload
  if (req.files && req.files.logo) {
    vendorData.store_details = vendorData.store_details || {};
    vendorData.store_details.logo = req.files.logo[0].path;
  }

  // Handle uploaded documents
  vendorData.documents = {};

  if (req.files) {
    const fileHandlers = {
      identityProof: () => {
        vendorData.documents.identity_proof = {
          type: 'identity_proof',
          path: req.files.identityProof[0].path,
          verified: false,
          uploaded_at: new Date()
        };
      },
      addressProof: () => {
        vendorData.documents.address_proof = {
          type: 'address_proof',
          path: req.files.addressProof[0].path,
          verified: false,
          uploaded_at: new Date()
        };
      },
      gstCertificate: () => {
        vendorData.documents.gst_certificate = {
          type: 'gst_certificate',
          path: req.files.gstCertificate[0].path,
          verified: false,
          uploaded_at: new Date()
        };
      }
    };

    Object.keys(req.files).forEach(fileType => {
      if (fileHandlers[fileType]) {
        fileHandlers[fileType]();
      }
    });
  }

  // Validate at least one document is provided
  const hasDocuments = Object.keys(vendorData.documents).some(key => {
    const doc = vendorData.documents[key];
    return doc !== undefined;
  });

  if (!hasDocuments) {
    throw new APIError('At least one document is required', StatusCodes.BAD_REQUEST);
  }

  try {
    // Create vendor
    const vendor = await VendorB2C.create(vendorData);

    // Log creation in change history
    vendor.meta.change_history = vendor.meta.change_history || [];
    vendor.meta.change_history.push({
      updated_by: req.user?._id || null, // If created by admin, req.user may be available
      updated_at: new Date(),
      changes: ['Vendor created']
    });
    await vendor.save();

    logger.info(`Vendor created successfully: ${vendor._id}`);

    res.status(StatusCodes.CREATED).json({
      success: true,
      message: 'Vendor created successfully',
      data: {
        vendor: {
          id: vendor._id,
          email: vendor.email,
          full_name: vendor.full_name,
          store_details: vendor.store_details,
          status: vendor.status_info.status
        }
      }
    });
  } catch (error) {
    logger.error(`Vendor creation failed: ${error.message}`);

    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => err.message);
      throw new APIError(`Validation failed: ${errors.join(', ')}`, StatusCodes.BAD_REQUEST);
    }

    if (error.code === 11000) {
      const field = Object.keys(error.keyValue)[0];
      throw new APIError(`${field} already exists`, StatusCodes.CONFLICT);
    }

    throw new APIError('Server error while creating vendor', StatusCodes.INTERNAL_SERVER_ERROR);
  }
});

// Get All Vendors
exports.getAllVendors = asyncHandler(async (req, res, next) => {
  const { page = 1, limit = 10, status, vendorId } = req.query;

  if (vendorId) {
    try {
      const vendor = await VendorB2C.findById(vendorId)
        .select('-password')
        .lean();

      if (!vendor) {
        return res.status(StatusCodes.NOT_FOUND).json({
          success: false,
          message: 'Vendor not found'
        });
      }

      logger.info(`Retrieved vendor with ID: ${vendorId}`);
      return res.status(StatusCodes.OK).json({
        success: true,
        vendor
      });
    } catch (error) {
      if (error.name === 'CastError') {
        return res.status(StatusCodes.BAD_REQUEST).json({
          success: false,
          message: 'Invalid vendor ID format'
        });
      }
      next(error);
    }
  }

  const query = status ? { 'status_info.status': parseInt(status) } : {};

  const vendors = await VendorB2C.find(query)
    .select('-password')
    .skip((page - 1) * limit)
    .limit(Number(limit))
    .lean();

  const total = await VendorB2C.countDocuments(query);

  logger.info(`Retrieved ${vendors.length} vendors`);
  res.status(StatusCodes.OK).json({
    success: true,
    pagination: {
      page: Number(page),
      limit: Number(limit),
      total
    },
    vendors,
  });
});

// Get Vendor Profile
exports.getVendorProfile = asyncHandler(async (req, res, next) => {
  try {
    const vendor = await VendorB2C.findById(req.user.id).populate('role').lean();
    if (!vendor) {
      throw new APIError('Vendor not found', StatusCodes.NOT_FOUND);
    }

    delete vendor.password;

    res.status(StatusCodes.OK).json({
      success: true,
      vendor,
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

    const vendor = await VendorB2C.findById(req.user.id).select('+password');

    if (!vendor) {
      throw new APIError('Vendor not found', StatusCodes.NOT_FOUND);
    }

    const isMatch = await bcrypt.compare(currentPassword, vendor.password);
    if (!isMatch) {
      throw new APIError('Current password is incorrect', StatusCodes.UNAUTHORIZED);
    }

    vendor.password = await bcrypt.hash(newPassword, 10);

    vendor.meta.updated_at = Date.now();
    vendor.meta.change_history = vendor.meta.change_history || [];
    vendor.meta.change_history.push({
      updated_by: req.user._id,
      updated_at: new Date(),
      changes: ['Password changed']
    });

    await vendor.save();

    logger.info(`Password changed for vendor: ${vendor._id}`);
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

    const vendor = await VendorB2C.findById(req.user.id);

    if (!vendor) {
      throw new APIError('Vendor not found', StatusCodes.NOT_FOUND);
    }

    let document = null;
    let documentField = null;

    for (const [type, docField] of Object.entries(vendor.documents.toObject())) {
      if (docField && docField._id?.toString() === documentId) {
        document = vendor.documents[type];
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

    vendor.meta.updated_at = new Date();
    vendor.meta.change_history = vendor.meta.change_history || [];
    vendor.meta.change_history.push({
      updated_by: req.user._id,
      updated_at: new Date(),
      changes: [`Document ${documentField} path updated`]
    });

    await vendor.save();

    logger.info(`Document ${documentId} path updated for vendor: ${vendor._id}`);
    res.status(StatusCodes.OK).json({
      success: true,
      message: 'Document path updated successfully',
      vendor: {
        id: vendor._id,
        documents: vendor.documents
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

// Update Vendor
exports.updateVendor = asyncHandler(async (req, res, next) => {
  if (!req.user) {
    logger.warn('Unauthorized vendor update attempt');
    throw new APIError('Unauthorized: User not found', StatusCodes.UNAUTHORIZED);
  }

  const vendor = await VendorB2C.findById(req.params.id);
  if (!vendor) {
    logger.warn(`Vendor not found for update: ${req.params.id}`);
    throw new APIError('Vendor not found', StatusCodes.NOT_FOUND);
  }

  const updatedData = req.body;
  if (updatedData.email && updatedData.email !== vendor.email) {
    const existingVendor = await VendorB2C.findOne({ email: updatedData.email });
    if (existingVendor) {
      logger.warn(`Update failed: Email already in use - ${updatedData.email}`);
      throw new APIError('Email already in use', StatusCodes.CONFLICT);
    }
  }

  Object.assign(vendor, updatedData);
  vendor.meta.updated_at = Date.now();
  vendor.meta.change_history = vendor.meta.change_history || [];
  vendor.meta.change_history.push({
    updated_by: req.user._id,
    updated_at: new Date(),
    changes: Object.keys(updatedData).map(key => `${key} updated`)
  });

  const updatedVendor = await vendor.save();

  logger.info(`Vendor updated successfully: ${vendor._id}`);
  res.status(StatusCodes.OK).json({
    success: true,
    message: 'Vendor updated successfully',
    vendor: {
      id: updatedVendor._id,
      email: updatedVendor.email,
      full_name: updatedVendor.full_name,
      store_details: updatedVendor.store_details
    }
  });
});

// Delete Vendor
exports.deleteVendor = asyncHandler(async (req, res, next) => {
  if (!req.user) {
    logger.warn('Unauthorized vendor deletion attempt');
    throw new APIError('Unauthorized: User not found', StatusCodes.UNAUTHORIZED);
  }

  const vendor = await VendorB2C.findById(req.params.id);
  if (!vendor) {
    logger.warn(`Vendor not found for deletion: ${req.params.id}`);
    throw new APIError('Vendor not found', StatusCodes.NOT_FOUND);
  }

  vendor.meta.updated_at = new Date();
  vendor.meta.change_history = vendor.meta.change_history || [];
  vendor.meta.change_history.push({
    updated_by: req.user._id,
    updated_at: new Date(),
    changes: ['Vendor deleted']
  });

  await vendor.save();
  await vendor.deleteOne();

  logger.info(`Vendor deleted successfully: ${vendor._id}`);
  res.status(StatusCodes.OK).json({
    success: true,
    message: 'Vendor deleted successfully'
  });
});

// Update Vendor Status
exports.updateVendorStatus = asyncHandler(async (req, res, next) => {
  const { status, rejection_reason } = req.body;

  const vendor = await VendorB2C.findById(req.params.id);
  if (!vendor) {
    logger.warn(`Vendor not found for status update: ${req.params.id}`);
    throw new APIError('Vendor not found', StatusCodes.NOT_FOUND);
  }

  vendor.status_info.status = parseInt(status);
  vendor.status_info.rejection_reason = rejection_reason || vendor.status_info.rejection_reason;
  if (status === 1) {
    vendor.status_info.approved_at = Date.now();
    vendor.status_info.approved_by = req.user._id;
  }

  vendor.meta.updated_at = new Date();
  vendor.meta.change_history = vendor.meta.change_history || [];
  vendor.meta.change_history.push({
    updated_by: req.user._id,
    updated_at: new Date(),
    changes: [`Status updated to ${status}`]
  });

  await vendor.save();

  logger.info(`Vendor status updated: ${vendor._id}, status: ${status}`);
  res.status(StatusCodes.OK).json({
    success: true,
    message: 'Vendor status updated',
    vendor: {
      id: vendor._id,
      status_info: vendor.status_info
    }
  });
});

// Update Document Verification
exports.updateDocumentVerification = asyncHandler(async (req, res) => {
  const { vendorId, documentId, verified, reason, suggestion } = req.body;

  const vendor = await VendorB2C.findById(vendorId);
  if (!vendor) {
    throw new APIError('Vendor not found', StatusCodes.NOT_FOUND);
  }

  let document = null;
  let documentField = null;

  for (const [type, docField] of Object.entries(vendor.documents.toObject())) {
    if (docField && docField._id?.toString() === documentId) {
      document = vendor.documents[type];
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

  vendor.meta.updated_at = new Date();
  vendor.meta.change_history = vendor.meta.change_history || [];
  vendor.meta.change_history.push({
    updated_by: req.user?._id,
    updated_at: new Date(),
    changes: [
      `Document ${documentField} verification set to ${verified ? 'APPROVED' : 'REJECTED'}`
    ]
  });

  await vendor.save();

  logger.info(`Document verification updated for vendor: ${vendor._id}, document: ${documentField}`);
  res.status(StatusCodes.OK).json({
    success: true,
    message: verified
      ? 'Document approved successfully'
      : 'Document rejected, please re-upload',
    vendor: {
      id: vendor._id,
      documents: vendor.documents
    }
  });
});

// Get Change History
exports.getChangeHistory = asyncHandler(async (req, res, next) => {
  try {
    const { vendorId } = req.params;
    const { page = 1, limit = 10 } = req.query;

    const vendor = await VendorB2C.findById(vendorId)
      .select('meta.change_history')
      .lean();

    if (!vendor) {
      logger.warn(`Vendor not found for change history: ${vendorId}`);
      throw new APIError('Vendor not found', StatusCodes.NOT_FOUND);
    }

    const changeHistory = vendor.meta.change_history || [];
    const total = changeHistory.length;

    // Paginate the change history
    const startIndex = (page - 1) * limit;
    const paginatedHistory = changeHistory.slice(startIndex, startIndex + Number(limit));

    logger.info(`Retrieved change history for vendor: ${vendorId}, page: ${page}, limit: ${limit}`);
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
      logger.warn(`Invalid vendor ID format: ${vendorId}`);
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message: 'Invalid vendor ID format'
      });
    }
    if (!error.message) error.message = 'Unidentified error';
    next(error);
  }
});