const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const helmet = require('helmet');
const createError = require('http-errors');
const logger = require('./config/logger');

const app = express();

// Middleware
app.use(cors());
app.use(helmet());
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Database connection
require('./config/database');

// Routes
app.use('/platform', require('../src/modules/auth/routes/role/platform.routes'));
app.use('/customer', require('../src/modules/auth/routes/customer.routes'));
app.use('/ecommerce/v1', require('../src/modules/ecommerce/B2C/routes/cartOrderWishlist.route'));

app.use('/roles', require('../src/modules/auth/routes/role/role.routes'));
app.use('/permission', require('../src/modules/auth/routes/permission/permission.routes'));
app.use('/permission-action', require('../src/modules/auth/routes/permission/action.routes'));
app.use('/module', require('../src/modules/auth/routes/module/module.routes'));
app.use('/setting/tax', require('../src/modules/auth/routes/tax/tax.routes'));
app.use('/setting/currency', require('../src/modules/auth/routes/currency/currency.routes'));

app.use('/auth', require('../src/modules/auth/routes/auth.routes'));
app.use('/vendor/b2c', require('../src/modules/auth/routes/vendor/vendorb2c.routes'));
app.use('/vendor/b2b', require('../src/modules/auth/routes/vendor/vendorb2b.routes'));
app.use('/business', require('../src/modules/auth/routes/freelancer/freelancerbusiness.routes'));

app.use('/freelancer', require('../src/modules/auth/routes/freelancer/freelancer.routes'));
app.use('/attributes', require('../src/modules/ecommerce/B2C/routes/attribute.routes'));
app.use('/materials', require('../src/modules/ecommerce/B2C/routes/material.routes'));
app.use('/brands', require('../src/modules/ecommerce/B2C/routes/brand.routes'));

app.use('/categories', require('../src/modules/ecommerce/B2C/routes/category.routes'));
app.use('/tags', require('../src/modules/ecommerce/B2C/routes/tags.routes'));
app.use('/products', require('../src/modules/ecommerce/B2C/routes/product.routes'));
app.use('/vendor/warehouses', require('../src/modules/ecommerce/B2C/routes/warehouse.routes'));

// 404 Handler
app.use((req, res, next) => {
  next(createError.NotFound());
});

// Error Handler
app.use((err, req, res, next) => {
  res.status(err.status || 500);
  res.json({
    error: {
      status: err.status || 500,
      message: err.message
    }
  });
});

module.exports = app;