const { StatusCodes } = require('../../../../utils/constants/statusCodes');
const { APIError } = require('../../../../utils/errorHandler');
const { Permission } = require('../../models/role/permission.model');
const { Role } = require('../../models/role/role.model');
const { Module } = require('../../models/role/module.model');
const asyncHandler = require('../../../../utils/asyncHandler');

// Create permissions (supports bulk creation)
exports.createPermission = asyncHandler(async (req, res) => {
  const permissionsData = Array.isArray(req.body) ? req.body : [req.body];

  const createdPermissions = [];

  for (const permissionData of permissionsData) {
    const { roleId, moduleId, canAdd, canEdit, canView, canDelete, canViewAll } = permissionData;

    // Check if role exists
    const roleExists = await Role.findById(roleId);
    if (!roleExists) {
      throw new APIError(`Role not found for roleId ${roleId}`, StatusCodes.NOT_FOUND);
    }

    // Check if module exists
    const moduleExists = await Module.findById(moduleId);
    if (!moduleExists) {
      throw new APIError(`Module not found for moduleId ${moduleId}`, StatusCodes.NOT_FOUND);
    }

    // Check for existing permission
    const existingPermission = await Permission.findOne({ roleId, moduleId });
    if (existingPermission) {
      throw new APIError(`Permission for role ${roleId} and module ${moduleId} already exists`, StatusCodes.CONFLICT);
    }

    // Create new permission
    const permission = await Permission.create({
      roleId,
      moduleId,
      canAdd: canAdd !== undefined ? canAdd : 0,
      canEdit: canEdit !== undefined ? canEdit : 0,
      canView: canView !== undefined ? canView : 0,
      canDelete: canDelete !== undefined ? canDelete : 0,
      canViewAll: canViewAll !== undefined ? canViewAll : 0,
      grantedBy: req.user._id
    });

    createdPermissions.push(permission);
  }

  res.status(StatusCodes.CREATED).json({
    success: true,
    message: `${createdPermissions.length} permission(s) created successfully`,
    permissions: createdPermissions
  });
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

// Get all permissions with pagination and filtering
exports.getAllPermissions = asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const skip = (page - 1) * limit;
  const { roleCode, moduleId, isActive } = req.query;

  // Build filter
  const filter = {};
  
  // If roleCode is provided in query, use it to find permissions for that role
  if (roleCode) {
    // First find the role with this code
    const role = await Role.findOne({ code: roleCode });
    if (!role) {
      return res.status(StatusCodes.NOT_FOUND).json({
        success: false,
        message: 'Role not found with the provided code'
      });
    }
    filter.roleId = role._id;
  }
  
  if (moduleId) filter.moduleId = moduleId;
  if (isActive !== undefined) filter.isActive = isActive === 'true';

  // Query permissions
  const permissions = await Permission.find(filter)
    .populate('roleId', 'name code')
    .populate('moduleId')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

  const total = await Permission.countDocuments(filter);

  res.status(StatusCodes.OK).json({
    success: true,
    count: permissions.length,
    message: `${permissions.length} permissions found`,
    pagination: {
      totalRecords: total,
      currentPage: page,
      totalPages: Math.ceil(total / limit),
      perPage: limit
    },
    permissions
  });
});