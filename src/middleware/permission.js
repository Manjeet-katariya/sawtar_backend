// middleware/permission.middleware.js

const { APIError } = require('../utils/errorHandler');
const { StatusCodes } = require('../utils/constants/statusCodes');
const { Permission } = require('../modules/auth/models/role/permission.model');
const { Module } = require('../modules/auth/models/role/module.model');

const moduleCache = new Map();

async function getModule(moduleName) {
  if (moduleCache.has(moduleName)) return moduleCache.get(moduleName);

  const module = await Module.findOne({ name: moduleName, isActive: true, isDeleted: false });
  if (module) {
    moduleCache.set(moduleName, module);
    setTimeout(() => moduleCache.delete(moduleName), 5 * 60 * 1000);
  }
  return module;
}

// MAIN: checkPermission(module, action, [subModule])
exports.checkPermission = (moduleName, actionName, subModuleName = null) => {
  return async (req, res, next) => {
    try {
      if (req.user.role.isSuperAdmin) return next();

      const module = await getModule(moduleName);
      if (!module) throw new APIError(`Module ${moduleName} not found`, StatusCodes.NOT_FOUND);

      let subModuleId = null;
      if (subModuleName) {
        const sub = module.subModules.find(
          s => s.name === subModuleName && s.isActive && !s.isDeleted
        );
        if (!sub) throw new APIError(`SubModule ${subModuleName} not found`, StatusCodes.NOT_FOUND);
        subModuleId = sub._id;
      }

      const permission = await Permission.findOne({
        roleId: req.user.role._id,
        moduleId: module._id,
        subModuleId,
        isActive: true
      });

      if (!permission) {
        throw new APIError(`Access denied to ${moduleName}${subModuleName ? ` → ${subModuleName}` : ''}`, StatusCodes.FORBIDDEN);
      }

      const actionMap = {
        view: 'canView', add: 'canAdd', create: 'canAdd',
        edit: 'canEdit', update: 'canEdit',
        delete: 'canDelete', remove: 'canDelete',
        viewall: 'canViewAll'
      };

      const field = actionMap[actionName.toLowerCase()];
      if (!field || !permission[field]) {
        throw new APIError(`No ${actionName} permission on ${moduleName}`, StatusCodes.FORBIDDEN);
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};

// getUserPermissions – fixed
exports.getUserPermissions = async (roleId) => {
  const permissions = await Permission.find({ roleId, isActive: true }).populate('moduleId');
  const map = {};

  permissions.forEach(p => {
    if (p.moduleId) {
      const key = p.subModuleId
        ? `${p.moduleId.name}→${p.moduleId.subModules.id(p.subModuleId).name}`
        : p.moduleId.name;

      map[key] = {
        canView: p.canView,
        canAdd: p.canAdd,
        canEdit: p.canEdit,
        canDelete: p.canDelete,
        canViewAll: p.canViewAll
      };
    }
  });

  return map;
};