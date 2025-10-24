const Material = require('../../models/material.model');
const { StatusCodes } = require('../../../../../utils/constants/statusCodes');
const { APIError } = require('../../../../../utils/errorHandler');
const asyncHandler = require('../../../../../utils/asyncHandler');

exports.createMaterial = asyncHandler(async (req, res, next) => {
  const materialData = req.body;

  const existingMaterial = await Material.findOne({ name: materialData.name.trim() });
  if (existingMaterial) {
    throw new APIError('Material name already exists', StatusCodes.CONFLICT);
  }

  try {
    const material = await Material.create(materialData);
    res.status(StatusCodes.CREATED).json({
      success: true,
      message: 'Material created successfully',
      data: { material }
    });
  } catch (error) {
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => err.message);
      throw new APIError(`Validation failed: ${errors.join(', ')}`, StatusCodes.BAD_REQUEST);
    }
    throw new APIError('Server error while creating material', StatusCodes.INTERNAL_SERVER_ERROR);
  }
});

exports.getAllMaterials = asyncHandler(async (req, res, next) => {
  const { page = 1, limit = 10 } = req.query;
  const materials = await Material.find()
    .skip((page - 1) * limit)
    .limit(Number(limit))
    .lean();
  const total = await Material.countDocuments();

  res.status(StatusCodes.OK).json({
    success: true,
    pagination: { page: Number(page), limit: Number(limit), total },
    materials
  });
});

exports.getMaterialById = asyncHandler(async (req, res, next) => {
  const material = await Material.findById(req.params.id).lean();
  if (!material) {
    throw new APIError('Material not found', StatusCodes.NOT_FOUND);
  }

  res.status(StatusCodes.OK).json({
    success: true,
    material
  });
});

exports.updateMaterial = asyncHandler(async (req, res, next) => {
  const material = await Material.findById(req.params.id);
  if (!material) {
    throw new APIError('Material not found', StatusCodes.NOT_FOUND);
  }

  const updatedData = req.body;
  if (updatedData.name && updatedData.name !== material.name) {
    const existingMaterial = await Material.findOne({ name: updatedData.name });
    if (existingMaterial) {
      throw new APIError('Material name already in use', StatusCodes.CONFLICT);
    }
  }

  Object.assign(material, updatedData);
  await material.save();

  res.status(StatusCodes.OK).json({
    success: true,
    message: 'Material updated successfully',
    material
  });
});

exports.deleteMaterial = asyncHandler(async (req, res, next) => {
  const material = await Material.findById(req.params.id);
  if (!material) {
    throw new APIError('Material not found', StatusCodes.NOT_FOUND);
  }

  await material.deleteOne();
  res.status(StatusCodes.OK).json({
    success: true,
    message: 'Material deleted successfully'
  });
});