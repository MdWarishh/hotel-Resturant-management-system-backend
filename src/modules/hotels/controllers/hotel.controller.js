import Hotel from '../models/Hotel.model.js';
import { successResponse, paginatedResponse } from '../../../utils/responseHandler.js';
import { HTTP_STATUS, PAGINATION, USER_ROLES } from '../../../config/constants.js';
import asyncHandler from '../../../utils/asyncHandler.js';
import AppError from '../../../utils/AppError.js';

/**
 * Create New Hotel
 * POST /api/hotels
 * Access: Super Admin only
 */
export const createHotel = asyncHandler(async (req, res) => {
  const {
    name,
    code,
    description,
    address,
    contact,
    gst,
    settings,
    amenities,
  } = req.body;

    // 🔥 SAFETY CHECK
  if (!gst?.number) {
    throw new AppError('GST number is required', HTTP_STATUS.BAD_REQUEST);
  }

  // Convert GST to uppercase first
  const gstNumber = gst.number.toUpperCase();

  // 🔥 Extract state code from GST (first 2 digits)
  const stateCodeFromGST = gstNumber.substring(0, 2);

  // Check if hotel code already exists
  const existingHotel = await Hotel.findOne({ code: code.toUpperCase() });
  if (existingHotel) {
    throw new AppError('Hotel code already exists', HTTP_STATUS.CONFLICT);
  }

  // Check if GST number already exists
  const existingGST = await Hotel.findOne({ 'gst.number': gst.number.toUpperCase() });
  if (existingGST) {
    throw new AppError('GST number already registered', HTTP_STATUS.CONFLICT);
  }

  // Create hotel
  const hotel = await Hotel.create({
    name,
    code: code.toUpperCase(),
    description,
    address: {
    ...address,
    stateCode: stateCodeFromGST,
  },
    contact,
    gst: {
      number: gst.number.toUpperCase(),
      name: gst.name,
    },
    settings,
    amenities,
    createdBy: req.user._id,
  });

  return successResponse(
    res,
    HTTP_STATUS.CREATED,
    'Hotel created successfully',
    { hotel }
  );
});

/**
 * Get All Hotels
 * GET /api/hotels
 * Access: Super Admin (all), Hotel Admin (only their hotel)
 */
export const getAllHotels = asyncHandler(async (req, res) => {
  const { page = 1, limit = PAGINATION.DEFAULT_LIMIT, status, city, state, search } = req.query;

  // Build query
  const query = {};

  // If not super admin, only show their hotel
  if (req.user.role !== USER_ROLES.SUPER_ADMIN) {
    query._id = req.user.hotel._id;
  }

  // Apply filters
  if (status) {
    query.status = status;
  }

  if (city) {
    query['address.city'] = new RegExp(city, 'i');
  }

  if (state) {
    query['address.state'] = new RegExp(state, 'i');
  }

  if (search) {
    query.$or = [
      { name: new RegExp(search, 'i') },
      { code: new RegExp(search, 'i') },
      { 'address.city': new RegExp(search, 'i') },
    ];
  }

  // Pagination
  const pageNum = parseInt(page);
  const limitNum = Math.min(parseInt(limit), PAGINATION.MAX_LIMIT);
  const skip = (pageNum - 1) * limitNum;

  // Fetch hotels
  const hotels = await Hotel.find(query)
    .populate('createdBy', 'name email')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limitNum);

  // Get total count
  const total = await Hotel.countDocuments(query);

  return paginatedResponse(
    res,
    hotels,
    pageNum,
    limitNum,
    total,
    'Hotels fetched successfully'
  );
});

/**
 * Get Single Hotel
 * GET /api/hotels/:id
 * Access: Super Admin (any), Others (only their hotel)
 */
export const getHotelById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  // Authorization check
  if (req.user.role !== USER_ROLES.SUPER_ADMIN) {
    if (!req.user.hotel || req.user.hotel._id.toString() !== id) {
      throw new AppError('Access denied to this hotel', HTTP_STATUS.FORBIDDEN);
    }
  }

  const hotel = await Hotel.findById(id).populate('createdBy', 'name email role');

  if (!hotel) {
    throw new AppError('Hotel not found', HTTP_STATUS.NOT_FOUND);
  }

  return successResponse(
    res,
    HTTP_STATUS.OK,
    'Hotel details fetched successfully',
    { hotel }
  );
});

/**
 * Update Hotel
 * PUT /api/hotels/:id
 * Access: Super Admin (any), Hotel Admin (only their hotel)
 */
export const updateHotel = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updateData = req.body;

  // Authorization check
  if (req.user.role === USER_ROLES.HOTEL_ADMIN) {
    if (!req.user.hotel || req.user.hotel._id.toString() !== id) {
      throw new AppError('Access denied to update this hotel', HTTP_STATUS.FORBIDDEN);
    }
  }

  // Find hotel
  const hotel = await Hotel.findById(id);

  if (!hotel) {
    throw new AppError('Hotel not found', HTTP_STATUS.NOT_FOUND);
  }

  // Check if updating code and it conflicts
  if (updateData.code && updateData.code.toUpperCase() !== hotel.code) {
    const existingCode = await Hotel.findOne({ 
      code: updateData.code.toUpperCase(),
      _id: { $ne: id }
    });
    if (existingCode) {
      throw new AppError('Hotel code already exists', HTTP_STATUS.CONFLICT);
    }
    updateData.code = updateData.code.toUpperCase();
  }

  // Check if updating GST and it conflicts
  if (updateData.gst?.number && updateData.gst.number.toUpperCase() !== hotel.gst.number) {
    const existingGST = await Hotel.findOne({ 
      'gst.number': updateData.gst.number.toUpperCase(),
      _id: { $ne: id }
    });
    if (existingGST) {
      throw new AppError('GST number already registered', HTTP_STATUS.CONFLICT);
    }
    updateData.gst.number = updateData.gst.number.toUpperCase();
  }

  // Update hotel
  const updatedHotel = await Hotel.findByIdAndUpdate(
    id,
    updateData,
    { new: true, runValidators: true }
  ).populate('createdBy', 'name email');

  return successResponse(
    res,
    HTTP_STATUS.OK,
    'Hotel updated successfully',
    { hotel: updatedHotel }
  );
});

/**
 * Delete Hotel
 * DELETE /api/hotels/:id
 * Access: Super Admin only
 */
export const deleteHotel = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const hotel = await Hotel.findById(id);

  if (!hotel) {
    throw new AppError('Hotel not found', HTTP_STATUS.NOT_FOUND);
  }

  // Instead of deleting, deactivate the hotel
  hotel.status = 'inactive';
  await hotel.save();

  return successResponse(
    res,
    HTTP_STATUS.OK,
    'Hotel deactivated successfully'
  );
});

/**
 * Get Hotel Statistics
 * GET /api/hotels/:id/stats
 * Access: Super Admin, Hotel Admin, Manager
 */
export const getHotelStats = asyncHandler(async (req, res) => {
  const { id } = req.params;

  // Authorization check
  if (req.user.role !== USER_ROLES.SUPER_ADMIN) {
    if (!req.user.hotel || req.user.hotel._id.toString() !== id) {
      throw new AppError('Access denied to this hotel', HTTP_STATUS.FORBIDDEN);
    }
  }

  const hotel = await Hotel.findById(id);

  if (!hotel) {
    throw new AppError('Hotel not found', HTTP_STATUS.NOT_FOUND);
  }

  // Get statistics (we'll implement detailed stats when we have rooms, bookings, etc.)
  const stats = {
    hotelInfo: {
      name: hotel.name,
      code: hotel.code,
      status: hotel.status,
      totalRooms: hotel.totalRooms,
    },
    // Placeholder for future stats
    rooms: {
      total: hotel.totalRooms,
      occupied: 0,
      available: 0,
    },
    revenue: {
      today: 0,
      thisMonth: 0,
      thisYear: 0,
    },
  };

  return successResponse(
    res,
    HTTP_STATUS.OK,
    'Hotel statistics fetched successfully',
    { stats }
  );
});