import Booking from '../models/Booking.model.js';
import Room from '../../rooms/models/Room.model.js';
import Hotel from '../../hotels/models/Hotel.model.js';
import { successResponse, paginatedResponse } from '../../../utils/responseHandler.js';
import { HTTP_STATUS, PAGINATION, USER_ROLES, BOOKING_STATUS, ROOM_STATUS, PAYMENT_STATUS, GST_RATE } from '../../../config/constants.js';
import asyncHandler from '../../../utils/asyncHandler.js';
import AppError from '../../../utils/AppError.js';
import PDFDocument from 'pdfkit';

// ── Helper: Check room availability ──────────────────────────────────────────
const checkRoomAvailability = async (roomId, checkIn, checkOut, bookingType, excludeBookingId = null) => {
  const query = {
    room: roomId,
    status: { $in: [BOOKING_STATUS.CONFIRMED, BOOKING_STATUS.CHECKED_IN, BOOKING_STATUS.RESERVED] },
  };
  if (excludeBookingId) query._id = { $ne: excludeBookingId };

  const existingBookings = await Booking.find(query);

  for (const booking of existingBookings) {
    const existingCheckIn = new Date(booking.dates.checkIn);
    const existingCheckOut = new Date(booking.dates.checkOut);
    const newCheckIn = new Date(checkIn);
    const newCheckOut = new Date(checkOut);

    const hasConflict =
      (newCheckIn >= existingCheckIn && newCheckIn < existingCheckOut) ||
      (newCheckOut > existingCheckIn && newCheckOut <= existingCheckOut) ||
      (newCheckIn <= existingCheckIn && newCheckOut >= existingCheckOut);

    if (hasConflict) return { available: false, conflictingBooking: booking };
  }

  return { available: true };
};

/**
 * Create New Booking
 * POST /api/bookings
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
    bookingType = 'daily',
    hours,
    additionalGuests,
    customCharges,
    // ✅ Payment method
    paymentMethod, // 'cash' | 'upi' | 'card' | undefined (unpaid)
  } = req.body;

  // Authorization
  let assignedHotel = hotel;
  if (req.user.role !== USER_ROLES.SUPER_ADMIN) {
    assignedHotel = req.user.hotel._id;
  }

  const hotelData = await Hotel.findById(assignedHotel);
  if (!hotelData) throw new AppError('Hotel not found', HTTP_STATUS.NOT_FOUND);

  const room = await Room.findById(roomId);
  if (!room) throw new AppError('Room not found', HTTP_STATUS.NOT_FOUND);

  if (room.hotel.toString() !== assignedHotel.toString()) {
    throw new AppError('Room does not belong to this hotel', HTTP_STATUS.BAD_REQUEST);
  }

  if (bookingType === 'hourly' && !room.supportsHourlyBooking()) {
    throw new AppError('This room does not support hourly bookings', HTTP_STATUS.BAD_REQUEST);
  }

  if (room.status !== ROOM_STATUS.AVAILABLE) {
    throw new AppError('Room is not available', HTTP_STATUS.BAD_REQUEST);
  }

  const checkIn = new Date(dates.checkIn);
  const checkOut = new Date(dates.checkOut);

  if (checkIn >= checkOut) {
    throw new AppError('Check-out must be after check-in', HTTP_STATUS.BAD_REQUEST);
  }

  const availabilityCheck = await checkRoomAvailability(roomId, checkIn, checkOut, bookingType);
  if (!availabilityCheck.available) {
    throw new AppError(
      `Room is already booked for this time period (Booking #${availabilityCheck.conflictingBooking.bookingNumber})`,
      HTTP_STATUS.CONFLICT
    );
  }

  // ── Pricing calculation ──
  let roomCharges = 0;
  let duration = 0;

  if (bookingType === 'hourly') {
    duration = hours;
    if (req.body.manualHourlyRate && req.body.manualHourlyRate > 0) {
      roomCharges = req.body.isFixedPrice
        ? req.body.manualHourlyRate
        : req.body.manualHourlyRate * hours;
    } else {
      const hourlyRate = room.pricing.hourlyRate > 0
        ? room.pricing.hourlyRate
        : Math.ceil(room.pricing.basePrice * 0.4);
      roomCharges = hourlyRate * hours;
    }
  } else {
    duration = Math.ceil((checkOut - checkIn) / (1000 * 60 * 60 * 24));
    if (req.body.manualDailyRate && req.body.manualDailyRate > 0) {
      roomCharges = req.body.isFixedPrice
        ? req.body.manualDailyRate
        : req.body.manualDailyRate * duration;
    } else {
      roomCharges = room.pricing.basePrice * duration;
    }
  }

  // Extra guest charges (daily only)
  let extraCharges = 0;
  if (bookingType === 'daily') {
    if (numberOfGuests.adults > room.capacity.adults) {
      extraCharges += (numberOfGuests.adults - room.capacity.adults) * (room.pricing.extraAdultCharge || 0) * duration;
    }
    if (numberOfGuests.children > room.capacity.children) {
      extraCharges += (numberOfGuests.children - room.capacity.children) * (room.pricing.extraChildCharge || 0) * duration;
    }
  }

  // Custom charges (AC charge, extra bed, etc.)
  const validCustomCharges = Array.isArray(customCharges)
    ? customCharges.filter(c => c.label && Number(c.amount) > 0)
    : [];
  const customChargesTotal = validCustomCharges.reduce((sum, c) => sum + Number(c.amount), 0);

  const subtotal = roomCharges + extraCharges + customChargesTotal;
  const tax = Math.ceil((subtotal * GST_RATE) / 100);
  const total = Math.ceil(subtotal + tax);

  const pricingData = {
    roomCharges,
    extraCharges,
    customCharges: validCustomCharges,
    discount: 0,
    subtotal,
    tax,
    total,
  };

  if (bookingType === 'hourly' && req.body.manualHourlyRate) {
    pricingData.manualHourlyRate = req.body.manualHourlyRate;
  }
  if (bookingType === 'daily' && req.body.manualDailyRate) {
    pricingData.manualDailyRate = req.body.manualDailyRate;
  }

  // ✅ Payment status based on paymentMethod
  // Agar method select kiya → PAID, warna PENDING
  const validPaymentMethods = ['cash', 'upi', 'card'];
  const isPaymentProvided = paymentMethod && validPaymentMethods.includes(paymentMethod.toLowerCase());

  const paymentStatus = isPaymentProvided ? PAYMENT_STATUS.PAID : PAYMENT_STATUS.PENDING;
  const finalAdvancePayment = isPaymentProvided
    ? total  // Full payment done
    : (advancePayment || 0);

  // ── Create Booking ──
  const booking = await Booking.create({
    hotel: assignedHotel,
    room: roomId,
    bookingType,
    hours: bookingType === 'hourly' ? hours : undefined,
    guest: {
      ...guest,
      idProof: {
        ...guest.idProof,
        image: { url: guest.idProof?.imageBase64 },
      },
    },
    numberOfGuests,
    additionalGuests: additionalGuests || [],
    dates: { checkIn, checkOut },
    pricing: pricingData,
    status: BOOKING_STATUS.CONFIRMED,
    paymentStatus,
    paymentMethod: isPaymentProvided ? paymentMethod.toLowerCase() : undefined, // ✅ store method
    advancePayment: finalAdvancePayment,
    specialRequests,
    createdBy: req.user._id,
    source: source || 'Direct',
  });

  // Update room status
  room.status = ROOM_STATUS.RESERVED;
  room.currentBooking = booking._id;
  await room.save();

  const populatedBooking = await Booking.findById(booking._id)
    .populate('hotel', 'name code address contact gst')
    .populate('room', 'roomNumber roomType')
    .populate('createdBy', 'name email');

  return successResponse(res, HTTP_STATUS.CREATED, 'Booking created successfully', { booking: populatedBooking });
});

/**
 * Check-In Guest
 * POST /api/bookings/:id/checkin
 */
export const checkInGuest = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const booking = await Booking.findById(id)
    .populate('room')
    .populate('hotel', 'name code address contact gst');

  if (!booking) throw new AppError('Booking not found', HTTP_STATUS.NOT_FOUND);

  if (req.user.role !== USER_ROLES.SUPER_ADMIN) {
    if (!req.user.hotel || booking.hotel._id.toString() !== req.user.hotel._id.toString()) {
      throw new AppError('Access denied to this booking', HTTP_STATUS.FORBIDDEN);
    }
  }

  if (booking.status === BOOKING_STATUS.CHECKED_IN) {
    throw new AppError('Guest is already checked in', HTTP_STATUS.BAD_REQUEST);
  }

  if (booking.status !== BOOKING_STATUS.CONFIRMED && booking.status !== BOOKING_STATUS.RESERVED) {
    throw new AppError('Booking must be confirmed to check in', HTTP_STATUS.BAD_REQUEST);
  }

  booking.status = BOOKING_STATUS.CHECKED_IN;
  booking.dates.actualCheckIn = new Date();
  booking.checkedInBy = req.user._id;
  await booking.save();

  const room = await Room.findById(booking.room._id);
  if (room) { room.status = ROOM_STATUS.OCCUPIED; await room.save(); }

  const updatedBooking = await Booking.findById(id)
    .populate('hotel', 'name code address contact gst')
    .populate('room', 'roomNumber roomType')
    .populate('checkedInBy', 'name email');

  return successResponse(res, HTTP_STATUS.OK, 'Guest checked in successfully', { booking: updatedBooking });
});

/**
 * Check-Out Guest
 * POST /api/bookings/:id/checkout
 */
export const checkOutGuest = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const booking = await Booking.findById(id)
    .populate('room')
    .populate('hotel', 'name code address contact gst');

  if (!booking) throw new AppError('Booking not found', HTTP_STATUS.NOT_FOUND);

  if (req.user.role !== USER_ROLES.SUPER_ADMIN) {
    if (!req.user.hotel || booking.hotel._id.toString() !== req.user.hotel._id.toString()) {
      throw new AppError('Access denied to this booking', HTTP_STATUS.FORBIDDEN);
    }
  }

  if (booking.status !== BOOKING_STATUS.CHECKED_IN) {
    throw new AppError('Guest must be checked in to check out', HTTP_STATUS.BAD_REQUEST);
  }

  // ✅ Payment check hata diya — checkout bina payment ke bhi ho sakta hai
  // if (booking.paymentStatus !== PAYMENT_STATUS.PAID) { ... }

  booking.status = BOOKING_STATUS.CHECKED_OUT;
  booking.dates.actualCheckOut = new Date();
  booking.checkedOutBy = req.user._id;
  await booking.save();

  const room = await Room.findById(booking.room._id);
  if (room) {
    room.status = ROOM_STATUS.AVAILABLE;
    room.currentBooking = null;
    room.lastCleaned = new Date();
    await room.save();
  }

  const updatedBooking = await Booking.findById(id)
    .populate('hotel', 'name code address contact gst')
    .populate('room', 'roomNumber roomType')
    .populate('checkedOutBy', 'name email');

  return successResponse(res, HTTP_STATUS.OK, 'Guest checked out successfully', { booking: updatedBooking });
});

/**
 * Get All Bookings
 * GET /api/bookings
 */
export const getAllBookings = asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = PAGINATION.DEFAULT_LIMIT,
    hotel,
    status,
    search,
    bookingType,
  } = req.query;

  const query = {};

  if (req.user.role !== USER_ROLES.SUPER_ADMIN) {
    query.hotel = req.user.hotel._id;
  } else if (hotel) {
    query.hotel = hotel;
  }

  if (status) query.status = status;
  if (bookingType && ['daily', 'hourly'].includes(bookingType)) query.bookingType = bookingType;

  if (search) {
    query.$or = [
      { bookingNumber: new RegExp(search, 'i') },
      { 'guest.name': new RegExp(search, 'i') },
      { 'guest.phone': new RegExp(search, 'i') },
    ];
  }

  const pageNum = parseInt(page);
  const limitNum = Math.min(parseInt(limit), PAGINATION.MAX_LIMIT);
  const skip = (pageNum - 1) * limitNum;

  const bookings = await Booking.find(query)
    .populate('hotel', 'name code address contact gst')
    .populate('room', 'roomNumber roomType')
    .populate('createdBy', 'name email')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limitNum);

  const total = await Booking.countDocuments(query);

  return paginatedResponse(res, bookings, pageNum, limitNum, total, 'Bookings fetched successfully');
});

/**
 * Get Single Booking
 * GET /api/bookings/:id
 */
export const getBookingById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const booking = await Booking.findById(id)
    .populate('hotel', 'name code address contact gst')
    .populate('room', 'roomNumber roomType floor pricing features')
    .populate('createdBy', 'name email')
    .populate('checkedInBy', 'name email')
    .populate('checkedOutBy', 'name email');

  if (!booking) throw new AppError('Booking not found', HTTP_STATUS.NOT_FOUND);

  if (req.user.role !== USER_ROLES.SUPER_ADMIN) {
    if (!req.user.hotel || booking.hotel._id.toString() !== req.user.hotel._id.toString()) {
      throw new AppError('Access denied to this booking', HTTP_STATUS.FORBIDDEN);
    }
  }

  return successResponse(res, HTTP_STATUS.OK, 'Booking details fetched successfully', { booking });
});

/**
 * Cancel Booking
 * DELETE /api/bookings/:id/cancel
 */
export const cancelBooking = asyncHandler(async (req, res) => {
  const booking = await Booking.findById(req.params.id);
  if (!booking) throw new AppError('Booking not found', HTTP_STATUS.NOT_FOUND);

  if (![BOOKING_STATUS.CONFIRMED, BOOKING_STATUS.RESERVED].includes(booking.status)) {
    throw new AppError('Only confirmed or reserved bookings can be cancelled', HTTP_STATUS.BAD_REQUEST);
  }

  booking.status = BOOKING_STATUS.CANCELLED;
  await booking.save();

  await Room.findByIdAndUpdate(booking.room, { status: ROOM_STATUS.AVAILABLE });

  return successResponse(res, HTTP_STATUS.OK, 'Booking cancelled successfully');
});

/**
 * Mark No-Show
 */
export const markNoShow = asyncHandler(async (req, res) => {
  const booking = await Booking.findById(req.params.id);
  if (!booking) throw new AppError('Booking not found', HTTP_STATUS.NOT_FOUND);

  if (![BOOKING_STATUS.CONFIRMED, BOOKING_STATUS.RESERVED].includes(booking.status)) {
    throw new AppError('Booking cannot be marked as no-show', HTTP_STATUS.BAD_REQUEST);
  }

  booking.status = BOOKING_STATUS.NO_SHOW;
  await booking.save();

  await Room.findByIdAndUpdate(booking.room, { status: ROOM_STATUS.AVAILABLE });

  return successResponse(res, HTTP_STATUS.OK, 'Booking marked as no-show');
});

/**
 * Update Payment
 * POST /api/bookings/:id/payment
 */
export const updatePayment = asyncHandler(async (req, res) => {
  const { amount, status, paymentMethod } = req.body;

  const booking = await Booking.findById(req.params.id);
  if (!booking) throw new AppError('Booking not found', HTTP_STATUS.NOT_FOUND);

  const total = booking.pricing?.total || 0;

  // ✅ Agar paymentMethod diya → full payment mark karo
  const validMethods = ['cash', 'upi', 'card'];
  if (paymentMethod && validMethods.includes(paymentMethod.toLowerCase())) {
    booking.paymentMethod = paymentMethod.toLowerCase();
    booking.advancePayment = total;
    booking.paymentStatus = PAYMENT_STATUS.PAID;
    await booking.save();
    return successResponse(res, HTTP_STATUS.OK, 'Payment confirmed successfully', { booking });
  }

  // Manual amount update
  if (amount !== undefined) {
    if (Number(amount) < 0) throw new AppError('Valid payment amount is required', HTTP_STATUS.BAD_REQUEST);

    const newPaidAmount = (booking.advancePayment || 0) + Number(amount);
    if (newPaidAmount > total) throw new AppError('Payment exceeds total amount', HTTP_STATUS.BAD_REQUEST);

    booking.advancePayment = newPaidAmount;

    if (newPaidAmount === 0) booking.paymentStatus = PAYMENT_STATUS.PENDING;
    else if (newPaidAmount < total) booking.paymentStatus = PAYMENT_STATUS.PARTIALLY_PAID;
    else booking.paymentStatus = PAYMENT_STATUS.PAID;

    if (status && Object.values(PAYMENT_STATUS).includes(status)) {
      booking.paymentStatus = status;
    }
  }

  await booking.save();

  return successResponse(res, HTTP_STATUS.OK, 'Payment updated successfully', { booking });
});

/**
 * Delete Booking
 * DELETE /api/bookings/:id
 */
export const deleteBooking = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const booking = await Booking.findById(id).populate('room');
  if (!booking) throw new AppError('Booking not found', HTTP_STATUS.NOT_FOUND);

  if (req.user.role !== USER_ROLES.SUPER_ADMIN) {
    if (!req.user.hotel || booking.hotel.toString() !== req.user.hotel._id.toString()) {
      throw new AppError('Access denied to delete this booking', HTTP_STATUS.FORBIDDEN);
    }
  }

  const activeStatuses = [BOOKING_STATUS.CONFIRMED, BOOKING_STATUS.CHECKED_IN, BOOKING_STATUS.RESERVED];
  if (activeStatuses.includes(booking.status)) {
    await Room.findByIdAndUpdate(booking.room._id || booking.room, {
      status: ROOM_STATUS.AVAILABLE,
      currentBooking: null,
    });
  }

  await Booking.findByIdAndDelete(id);

  return successResponse(res, HTTP_STATUS.OK, 'Booking deleted successfully');
});