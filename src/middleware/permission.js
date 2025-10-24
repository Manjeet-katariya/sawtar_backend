// middleware/permission.middleware.js
const { APIError } = require('../utils/errorHandler');
const { StatusCodes } = require('../utils/constants/statusCodes');
const { Permission } = require('../modules/auth/models/role/permission.model');
const { Module } = require('../modules/auth/models/role/module.model');

// Cache for frequently accessed modules
const moduleCache = new Map();

// Get module from cache or database
async function getModule(moduleName) {
  if (moduleCache.has(moduleName)) {
    return moduleCache.get(moduleName);
  }

  const module = await Module.findOne({ name: moduleName });
  if (module) {
    moduleCache.set(moduleName, module);
    // Cache for 5 minutes
    setTimeout(() => moduleCache.delete(moduleName), 5 * 60 * 1000);
  }
  
  return module;
}

// Dynamic permission check middleware
exports.checkPermission = (moduleName, actionName) => {
  return async (req, res, next) => {
    try {
      // Skip permission check for superadmins
      if (req.user.role.isSuperAdmin) {
        return next();
      }

      // Find module by name
      const module = await getModule(moduleName);
      if (!module) {
        throw new APIError(`Module ${moduleName} not found`, StatusCodes.NOT_FOUND);
      }

      // Check if user has the required permission
      const permission = await Permission.findOne({
        roleId: req.user.role._id,
        moduleId: module._id,
        isActive: true
      });

      if (!permission) {
        throw new APIError(
          `You don't have permission to access ${moduleName}`,
          StatusCodes.FORBIDDEN
        );
      }

      // Check if the specific action is allowed using boolean fields
      let hasPermission = false;
      
      switch (actionName.toLowerCase()) {
        case 'view':
          hasPermission = permission.canView;
          break;
        case 'add':
        case 'create':
          hasPermission = permission.canAdd;
          break;
        case 'edit':
        case 'update':
          hasPermission = permission.canEdit;
          break;
        case 'delete':
        case 'remove':
          hasPermission = permission.canDelete;
          break;
        case 'viewall':
          hasPermission = permission.canViewAll;
          break;
        default:
          hasPermission = false;
      }

      if (!hasPermission) {
        throw new APIError(
          `You don't have permission to ${actionName} ${moduleName}`,
          StatusCodes.FORBIDDEN
        );
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};

// Check multiple permissions at once
exports.checkPermissions = (moduleName, actionNames = []) => {
  return async (req, res, next) => {
    try {
      if (req.user.role.isSuperAdmin) {
        return next();
      }

      const module = await getModule(moduleName);
      if (!module) {
        throw new APIError(`Module ${moduleName} not found`, StatusCodes.NOT_FOUND);
      }

      // Check if user has permission for this module
      const permission = await Permission.findOne({
        roleId: req.user.role._id,
        moduleId: module._id,
        isActive: true
      });

      if (!permission) {
        throw new APIError(
          `You don't have permission to access ${moduleName}`,
          StatusCodes.FORBIDDEN
        );
      }

      // Check if all requested actions are permitted
      const hasAllPermissions = actionNames.every(actionName => {
        switch (actionName.toLowerCase()) {
          case 'view':
            return permission.canView;
          case 'add':
          case 'create':
            return permission.canAdd;
          case 'edit':
          case 'update':
            return permission.canEdit;
          case 'delete':
          case 'remove':
            return permission.canDelete;
          case 'viewall':
            return permission.canViewAll;
          default:
            return false;
        }
      });

      if (!hasAllPermissions) {
        throw new APIError(
          `You don't have required permissions for ${moduleName}`,
          StatusCodes.FORBIDDEN
        );
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};

// Check if user has any of the specified permissions
exports.checkAnyPermission = (moduleName, actionNames = []) => {
  return async (req, res, next) => {
    try {
      if (req.user.role.isSuperAdmin) {
        return next();
      }

      const module = await getModule(moduleName);
      if (!module) {
        throw new APIError(`Module ${moduleName} not found`, StatusCodes.NOT_FOUND);
      }

      // Check if user has permission for this module
      const permission = await Permission.findOne({
        roleId: req.user.role._id,
        moduleId: module._id,
        isActive: true
      });

      if (!permission) {
        throw new APIError(
          `You don't have permission to access ${moduleName}`,
          StatusCodes.FORBIDDEN
        );
      }

      // Check if any of the requested actions are permitted
      const hasAnyPermission = actionNames.some(actionName => {
        switch (actionName.toLowerCase()) {
          case 'view':
            return permission.canView;
          case 'add':
          case 'create':
            return permission.canAdd;
          case 'edit':
          case 'update':
            return permission.canEdit;
          case 'delete':
          case 'remove':
            return permission.canDelete;
          case 'viewall':
            return permission.canViewAll;
          default:
            return false;
        }
      });

      if (!hasAnyPermission) {
        throw new APIError(
          `You don't have any of the required permissions for ${moduleName}`,
          StatusCodes.FORBIDDEN
        );
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};

// Simple role-based middleware
exports.requireRole = (roleCodes = []) => {
  return (req, res, next) => {
    try {
      if (!req.user || !req.user.role) {
        throw new APIError('Authentication required', StatusCodes.UNAUTHORIZED);
      }

      if (req.user.role.isSuperAdmin) {
        return next();
      }

      if (roleCodes.length > 0 && !roleCodes.includes(req.user.role.code)) {
        throw new APIError(
          `Required role: ${roleCodes.join(', ')}`,
          StatusCodes.FORBIDDEN
        );
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};

// Check if user has module access (any permission)
exports.hasModuleAccess = (moduleName) => {
  return async (req, res, next) => {
    try {
      if (req.user.role.isSuperAdmin) {
        return next();
      }

      const module = await getModule(moduleName);
      if (!module) {
        throw new APIError(`Module ${moduleName} not found`, StatusCodes.NOT_FOUND);
      }

      // Check if user has any permission for this module
      const permission = await Permission.findOne({
        roleId: req.user.role._id,
        moduleId: module._id,
        isActive: true
      });

      if (!permission) {
        throw new APIError(
          `You don't have access to ${moduleName} module`,
          StatusCodes.FORBIDDEN
        );
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};

// Get user permissions for frontend
exports.getUserPermissions = async (userId, roleId) => {
  try {
    const permissions = await Permission.find({
      roleId: roleId,
      isActive: true
    }).populate('moduleId');

    const formattedPermissions = {};
    
    permissions.forEach(permission => {
      if (permission.moduleId) {
        formattedPermissions[permission.moduleId.name] = {
          canView: permission.canView,
          canAdd: permission.canAdd,
          canEdit: permission.canEdit,
          canDelete: permission.canDelete,
          canViewAll: permission.canViewAll
        };
      }
    });

    return formattedPermissions;
  } catch (error) {
    throw error;
  }
};