const { StatusCodes } = require('../../../../utils/constants/statusCodes');
const { APIError } = require('../../../../utils/errorHandler');
const { Module } = require('../../models/role/module.model');
const { Permission } = require('../../models/role/permission.model');
const asyncHandler = require('../../../../utils/asyncHandler');

// Create modules (supports bulk creation)
exports.createModule = asyncHandler(async (req, res) => {
  const modulesData = Array.isArray(req.body) ? req.body : [req.body];

  const createdModules = [];

  for (const moduleData of modulesData) {
    const { name, description, icon, route, subModules, position } = moduleData;

    const existingModule = await Module.findOne({ $or: [{ name }, { route }] });
    if (existingModule) {
      throw new APIError(`Module with name "${name}" or route "${route}" already exists`, StatusCodes.CONFLICT);
    }

    const module = await Module.create({
      name,
      slug: name.toLowerCase().replace(/\s+/g, '-'),
      description,
      icon: icon || 'fas fa-folder',
      route,
      subModules: subModules || [],
      position: position || 0
    });

    createdModules.push(module);
  }

  res.status(StatusCodes.CREATED).json({
    success: true,
    message: `${createdModules.length} module(s) created successfully`,
    modules: createdModules
  });
});

// Update an existing module
exports.updateModule = asyncHandler(async (req, res) => {
  const { moduleId } = req.params;
  const { name, description, icon, route, subModules, isActive, position } = req.body;

  const module = await Module.findById(moduleId);
  if (!module) {
    throw new APIError('Module not found', StatusCodes.NOT_FOUND);
  }

  if (name || route) {
    const existing = await Module.findOne({
      $or: [{ name: name || module.name }, { route: route || module.route }],
      _id: { $ne: moduleId }
    });
    if (existing) {
      throw new APIError('Module with this name or route already exists', StatusCodes.CONFLICT);
    }
  }

  module.name = name || module.name;
  module.slug = name ? name.toLowerCase().replace(/\s+/g, '-') : module.slug;
  module.description = description || module.description;
  module.icon = icon || module.icon;
  module.route = route || module.route;
  module.subModules = subModules !== undefined ? subModules : module.subModules;
  module.isActive = isActive !== undefined ? isActive : module.isActive;
  module.position = position !== undefined ? position : module.position;

  await module.save();

  res.status(StatusCodes.OK).json({
    success: true,
    message: 'Module updated successfully',
    module
  });
});

// Update module positions
exports.reorderModules = asyncHandler(async (req, res) => {
  const { modules } = req.body;

  if (!Array.isArray(modules)) {
    throw new APIError('Modules must be an array', StatusCodes.BAD_REQUEST);
  }

  for (const { _id, position } of modules) {
    const module = await Module.findById(_id);
    if (!module) {
      throw new APIError(`Module with ID ${_id} not found`, StatusCodes.NOT_FOUND);
    }
    module.position = position;
    await module.save();
  }

  res.status(StatusCodes.OK).json({
    success: true,
    message: 'Module positions updated successfully'
  });
});

// Delete a module
exports.deleteModule = asyncHandler(async (req, res) => {
  const { moduleId } = req.params;

  const module = await Module.findById(moduleId);
  if (!module) {
    throw new APIError('Module not found', StatusCodes.NOT_FOUND);
  }

  const permissions = await Permission.find({ moduleId });
  if (permissions.length > 0) {
    throw new APIError('Cannot delete module with associated permissions', StatusCodes.BAD_REQUEST);
  }

  await module.deleteOne();

  res.status(StatusCodes.OK).json({
    success: true,
    message: 'Module deleted successfully'
  });
});

// Get a single module by ID
exports.getModule = asyncHandler(async (req, res) => {
  const { moduleId } = req.params;

  const module = await Module.findById(moduleId);
  if (!module) {
    throw new APIError('Module not found', StatusCodes.NOT_FOUND);
  }

  res.status(StatusCodes.OK).json({
    success: true,
    message: 'Module retrieved successfully',
    module
  });
});

// Get all modules with pagination and filtering
exports.getAllModules = asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const skip = (page - 1) * limit;
  const { isActive } = req.query;

  const filter = {};
  if (isActive !== undefined) filter.isActive = isActive === 'true';

  const modules = await Module.find(filter)
    .sort({ position: 1, createdAt: -1 })
    .skip(skip)
    .limit(limit);

  const total = await Module.countDocuments(filter);

  res.status(StatusCodes.OK).json({
    success: true,
    count: modules.length,
    message: `${modules.length} modules found`,
    pagination: {
      totalRecords: total,
      currentPage: page,
      totalPages: Math.ceil(total / limit),
      perPage: limit
    },
    modules
  });
});

// Get menu for dashboard
exports.getMenu = asyncHandler(async (req, res) => {
  let modules;
  if (req.user.role.isSuperAdmin) {
    modules = await Module.find({ isActive: true }).sort({ position: 1, name: 1 });
  } else {
    const perms = await Permission.find({ roleId: req.user.role._id, isActive: true }).populate('actions');
    const moduleIds = perms.map(p => p.moduleId);
    modules = await Module.find({ _id: { $in: moduleIds }, isActive: true }).sort({ position: 1, name: 1 });
  }

  const menu = modules.map(m => ({
    _id: m._id,
    name: m.name,
    icon: m.icon,
    route: m.route,
    subModules: m.subModules
      .filter(sm => sm.isActive)
      .sort((a, b) => (a.position || 0) - (b.position || 0))
  }));

  res.status(StatusCodes.OK).json({
    success: true,
    menu
  });
});