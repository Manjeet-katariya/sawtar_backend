// routes/module.routes.js
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
  validateGetAllModules,
  validateCreateSubModule,
  validateUpdateSubModule,
  validateReorderSubModules
} = require('../../validations/authvalidation/module.validation');

/* -------------------------------------------------------------
   MODULE LEVEL
------------------------------------------------------------- */
// Create (single or bulk)
router.post(
  '/',
  protect,
  authorize({ minLevel: 10 }),
  checkPermission('Modules', 'create'),
  validateCreateModule,
  moduleController.createModule
);

// Update
router.put(
  '/:moduleId',
  protect,
  authorize({ minLevel: 10 }),
  checkPermission('Modules', 'update'),
  validateUpdateModule,
  moduleController.updateModule
);

// Reorder
router.put(
  '/reorder',
  protect,
  authorize({ minLevel: 10 }),
  checkPermission('Modules', 'update'),
  validateReorderModules,
  moduleController.reorderModules
);

// Soft-delete
router.delete(
  '/:moduleId',
  protect,
  authorize({ minLevel: 10 }),
  checkPermission('Modules', 'delete'),
  validateDeleteModule,
  moduleController.deleteModule
);

// Restore module
router.post(
  '/:moduleId/restore',
  protect,
  authorize({ minLevel: 10 }),
  checkPermission('Modules', 'update'),
  validateGetModule,                     // re-uses ID validation
  moduleController.restoreModule
);

// Get single
router.get(
  '/:moduleId',
  protect,
  authorize({ minLevel: 5 }),
  checkPermission('Modules', 'read'),
  validateGetModule,
  moduleController.getModule
);

// Get all (paginated)
router.get(
  '/',
  protect,
  authorize({ minLevel: 5 }),
  checkPermission('Modules', 'read'),
  validateGetAllModules,
  moduleController.getAllModules
);

// Get menu (public-ish – only auth)
router.get('/menu', protect, moduleController.getMenu);

/* -------------------------------------------------------------
   SUB-MODULE LEVEL
------------------------------------------------------------- */
// Create sub-module(s)
router.post(
  '/:moduleId/sub-modules',
  protect,
  authorize({ minLevel: 10 }),
  checkPermission('Modules', 'create'),
  validateCreateSubModule,
  moduleController.createSubModule
);

// Update sub-module
router.put(
  '/:moduleId/sub-modules/:subModuleId',
  protect,
  authorize({ minLevel: 10 }),
  checkPermission('Modules', 'update'),
  validateUpdateSubModule,
  moduleController.updateSubModule
);

// Soft-delete sub-module
router.delete(
  '/:moduleId/sub-modules/:subModuleId',
  protect,
  authorize({ minLevel: 10 }),
  checkPermission('Modules', 'delete'),
  validateUpdateSubModule,               // re-uses ID checks
  moduleController.deleteSubModule
);

// Restore sub-module
router.post(
  '/:moduleId/sub-modules/:subModuleId/restore',
  protect,
  authorize({ minLevel: 10 }),
  checkPermission('Modules', 'update'),
  validateUpdateSubModule,
  moduleController.restoreSubModule
);

// Reorder sub-modules
router.put(
  '/:moduleId/sub-modules/reorder',
  protect,
  authorize({ minLevel: 10 }),
  checkPermission('Modules', 'update'),
  validateReorderSubModules,
  moduleController.reorderSubModules
);

module.exports = router;