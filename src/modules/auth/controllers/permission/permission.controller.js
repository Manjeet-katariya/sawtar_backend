const { StatusCodes } = require('../../../../utils/constants/statusCodes');
const { APIError } = require('../../../../utils/errorHandler');
const { Permission } = require('../../models/role/permission.model');
const { Role } = require('../../models/role/role.model');
const { Module } = require('../../models/role/module.model');
const asyncHandler = require('../../../../utils/asyncHandler');

// Create permissions (supports bulk creation)
// createPermission – supports subModuleId
exports.createPermission = asyncHandler(async (req, res) => {
  const permissionsData = Array.isArray(req.body) ? req.body : [req.body];
  const created = [];

  for (const data of permissionsData) {
    const { roleId, moduleId, subModuleId, canAdd, canEdit, canView, canDelete, canViewAll } = data;

    // Validate Role & Module
    const role = await Role.findById(roleId);
    const module = await Module.findById(moduleId);
    if (!role || !module) throw new APIError('Invalid role or module', StatusCodes.NOT_FOUND);

    // Validate subModuleId if provided
    if (subModuleId) {
      const sub = module.subModules.id(subModuleId);
      if (!sub || sub.isDeleted) throw new APIError('Submodule not found', StatusCodes.NOT_FOUND);
    }

    // Check duplicate
    const exists = await Permission.findOne({ roleId, moduleId, subModuleId, isDeleted: false });
    if (exists) throw new APIError(`Permission already exists`, StatusCodes.CONFLICT);

    const permission = await Permission.create({
      roleId, moduleId, subModuleId,
      canAdd: canAdd ?? 0,
      canEdit: canEdit ?? 0,
      canView: canView ?? 0,
      canDelete: canDelete ?? 0,
      canViewAll: canViewAll ?? 0,
      grantedBy: req.user._id
    });

    created.push(permission);
  }

  res.status(StatusCodes.CREATED).json({
    success: true,
    message: `${created.length} permission(s) created`,
    permissions: created
  });
});

// Soft Delete
exports.softDeletePermission = asyncHandler(async (req, res) => {
  const { permissionId } = req.params;
  const permission = await Permission.findById(permissionId);
  if (!permission || permission.isDeleted) throw new APIError('Not found', StatusCodes.NOT_FOUND);

  permission.isDeleted = true;
  permission.deletedAt = new Date();
  await permission.save();

  res.json({ success: true, message: 'Permission soft deleted' });
});

// Restore
exports.restorePermission = asyncHandler(async (req, res) => {
  const { permissionId } = req.params;
  const permission = await Permission.findById(permissionId);
  if (!permission || !permission.isDeleted) throw new APIError('Not deleted', StatusCodes.BAD_REQUEST);

  permission.isDeleted = false;
  permission.deletedAt = null;
  await permission.save();

  res.json({ success: true, message: 'Permission restored' });
});

// Update an existing permission
exports.updatePermission = asyncHandler(async (req, res) => {
  const { permissionId } = req.params;
  const { canAdd, canEdit, canView, canDelete, canViewAll, isActive } = req.body;

  // Check if permission exists
  const permission = await Permission.findById(permissionId);
  if (!permission) {
    throw new APIError('Permission not found', StatusCodes.NOT_FOUND);
  }

  // Update permission fields
  permission.canAdd = canAdd !== undefined ? canAdd : permission.canAdd;
  permission.canEdit = canEdit !== undefined ? canEdit : permission.canEdit;
  permission.canView = canView !== undefined ? canView : permission.canView;
  permission.canDelete = canDelete !== undefined ? canDelete : permission.canDelete;
  permission.canViewAll = canViewAll !== undefined ? canViewAll : permission.canViewAll;
  permission.isActive = isActive !== undefined ? isActive : permission.isActive;

  await permission.save();

  res.status(StatusCodes.OK).json({
    success: true,
    message: 'Permission updated successfully',
    permission
  });
});

// Delete a permission
exports.deletePermission = asyncHandler(async (req, res) => {
  const { permissionId } = req.params;

  // Check if permission exists
  const permission = await Permission.findById(permissionId);
  if (!permission) {
    throw new APIError('Permission not found', StatusCodes.NOT_FOUND);
  }

  await permission.deleteOne();

  res.status(StatusCodes.OK).json({
    success: true,
    message: 'Permission deleted successfully'
  });
});

// Get a single permission by ID
exports.getPermission = asyncHandler(async (req, res) => {
  const { permissionId } = req.params;

  const permission = await Permission.findById(permissionId)
    .populate('roleId', 'name code')
    .populate('moduleId');
  if (!permission) {
    throw new APIError('Permission not found', StatusCodes.NOT_FOUND);
  }

  res.status(StatusCodes.OK).json({
    success: true,
    message: 'Permission retrieved successfully',
    permission
  });
});

exports.getAllPermissions = asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const skip = (page - 1) * limit;
  const { roleCode, moduleId, isActive } = req.query;

  const filter = { isDeleted: false };

  // ✅ Step 1: Filter by Role Code
  if (roleCode) {
    const role = await Role.findOne({ code: roleCode.trim() });
    if (!role) {
      return res.status(StatusCodes.NOT_FOUND).json({
        success: false,
        message: 'Role not found with the provided code',
      });
    }
    filter.roleId = role._id;
  }

  if (moduleId) filter.moduleId = moduleId;
  if (isActive !== undefined) filter.isActive = isActive === 'true';

  // ✅ Step 2: Fetch permissions
  const permissions = await Permission.find(filter)
    .populate('roleId', 'name code')
    .populate('moduleId', 'name route icon subModules')
    .populate('grantedBy', 'name email')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .lean();

  // ✅ Step 3: Extract relevant submodule (only the one matching subModuleId)
  const formattedPermissions = permissions.map((perm) => {
    const subModule =
      perm.subModuleId && perm.moduleId?.subModules?.length
        ? perm.moduleId.subModules.find(
            (s) => s._id.toString() === perm.subModuleId.toString()
          )
        : null;

    return {
      _id: perm._id,
      role: perm.roleId,
      module: {
        _id: perm.moduleId?._id,
        name: perm.moduleId?.name,
        route: perm.moduleId?.route,
        icon: perm.moduleId?.icon,
      },
      subModule: subModule
        ? {
            _id: subModule._id,
            name: subModule.name,
            route: subModule.route,
            icon: subModule.icon,
          }
        : null,
      permissions: {
        canAdd: perm.canAdd,
        canEdit: perm.canEdit,
        canView: perm.canView,
        canDelete: perm.canDelete,
        canViewAll: perm.canViewAll,
      },
      isActive: perm.isActive,
      grantedBy: perm.grantedBy,
      createdAt: perm.createdAt,
    };
  });

  // ✅ Step 4: Count and return
  const total = await Permission.countDocuments(filter);

  res.status(StatusCodes.OK).json({
    success: true,
    count: formattedPermissions.length,
    message: `${formattedPermissions.length} permissions found`,
    pagination: {
      totalRecords: total,
      currentPage: page,
      totalPages: Math.ceil(total / limit),
      perPage: limit,
    },
    permissions: formattedPermissions,
  });
});




// ✅ YOUR CODE IS PERFECT - Add this endpoint for frontend
exports.getMyPermissions = asyncHandler(async (req, res) => {
  const filter = {
    roleId: req.user.role._id,
    isActive: true,
    isDeleted: false
  };

  const permissions = await Permission.find(filter)
    .populate('roleId', 'name code')
    .populate('moduleId', 'name route icon subModules')
    .populate('grantedBy', 'name email')
    .lean();

  const formatted = permissions.map(perm => {
    const subModule = perm.subModuleId && perm.moduleId?.subModules?.length
      ? perm.moduleId.subModules.find(s => s._id.toString() === perm.subModuleId.toString())
      : null;

    return {
      _id: perm._id,
      role: perm.roleId,
      module: {
        _id: perm.moduleId?._id,
        name: perm.moduleId?.name,
        route: perm.moduleId?.route,
        icon: perm.moduleId?.icon,
      },
      subModule: subModule ? {
        _id: subModule._id,
        name: subModule.name,
        route: subModule.route,
        icon: subModule.icon,
      } : null,
      permissions: {
        canAdd: perm.canAdd,
        canEdit: perm.canEdit,
        canView: perm.canView,
        canDelete: perm.canDelete,
        canViewAll: perm.canViewAll,
      }
    };
  });

  res.json({ success: true, permissions: formatted });
});



