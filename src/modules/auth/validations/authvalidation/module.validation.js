const { body, param, query, validationResult } = require('express-validator');
const { StatusCodes } = require('../../../../utils/constants/statusCodes');
const { Module } = require('../../models/role/module.model');
const mongoose = require('mongoose');

// Validation middleware
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(StatusCodes.BAD_REQUEST).json({
      success: false,
      statusCode: StatusCodes.BAD_REQUEST,
      errors: errors.array().map((err) => ({
        field: err.path,
        message: err.msg
      }))
    });
  }
  next();
};

// Custom validator for MongoDB ObjectId
const isValidObjectId = (value, fieldName) => {
  if (!mongoose.Types.ObjectId.isValid(value)) {
    throw new Error(`${fieldName} must be a valid MongoDB ObjectId`);
  }
  return true;
};

// Custom validator to check if module exists
const checkModuleExistence = async (moduleId) => {
  const module = await Module.findById(moduleId);
  if (!module) {
    throw new Error('Module not found');
  }
  return true;
};

// Validation for creating modules (supports array)
exports.validateCreateModule = [
  body().custom((value) => {
    if (!Array.isArray(value) && typeof value !== 'object') {
      throw new Error('Request body must be an object or array of modules');
    }
    return true;
  }),
  body('*.name')
    .trim()
    .notEmpty()
    .withMessage('Name is required')
    .bail()
    .isLength({ max: 50 })
    .withMessage('Name cannot exceed 50 characters')
    .bail()
    .custom(async (name, { req, path }) => {
      const index = path.includes('[') ? parseInt(path.match(/\d+/)[0]) : 'single';
      const existingModule = await Module.findOne({ name });
      if (existingModule) {
        throw new Error(`Module with name "${name}" already exists at ${index}`);
      }
      return true;
    })
    .bail(),
  body('*.description')
    .optional()
    .trim()
    .isLength({ max: 300 })
    .withMessage('Description cannot exceed 300 characters')
    .bail(),
  body('*.icon')
    .optional()
    .trim()
    .bail(),
  body('*.route')
    .trim()
    .notEmpty()
    .withMessage('Route is required')
    .bail()
    .custom(async (route, { req, path }) => {
      const index = path.includes('[') ? parseInt(path.match(/\d+/)[0]) : 'single';
      const existingModule = await Module.findOne({ route });
      if (existingModule) {
        throw new Error(`Module with route "${route}" already exists at ${index}`);
      }
      return true;
    })
    .bail(),
  body('*.subModules')
    .optional()
    .isArray()
    .withMessage('subModules must be an array')
    .bail(),
  body('*.subModules.*.name')
    .if(body('*.subModules').exists())
    .trim()
    .notEmpty()
    .withMessage('Submodule name is required')
    .bail(),
  body('*.subModules.*.route')
    .if(body('*.subModules').exists())
    .trim()
    .notEmpty()
    .withMessage('Submodule route is required')
    .bail(),
  body('*.subModules.*.icon')
    .optional()
    .trim()
    .bail(),
  body('*.subModules.*.isActive')
    .optional()
    .isBoolean()
    .withMessage('Submodule isActive must be a boolean')
    .bail(),
  body('*.subModules.*.position')
    .optional()
    .isNumeric()
    .withMessage('Submodule position must be a number')
    .bail(),
  body('*.position')
    .optional()
    .isNumeric()
    .withMessage('Position must be a number')
    .bail(),
  validate
];

// Validation for updating a module
exports.validateUpdateModule = [
  param('moduleId')
    .custom((value) => isValidObjectId(value, 'Module ID'))
    .bail()
    .custom(checkModuleExistence)
    .bail(),
  body('name')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Name cannot be empty')
    .bail()
    .isLength({ max: 50 })
    .withMessage('Name cannot exceed 50 characters')
    .bail()
    .custom(async (name, { req }) => {
      const existingModule = await Module.findOne({ name, _id: { $ne: req.params.moduleId } });
      if (existingModule) {
        throw new Error('Module with this name already exists');
      }
      return true;
    })
    .bail(),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 300 })
    .withMessage('Description cannot exceed 300 characters')
    .bail(),
  body('icon')
    .optional()
    .trim()
    .bail(),
  body('route')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Route cannot be empty')
    .bail()
    .custom(async (route, { req }) => {
      const existingModule = await Module.findOne({ route, _id: { $ne: req.params.moduleId } });
      if (existingModule) {
        throw new Error('Module with this route already exists');
      }
      return true;
    })
    .bail(),
  body('subModules')
    .optional()
    .isArray()
    .withMessage('subModules must be an array')
    .bail(),
  body('subModules.*.name')
    .if(body('subModules').exists())
    .trim()
    .notEmpty()
    .withMessage('Submodule name is required')
    .bail(),
  body('subModules.*.route')
    .if(body('subModules').exists())
    .trim()
    .notEmpty()
    .withMessage('Submodule route is required')
    .bail(),
  body('subModules.*.icon')
    .optional()
    .trim()
    .bail(),
  body('subModules.*.isActive')
    .optional()
    .isBoolean()
    .withMessage('Submodule isActive must be a boolean')
    .bail(),
  body('subModules.*.position')
    .optional()
    .isNumeric()
    .withMessage('Submodule position must be a number')
    .bail(),
  body('isActive')
    .optional()
    .isBoolean()
    .withMessage('isActive must be a boolean')
    .bail(),
  body('position')
    .optional()
    .isNumeric()
    .withMessage('Position must be a number')
    .bail(),
  validate
];

// Validation for reordering modules
exports.validateReorderModules = [
  body('modules')
    .isArray()
    .withMessage('Modules must be an array'),
  body('modules.*._id')
    .custom((value) => isValidObjectId(value, 'Module ID')),
  body('modules.*.position')
    .isNumeric()
    .withMessage('Position must be a number'),
  validate
];

// Validation for deleting a module
exports.validateDeleteModule = [
  param('moduleId')
    .custom((value) => isValidObjectId(value, 'Module ID'))
    .bail()
    .custom(checkModuleExistence)
    .bail()
    .custom(async (moduleId) => {
      const { Permission } = require('../../models/role/permission.model');
      const permissions = await Permission.find({ moduleId });
      if (permissions.length > 0) {
        throw new Error('Cannot delete module with associated permissions');
      }
      return true;
    })
    .bail(),
  validate
];

// Validation for getting a single module
exports.validateGetModule = [
  param('moduleId')
    .custom((value) => isValidObjectId(value, 'Module ID'))
    .bail()
    .custom(checkModuleExistence)
    .bail(),
  validate
];

// Validation for getting all modules
exports.validateGetAllModules = [
  query('isActive')
    .optional()
    .isIn(['true', 'false'])
    .withMessage('isActive must be either "true" or "false"')
    .bail(),
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer')
    .bail(),
  query('limit')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Limit must be a positive integer')
    .bail(),
  validate
];