// modules/services/routes/service.routes.js
const express = require('express');
const router = express.Router();
const serviceController = require('../../controllers/services/services.controller');
const { protect, authorize } = require('../../../../middleware/auth');
const { checkPermission } = require('../../../../middleware/permission');
const {
  validateCreateService,
  validateUpdateService,
  validateDeleteService,
  validatePermanentDeleteService,
  validateRestoreService,
  validateGetService,
  validateGetAllServices
} = require('../../validations/services/services.validation');

// Public routes (can be restricted later if needed)
router.get('/', validateGetAllServices, serviceController.getAllServices);
router.get('/:service_id', validateGetService, serviceController.getService);

// Protected Admin Routes (adjust permission as per your role system)
router.post(
  '/',
  protect,
  authorize({ minLevel: 5 }), // Example: Admin level
  checkPermission('Services', 'create'),
  validateCreateService,
  serviceController.createService
);

router.put(
  '/:service_id',
  protect,
  authorize({ minLevel: 5 }),
  checkPermission('Services', 'update'),
  validateUpdateService,
  serviceController.updateService
);

// Soft Delete
router.delete(
  '/:service_id',
  protect,
  authorize({ minLevel: 5 }),
  checkPermission('Services', 'delete'),
  validateDeleteService,
  serviceController.deleteService
);

// Permanent Delete (only soft-deleted)
router.delete(
  '/:service_id/permanent',
  protect,
  authorize({ minLevel: 5 }),
  checkPermission('Services', 'delete'),
  validatePermanentDeleteService,
  serviceController.permanentDeleteService
);

// Restore
router.patch(
  '/:service_id/restore',
  protect,
  authorize({ minLevel: 5 }),
  checkPermission('Services', 'update'),
  validateRestoreService,
  serviceController.restoreService
);

module.exports = router;