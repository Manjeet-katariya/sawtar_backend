// modules/services/validations/service.validation.js
const { body, param, query, validationResult } = require('express-validator');
const { StatusCodes } = require('../../../../utils/constants/statusCodes');
const { Service } = require('../../models/services/services.model'); // Fixed path
const mongoose = require('mongoose');

// Validation middleware
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(StatusCodes.BAD_REQUEST).json({
      success: false,
      status_code: StatusCodes.BAD_REQUEST,
      errors: errors.array().map((err) => ({
        field: err.path,
        message: err.msg,
      })),
    });
  }
  next();
};

// Reusable validators
const isValidObjectId = (value, fieldName) => {
  if (!mongoose.Types.ObjectId.isValid(value)) {
    throw new Error(`${fieldName} must be a valid MongoDB ObjectId`);
  }
  return true;
};

const checkServiceExistence = async (serviceId) => {
  const service = await Service.findById(serviceId);
  if (!service) throw new Error('Service not found');
  return true;
};

// Create Service
exports.validateCreateService = [
  body('name')
    .trim()
    .notEmpty().withMessage('Name is required')
    .isString().withMessage('Name must be a string')
    .isLength({ max: 50 }).withMessage('Name cannot exceed 50 characters')
    .custom(async (name) => {
      const existing = await Service.findOne({ name });
      if (existing) throw new Error('Service with this name already exists');
      return true;
    }),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 500 }).withMessage('Description cannot exceed 500 characters'),
  body('icon')
    .optional()
    .trim(),
  body('is_featured')
    .optional()
    .isBoolean().withMessage('is_featured must be a boolean'),
  validate,
];

// Update Service
exports.validateUpdateService = [
  param('service_id')
    .custom((value) => isValidObjectId(value, 'Service ID'))
    .custom(checkServiceExistence),
  body('name')
    .optional()
    .trim()
    .notEmpty().withMessage('Name cannot be empty')
    .isLength({ max: 50 })
    .custom(async (name, { req }) => {
      const existing = await Service.findOne({ name, _id: { $ne: req.params.service_id } });
      if (existing) throw new Error('Service with this name already exists');
    }),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 500 }),
  body('icon')
    .optional()
    .trim(),
  body('is_active')
    .optional()
    .isBoolean(),
  body('is_featured')
    .optional()
    .isBoolean(),
  validate,
];

// Other validations remain the same...
// validateDeleteService, validatePermanentDeleteService, validateRestoreService, validateGetService

// Get All Services - Pagination optional
exports.validateGetAllServices = [
  query('is_active')
    .optional()
    .isIn(['true', 'false']).withMessage('is_active must be "true" or "false"'),
  query('is_featured')
    .optional()
    .isIn(['true', 'false']).withMessage('is_featured must be "true" or "false"'),
  query('page')
    .optional()
    .isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1 }).withMessage('Limit must be a positive integer'),
  validate,
];

// Get Single Service
exports.validateGetService = [
  param('service_id')
    .custom((value) => isValidObjectId(value, 'Service ID'))
    .custom(checkServiceExistence),
  validate,
];

// Soft Delete
exports.validateDeleteService = [
  param('service_id')
    .custom((value) => isValidObjectId(value, 'Service ID'))
    .custom(checkServiceExistence)
    .custom(async (id) => {
      const service = await Service.findById(id);
      if (!service.is_active) throw new Error('Service is already deleted');
      return true;
    }),
  validate,
];

// Permanent Delete
exports.validatePermanentDeleteService = [
  param('service_id')
    .custom((value) => isValidObjectId(value, 'Service ID'))
    .custom(checkServiceExistence)
    .custom(async (id) => {
      const service = await Service.findById(id);
      if (service.is_active) throw new Error('Service must be soft deleted first');
      return true;
    }),
  validate,
];

// Restore
exports.validateRestoreService = [
  param('service_id')
    .custom((value) => isValidObjectId(value, 'Service ID'))
    .custom(checkServiceExistence)
    .custom(async (id) => {
      const service = await Service.findById(id);
      if (service.is_active) throw new Error('Service is already active');
      return true;
    }),
  validate,
];