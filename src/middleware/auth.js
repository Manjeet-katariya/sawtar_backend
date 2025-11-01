const jwt = require('jsonwebtoken');
const { APIError } = require('../utils/errorHandler');
const { StatusCodes } = require('../utils/constants/statusCodes');
const User = require('../modules/auth/models/User');
const { Role } = require('../modules/auth/models/role/role.model');
const Vendorb2b = require('../modules/auth/models/Vendor/B2bvendor.model');
const Vendorb2c = require('../modules/auth/models/Vendor/B2cvendor.model');
const Business = require('../modules/auth/models/Freelancer/freelancerbusiness.model');
const Freelancer = require('../modules/auth/models/Freelancer/freelancer.model');
const Customer = require('../modules/auth/models/Customer/customer.model');


exports.createToken = (user, type = 'user') => {
  const payload = {
    id: user._id,
    email: user.email,
    type, // Add type to distinguish vendor vs user tokens
    role: {
      code: user.role.code,
      name: user.role.name,
      isSuperAdmin: user.role.isSuperAdmin,
    },
  };

  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || '30d',
  });
};

exports.protect = async (req, res, next) => {
  try {
    let token;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      throw new APIError('Not authorized to access this route', StatusCodes.UNAUTHORIZED);
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).populate({
      path: 'role',
      model: Role,
    });

    if (!user || !user.isActive) {
      throw new APIError('Not authorized to access this route', StatusCodes.UNAUTHORIZED);
    }

    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
};

exports.protectFreelancer = async (req, res, next) => {
  try {
    let token;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      throw new APIError('Not authorized to access this route', StatusCodes.UNAUTHORIZED);
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
  

    const freelancer = await Freelancer.findById(decoded.id).populate('role');

    req.user = freelancer;
    next();
  } catch (error) {
    next(error);
  }
};
exports.protectBusiness = async (req, res, next) => {
  try {
    let token;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      throw new APIError('Not authorized to access this route', StatusCodes.UNAUTHORIZED);
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
  

    const business = await Business.findById(decoded.id).populate('role');

    req.user = business;
    next();
  } catch (error) {
    next(error);
  }
};

exports.protectVendorb2b = async (req, res, next) => {
  try {
    let token;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      throw new APIError('Not authorized to access this route', StatusCodes.UNAUTHORIZED);
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
  

    const vendor = await Vendorb2b.findById(decoded.id).populate('role');

    req.user = vendor;
    next();
  } catch (error) {
    next(error);
  }
};

exports.protectVendorb2c = async (req, res, next) => {
  try {
    let token;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      throw new APIError('Not authorized to access this route', StatusCodes.UNAUTHORIZED);
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
  

    const vendor = await Vendorb2c.findById(decoded.id).populate('role');

    req.user = vendor;
    next();
  } catch (error) {
    next(error);
  }
};
exports.protectCustomer = async (req, res, next) => {
  try {
    let token;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      throw new APIError('Not authorized to access this route', StatusCodes.UNAUTHORIZED);
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
  

    const customer = await Customer.findById(decoded.id).populate('role');

    req.user = customer;
    next();
  } catch (error) {
    next(error);
  }
};

// In protectMulti
exports.protectMulti = async (req, res, next) => {
  try {
    let token = req.headers.authorization?.startsWith('Bearer') 
      ? req.headers.authorization.split(' ')[1] 
      : null;

    if (!token) throw new APIError('No token', StatusCodes.UNAUTHORIZED);

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const entityMap = {
      user: User,
      vendorb2c: Vendorb2c,
      vendorb2b: Vendorb2b,
      freelancer: Freelancer,
      business: Business,
      customer: Customer,
    };

    const Model = entityMap[decoded.type];
    if (!Model) throw new APIError('Invalid token type', StatusCodes.UNAUTHORIZED);

    const entity = await Model.findById(decoded.id).populate('role');
    if (!entity || !entity.isActive) throw new APIError('Unauthorized', StatusCodes.UNAUTHORIZED);

    // Cache permissions
    entity.permissions = await exports.getUserPermissions(entity.role._id);
    req.user = entity;
    next();
  } catch (error) {
    next(error);
  }
};

// authorize – use role.code
exports.authorize = (options = {}) => {
  return (req, res, next) => {
    try {
      if (req.user.role.isSuperAdmin) return next();

      if (options.minLevel && req.user.role.level < options.minLevel) {
        throw new APIError('Insufficient role level', StatusCodes.FORBIDDEN);
      }

      if (options.roles && !options.roles.includes(req.user.role.code)) {
        throw new APIError(`Role not allowed: ${options.roles.join(', ')}`, StatusCodes.FORBIDDEN);
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};