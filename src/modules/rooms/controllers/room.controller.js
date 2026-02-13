import mongoose from 'mongoose';
import Room from '../models/Room.model.js';
import Hotel from '../../hotels/models/Hotel.model.js';
import { successResponse, paginatedResponse } from '../../../utils/responseHandler.js';
import { HTTP_STATUS, PAGINATION, USER_ROLES, ROOM_STATUS } from '../../../config/constants.js';
import asyncHandler from '../../../utils/asyncHandler.js';
import AppError from '../../../utils/AppError.js';

/**
 * Create New Room
 * POST /api/rooms
 * Access: Super Admin, Hotel Admin
 */
export const createRoom = asyncHandler(async (req, res) => {
  const {
    hotel,
    roomNumber,
    roomType,
    floor,
    capacity,
    pricing,
    description,
    amenities,
    features,
    images,
  } = req.body;

  // Authorization: Hotel Admin can only create rooms for their hotel
  let assignedHotel = hotel;

  if (req.user.role === USER_ROLES.HOTEL_ADMIN) {
    assignedHotel = req.user.hotel._id;
  }

  // Verify hotel exists
  const hotelExists = await Hotel.findById(assignedHotel);
  if (!hotelExists) {
    throw new AppError('Hotel not found', HTTP_STATUS.NOT_FOUND);
  }

  // Check if room number already exists in this hotel
  const existingRoom = await Room.findOne({
    hotel: assignedHotel,
    roomNumber: roomNumber.toUpperCase(),
  });

  if (existingRoom) {
    throw new AppError('Room number already exists in this hotel', HTTP_STATUS.CONFLICT);
  }

  // Create room
  const room = await Room.create({
    hotel: assignedHotel,
    roomNumber: roomNumber.toUpperCase(),
    roomType,
    floor,
    capacity,
    pricing,
    description,
    amenities,
    features,
    images: images || [],
    createdBy: req.user._id,
  });

  // ✅ FIXED: Update hotel's total rooms count using updateOne (bypasses validation)
  await Hotel.updateOne(
    { _id: assignedHotel },
    { $inc: { totalRooms: 1 } }
  );

  const populatedRoom = await Room.findById(room._id).populate('hotel', 'name code');

  return successResponse(
    res,
    HTTP_STATUS.CREATED,
    'Room created successfully',
    { room: populatedRoom }
  );
});

/**
 * Get All Rooms
 * GET /api/rooms
 * Access: Authenticated users
 */
export const getAllRooms = asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = PAGINATION.DEFAULT_LIMIT,
    hotel,
    roomType,
    status,
    floor,
    search,
  } = req.query;

  // Build query
  const query = { isActive: true };

  // If not super admin, only show their hotel's rooms
  if (req.user.role !== USER_ROLES.SUPER_ADMIN) {
    query.hotel = req.user.hotel._id;
  } else if (hotel && mongoose.Types.ObjectId.isValid(hotel)) {
    query.hotel = hotel;
  }

  // Apply filters
  if (roomType) {
    query.roomType = roomType;
  }

  if (status) {
    query.status = status;
  }

  if (floor) {
    query.floor = parseInt(floor);
  }

  if (search) {
    query.$or = [
      { roomNumber: new RegExp(search, 'i') },
      { description: new RegExp(search, 'i') },
    ];
  }

  // Pagination
  const pageNum = parseInt(page);
  const limitNum = Math.min(parseInt(limit), PAGINATION.MAX_LIMIT);
  const skip = (pageNum - 1) * limitNum;

  // Fetch rooms
  const rooms = await Room.find(query)
    .populate('hotel', 'name code address.city')
    .populate('createdBy', 'name email')
    .populate('currentBooking')
    .sort({ floor: 1, roomNumber: 1 })
    .skip(skip)
    .limit(limitNum);

  // Get total count
  const total = await Room.countDocuments(query);

  return paginatedResponse(
    res,
    rooms,
    pageNum,
    limitNum,
    total,
    'Rooms fetched successfully'
  );
});

/**
 * Get Single Room
 * GET /api/rooms/:id
 * Access: Authenticated users
 */
export const getRoomById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const room = await Room.findById(id)
    .populate('hotel', 'name code address contact')
    .populate('createdBy', 'name email')
    .populate('currentBooking');

  if (!room) {
    throw new AppError('Room not found', HTTP_STATUS.NOT_FOUND);
  }

  // Authorization check
  if (req.user.role !== USER_ROLES.SUPER_ADMIN) {
    if (!req.user.hotel || room.hotel._id.toString() !== req.user.hotel._id.toString()) {
      throw new AppError('Access denied to this room', HTTP_STATUS.FORBIDDEN);
    }
  }

  return successResponse(
    res,
    HTTP_STATUS.OK,
    'Room details fetched successfully',
    { room }
  );
});

/**
 * Update Room
 * PUT /api/rooms/:id
 * Access: Super Admin, Hotel Admin
 */
export const updateRoom = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updateData = req.body;

  // Find room
  const room = await Room.findById(id);

  if (!room) {
    throw new AppError('Room not found', HTTP_STATUS.NOT_FOUND);
  }

  // Authorization check
  if (req.user.role === USER_ROLES.HOTEL_ADMIN) {
    if (!req.user.hotel || room.hotel.toString() !== req.user.hotel._id.toString()) {
      throw new AppError('Access denied to update this room', HTTP_STATUS.FORBIDDEN);
    }
  }

  // Check if updating room number and it conflicts
  if (updateData.roomNumber && updateData.roomNumber.toUpperCase() !== room.roomNumber) {
    const existingRoom = await Room.findOne({
      hotel: room.hotel,
      roomNumber: updateData.roomNumber.toUpperCase(),
      _id: { $ne: id },
    });

    if (existingRoom) {
      throw new AppError('Room number already exists in this hotel', HTTP_STATUS.CONFLICT);
    }

    updateData.roomNumber = updateData.roomNumber.toUpperCase();
  }

  if (updateData.images && Array.isArray(updateData.images)) {
    // This ensures that the objects have the required url and public_id
    updateData.images = updateData.images.map(img => ({
      url: img.url,
      public_id: img.public_id,
      isPrimary: img.isPrimary || false
    }));
  }

  // Update room
  const updatedRoom = await Room.findByIdAndUpdate(id, updateData, {
    new: true,
    runValidators: true,
  }).populate('hotel', 'name code');

  return successResponse(
    res,
    HTTP_STATUS.OK,
    'Room updated successfully',
    { room: updatedRoom }
  );
});

/**
 * Delete Room
 * DELETE /api/rooms/:id
 * Access: Super Admin, Hotel Admin
 */
export const deleteRoom = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const room = await Room.findById(id);

  if (!room) {
    throw new AppError('Room not found', HTTP_STATUS.NOT_FOUND);
  }

  // Authorization check
  if (req.user.role === USER_ROLES.HOTEL_ADMIN) {
    if (!req.user.hotel || room.hotel.toString() !== req.user.hotel._id.toString()) {
      throw new AppError('Access denied to delete this room', HTTP_STATUS.FORBIDDEN);
    }
  }

  // Check if room is occupied
  if (room.status === ROOM_STATUS.OCCUPIED) {
    throw new AppError('Cannot delete occupied room', HTTP_STATUS.BAD_REQUEST);
  }

  // Soft delete - set isActive to false
  room.isActive = false;
  await room.save();

  // ✅ FIXED: Update hotel's total rooms count using updateOne
  await Hotel.updateOne(
    { _id: room.hotel },
    { $inc: { totalRooms: -1 } }
  );

  return successResponse(res, HTTP_STATUS.OK, 'Room deleted successfully');
});

/**
 * Update Room Status
 * PATCH /api/rooms/:id/status
 * Access: Hotel Admin, Manager, Cashier
 */
export const updateRoomStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status, notes } = req.body;

  if (!status) {
    throw new AppError('Status is required', HTTP_STATUS.BAD_REQUEST);
  }

  const room = await Room.findById(id);

  if (!room) {
    throw new AppError('Room not found', HTTP_STATUS.NOT_FOUND);
  }

  // Authorization check
  if (req.user.role !== USER_ROLES.SUPER_ADMIN) {
    if (!req.user.hotel || room.hotel.toString() !== req.user.hotel._id.toString()) {
      throw new AppError('Access denied to update this room', HTTP_STATUS.FORBIDDEN);
    }
  }

  // Update status
  room.status = status;

  if (status === ROOM_STATUS.MAINTENANCE && notes) {
    room.maintenanceNotes = notes;
    room.lastMaintenance = new Date();
  }

  if (status === ROOM_STATUS.AVAILABLE) {
    room.lastCleaned = new Date();
    room.currentBooking = null;
  }

  await room.save();

  return successResponse(
    res,
    HTTP_STATUS.OK,
    'Room status updated successfully',
    { room }
  );
});

/**
 * Get Available Rooms
 * GET /api/rooms/available
 * Access: Authenticated users
 */
export const getAvailableRooms = asyncHandler(async (req, res) => {
  const { hotel, roomType, checkIn, checkOut } = req.query;

  // Build query
  const query = {
    isActive: true,
    status: ROOM_STATUS.AVAILABLE,
  };

  // If not super admin, only show their hotel's rooms
  if (req.user.role !== USER_ROLES.SUPER_ADMIN) {
    query.hotel = req.user.hotel._id;
  } else if (hotel && mongoose.Types.ObjectId.isValid(hotel)) {
    query.hotel = hotel;
  }

  if (roomType) {
    query.roomType = roomType;
  }

  const rooms = await Room.find(query)
    .populate('hotel', 'name code')
    .sort({ floor: 1, roomNumber: 1 });

  return successResponse(
    res,
    HTTP_STATUS.OK,
    'Available rooms fetched successfully',
    { rooms, count: rooms.length }
  );
});