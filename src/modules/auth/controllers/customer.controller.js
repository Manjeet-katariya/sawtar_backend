const winston = require('winston');
const Customer = require('../models/Customer/customer.model');
const { StatusCodes } = require('../../../utils/constants/statusCodes');
const { APIError } = require('../../../utils/errorHandler');
const asyncHandler = require('../../../utils/asyncHandler');
const bcrypt = require('bcryptjs');
const { createToken } = require('../../../middleware/auth');
const { Role } = require('../models/role/role.model');

// Configure Winston logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'logs/customer.log' }),
    new winston.transports.Console(),
  ],
});

// Customer Login
exports.customerLogin = asyncHandler(async (req, res, next) => {
  const { email, password } = req.body;

  // Validate input
  if (!email || !password) {
    throw new APIError('Email and password are required', StatusCodes.BAD_REQUEST);
  }

  // Find customer and select password
  const customer = await Customer.findOne({ email: email.toLowerCase().trim() })
    .select('+password')
    .populate({ path: 'role', model: Role });

  if (!customer) {
    logger.warn(`Failed login attempt for email: ${email}`);
    throw new APIError('Invalid credentials', StatusCodes.UNAUTHORIZED);
  }

  // Compare hashed password
  const isMatch = await customer.comparePassword(password);
  if (!isMatch) {
    logger.warn(`Invalid password attempt for customer: ${customer._id}`);
    throw new APIError('Invalid credentials', StatusCodes.UNAUTHORIZED);
  }

  // Generate token
  const token = createToken(customer);

  // Remove password from response
  const customerResponse = customer.toObject();
  delete customerResponse.password;

  logger.info(`Customer logged in successfully: ${customer._id}`);

  res.status(StatusCodes.OK).json({
    success: true,
    message: 'Login successful',
    token,
    customer: customerResponse,
  });
});

// Create Customer
exports.createCustomer = asyncHandler(async (req, res, next) => {
  const customerData = req.body;

  // Validate required fields
  if (!customerData.email || !customerData.name || !customerData.password) {
    throw new APIError('Name, email, and password are required', StatusCodes.BAD_REQUEST);
  }

  // Normalize email
  customerData.email = customerData.email.toLowerCase().trim();

  // Check for duplicate email
  const existingCustomer = await Customer.findOne({ email: customerData.email });
  if (existingCustomer) {
    logger.warn(`Customer creation failed: Duplicate email - ${customerData.email}`);
    throw new APIError('Email already exists', StatusCodes.CONFLICT);
  }

  // Assign Customer role
  const customerRole = await Role.findOne({ name: 'Customer' });
  if (!customerRole) {
    throw new APIError('Customer role not available', StatusCodes.INTERNAL_SERVER_ERROR);
  }
  customerData.role = customerRole._id;

  // Handle profile image upload
  if (req.files && req.files.profileImage) {
    customerData.profile_image = req.files.profileImage[0].path;
  } else if (req.file) {
    // Handle single file upload
    customerData.profile_image = req.file.path;
  }

  // Set agreed_to_terms
  customerData.meta = customerData.meta || {};
  customerData.meta.agreed_to_terms = customerData.agreed_to_terms || false;

  // Create customer
  const customer = await Customer.create(customerData);

  // Log creation in change history
  customer.meta.change_history = customer.meta.change_history || [];
  customer.meta.change_history.push({
    updated_by: req.user?._id || 'system',
    updated_at: new Date(),
    changes: ['Customer created'],
  });
  await customer.save();

  logger.info(`Customer created successfully: ${customer._id}`);

  // Remove password from response
  const customerResponse = customer.toObject();
  delete customerResponse.password;

  res.status(StatusCodes.CREATED).json({
    success: true,
    message: 'Customer created successfully',
    data: {
      customer: {
        id: customer._id,
        email: customer.email,
        name: customer.name,
        profile_image: customer.profile_image,
      },
    },
  });
});

// Get Customer Profile
exports.getCustomerProfile = asyncHandler(async (req, res, next) => {
  
  const customer = await Customer.findById(req.user.id).populate('role').lean();
  if (!customer) {
    throw new APIError('Customer not found', StatusCodes.NOT_FOUND);
  }

  delete customer.password;

  res.status(StatusCodes.OK).json({
    success: true,
    customer,
  });
});

// Update Customer Profile
exports.updateCustomerProfile = asyncHandler(async (req, res, next) => {
  if (!req.user || !req.user.id) {
    logger.warn('Unauthorized customer update attempt');
    throw new APIError('Unauthorized', StatusCodes.UNAUTHORIZED);
  }

  const customer = await Customer.findById(req.user.id);
  if (!customer) {
    logger.warn(`Customer not found for update: ${req.user.id}`);
    throw new APIError('Customer not found', StatusCodes.NOT_FOUND);
  }

  const updatedData = req.body;

  // Check for duplicate email if email is being updated
  if (updatedData.email) {
    updatedData.email = updatedData.email.toLowerCase().trim();
    if (updatedData.email !== customer.email) {
      const existingCustomer = await Customer.findOne({ email: updatedData.email });
      if (existingCustomer) {
        logger.warn(`Update failed: Email already in use - ${updatedData.email}`);
        throw new APIError('Email already in use', StatusCodes.CONFLICT);
      }
    }
  }

  // Handle profile image upload
  if (req.files && req.files.profileImage) {
    updatedData.profile_image = req.files.profileImage[0].path;
  } else if (req.file) {
    updatedData.profile_image = req.file.path;
  }

  // Update customer data
  Object.keys(updatedData).forEach(key => {
    if (key !== 'password') { // Don't allow password update via this endpoint
      customer[key] = updatedData[key];
    }
  });

  customer.meta.updated_at = new Date();
  customer.meta.change_history = customer.meta.change_history || [];
  customer.meta.change_history.push({
    updated_by: req.user._id,
    updated_at: new Date(),
    changes: Object.keys(updatedData).map((key) => `${key} updated`),
  });

  const updatedCustomer = await customer.save();

  logger.info(`Customer updated successfully: ${customer._id}`);
  
  // Remove password from response
  const customerResponse = updatedCustomer.toObject();
  delete customerResponse.password;

  res.status(StatusCodes.OK).json({
    success: true,
    message: 'Customer updated successfully',
    customer: customerResponse,
  });
});

// Change Password
exports.changePassword = asyncHandler(async (req, res, next) => {
  const { currentPassword, newPassword, confirmPassword } = req.body;

  if (!req.user || !req.user.id) {
    throw new APIError('Unauthorized', StatusCodes.UNAUTHORIZED);
  }

  if (!currentPassword || !newPassword || !confirmPassword) {
    throw new APIError('All password fields are required', StatusCodes.BAD_REQUEST);
  }

  if (newPassword !== confirmPassword) {
    throw new APIError('New passwords do not match', StatusCodes.BAD_REQUEST);
  }

  const customer = await Customer.findById(req.user.id).select('+password');
  if (!customer) {
    throw new APIError('Customer not found', StatusCodes.NOT_FOUND);
  }

  const isMatch = await customer.comparePassword(currentPassword);
  if (!isMatch) {
    logger.warn(`Invalid current password attempt for customer: ${customer._id}`);
    throw new APIError('Current password is incorrect', StatusCodes.UNAUTHORIZED);
  }

  customer.password = newPassword; // Let the model handle hashing
  customer.meta.updated_at = new Date();
  customer.meta.change_history = customer.meta.change_history || [];
  customer.meta.change_history.push({
    updated_by: req.user._id,
    updated_at: new Date(),
    changes: ['Password changed'],
  });

  await customer.save();

  logger.info(`Password changed successfully for customer: ${customer._id}`);
  res.status(StatusCodes.OK).json({
    success: true,
    message: 'Password changed successfully',
  });
});