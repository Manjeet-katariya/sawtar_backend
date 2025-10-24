// routes/freelancer/freelancer.route.js

const express = require('express');
const router = express.Router();
const freelancerController = require('../../controllers/freelancer/freeelancer.controller');
const { protect, authorize, protectFreelancer } = require('../../../../middleware/auth'); // Assuming protectFreelancer is defined similarly
const { checkPermission } = require('../../../../middleware/permission');
const upload = require('../../../../middleware/multer');
const {
  validateCreateFreelancer,
  validateFreelancerId,
  validateUpdateFreelancer,
  validateGetAllFreelancers,
  validateUpdateFreelancerStatus,
  validateUpdateDocumentVerification,
  validateFreelancerLogin,
  validateChangePassword,
  validateUpdateDocument
} = require('../../validations/freelancer/freelancer.validation');

// Configure multer with file type and size restrictions
const uploadSingleFile = upload.single('file');

router.post('/login', validateFreelancerLogin, freelancerController.freelancerLogin);

router.get('/profile', protectFreelancer, freelancerController.getFreelancerProfile);

router.put(
  '/change-password',
  protectFreelancer,
  validateChangePassword,
  freelancerController.changePassword
);

router.put(
  '/document/:documentId',
  protectFreelancer,
  uploadSingleFile,
  validateUpdateDocument,
  freelancerController.updateDocument
);

router.get(
  '/',
  protect,
  authorize({ minLevel: 5 }),
  checkPermission('Freelancers', 'read'),
  validateGetAllFreelancers,
  freelancerController.getAllFreelancers
);

router.post(
  '/',
  upload.fields([
    { name: 'resume', maxCount: 1 },
    { name: 'portfolio', maxCount: 1 },
    { name: 'certificates', maxCount: 10 }, // Allowing multiple certificates
    { name: 'identityProof', maxCount: 1 },
    { name: 'addressProof', maxCount: 1 }
  ]),
  validateCreateFreelancer,
  freelancerController.createFreelancer
);

router.put(
  '/:id',
  protect,
  authorize({ minLevel: 5 }),
  checkPermission('Freelancers', 'update'),
  validateFreelancerId,
  validateUpdateFreelancer,
  freelancerController.updateFreelancer
);

router.delete(
  '/:id',
  protect,
  authorize({ minLevel: 5 }),
  checkPermission('Freelancers', 'delete'),
  validateFreelancerId,
  freelancerController.deleteFreelancer
);

router.put(
  '/:id/status',
  protect,
  authorize({ minLevel: 5 }),
  checkPermission('Freelancers', 'update'),
  validateUpdateFreelancerStatus,
  freelancerController.updateFreelancerStatus
);

router.put(
  '/document/verification/check',
  protect,
  authorize({ minLevel: 5 }),
  checkPermission('Freelancers', 'update'),
  validateUpdateDocumentVerification,
  freelancerController.updateDocumentVerification
);

module.exports = router;