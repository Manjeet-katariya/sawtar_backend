// modules/auth/routes/role.routes.js
const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../../../../middleware/auth');
const { checkPermission } = require('../../../../middleware/permission');
const roleController = require('../../controllers/role/role.controller');
const {
  validateCreateRole,
  validateUpdateRole,
  validateDeleteRole,
  validateGetRole,
  validateGetAllRoles,
  validatePermanentDeleteRole,
  validateRestoreRole,
} = require('../../validations/authvalidation/role.validation');

// Create role
router.post(
  '/',
  protect,
  authorize({ minLevel: 10 }),
  checkPermission('Roles', 'create'),
  validateCreateRole,
  roleController.createRole
);

// Update role
router.put(
  '/:roleId',
  protect,
  authorize({ minLevel: 10 }),
  checkPermission('Roles', 'update'),
  validateUpdateRole,
  roleController.updateRole
);

// Soft delete role
router.delete(
  '/:roleId',
  protect,
  authorize({ minLevel: 10 }),
  checkPermission('Roles', 'delete'),
  validateDeleteRole,
  roleController.deleteRole
);

// Permanent delete role
router.delete(
  '/:roleId/permanent',
  protect,
  authorize({ minLevel: 10 }),
  checkPermission('Roles', 'delete'),
  validatePermanentDeleteRole,
  roleController.permanentDeleteRole
);

// Restore role
router.put(
  '/:roleId/restore',
  protect,
  authorize({ minLevel: 10 }),
  checkPermission('Roles', 'update'),
  validateRestoreRole,
  roleController.restoreRole
);

// Get single role
router.get(
  '/:roleId',
  protect,
  authorize({ minLevel: 5 }),
  checkPermission('Roles', 'read'),
  validateGetRole,
  roleController.getRole
);

// Get all roles
router.get(
  '/',
  protect,
  authorize({ minLevel: 5 }),
  checkPermission('Roles', 'read'),
  validateGetAllRoles,
  roleController.getAllRoles
);

module.exports = router;