// validations/freelancer/freelancer.validation.js

const { body, query, param, validationResult } = require('express-validator');
const { StatusCodes } = require('../../../../utils/constants/statusCodes');
const Freelancer = require('../../models/Freelancer/freelancer.model');
const mongoose = require('mongoose');

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(StatusCodes.BAD_REQUEST).json({
      success: false,
      statusCode: StatusCodes.BAD_REQUEST,
      message: 'Validation failed',
      errors: errors.array().map(err => ({
        field: err.path,
        message: err.msg
      }))
    });
  }
  next();
};

const isValidObjectId = (value, fieldName) => {
  if (!mongoose.Types.ObjectId.isValid(value)) {
    throw new Error(`${fieldName} must be a valid MongoDB ObjectId`);
  }
  return true;
};

// Send OTP validation (if needed, though not in routes)
exports.validateSendOtp = [
  body('mobile')
    .trim()
    .notEmpty().withMessage('Mobile number is required')
    .isMobilePhone('any').withMessage('Invalid mobile number'),
  validate
];

// Verify OTP validation (if needed)
exports.validateVerifyOtp = [
  body('mobile')
    .trim()
    .notEmpty().withMessage('Mobile number is required')
    .isMobilePhone('any').withMessage('Invalid mobile number'),
  body('otp')
    .trim()
    .notEmpty().withMessage('OTP is required')
    .isLength({ min: 4, max: 6 }).withMessage('OTP must be between 4 and 6 digits'),
  validate
];

// Create freelancer validation
exports.validateCreateFreelancer = [
  body('email')
    .trim()
    .notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Invalid email format')
    .normalizeEmail()
    .custom(async (email) => {
      const existingFreelancer = await Freelancer.findOne({ email });
      if (existingFreelancer) {
        throw new Error('Email already in use');
      }
      return true;
    }),
  body('password')
    .trim()
    .notEmpty().withMessage('Password is required')
    .isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('confirmPassword')
    .trim()
    .notEmpty().withMessage('Confirm password is required')
    .custom((value, { req }) => {
      if (value !== req.body.password) {
        throw new Error('Passwords do not match');
      }
      return true;
    }),
  body('full_name')
    .trim()
    .notEmpty().withMessage('Full name is required'),
  body('mobile')
    .trim()
    .notEmpty().withMessage('Mobile number is required')
    .isMobilePhone('any').withMessage('Invalid mobile number')
    .custom(async (mobile) => {
      const existingFreelancer = await Freelancer.findOne({ mobile });
      if (existingFreelancer) {
        throw new Error('Mobile number already in use');
      }
      return true;
    }),
  body('is_mobile_verified')
    .toBoolean()
    .isBoolean().withMessage('isMobileVerified must be boolean')
    .custom((value) => {
      if (!value) {
        throw new Error('Mobile must be verified');
      }
      return true;
    }),
  body('servicesOffered')
    .customSanitizer(value => {
      if (typeof value === 'string') {
        try {
          return JSON.parse(value);
        } catch (e) {
          return [];
        }
      }
      return value;
    })
    .isArray({ min: 1 }).withMessage('At least one service is required')
    .custom((services) => {
      for (const service of services) {
        if (!service.title || typeof service.title !== 'string') {
          throw new Error('Each service must have a valid title');
        }
      }
      return true;
    }),
  body('availability')
    .optional()
    .trim()
    .notEmpty().withMessage('Availability cannot be empty'),
  body('location.city')
    .optional()
    .trim(),
  body('location.state')
    .optional()
    .trim(),
  body('location.country')
    .optional()
    .trim(),
  body('location.pincode')
    .optional()
    .trim(),
  body('languages')
    .optional()
    .isArray().withMessage('Languages must be an array'),
  body('contacts.primary_contact.name')
    .optional()
    .trim(),
  body('contacts.primary_contact.designation')
    .optional()
    .trim(),
  body('contacts.primary_contact.email')
    .optional()
    .trim()
    .isEmail().withMessage('Invalid primary contact email'),
  body('contacts.primary_contact.mobile')
    .optional()
    .trim()
    .isMobilePhone('any').withMessage('Invalid primary contact mobile'),
  body('documents')
    .custom((value, { req }) => {
      const allowedTypes = ['image/jpeg', 'image/png', 'application/pdf'];
      const maxSize = 5 * 1024 * 1024; // 5MB
      const documentTypes = ['resume', 'portfolio', 'certificates', 'identityProof', 'addressProof'];

      if (!req.files || !Object.keys(req.files).some(key => documentTypes.includes(key))) {
        throw new Error('At least one document is required');
      }

      Object.keys(req.files).forEach(fileType => {
        if (documentTypes.includes(fileType)) {
          const files = Array.isArray(req.files[fileType]) ? req.files[fileType] : [req.files[fileType]];
          files.forEach(file => {
            if (!allowedTypes.includes(file.mimetype)) {
              throw new Error(`Document ${fileType} must be JPEG, PNG, or PDF`);
            }
            if (file.size > maxSize) {
              throw new Error(`Document ${fileType} size must be less than 5MB`);
            }
          });
        }
      });

      return true;
    }),
  body('meta.agreed_to_terms')
    .toBoolean()
    .isBoolean().withMessage('Agreed to terms must be boolean')
    .custom(value => {
      if (!value) {
        throw new Error('You must agree to the terms');
      }
      return true;
    }),
  validate
];

// Freelancer login validation
exports.validateFreelancerLogin = [
  body('email')
    .trim()
    .notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Invalid email format'),
  body('password')
    .trim()
    .notEmpty().withMessage('Password is required'),
  validate
];

// Get all freelancers validation
exports.validateGetAllFreelancers = [
  query('page')
    .optional()
    .isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1 }).withMessage('Limit must be a positive integer'),
  query('status')
    .optional()
    .isIn(['0', '1', '2', '3']).withMessage('Invalid status (must be 0, 1, 2 or 3)'),
  validate
];

// Freelancer ID validation
exports.validateFreelancerId = [
  param('id')
    .custom(value => isValidObjectId(value, 'Freelancer ID')),
  validate
];

// Update freelancer status validation
exports.validateUpdateFreelancerStatus = [
  param('id')
    .custom(value => isValidObjectId(value, 'Freelancer ID')),
  body('status')
    .notEmpty().withMessage('Status is required')
    .isIn(['0', '1', '2', '3']).withMessage('Invalid status (must be 0, 1, 2 or 3)'),
  body('rejection_reason')
    .optional()
    .trim()
    .isLength({ max: 500 }).withMessage('Rejection reason must not exceed 500 characters'),
  validate
];

// Update freelancer validation
exports.validateUpdateFreelancer = [
  param('id')
    .custom(value => isValidObjectId(value, 'Freelancer ID')),
  body('full_name')
    .optional()
    .trim()
    .notEmpty().withMessage('Full name cannot be empty'),
  body('mobile')
    .optional()
    .trim()
    .isMobilePhone('any').withMessage('Invalid mobile number')
    .custom(async (mobile, { req }) => {
      const freelancer = await Freelancer.findOne({ mobile, _id: { $ne: req.params.id } });
      if (freelancer) {
        throw new Error('Mobile number already in use');
      }
      return true;
    }),
  body('servicesOffered')
    .optional()
    .isArray({ min: 1 }).withMessage('At least one service is required')
    .custom((services) => {
      for (const service of services) {
        if (!service.title || typeof service.title !== 'string') {
          throw new Error('Each service must have a valid title');
        }
      }
      return true;
    }),
  body('availability')
    .optional()
    .trim()
    .notEmpty().withMessage('Availability cannot be empty'),
  body('location.city')
    .optional()
    .trim(),
  body('location.state')
    .optional()
    .trim(),
  body('location.country')
    .optional()
    .trim(),
  body('location.pincode')
    .optional()
    .trim(),
  body('languages')
    .optional()
    .isArray().withMessage('Languages must be an array'),
  body('contacts.primary_contact.name')
    .optional()
    .trim(),
  body('contacts.primary_contact.designation')
    .optional()
    .trim(),
  body('contacts.primary_contact.email')
    .optional()
    .trim()
    .isEmail().withMessage('Invalid primary contact email'),
  body('contacts.primary_contact.mobile')
    .optional()
    .trim()
    .isMobilePhone('any').withMessage('Invalid primary contact mobile'),
  body('meta.agreed_to_terms')
    .optional()
    .toBoolean()
    .isBoolean().withMessage('Agreed to terms must be boolean'),
  validate
];

// Update document verification validation
exports.validateUpdateDocumentVerification = [
  body('freelancerId')
    .notEmpty()
    .withMessage('Freelancer ID is required')
    .custom((value) => isValidObjectId(value, 'Freelancer ID')),
  body('documentId')
    .notEmpty()
    .withMessage('Document ID is required')
    .custom((value) => isValidObjectId(value, 'Document ID')),
  body('verified')
    .toBoolean()
    .isBoolean()
    .withMessage('Verified must be a boolean value'),
  body('reason')
    .if((value, { req }) => req.body.verified === false)
    .notEmpty()
    .withMessage('Reason is required when document is rejected')
    .trim()
    .isLength({ max: 500 })
    .withMessage('Reason must not exceed 500 characters'),
  body('suggestion')
    .if((value, { req }) => req.body.verified === false)
    .notEmpty()
    .withMessage('Suggestion is required when document is rejected')
    .trim()
    .isLength({ max: 500 })
    .withMessage('Suggestion must not exceed 500 characters'),
  body('reason')
    .if((value, { req }) => req.body.verified === true)
    .isEmpty()
    .withMessage('Reason must be empty when document is verified'),
  body('suggestion')
    .if((value, { req }) => req.body.verified === true)
    .isEmpty()
    .withMessage('Suggestion must be empty when document is verified'),
  validate
];

// Change password validation
exports.validateChangePassword = [
  body('currentPassword')
    .trim()
    .notEmpty().withMessage('Current password is required'),
  body('newPassword')
    .trim()
    .notEmpty().withMessage('New password is required')
    .isLength({ min: 6 }).withMessage('New password must be at least 6 characters'),
  body('confirmPassword')
    .trim()
    .notEmpty().withMessage('Confirm password is required')
    .custom((value, { req }) => {
      if (value !== req.body.newPassword) {
        throw new Error('Passwords do not match');
      }
      return true;
    }),
  validate
];

// Update document validation
exports.validateUpdateDocument = [
  param('documentId')
    .custom(value => isValidObjectId(value, 'Document ID')),
  body('file')
    .custom((value, { req }) => {
      if (!req.file) {
        throw new Error('File is required');
      }
      const allowedTypes = ['image/jpeg', 'image/png', 'application/pdf'];
      if (!allowedTypes.includes(req.file.mimetype)) {
        throw new Error('Invalid file type. Only JPEG, PNG, and PDF are allowed');
      }
      const maxSize = 5 * 1024 * 1024; // 5MB
      if (req.file.size > maxSize) {
        throw new Error('File size exceeds 5MB limit');
      }
      return true;
    }),
  validate
];