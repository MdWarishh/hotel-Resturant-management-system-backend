// backend/src/modules/pos/controllers/publicMenu.controller.js

import Hotel from '../../hotels/models/Hotel.model.js';
import MenuCategory from '../models/MenuCategory.model.js';
import MenuItem from '../models/MenuItem.model.js';
import Table from '../../tables/models/Table.model.js';
import Room from '../../rooms/models/Room.model.js';
import { successResponse } from '../../../utils/responseHandler.js';
import { HTTP_STATUS } from '../../../config/constants.js';
import asyncHandler from '../../../utils/asyncHandler.js';
import AppError from '../../../utils/AppError.js';

/**
 * 🌍 PUBLIC: Get All Active Hotels/Restaurants
 * GET /api/public/hotels
 * Access: Public (No Auth Required)
 */
export const getAllPublicHotels = asyncHandler(async (req, res) => {
  const { city, search } = req.query;

  // Build query
  const query = { status: 'active' };

  if (city) {
    query['address.city'] = new RegExp(city, 'i');
  }

  if (search) {
    query.$or = [
      { name: new RegExp(search, 'i') },
      { code: new RegExp(search, 'i') },
      { description: new RegExp(search, 'i') },
    ];
  }

  const hotels = await Hotel.find(query)
    .select('name code description address contact logo images amenities totalMenuCategories totalMenuItems')
    .sort({ name: 1 });

  return successResponse(
    res,
    HTTP_STATUS.OK,
    'Hotels fetched successfully',
    { hotels, count: hotels.length }
  );
});

/**
 * 🌍 PUBLIC: Get Hotel Details by Code
 * GET /api/public/hotels/:hotelCode
 * Access: Public (No Auth Required)
 */
export const getPublicHotelByCode = asyncHandler(async (req, res) => {
  const { hotelCode } = req.params;

  const hotel = await Hotel.findOne({ 
    code: hotelCode.toUpperCase(), 
    status: 'active' 
  }).select('name code description address contact logo images amenities settings');

  if (!hotel) {
    throw new AppError('Hotel not found or inactive', HTTP_STATUS.NOT_FOUND);
  }

  return successResponse(
    res,
    HTTP_STATUS.OK,
    'Hotel details fetched successfully',
    { hotel }
  );
});

/**
 * 🌍 PUBLIC: Get Full Menu by Hotel Code
 * GET /api/public/:hotelCode/menu
 * Access: Public (No Auth Required)
 */
export const getPublicMenu = asyncHandler(async (req, res) => {
  const { hotelCode } = req.params;

  // Find hotel by code
  const hotel = await Hotel.findOne({ 
    code: hotelCode.toUpperCase(), 
    status: 'active' 
  });

  if (!hotel) {
    throw new AppError('Hotel not found or inactive', HTTP_STATUS.NOT_FOUND);
  }

  // Get all active categories for this hotel
  const categories = await MenuCategory.find({
    hotel: hotel._id,
    isActive: true,
  })
    .select('name description image displayOrder')
    .sort({ displayOrder: 1, name: 1 });

  // Get all menu items grouped by category
  const menu = await Promise.all(
    categories.map(async (category) => {
      const items = await MenuItem.find({
        hotel: hotel._id,
        category: category._id,
        isActive: true,
        isAvailable: true, // Only show available items
      })
        .select('name description price variants type cuisine spicyLevel preparationTime tags images')
        .sort({ displayOrder: 1, name: 1 });

      return {
        category: {
          _id: category._id,
          name: category.name,
          description: category.description,
          image: category.image,
        },
        items,
        itemCount: items.length,
      };
    })
  );

  // Filter out empty categories
  const menuWithItems = menu.filter((cat) => cat.itemCount > 0);

  return successResponse(
    res,
    HTTP_STATUS.OK,
    'Menu fetched successfully',
    { 
      hotel: {
        name: hotel.name,
        code: hotel.code,
        description: hotel.description,
      },
      menu: menuWithItems,
      totalCategories: menuWithItems.length,
      totalItems: menuWithItems.reduce((sum, cat) => sum + cat.itemCount, 0),
    }
  );
});

/**
 * 🌍 PUBLIC: Get Categories by Hotel Code
 * GET /api/public/:hotelCode/categories
 * Access: Public (No Auth Required)
 */
export const getPublicCategories = asyncHandler(async (req, res) => {
  const { hotelCode } = req.params;

  // Find hotel by code
  const hotel = await Hotel.findOne({ 
    code: hotelCode.toUpperCase(), 
    status: 'active' 
  });

  if (!hotel) {
    throw new AppError('Hotel not found or inactive', HTTP_STATUS.NOT_FOUND);
  }

  const categories = await MenuCategory.find({
    hotel: hotel._id,
    isActive: true,
  })
    .select('name description image displayOrder')
    .sort({ displayOrder: 1, name: 1 });

  return successResponse(
    res,
    HTTP_STATUS.OK,
    'Categories fetched successfully',
    { categories, count: categories.length }
  );
});

/**
 * 🌍 PUBLIC: Get Menu Items by Category
 * GET /api/public/:hotelCode/categories/:categoryId/items
 * Access: Public (No Auth Required)
 */
export const getPublicCategoryItems = asyncHandler(async (req, res) => {
  const { hotelCode, categoryId } = req.params;

  // Find hotel by code
  const hotel = await Hotel.findOne({ 
    code: hotelCode.toUpperCase(), 
    status: 'active' 
  });

  if (!hotel) {
    throw new AppError('Hotel not found or inactive', HTTP_STATUS.NOT_FOUND);
  }

  // Verify category belongs to this hotel
  const category = await MenuCategory.findOne({
    _id: categoryId,
    hotel: hotel._id,
    isActive: true,
  });

  if (!category) {
    throw new AppError('Category not found', HTTP_STATUS.NOT_FOUND);
  }

  const items = await MenuItem.find({
    hotel: hotel._id,
    category: categoryId,
    isActive: true,
    isAvailable: true,
  })
    .select('name description price variants type cuisine spicyLevel preparationTime tags images')
    .sort({ displayOrder: 1, name: 1 });

  return successResponse(
    res,
    HTTP_STATUS.OK,
    'Category items fetched successfully',
    { 
      category: {
        _id: category._id,
        name: category.name,
        description: category.description,
      },
      items,
      count: items.length 
    }
  );
});

/**
 * 🌍 PUBLIC: Get Available Tables
 * GET /api/public/:hotelCode/tables/available
 * Access: Public (No Auth Required)
 */
export const getAvailableTables = asyncHandler(async (req, res) => {
  const { hotelCode } = req.params;

  // Find hotel by code
  const hotel = await Hotel.findOne({ 
    code: hotelCode.toUpperCase(), 
    status: 'active' 
  });

  if (!hotel) {
    throw new AppError('Hotel not found or inactive', HTTP_STATUS.NOT_FOUND);
  }

  // Get only available tables
  const tables = await Table.find({
    hotel: hotel._id,
    status: 'available',
  })
    .select('tableNumber capacity status')
    .sort({ tableNumber: 1 });

  return successResponse(
    res,
    HTTP_STATUS.OK,
    'Available tables fetched successfully',
    { tables, count: tables.length }
  );
});

/**
 * 🌍 PUBLIC: Get Available Rooms (for room service)
 * GET /api/public/:hotelCode/rooms/available
 * Access: Public (No Auth Required)
 */
export const getAvailableRooms = asyncHandler(async (req, res) => {
  const { hotelCode } = req.params;

  // Find hotel by code
  const hotel = await Hotel.findOne({ 
    code: hotelCode.toUpperCase(), 
    status: 'active' 
  });

  if (!hotel) {
    throw new AppError('Hotel not found or inactive', HTTP_STATUS.NOT_FOUND);
  }

  // Get occupied rooms (rooms with active bookings/guests)
  const rooms = await Room.find({
    hotel: hotel._id,
    status: 'occupied',
    isActive: true,
  })
    .select('roomNumber roomType floor')
    .sort({ floor: 1, roomNumber: 1 });

  return successResponse(
    res,
    HTTP_STATUS.OK,
    'Available rooms for service fetched successfully',
    { rooms, count: rooms.length }
  );
});

/**
 * 🌍 PUBLIC: Get Single Menu Item Details
 * GET /api/public/:hotelCode/items/:itemId
 * Access: Public (No Auth Required)
 */
export const getPublicMenuItem = asyncHandler(async (req, res) => {
  const { hotelCode, itemId } = req.params;

  // Find hotel by code
  const hotel = await Hotel.findOne({ 
    code: hotelCode.toUpperCase(), 
    status: 'active' 
  });

  if (!hotel) {
    throw new AppError('Hotel not found or inactive', HTTP_STATUS.NOT_FOUND);
  }

  const menuItem = await MenuItem.findOne({
    _id: itemId,
    hotel: hotel._id,
    isActive: true,
  })
    .select('name description price variants type cuisine spicyLevel preparationTime tags images allergens')
    .populate('category', 'name description');

  if (!menuItem) {
    throw new AppError('Menu item not found', HTTP_STATUS.NOT_FOUND);
  }

  if (!menuItem.isAvailable) {
    return successResponse(
      res,
      HTTP_STATUS.OK,
      'Item is currently unavailable',
      { menuItem, available: false }
    );
  }

  return successResponse(
    res,
    HTTP_STATUS.OK,
    'Menu item details fetched successfully',
    { menuItem, available: true }
  );
});