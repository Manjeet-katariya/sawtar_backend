const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../../../../middleware/auth');
const { checkPermission } = require('../../../../middleware/permission');
const moduleController = require('../../controllers/module/module.controller');
const {
  validateCreateModule,
  validateUpdateModule,
  validateReorderModules,
  validateDeleteModule,
  validateGetModule,
  validateGetAllModules
} = require('../../validations/authvalidation/module.validation');

// Create module
router.post(
  '/',
  protect,
  authorize({ minLevel: 10 }),
  checkPermission('Modules', 'create'),
  validateCreateModule,
  moduleController.createModule
);

// Update module
router.put(
  '/:moduleId',
  protect,
  authorize({ minLevel: 10 }),
  checkPermission('Modules', 'update'),
  validateUpdateModule,
  moduleController.updateModule
);

// Reorder modules
router.put(
  '/reorder',
  protect,
  authorize({ minLevel: 10 }),
  checkPermission('Modules', 'update'),
  validateReorderModules,
  moduleController.reorderModules
);

// Delete module
router.delete(
  '/:moduleId',
  protect,
  authorize({ minLevel: 10 }),
  checkPermission('Modules', 'delete'),
  validateDeleteModule,
  moduleController.deleteModule
);

// Get single module
router.get(
  '/:moduleId',
  protect,
  authorize({ minLevel: 5 }),
  checkPermission('Modules', 'read'),
  validateGetModule,
  moduleController.getModule
);

// Get all modules
router.get(
  '/',
  protect,
  authorize({ minLevel: 5 }),
  checkPermission('Modules', 'read'),
  validateGetAllModules,
  moduleController.getAllModules
);

// Get menu
router.get(
  '/menu',
  protect,
  moduleController.getMenu
);

module.exports = router;