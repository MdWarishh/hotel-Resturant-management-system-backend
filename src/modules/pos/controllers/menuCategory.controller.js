import MenuCategory from '../models/MenuCategory.model.js';
import { successResponse } from '../../../utils/responseHandler.js';
import { HTTP_STATUS, USER_ROLES } from '../../../config/constants.js';
import asyncHandler from '../../../utils/asyncHandler.js';
import AppError from '../../../utils/AppError.js';

/**
 * Create Menu Category
 * POST /api/pos/categories
 * Access: Hotel Admin, Manager
 */
export const createCategory = asyncHandler(async (req, res) => {
  const { hotel, name, description, displayOrder, image } = req.body;

  // Authorization: Only allow for user's hotel
  let assignedHotel = hotel;
  if (req.user.role !== USER_ROLES.SUPER_ADMIN) {
    assignedHotel = req.user.hotel._id;
  }

  // Check if category already exists
  const existingCategory = await MenuCategory.findOne({
    hotel: assignedHotel,
    name: name.trim(),
  });

  if (existingCategory) {
    throw new AppError('Category with this name already exists', HTTP_STATUS.CONFLICT);
  }

  // Create category
  const category = await MenuCategory.create({
    hotel: assignedHotel,
    name: name.trim(),
    description,
    displayOrder,
    image,
    createdBy: req.user._id,
  });

  const populatedCategory = await MenuCategory.findById(category._id).populate(
    'hotel',
    'name code'
  );

  return successResponse(
    res,
    HTTP_STATUS.CREATED,
    'Category created successfully',
    { category: populatedCategory }
  );
});

/**
 * Get All Categories
 * GET /api/pos/categories
 * Access: Authenticated users
 */
export const getAllCategories = asyncHandler(async (req, res) => {
  const { hotel } = req.query;

  // Build query
  const query = { isActive: true };

  // If not super admin, only show their hotel's categories
  if (req.user.role !== USER_ROLES.SUPER_ADMIN) {
    query.hotel = req.user.hotel._id;
  } else if (hotel) {
    query.hotel = hotel;
  }

  const categories = await MenuCategory.find(query)
    .populate('hotel', 'name code')
    .sort({ displayOrder: 1, name: 1 });

  return successResponse(
    res,
    HTTP_STATUS.OK,
    'Categories fetched successfully',
    { categories, count: categories.length }
  );
});

/**
 * Get Single Category
 * GET /api/pos/categories/:id
 * Access: Authenticated users
 */
export const getCategoryById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const category = await MenuCategory.findById(id).populate('hotel', 'name code');

  if (!category) {
    throw new AppError('Category not found', HTTP_STATUS.NOT_FOUND);
  }

  // Authorization check
  if (req.user.role !== USER_ROLES.SUPER_ADMIN) {
    if (!req.user.hotel || category.hotel._id.toString() !== req.user.hotel._id.toString()) {
      throw new AppError('Access denied to this category', HTTP_STATUS.FORBIDDEN);
    }
  }

  return successResponse(
    res,
    HTTP_STATUS.OK,
    'Category details fetched successfully',
    { category }
  );
});

/**
 * Update Category
 * PUT /api/pos/categories/:id
 * Access: Hotel Admin, Manager
 */
export const updateCategory = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updateData = req.body;

  const category = await MenuCategory.findById(id);

  if (!category) {
    throw new AppError('Category not found', HTTP_STATUS.NOT_FOUND);
  }

  // Authorization check
  if (req.user.role !== USER_ROLES.SUPER_ADMIN) {
    if (!req.user.hotel || category.hotel.toString() !== req.user.hotel._id.toString()) {
      throw new AppError('Access denied to update this category', HTTP_STATUS.FORBIDDEN);
    }
  }

  // Check if updating name and it conflicts
  if (updateData.name && updateData.name.trim() !== category.name) {
    const existingCategory = await MenuCategory.findOne({
      hotel: category.hotel,
      name: updateData.name.trim(),
      _id: { $ne: id },
    });

    if (existingCategory) {
      throw new AppError('Category with this name already exists', HTTP_STATUS.CONFLICT);
    }
  }

  // Update category
  const updatedCategory = await MenuCategory.findByIdAndUpdate(id, updateData, {
    new: true,
    runValidators: true,
  }).populate('hotel', 'name code');

  return successResponse(
    res,
    HTTP_STATUS.OK,
    'Category updated successfully',
    { category: updatedCategory }
  );
});

/**
 * Delete Category
 * DELETE /api/pos/categories/:id
 * Access: Hotel Admin
 */
export const deleteCategory = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const category = await MenuCategory.findById(id);

  if (!category) {
    throw new AppError('Category not found', HTTP_STATUS.NOT_FOUND);
  }

  // Authorization check
  if (req.user.role === USER_ROLES.HOTEL_ADMIN) {
    if (!req.user.hotel || category.hotel.toString() !== req.user.hotel._id.toString()) {
      throw new AppError('Access denied to delete this category', HTTP_STATUS.FORBIDDEN);
    }
  }

  // Soft delete
  category.isActive = false;
  await category.save();

  return successResponse(res, HTTP_STATUS.OK, 'Category deleted successfully');
});