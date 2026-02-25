import Booking from '../models/Booking.model.js';
import Room from '../models/Room.model.js';
import Hotel from '../../hotels/models/Hotel.model.js';
import { successResponse, paginatedResponse } from '../../../utils/responseHandler.js';
import { HTTP_STATUS, PAGINATION, USER_ROLES, BOOKING_STATUS, ROOM_STATUS, PAYMENT_STATUS, GST_RATE } from '../../../config/constants.js';
import asyncHandler from '../../../utils/asyncHandler.js';
import AppError from '../../../utils/AppError.js';
import PDFDocument from 'pdfkit';

/**
 * 🔥 UPDATED: Check Room Availability for Hourly/Daily Bookings
 * Helper function to check if room is available for the requested time period
 */
const checkRoomAvailability = async (roomId, checkIn, checkOut, bookingType, excludeBookingId = null) => {
  const query = {
    room: roomId,
    status: { $in: [BOOKING_STATUS.CONFIRMED, BOOKING_STATUS.CHECKED_IN, BOOKING_STATUS.RESERVED] },
  };

  if (excludeBookingId) {
    query._id = { $ne: excludeBookingId };
  }

  // Find all active bookings for this room
  const existingBookings = await Booking.find(query);

  // Check for conflicts
  for (const booking of existingBookings) {
    const existingCheckIn = new Date(booking.dates.checkIn);
    const existingCheckOut = new Date(booking.dates.checkOut);
    const newCheckIn = new Date(checkIn);
    const newCheckOut = new Date(checkOut);

    // Check if dates overlap
    const hasConflict =
      (newCheckIn >= existingCheckIn && newCheckIn < existingCheckOut) ||
      (newCheckOut > existingCheckIn && newCheckOut <= existingCheckOut) ||
      (newCheckIn <= existingCheckIn && newCheckOut >= existingCheckOut);

    if (hasConflict) {
      return {
        available: false,
        conflictingBooking: booking,
      };
    }
  }

  return { available: true };
};

/**
 * 🔥 UPDATED: Create New Booking (with Hourly Support)
 * POST /api/bookings
 * Access: Hotel Admin, Manager, Cashier
 */
export const createBooking = asyncHandler(async (req, res) => {
  const {
    hotel,
    room: roomId,
    guest,
    numberOfGuests,
    dates,
    specialRequests,
    advancePayment,
    source,
    bookingType = 'daily', // 🔥 NEW
    hours, // 🔥 NEW
  } = req.body;

  // Authorization: Only allow booking for user's hotel
  let assignedHotel = hotel;
  if (req.user.role !== USER_ROLES.SUPER_ADMIN) {
    assignedHotel = req.user.hotel._id;
  }

  // Verify hotel and room exist
  const hotelData = await Hotel.findById(assignedHotel);
  if (!hotelData) {
    throw new AppError('Hotel not found', HTTP_STATUS.NOT_FOUND);
  }

  const room = await Room.findById(roomId);
  if (!room) {
    throw new AppError('Room not found', HTTP_STATUS.NOT_FOUND);
  }

  // Verify room belongs to the hotel
  if (room.hotel.toString() !== assignedHotel.toString()) {
    throw new AppError('Room does not belong to this hotel', HTTP_STATUS.BAD_REQUEST);
  }

  // 🔥 NEW: Check if room supports hourly bookings
  if (bookingType === 'hourly' && !room.supportsHourlyBooking()) {
    throw new AppError('This room does not support hourly bookings', HTTP_STATUS.BAD_REQUEST);
  }

  // Check if room is available
  if (room.status !== ROOM_STATUS.AVAILABLE) {
    throw new AppError('Room is not available', HTTP_STATUS.BAD_REQUEST);
  }

  // Validate dates
  const checkIn = new Date(dates.checkIn);
  const checkOut = new Date(dates.checkOut);

  if (checkIn >= checkOut) {
    throw new AppError('Check-out date/time must be after check-in date/time', HTTP_STATUS.BAD_REQUEST);
  }

  // 🔥 NEW: Check room availability for the time period
  const availabilityCheck = await checkRoomAvailability(roomId, checkIn, checkOut, bookingType);
  if (!availabilityCheck.available) {
    throw new AppError(
      `Room is already booked for this time period (Booking #${availabilityCheck.conflictingBooking.bookingNumber})`,
      HTTP_STATUS.CONFLICT
    );
  }

  // 🔥 UPDATED: Calculate pricing based on booking type
 let roomCharges = 0;
  let duration = 0;

  if (bookingType === 'hourly') {
    // Hourly booking calculation
    duration = hours;
    
    // 🔥 NEW: Check if manual hourly rate is provided
    if (req.body.manualHourlyRate && req.body.manualHourlyRate > 0) {
      // Use custom/manual hourly rate set by admin
      roomCharges = req.body.manualHourlyRate * hours;
    } else {
      // Use room's default hourly rate or auto-calculate (40% of daily rate)
      const hourlyRate = room.pricing.hourlyRate > 0 
        ? room.pricing.hourlyRate 
        : Math.ceil(room.pricing.basePrice * 0.4);
      roomCharges = hourlyRate * hours;
    }
  } else {
    // Daily booking calculation (unchanged)
    duration = Math.ceil((checkOut - checkIn) / (1000 * 60 * 60 * 24));
    roomCharges = room.pricing.basePrice * duration;
  }

  // Add extra guest charges (only for daily bookings)
  let extraCharges = 0;
  if (bookingType === 'daily') {
    if (numberOfGuests.adults > room.capacity.adults) {
      const extraAdults = numberOfGuests.adults - room.capacity.adults;
      extraCharges += extraAdults * (room.pricing.extraAdultCharge || 0) * duration;
    }
    if (numberOfGuests.children > room.capacity.children) {
      const extraChildren = numberOfGuests.children - room.capacity.children;
      extraCharges += extraChildren * (room.pricing.extraChildCharge || 0) * duration;
    }
  }

  const subtotal = roomCharges + extraCharges;
  const tax = Math.ceil((subtotal * GST_RATE) / 100);
  const total = Math.ceil(subtotal + tax);

  // 🔥 NEW: Store manual rate if provided (for record keeping)
  const pricingData = {
    roomCharges,
    extraCharges,
    discount: 0,
    subtotal,
    tax,
    total,
  };

  // Add manual rate to pricing if it was used
  if (bookingType === 'hourly' && req.body.manualHourlyRate) {
    pricingData.manualHourlyRate = req.body.manualHourlyRate; // Store for audit
  }

  // Create booking (update line 151 onwards)
  const booking = await Booking.create({
    hotel: assignedHotel,
    room: roomId,
    bookingType,
    hours: bookingType === 'hourly' ? hours : undefined,
    guest: {
      ...guest,
      idProof: {
        ...guest.idProof,
        image: {
          url: guest.idProof?.imageBase64,
        },
      },
    },
    numberOfGuests,
    dates: {
      checkIn,
      checkOut,
    },
    pricing: pricingData, // 🔥 UPDATED: Use pricingData with manual rate
    status: BOOKING_STATUS.CONFIRMED,
    advancePayment: advancePayment || 0,
    specialRequests,
    createdBy: req.user._id,
    source: source || 'Direct',
  });


  // Update room status to reserved
  room.status = ROOM_STATUS.RESERVED;
  room.currentBooking = booking._id;
  await room.save();

  const populatedBooking = await Booking.findById(booking._id)
    .populate('hotel', 'name code address contact gst')
    .populate('room', 'roomNumber roomType')
    .populate('createdBy', 'name email');

  return successResponse(
    res,
    HTTP_STATUS.CREATED,
    'Booking created successfully',
    { booking: populatedBooking }
  );
});

/**
 * Check-In Guest
 * POST /api/bookings/:id/checkin
 * Access: Hotel Admin, Manager, Cashier
 */
export const checkInGuest = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const booking = await Booking.findById(id)
    .populate('room')
    .populate('hotel', 'name code address contact gst');

  if (!booking) {
    throw new AppError('Booking not found', HTTP_STATUS.NOT_FOUND);
  }

  // Authorization check
  if (req.user.role !== USER_ROLES.SUPER_ADMIN) {
    if (!req.user.hotel || booking.hotel._id.toString() !== req.user.hotel._id.toString()) {
      throw new AppError('Access denied to this booking', HTTP_STATUS.FORBIDDEN);
    }
  }

  // Check if already checked in
  if (booking.status === BOOKING_STATUS.CHECKED_IN) {
    throw new AppError('Guest is already checked in', HTTP_STATUS.BAD_REQUEST);
  }

  // Check if booking is confirmed
  if (booking.status !== BOOKING_STATUS.CONFIRMED && booking.status !== BOOKING_STATUS.RESERVED) {
    throw new AppError('Booking must be confirmed to check in', HTTP_STATUS.BAD_REQUEST);
  }

  // Update booking
  booking.status = BOOKING_STATUS.CHECKED_IN;
  booking.dates.actualCheckIn = new Date();
  booking.checkedInBy = req.user._id;
  await booking.save();

  // Update room status
  const room = await Room.findById(booking.room._id);
  if (room) {
    room.status = ROOM_STATUS.OCCUPIED;
    await room.save();
  }

  const updatedBooking = await Booking.findById(id)
    .populate('hotel', 'name code address contact gst')
    .populate('room', 'roomNumber roomType')
    .populate('checkedInBy', 'name email');

  return successResponse(
    res,
    HTTP_STATUS.OK,
    'Guest checked in successfully',
    { booking: updatedBooking }
  );
});

/**
 * Check-Out Guest
 * POST /api/bookings/:id/checkout
 * Access: Hotel Admin, Manager, Cashier
 */
export const checkOutGuest = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const booking = await Booking.findById(id)
    .populate('room')
    .populate('hotel', 'name code address contact gst');

  if (!booking) {
    throw new AppError('Booking not found', HTTP_STATUS.NOT_FOUND);
  }

  // Authorization check
  if (req.user.role !== USER_ROLES.SUPER_ADMIN) {
    if (!req.user.hotel || booking.hotel._id.toString() !== req.user.hotel._id.toString()) {
      throw new AppError('Access denied to this booking', HTTP_STATUS.FORBIDDEN);
    }
  }

  // Check if checked in
  if (booking.status !== BOOKING_STATUS.CHECKED_IN) {
    throw new AppError('Guest must be checked in to check out', HTTP_STATUS.BAD_REQUEST);
  }

  // Payment must be cleared before checkout
  if (booking.paymentStatus !== PAYMENT_STATUS.PAID) {
    throw new AppError(
      'Complete payment before checkout',
      HTTP_STATUS.BAD_REQUEST
    );
  }

  // Update booking
  booking.status = BOOKING_STATUS.CHECKED_OUT;
  booking.dates.actualCheckOut = new Date();
  booking.checkedOutBy = req.user._id;
  await booking.save();

  // Update room status to available after checkout
  const room = await Room.findById(booking.room._id);
  if (room) {
    room.status = ROOM_STATUS.AVAILABLE;
    room.currentBooking = null;
    room.lastCleaned = new Date(); // lastCleaned timestamp bhi update karo
    await room.save();
  }

  const updatedBooking = await Booking.findById(id)
    .populate('hotel', 'name code address contact gst')
    .populate('room', 'roomNumber roomType')
    .populate('checkedOutBy', 'name email');

  return successResponse(
    res,
    HTTP_STATUS.OK,
    'Guest checked out successfully',
    { booking: updatedBooking }
  );
});

/**
 * Get All Bookings
 * GET /api/bookings
 * Access: Authenticated users
 */
export const getAllBookings = asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = PAGINATION.DEFAULT_LIMIT,
    hotel,
    status,
    search,
    bookingType, // 🔥 NEW filter
  } = req.query;

  // Build query
  const query = {};

  // If not super admin, only show their hotel's bookings
  if (req.user.role !== USER_ROLES.SUPER_ADMIN) {
    query.hotel = req.user.hotel._id;
  } else if (hotel) {
    query.hotel = hotel;
  }

  // Filter by status
  if (status) {
    query.status = status;
  }

  // 🔥 NEW: Filter by booking type
  if (bookingType && ['daily', 'hourly'].includes(bookingType)) {
    query.bookingType = bookingType;
  }

  // Search by booking number, guest name, or phone
  if (search) {
    query.$or = [
      { bookingNumber: new RegExp(search, 'i') },
      { 'guest.name': new RegExp(search, 'i') },
      { 'guest.phone': new RegExp(search, 'i') },
    ];
  }

  // Pagination
  const pageNum = parseInt(page);
  const limitNum = Math.min(parseInt(limit), PAGINATION.MAX_LIMIT);
  const skip = (pageNum - 1) * limitNum;

  // Fetch bookings
  const bookings = await Booking.find(query)
    .populate('hotel', 'name code address contact gst')
    .populate('room', 'roomNumber roomType')
    .populate('createdBy', 'name email')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limitNum);

  // Get total count
  const total = await Booking.countDocuments(query);

  return paginatedResponse(
    res,
    bookings,
    pageNum,
    limitNum,
    total,
    'Bookings fetched successfully'
  );
});

/**
 * Get Single Booking
 * GET /api/bookings/:id
 * Access: Authenticated users
 */
export const getBookingById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const booking = await Booking.findById(id)
    .populate('hotel', 'name code address contact gst')
    .populate('room', 'roomNumber roomType floor pricing features')
    .populate('createdBy', 'name email')
    .populate('checkedInBy', 'name email')
    .populate('checkedOutBy', 'name email');

  if (!booking) {
    throw new AppError('Booking not found', HTTP_STATUS.NOT_FOUND);
  }

  // Authorization check
  if (req.user.role !== USER_ROLES.SUPER_ADMIN) {
    if (!req.user.hotel || booking.hotel._id.toString() !== req.user.hotel._id.toString()) {
      throw new AppError('Access denied to this booking', HTTP_STATUS.FORBIDDEN);
    }
  }

  return successResponse(
    res,
    HTTP_STATUS.OK,
    'Booking details fetched successfully',
    { booking }
  );
});




/* ---------------- CANCEL BOOKING ---------------- */
export const cancelBooking = asyncHandler(async (req, res) => {
  const booking = await Booking.findById(req.params.id);

  if (!booking) {
    throw new AppError('Booking not found', HTTP_STATUS.NOT_FOUND);
  }

  if (![BOOKING_STATUS.CONFIRMED, BOOKING_STATUS.RESERVED].includes(booking.status)) {
    throw new AppError('Only confirmed or reserved bookings can be cancelled', HTTP_STATUS.BAD_REQUEST);
  }

  booking.status = BOOKING_STATUS.CANCELLED;
  await booking.save();

  await Room.findByIdAndUpdate(booking.room, {
    status: ROOM_STATUS.AVAILABLE,
  });

  res.status(HTTP_STATUS.OK).json({
    success: true,
    message: 'Booking cancelled successfully',
  });
});

/* ---------------- NO-SHOW BOOKING ---------------- */
export const markNoShow = asyncHandler(async (req, res) => {
  const booking = await Booking.findById(req.params.id);

  if (!booking) {
    throw new AppError('Booking not found', HTTP_STATUS.NOT_FOUND);
  }

  if (![BOOKING_STATUS.CONFIRMED, BOOKING_STATUS.RESERVED].includes(booking.status)) {
    throw new AppError('Booking cannot be marked as no-show', HTTP_STATUS.BAD_REQUEST);
  }

  if (new Date(booking.dates.checkIn) > new Date()) {
    throw new AppError('Cannot mark no-show before check-in time', HTTP_STATUS.BAD_REQUEST);
  }

  booking.status = BOOKING_STATUS.NO_SHOW;
  await booking.save();

  await Room.findByIdAndUpdate(booking.room, {
    status: ROOM_STATUS.AVAILABLE,
  });

  res.status(HTTP_STATUS.OK).json({
    success: true,
    message: 'Booking marked as no-show',
  });
});






/* ---------------- UPDATE PAYMENT ---------------- */

/**
 * Update Payment
 */
export const updatePayment = asyncHandler(async (req, res) => {
  const { amount, status } = req.body;

  if (amount === undefined || Number(amount) < 0) {
    throw new AppError('Valid payment amount is required', HTTP_STATUS.BAD_REQUEST);
  }

  const booking = await Booking.findById(req.params.id);

  if (!booking) {
    throw new AppError('Booking not found', HTTP_STATUS.NOT_FOUND);
  }

  const total = booking.pricing?.total || 0;
  const newPaidAmount = (booking.advancePayment || 0) + Number(amount);

  if (newPaidAmount > total) {
    throw new AppError('Payment exceeds total amount', HTTP_STATUS.BAD_REQUEST);
  }

  booking.advancePayment = newPaidAmount;

  // Auto payment status
  if (newPaidAmount === 0) {
    booking.paymentStatus = PAYMENT_STATUS.PENDING;
  } else if (newPaidAmount < total) {
    booking.paymentStatus = PAYMENT_STATUS.PARTIALLY_PAID;
  } else {
    booking.paymentStatus = PAYMENT_STATUS.PAID;
  }

  // Optional manual override
  if (status && Object.values(PAYMENT_STATUS).includes(status)) {
    booking.paymentStatus = status;
  }

  await booking.save();

  return successResponse(
    res,
    HTTP_STATUS.OK,
    'Payment updated successfully',
    { booking }
  );
});