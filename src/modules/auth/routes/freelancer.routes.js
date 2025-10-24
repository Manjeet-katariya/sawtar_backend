const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../../../middleware/auth');
const asyncHandler = require('../../../utils/asyncHandler');
const freelancerRequestController = require('../controllers/freelancer.controller');
const {
  validateSubmitFreelancerRequest,
  validateApproveFreelancerRequest,
  validateRejectFreelancerRequest,
  validateGetAllFreelancerRequests,
  validateGetCustomerFreelancerStatus,
} = require('../validations/freelancer.validation');
const { ROLES } = require('../../../utils/constants/roles');

// Customer Freelancer Request Routes
router.post(
  '/:customerId/request',
  validateSubmitFreelancerRequest,
  asyncHandler(freelancerRequestController.submitFreelancerRequest)
);

router.get(
  '/:customerId/request/status',
  protect,
  authorize(ROLES.CUSTOMER),
  validateGetCustomerFreelancerStatus,
  asyncHandler(freelancerRequestController.getCustomerFreelancerStatus)
);

// Admin Freelancer Request Management Routes
router.get(
  '/requests',
  protect,
  authorize(ROLES.SUPERADMIN),
  validateGetAllFreelancerRequests,
  asyncHandler(freelancerRequestController.getAllFreelancerRequests)
);

router.put(
  '/requests/:requestId/approve',
  protect,
  authorize(ROLES.SUPERADMIN),
  validateApproveFreelancerRequest,
  asyncHandler(freelancerRequestController.approveFreelancerRequest)
);

router.patch(
  '/requests/:requestId/reject',
  protect,
  authorize([ROLES.SUPERADMIN, ROLES.ADMIN]),
  validateRejectFreelancerRequest,
  asyncHandler(freelancerRequestController.rejectFreelancerRequest)
);

module.exports = router;