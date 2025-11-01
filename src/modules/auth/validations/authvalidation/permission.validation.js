const { body, param, query, validationResult } = require('express-validator');
const { StatusCodes } = require('../../../../utils/constants/statusCodes');
const { Permission } = require('../../models/role/permission.model');
const { Role } = require('../../models/role/role.model');
const { Module } = require('../../models/role/module.model');
const mongoose = require('mongoose');

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(StatusCodes.BAD_REQUEST).json({
      success: false,
      statusCode: StatusCodes.BAD_REQUEST,
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

exports.validateCreatePermission = [
  body().isArray().withMessage('Body must be array'),
  body('*.roleId').custom(isValidObjectId).custom(async (id, { req, path }) => {
    const i = path.match(/\d+/)[0];
    const role = await Role.findById(id);
    if (!role) throw new Error(`Role not found at [${i}]`);
    return true;
  }),
  body('*.moduleId').custom(isValidObjectId).custom(async (id, { req, path }) => {
    const i = path.match(/\d+/)[0];
    const module = await Module.findById(id);
    if (!module) throw new Error(`Module not found at [${i}]`);
    return true;
  }),
  body('*.subModuleId').optional().custom(async (id, { req, path }) => {
    if (!id) return true;
    const i = path.match(/\d+/)[0];
    const moduleId = req.body[i]?.moduleId;
    const module = await Module.findById(moduleId);
    const sub = module?.subModules.id(id);
    if (!sub || sub.isDeleted) throw new Error(`Submodule not found at [${i}]`);
    return true;
  }),
  body('*.can*').optional().isIn([0,1]),
  body().custom(async (arr) => {
    for (let i = 0; i < arr.length; i++) {
      const { roleId, moduleId, subModuleId } = arr[i];
      const exists = await Permission.findOne({ roleId, moduleId, subModuleId, isDeleted: false });
      if (exists) throw new Error(`Duplicate at index ${i}`);
    }
  }),
  validate
];

exports.validateUpdatePermission = [
  param('permissionId')
    .custom(value => isValidObjectId(value, 'Permission ID'))
    .bail()
    .custom(async permissionId => {
      const permission = await Permission.findById(permissionId);
      if (!permission) {
        throw new Error('Permission not found');
      }
      return true;
    })
    .bail(),
  body('canAdd')
    .optional()
    .isIn([0, 1])
    .withMessage('canAdd must be 0 or 1')
    .bail(),
  body('canEdit')
    .optional()
    .isIn([0, 1])
    .withMessage('canEdit must be 0 or 1')
    .bail(),
  body('canView')
    .optional()
    .isIn([0, 1])
    .withMessage('canView must be 0 or 1')
    .bail(),
  body('canDelete')
    .optional()
    .isIn([0, 1])
    .withMessage('canDelete must be 0 or 1')
    .bail(),
  body('canViewAll')
    .optional()
    .isIn([0, 1])
    .withMessage('canViewAll must be 0 or 1')
    .bail(),
  body('isActive')
    .optional()
    .isBoolean()
    .withMessage('isActive must be a boolean')
    .bail(),
  validate
];

exports.validateDeletePermission = [
  param('permissionId')
    .custom(value => isValidObjectId(value, 'Permission ID'))
    .bail()
    .custom(async permissionId => {
      const permission = await Permission.findById(permissionId);
      if (!permission) {
        throw new Error('Permission not found');
      }
      return true;
    })
    .bail(),
  validate
];

exports.validateGetPermission = [
  param('permissionId')
    .custom(value => isValidObjectId(value, 'Permission ID'))
    .bail()
    .custom(async permissionId => {
      const permission = await Permission.findById(permissionId);
      if (!permission) {
        throw new Error('Permission not found');
      }
      return true;
    })
    .bail(),
  validate
];

exports.validateGetAllPermissions = [
  query('roleId')
    .optional()
    .custom(value => isValidObjectId(value, 'Role ID'))
    .bail()
    .custom(async roleId => {
      const role = await Role.findById(roleId);
      if (!role) {
        throw new Error('Role not found');
      }
      return true;
    })
    .bail(),
  query('moduleId')
    .optional()
    .custom(value => isValidObjectId(value, 'Module ID'))
    .bail()
    .custom(async moduleId => {
      const module = await Module.findById(moduleId);
      if (!module) {
        throw new Error('Module not found');
      }
      return true;
    })
    .bail(),
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