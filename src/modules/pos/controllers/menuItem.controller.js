import MenuItem from '../models/MenuItem.model.js';
import MenuCategory from '../models/MenuCategory.model.js';
import MenuSubCategory from '../models/MenuSubCategory.model.js';
import { successResponse, paginatedResponse } from '../../../utils/responseHandler.js';
import { HTTP_STATUS, PAGINATION, USER_ROLES } from '../../../config/constants.js';
import asyncHandler from '../../../utils/asyncHandler.js';
import AppError from '../../../utils/AppError.js';

/**
 * Create Menu Item
 * POST /api/pos/items
 * Access: Hotel Admin, Manager
 */
export const createMenuItem = asyncHandler(async (req, res) => {
  const {
    hotel,
    category,
    name,
    description,
    price,
    variants,
    type,
    cuisine,
    spicyLevel,
    preparationTime,
    tags,
    images,
    ingredients,
    allergens,
  } = req.body;

  // Authorization: Only allow for user's hotel
  let assignedHotel = hotel;
  if (req.user.role !== USER_ROLES.SUPER_ADMIN) {
    assignedHotel = req.user.hotel._id;
  }

  // Verify category exists and belongs to hotel
  const categoryData = await MenuCategory.findById(category);
  if (!categoryData) {
    throw new AppError('Category not found', HTTP_STATUS.NOT_FOUND);
  }

  if (categoryData.hotel.toString() !== assignedHotel.toString()) {
    throw new AppError('Category does not belong to this hotel', HTTP_STATUS.BAD_REQUEST);
  }

  // Create menu item
  const menuItem = await MenuItem.create({
    hotel: assignedHotel,
    category,
    name: name.trim(),
    description,
    price,
    variants,
    type,
    cuisine,
    spicyLevel,
    preparationTime,
    tags,
    images,
    ingredients,
    allergens,
    createdBy: req.user._id,
  });

  const populatedItem = await MenuItem.findById(menuItem._id)
    .populate('hotel', 'name code')
    .populate('category', 'name');

  return successResponse(
    res,
    HTTP_STATUS.CREATED,
    'Menu item created successfully',
    { menuItem: populatedItem }
  );
});

/**
 * Get All Menu Items
 * GET /api/pos/items
 * Access: Authenticated users
 */
export const getAllMenuItems = asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = PAGINATION.DEFAULT_LIMIT,
    hotel,
    category,
    type,
    search,
    isAvailable,
  } = req.query;

  // Build query
  const query = { isActive: true };

  // If not super admin, only show their hotel's items
  if (req.user.role !== USER_ROLES.SUPER_ADMIN) {
    query.hotel = req.user.hotel._id;
  } else if (hotel) {
    query.hotel = hotel;
  }

  if (category) {
    query.category = category;
  }

  if (type) {
    query.type = type;
  }

  if (isAvailable !== undefined) {
    query.isAvailable = isAvailable === 'true';
  }

  if (search) {
    query.$or = [
      { name: new RegExp(search, 'i') },
      { description: new RegExp(search, 'i') },
      { tags: new RegExp(search, 'i') },
    ];
  }

  // Pagination
  const pageNum = parseInt(page);
  const limitNum = Math.min(parseInt(limit), PAGINATION.MAX_LIMIT);
  const skip = (pageNum - 1) * limitNum;

  // Fetch menu items
  const menuItems = await MenuItem.find(query)
    .populate('hotel', 'name code')
    .populate('category', 'name')
    .sort({ displayOrder: 1, name: 1 })
    .skip(skip)
    .limit(limitNum);

  // Get total count
  const total = await MenuItem.countDocuments(query);

  return paginatedResponse(
    res,
    menuItems,
    pageNum,
    limitNum,
    total,
    'Menu items fetched successfully'
  );
});

/**
 * Get Single Menu Item
 * GET /api/pos/items/:id
 * Access: Authenticated users
 */
export const getMenuItemById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const menuItem = await MenuItem.findById(id)
    .populate('hotel', 'name code')
    .populate('category', 'name description')
    .populate('ingredients.inventoryItem', 'name unit');

  if (!menuItem) {
    throw new AppError('Menu item not found', HTTP_STATUS.NOT_FOUND);
  }

  // Authorization check
  if (req.user.role !== USER_ROLES.SUPER_ADMIN) {
    if (!req.user.hotel || menuItem.hotel._id.toString() !== req.user.hotel._id.toString()) {
      throw new AppError('Access denied to this menu item', HTTP_STATUS.FORBIDDEN);
    }
  }

  return successResponse(
    res,
    HTTP_STATUS.OK,
    'Menu item details fetched successfully',
    { menuItem }
  );
});

/**
 * Update Menu Item
 * PUT /api/pos/items/:id
 * Access: Hotel Admin, Manager
 */
export const updateMenuItem = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updateData = req.body;

  const menuItem = await MenuItem.findById(id);

  if (!menuItem) {
    throw new AppError('Menu item not found', HTTP_STATUS.NOT_FOUND);
  }

  // Authorization check
  if (req.user.role !== USER_ROLES.SUPER_ADMIN) {
    if (!req.user.hotel || menuItem.hotel.toString() !== req.user.hotel._id.toString()) {
      throw new AppError('Access denied to update this item', HTTP_STATUS.FORBIDDEN);
    }
  }

  // If updating category, verify it belongs to the same hotel
  if (updateData.category && updateData.category !== menuItem.category.toString()) {
    const categoryData = await MenuCategory.findById(updateData.category);
    if (!categoryData) {
      throw new AppError('Category not found', HTTP_STATUS.NOT_FOUND);
    }
    if (categoryData.hotel.toString() !== menuItem.hotel.toString()) {
      throw new AppError('Category does not belong to this hotel', HTTP_STATUS.BAD_REQUEST);
    }
  }

  // Update menu item
  const updatedItem = await MenuItem.findByIdAndUpdate(id, updateData, {
    new: true,
    runValidators: true,
  })
    .populate('hotel', 'name code')
    .populate('category', 'name');

  return successResponse(
    res,
    HTTP_STATUS.OK,
    'Menu item updated successfully',
    { menuItem: updatedItem }
  );
});

/**
 * Toggle Item Availability
 * PATCH /api/pos/items/:id/availability
 * Access: Hotel Admin, Manager, Cashier
 */
export const toggleAvailability = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { isAvailable } = req.body;

  const menuItem = await MenuItem.findById(id);

  if (!menuItem) {
    throw new AppError('Menu item not found', HTTP_STATUS.NOT_FOUND);
  }

  // Authorization check
  if (req.user.role !== USER_ROLES.SUPER_ADMIN) {
    if (!req.user.hotel || menuItem.hotel.toString() !== req.user.hotel._id.toString()) {
      throw new AppError('Access denied to update this item', HTTP_STATUS.FORBIDDEN);
    }
  }

  menuItem.isAvailable = isAvailable;
  await menuItem.save();

  return successResponse(
    res,
    HTTP_STATUS.OK,
    `Item marked as ${isAvailable ? 'available' : 'unavailable'}`,
    { menuItem }
  );
});

/**
 * Delete Menu Item
 * DELETE /api/pos/items/:id
 * Access: Hotel Admin
 */
export const deleteMenuItem = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const menuItem = await MenuItem.findById(id);

  if (!menuItem) {
    throw new AppError('Menu item not found', HTTP_STATUS.NOT_FOUND);
  }

  // Authorization check
  if (req.user.role === USER_ROLES.HOTEL_ADMIN) {
    if (!req.user.hotel || menuItem.hotel.toString() !== req.user.hotel._id.toString()) {
      throw new AppError('Access denied to delete this item', HTTP_STATUS.FORBIDDEN);
    }
  }

  // Soft delete
  menuItem.isActive = false;
  await menuItem.save();

  return successResponse(res, HTTP_STATUS.OK, 'Menu item deleted successfully');
});

/**
 * Get Menu by Category
 * GET /api/pos/menu
 * Access: Authenticated users
 */
export const getFullMenu = asyncHandler(async (req, res) => {
  const { hotel } = req.query;

  let assignedHotel = hotel;
  if (req.user.role !== USER_ROLES.SUPER_ADMIN) {
    assignedHotel = req.user.hotel._id;
  }

  const categories = await MenuCategory.find({
    hotel: assignedHotel,
    isActive: true,
  }).sort({ displayOrder: 1 });

  const menu = await Promise.all(
    categories.map(async (category) => {
      // ✅ NEW: Get sub-categories for this category
      const subCategories = await MenuSubCategory.find({
        category: category._id,
        isActive: true,
      }).sort({ displayOrder: 1 });

      // ✅ NEW: Get items for each sub-category
      const subCategoryItems = await Promise.all(
        subCategories.map(async (subCat) => {
          const items = await MenuItem.find({
            hotel: assignedHotel,
            subCategory: subCat._id,
            isActive: true,
            isAvailable: true,
          }).sort({ displayOrder: 1, name: 1 });

          return {
            subCategory: {
              _id: subCat._id,
              name: subCat.name,
              description: subCat.description,
              image: subCat.image,
              displayOrder: subCat.displayOrder,
            },
            items,
          };
        })
      );

      // ✅ NEW: Get direct items (items without sub-category)
      const directItems = await MenuItem.find({
        hotel: assignedHotel,
        category: category._id,
        subCategory: { $in: [null, undefined] },
        isActive: true,
        isAvailable: true,
      }).sort({ displayOrder: 1, name: 1 });

      return {
        category: {
          _id: category._id,
          name: category.name,
          description: category.description,
          image: category.image,
          displayOrder: category.displayOrder,
        },
        subCategories: subCategoryItems,  // ← NEW
        items: directItems,                // Items without sub-category (optional)
      };
    })
  );

  return successResponse(
    res,
    HTTP_STATUS.OK,
    'Full menu fetched successfully',
    { menu }
  );
});