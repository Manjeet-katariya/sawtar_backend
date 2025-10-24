const express = require('express');
const router = express.Router();
const customerController = require('../controllers/customer.controller');
const { protectCustomer } = require('../../../middleware/auth');
const { validateCreateCustomer, validateCustomerLogin, validateChangePassword } = require('../validations/customer.validation');
const upload = require('../../../middleware/multer');

// Configure multer for profile image
const uploadProfileImage = upload.single('profileImage');

router.post('/login', validateCustomerLogin, customerController.customerLogin);

router.post(
  '/',
  uploadProfileImage,
  validateCreateCustomer,
  customerController.createCustomer
);

router.get('/profile',protectCustomer, customerController.getCustomerProfile);

router.put(
  '/profile',
  uploadProfileImage,
  customerController.updateCustomerProfile
);

router.put(
  '/change-password',
  validateChangePassword,
  customerController.changePassword
);

module.exports = router;