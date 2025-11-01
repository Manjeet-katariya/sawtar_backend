// modules/auth/routes/permission.routes.js
const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../../../../middleware/auth');
const { checkPermission } = require('../../../../middleware/permission');
const permissionController = require('../../controllers/permission/permission.controller');
const {
  validateCreatePermission,
  validateUpdatePermission,
  validateDeletePermission,
  validateGetPermission,
  validateGetAllPermissions,
} = require('../../validations/authvalidation/permission.validation');


// Create permission
router.post(
  '/',
  protect,
  authorize({ minLevel: 10 }),
  checkPermission('Permissions', 'create'),
  validateCreatePermission,
  permissionController.createPermission
);
router.get(
  '/my',
  protect,
  authorize({ minLevel: 10 }),
  permissionController.getMyPermissions
);


// Update permission
router.put(
  '/:permissionId',
  protect,
  authorize({ minLevel: 10 }),
  checkPermission('Permissions', 'update'),
  validateUpdatePermission,
  permissionController.updatePermission
);

// Delete permission
router.delete(
  '/:permissionId',
  protect,
  authorize({ minLevel: 10 }),
  checkPermission('Permissions', 'delete'),
  validateDeletePermission,
  permissionController.deletePermission
);

// Get single permission
router.get(
  '/:permissionId',
  protect,
  authorize({ minLevel: 5 }),
  checkPermission('Permissions', 'read'),
  validateGetPermission,
  permissionController.getPermission
);

// Get all permissions
router.get(
  '/',
  // protect,
  // authorize({ minLevel: 5 }),
  // checkPermission('Permissions', 'read'),
  validateGetAllPermissions,
  permissionController.getAllPermissions
);

module.exports = router;