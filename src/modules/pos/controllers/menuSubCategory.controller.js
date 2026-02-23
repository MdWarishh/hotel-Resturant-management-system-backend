import MenuSubCategory from '../models/MenuSubCategory.model.js';
import MenuCategory from '../models/MenuCategory.model.js';
import { successResponse } from '../../../utils/responseHandler.js';
import { HTTP_STATUS, USER_ROLES } from '../../../config/constants.js';
import asyncHandler from '../../../utils/asyncHandler.js';
import AppError from '../../../utils/AppError.js';

/**
 * Create Menu Sub-Category
 * POST /api/pos/subcategories
 * Access: Hotel Admin, Manager
 */
export const createSubCategory = asyncHandler(async (req, res) => {
  const { hotel, category, name, description, displayOrder, image } = req.body;

  // Authorization: Only allow for user's hotel
  let assignedHotel = hotel;
  if (req.user.role !== USER_ROLES.SUPER_ADMIN) {
    assignedHotel = req.user.hotel._id;
  }

  // Verify parent category exists and belongs to hotel
  const parentCategory = await MenuCategory.findById(category);
  if (!parentCategory) {
    throw new AppError('Parent category not found', HTTP_STATUS.NOT_FOUND);
  }

  if (parentCategory.hotel.toString() !== assignedHotel.toString()) {
    throw new AppError('Category does not belong to this hotel', HTTP_STATUS.BAD_REQUEST);
  }

  // Check if sub-category already exists
  const existingSubCategory = await MenuSubCategory.findOne({
    category: category,
    name: name.trim(),
  });

  if (existingSubCategory) {
    throw new AppError('Sub-category with this name already exists', HTTP_STATUS.CONFLICT);
  }

  // Create sub-category
  const subCategory = await MenuSubCategory.create({
    hotel: assignedHotel,
    category,
    name: name.trim(),
    description,
    displayOrder,
    image,
    createdBy: req.user._id,
  });

  const populatedSubCategory = await MenuSubCategory.findById(subCategory._id)
    .populate('hotel', 'name code')
    .populate('category', 'name');

  return successResponse(
    res,
    HTTP_STATUS.CREATED,
    'Sub-category created successfully',
    { subCategory: populatedSubCategory }
  );
});

/**
 * Get All Sub-Categories (with optional filtering by category)
 * GET /api/pos/subcategories
 * Query: ?categoryId=xxx (optional)
 * Access: Authenticated users
 */
export const getAllSubCategories = asyncHandler(async (req, res) => {
  const { hotel, category } = req.query;

  // Build query
  const query = { isActive: true };

  // If not super admin, only show their hotel's sub-categories
  if (req.user.role !== USER_ROLES.SUPER_ADMIN) {
    query.hotel = req.user.hotel._id;
  } else if (hotel) {
    query.hotel = hotel;
  }

  if (category) {
    query.category = category;
  }

  const subCategories = await MenuSubCategory.find(query)
    .populate('hotel', 'name code')
    .populate('category', 'name')
    .sort({ displayOrder: 1, name: 1 });

  return successResponse(
    res,
    HTTP_STATUS.OK,
    'Sub-categories fetched successfully',
    { subCategories, count: subCategories.length }
  );
});

/**
 * Get Single Sub-Category
 * GET /api/pos/subcategories/:id
 * Access: Authenticated users
 */
export const getSubCategoryById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const subCategory = await MenuSubCategory.findById(id)
    .populate('hotel', 'name code')
    .populate('category', 'name description');

  if (!subCategory) {
    throw new AppError('Sub-category not found', HTTP_STATUS.NOT_FOUND);
  }

  // Authorization check
  if (req.user.role !== USER_ROLES.SUPER_ADMIN) {
    if (!req.user.hotel || subCategory.hotel._id.toString() !== req.user.hotel._id.toString()) {
      throw new AppError('Access denied to this sub-category', HTTP_STATUS.FORBIDDEN);
    }
  }

  return successResponse(
    res,
    HTTP_STATUS.OK,
    'Sub-category details fetched successfully',
    { subCategory }
  );
});

/**
 * Update Sub-Category
 * PUT /api/pos/subcategories/:id
 * Access: Hotel Admin, Manager
 */
export const updateSubCategory = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updateData = req.body;

  const subCategory = await MenuSubCategory.findById(id);

  if (!subCategory) {
    throw new AppError('Sub-category not found', HTTP_STATUS.NOT_FOUND);
  }

  // Authorization check
  if (req.user.role !== USER_ROLES.SUPER_ADMIN) {
    if (!req.user.hotel || subCategory.hotel.toString() !== req.user.hotel._id.toString()) {
      throw new AppError('Access denied to update this sub-category', HTTP_STATUS.FORBIDDEN);
    }
  }

  // Check if updating name and it conflicts
  if (updateData.name && updateData.name.trim() !== subCategory.name) {
    const existingSubCategory = await MenuSubCategory.findOne({
      category: subCategory.category,
      name: updateData.name.trim(),
      _id: { $ne: id },
    });

    if (existingSubCategory) {
      throw new AppError('Sub-category with this name already exists in this category', HTTP_STATUS.CONFLICT);
    }
  }

  // If changing category, verify new category exists
  if (updateData.category && updateData.category !== subCategory.category.toString()) {
    const newCategory = await MenuCategory.findById(updateData.category);
    if (!newCategory) {
      throw new AppError('New parent category not found', HTTP_STATUS.NOT_FOUND);
    }
  }

  // Update sub-category
  const updatedSubCategory = await MenuSubCategory.findByIdAndUpdate(id, updateData, {
    new: true,
    runValidators: true,
  })
    .populate('hotel', 'name code')
    .populate('category', 'name');

  return successResponse(
    res,
    HTTP_STATUS.OK,
    'Sub-category updated successfully',
    { subCategory: updatedSubCategory }
  );
});

/**
 * Delete Sub-Category
 * DELETE /api/pos/subcategories/:id
 * Access: Hotel Admin
 */
export const deleteSubCategory = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const subCategory = await MenuSubCategory.findById(id);

  if (!subCategory) {
    throw new AppError('Sub-category not found', HTTP_STATUS.NOT_FOUND);
  }

  // Authorization check
  if (req.user.role === USER_ROLES.HOTEL_ADMIN) {
    if (!req.user.hotel || subCategory.hotel.toString() !== req.user.hotel._id.toString()) {
      throw new AppError('Access denied to delete this sub-category', HTTP_STATUS.FORBIDDEN);
    }
  }

  // Soft delete
  subCategory.isActive = false;
  await subCategory.save();

  return successResponse(res, HTTP_STATUS.OK, 'Sub-category deleted successfully');
});

/**
 * Get Sub-Categories by Parent Category
 * GET /api/pos/categories/:categoryId/subcategories
 * Access: Authenticated users
 */
export const getSubCategoriesByCategory = asyncHandler(async (req, res) => {
  const { categoryId } = req.params;

  // Verify parent category exists
  const parentCategory = await MenuCategory.findById(categoryId);
  if (!parentCategory) {
    throw new AppError('Category not found', HTTP_STATUS.NOT_FOUND);
  }

  // Authorization check
  if (req.user.role !== USER_ROLES.SUPER_ADMIN) {
    if (!req.user.hotel || parentCategory.hotel.toString() !== req.user.hotel._id.toString()) {
      throw new AppError('Access denied to this category', HTTP_STATUS.FORBIDDEN);
    }
  }

  const subCategories = await MenuSubCategory.find({
    category: categoryId,
    isActive: true,
  })
    .populate('hotel', 'name code')
    .sort({ displayOrder: 1, name: 1 });

  return successResponse(
    res,
    HTTP_STATUS.OK,
    'Sub-categories fetched successfully',
    { subCategories, count: subCategories.length }
  );
});