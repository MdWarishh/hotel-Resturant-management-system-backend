import Booking from '../models/Booking.model.js';
import Room from '../models/Room.model.js';
import Hotel from '../../hotels/models/Hotel.model.js';
import { successResponse, paginatedResponse } from '../../../utils/responseHandler.js';
import { HTTP_STATUS, PAGINATION, USER_ROLES, BOOKING_STATUS, ROOM_STATUS,PAYMENT_STATUS, GST_RATE } from '../../../config/constants.js';
import asyncHandler from '../../../utils/asyncHandler.js';
import AppError from '../../../utils/AppError.js';
import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';


/**
 * Create New Booking
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

  // Check if room is available
  if (room.status !== ROOM_STATUS.AVAILABLE) {
    throw new AppError('Room is not available', HTTP_STATUS.BAD_REQUEST);
  }

  // Validate dates
  const checkIn = new Date(dates.checkIn);
  const checkOut = new Date(dates.checkOut);

  if (checkIn >= checkOut) {
    throw new AppError('Check-out date must be after check-in date', HTTP_STATUS.BAD_REQUEST);
  }

  // Calculate total nights
  const totalNights = Math.ceil((checkOut - checkIn) / (1000 * 60 * 60 * 24));

  // Calculate pricing
  let roomCharges = room.pricing.basePrice * totalNights;

  // Add extra guest charges
  let extraCharges = 0;
  if (numberOfGuests.adults > room.capacity.adults) {
    const extraAdults = numberOfGuests.adults - room.capacity.adults;
    extraCharges += extraAdults * (room.pricing.extraAdultCharge || 0) * totalNights;
  }
  if (numberOfGuests.children > room.capacity.children) {
    const extraChildren = numberOfGuests.children - room.capacity.children;
    extraCharges += extraChildren * (room.pricing.extraChildCharge || 0) * totalNights;
  }

  const subtotal = roomCharges + extraCharges;
  const tax = Math.ceil((subtotal * GST_RATE) / 100);
  const total = Math.ceil(subtotal + tax);

  // Create booking
  const booking = await Booking.create({
    hotel: assignedHotel,
    room: roomId,
    guest,
    numberOfGuests,
    dates: {
      checkIn,
      checkOut,
    },
    pricing: {
      roomCharges,
      extraCharges,
      discount: 0,
      subtotal,
      tax,
      total,
    },
    status: BOOKING_STATUS.CONFIRMED,
    advancePayment: advancePayment || 0,
    specialRequests,
    createdBy: req.user._id,
  });

  // Update room status to reserved
  room.status = ROOM_STATUS.RESERVED;
  room.currentBooking = booking._id;
  await room.save();

  const populatedBooking = await Booking.findById(booking._id)
    .populate('hotel', 'name code')
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
    .populate('hotel', 'name code');

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
    .populate('hotel', 'name code')
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
    .populate('hotel', 'name code');

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

  // 🔒 Payment must be cleared before checkout
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

  // Update room status to cleaning
  const room = await Room.findById(booking.room._id);
  if (room) {
    room.status = ROOM_STATUS.CLEANING;
    room.currentBooking = null;
    await room.save();
  }

  const updatedBooking = await Booking.findById(id)
    .populate('hotel', 'name code')
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
  } = req.query;

  // Build query
  const query = {};

  // If not super admin, only show their hotel's bookings
  if (req.user.role !== USER_ROLES.SUPER_ADMIN) {
    query.hotel = req.user.hotel._id;
  } else if (hotel) {
    query.hotel = hotel;
  }

  if (status) {
    query.status = status;
  }

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
    .populate('hotel', 'name code')
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
    .populate('hotel', 'name code address contact')
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


export const downloadInvoicePDF = asyncHandler(async (req, res) => {
  const booking = await Booking.findById(req.params.id)
    .populate('hotel')
    .populate('room')
    .populate('createdBy');

  if (!booking) {
    throw new AppError('Booking not found', HTTP_STATUS.NOT_FOUND);
  }

  if (booking.status !== 'checked_out') {
    throw new AppError(
      'Invoice available only after checkout',
      HTTP_STATUS.BAD_REQUEST
    );
  }

  const doc = new PDFDocument({ size: 'A4', margin: 50 });

  res.setHeader(
    'Content-Disposition',
    `attachment; filename=Invoice-${booking.bookingNumber}.pdf`
  );
  res.setHeader('Content-Type', 'application/pdf');

  doc.pipe(res);

  /* -------- HEADER -------- */
  doc.fontSize(20).text('INVOICE', { align: 'center' });
  doc.moveDown();

  /* -------- HOTEL -------- */
  doc.fontSize(14).text(booking.hotel.name);
  doc.fontSize(10).text(
    `${booking.hotel.address?.street || ''}, ${booking.hotel.address?.city || ''}`
  );

  doc.moveDown();

  /* -------- BOOKING INFO -------- */
  doc.text(`Invoice No: ${booking.bookingNumber}`);
  doc.text(`Guest: ${booking.guest.name}`);
  doc.text(`Room: ${booking.room.roomNumber}`);
  doc.text(
    `Stay: ${new Date(booking.dates.checkIn).toDateString()} - ${new Date(
      booking.dates.checkOut
    ).toDateString()}`
  );

  doc.moveDown();

  /* -------- CHARGES -------- */
  doc.text(`Room Charges: ₹${booking.pricing.roomCharges}`);
  doc.text(`GST: ₹${booking.pricing.tax}`);
  doc.fontSize(12).text(`Total: ₹${booking.pricing.total}`, {
    underline: true,
  });

  doc.moveDown();
  doc.text(`Paid: ₹${booking.advancePayment}`);
  doc.text(`Payment Status: ${booking.paymentStatus}`);

  doc.moveDown(2);
  doc.fontSize(10).text('Thank you for staying with us!', {
    align: 'center',
  });

  doc.end();
});
