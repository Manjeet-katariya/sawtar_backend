// modules/services/controllers/service.controller.js
const { StatusCodes } = require('../../../../utils/constants/statusCodes');
const { APIError } = require('../../../../utils/errorHandler');
const { Service } = require('../../models/services/services.model');
const asyncHandler = require('../../../../utils/asyncHandler');

// Create a new service
exports.createService = asyncHandler(async (req, res) => {
  const { name, description, is_featured } = req.body;

  // Check for duplicate name
  const existingService = await Service.findOne({ name });
  if (existingService) {
    throw new APIError('Service with this name already exists', StatusCodes.CONFLICT);
  }

  // Create new service
  const service = await Service.create({
    name,
    slug: name.toLowerCase().replace(/\s+/g, '-'),
    description,
    is_featured: is_featured || false
  });

  res.status(StatusCodes.CREATED).json({
    success: true,
    message: 'Service created successfully',
    service,
  });
});

// Update an existing service
exports.updateService = asyncHandler(async (req, res) => {
  const { service_id } = req.params;
  const { name, description, is_active, is_featured } = req.body;

  // Check if service exists
  const service = await Service.findById(service_id);
  if (!service) {
    throw new APIError('Service not found', StatusCodes.NOT_FOUND);
  }

  // Check for duplicate name (excluding current service)
  if (name) {
    const existingService = await Service.findOne({
      name,
      _id: { $ne: service_id },
    });
    if (existingService) {
      throw new APIError('Service with this name already exists', StatusCodes.CONFLICT);
    }
  }

  // Update service
  service.name = name || service.name;
  service.slug = name ? name.toLowerCase().replace(/\s+/g, '-') : service.slug;
  service.description = description || service.description;
  service.is_active = is_active !== undefined ? is_active : service.is_active;
  service.is_featured = is_featured !== undefined ? is_featured : service.is_featured;

  await service.save();

  res.status(StatusCodes.OK).json({
    success: true,
    message: 'Service updated successfully',
    service,
  });
});

// Soft delete a service (set is_active to false)
exports.deleteService = asyncHandler(async (req, res) => {
  const { service_id } = req.params;

  // Check if service exists
  const service = await Service.findById(service_id);
  if (!service) {
    throw new APIError('Service not found', StatusCodes.NOT_FOUND);
  }

  // Check if service is already inactive
  if (!service.is_active) {
    throw new APIError('Service is already deleted', StatusCodes.BAD_REQUEST);
  }

  // Soft delete
  service.is_active = false;
  await service.save();

  res.status(StatusCodes.OK).json({
    success: true,
    message: 'Service soft deleted successfully',
  });
});

// Permanent delete a service (only if already soft deleted)
exports.permanentDeleteService = asyncHandler(async (req, res) => {
  const { service_id } = req.params;

  // Check if service exists
  const service = await Service.findById(service_id);
  if (!service) {
    throw new APIError('Service not found', StatusCodes.NOT_FOUND);
  }

  // Check if service is already soft deleted
  if (service.is_active) {
    throw new APIError('Service must be soft deleted before permanent deletion', StatusCodes.BAD_REQUEST);
  }

  // Permanent delete
  await service.deleteOne();

  res.status(StatusCodes.OK).json({
    success: true,
    message: 'Service permanently deleted successfully',
  });
});

// Restore a soft deleted service (set is_active to true)
exports.restoreService = asyncHandler(async (req, res) => {
  const { service_id } = req.params;

  // Check if service exists
  const service = await Service.findById(service_id);
  if (!service) {
    throw new APIError('Service not found', StatusCodes.NOT_FOUND);
  }

  // Check if service is already active
  if (service.is_active) {
    throw new APIError('Service is already active', StatusCodes.BAD_REQUEST);
  }

  // Restore
  service.is_active = true;
  await service.save();

  res.status(StatusCodes.OK).json({
    success: true,
    message: 'Service restored successfully',
    service,
  });
});

// Get a single service by ID
exports.getService = asyncHandler(async (req, res) => {
  const { service_id } = req.params;

  const service = await Service.findById(service_id);
  if (!service) {
    throw new APIError('Service not found', StatusCodes.NOT_FOUND);
  }

  res.status(StatusCodes.OK).json({
    success: true,
    message: 'Service retrieved successfully',
    service,
  });
});

// Get all services with pagination and filtering (default to active services)
// Get all services with optional pagination & filtering
exports.getAllServices = asyncHandler(async (req, res) => {
  const {
    name,
    is_active,
    is_featured,
    page = 1,
    limit // optional
  } = req.query;

  /* ---------------------------------------------------------
      🟦 BUILD FILTER QUERY
  --------------------------------------------------------- */
  let query = {};

  // Search by name (case-insensitive)
  if (name) {
    query.name = new RegExp(name, "i");
  }

  // Default: only active services
  if (is_active !== undefined) {
    query.is_active = is_active === "true";
  } else {
    query.is_active = true;
  }

  // Featured filter
  if (is_featured !== undefined) {
    query.is_featured = is_featured === "true";
  }

  /* ---------------------------------------------------------
      🟦 BASE QUERY
  --------------------------------------------------------- */
  let serviceQuery = Service.find(query)
    .sort({ createdAt: -1 });

  /* ---------------------------------------------------------
      🟦 OPTIONAL PAGINATION
  --------------------------------------------------------- */
  let pagination = null;

  if (limit) {
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);

    serviceQuery = serviceQuery
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum);

    const total = await Service.countDocuments(query);

    pagination = {
      page: pageNum,
      limit: limitNum,
      total,
      totalPages: Math.ceil(total / limitNum)
    };
  }

  /* ---------------------------------------------------------
      🟦 EXECUTE QUERY
  --------------------------------------------------------- */
  const services = await serviceQuery;

  /* ---------------------------------------------------------
      🟦 RESPONSE
  --------------------------------------------------------- */
  res.status(StatusCodes.OK).json({
    success: true,
    data: services,
    pagination // null if limit not passed
  });
});
