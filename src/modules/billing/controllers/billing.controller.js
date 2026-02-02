import Invoice from '../models/Invoice.model.js';
import Booking from '../../rooms/models/Booking.model.js';
import Order from '../../pos/models/Order.model.js';
import { successResponse, paginatedResponse } from '../../../utils/responseHandler.js';
import { HTTP_STATUS, PAGINATION, USER_ROLES, INVOICE_STATUS, PAYMENT_STATUS, ORDER_STATUS, GST_RATE } from '../../../config/constants.js';
import asyncHandler from '../../../utils/asyncHandler.js';
import AppError from '../../../utils/AppError.js';

/**
 * Generate Invoice for Booking
 * POST /api/billing/generate
 * Access: Hotel Admin, Manager, Cashier
 */
export const generateInvoice = asyncHandler(async (req, res) => {
  const { bookingId, discount, notes } = req.body;

  // Get booking details
  const booking = await Booking.findById(bookingId)
    .populate('hotel', 'name code address contact gst')
    .populate('room', 'roomNumber roomType');

  if (!booking) {
    throw new AppError('Booking not found', HTTP_STATUS.NOT_FOUND);
  }

  // Authorization check
  if (req.user.role !== USER_ROLES.SUPER_ADMIN) {
    if (!req.user.hotel || booking.hotel._id.toString() !== req.user.hotel._id.toString()) {
      throw new AppError('Access denied to this booking', HTTP_STATUS.FORBIDDEN);
    }
  }

  // Check if invoice already exists for this booking
  const existingInvoice = await Invoice.findOne({ booking: bookingId });
  if (existingInvoice) {
    throw new AppError('Invoice already generated for this booking', HTTP_STATUS.CONFLICT);
  }

  // Get all orders linked to this booking
  const orders = await Order.find({
    booking: bookingId,
    status: ORDER_STATUS.SERVED,
  }).populate('items.menuItem', 'name');

  // Calculate room charges
  const lineItems = [];
  const totalNights = booking.getTotalNights();

  // Add room charges
  lineItems.push({
    type: 'room',
    description: `Room ${booking.room.roomNumber} (${booking.room.roomType}) - ${totalNights} night(s)`,
    reference: booking._id,
    referenceModel: 'Booking',
    quantity: totalNights,
    unit: 'night',
    rate: booking.pricing.roomCharges / totalNights,
    amount: booking.pricing.roomCharges,
  });

  let roomCharges = booking.pricing.roomCharges;
  let foodCharges = 0;

  // Add food orders
  for (const order of orders) {
    for (const item of order.items) {
      lineItems.push({
        type: 'food',
        description: `${item.name}${item.variant ? ` (${item.variant})` : ''}`,
        reference: order._id,
        referenceModel: 'Order',
        quantity: item.quantity,
        unit: 'item',
        rate: item.price,
        amount: item.subtotal,
      });
      foodCharges += item.subtotal;
    }
  }

  // Calculate totals
  const subtotal = roomCharges + foodCharges;
  const discountAmount = discount?.amount || 0;
  const taxableAmount = subtotal - discountAmount;

  // Calculate GST (5% total = 2.5% CGST + 2.5% SGST)
  const cgstAmount = (taxableAmount * 2.5) / 100;
  const sgstAmount = (taxableAmount * 2.5) / 100;
  const totalTax = cgstAmount + sgstAmount;

  // Calculate total with round-off (always use Math.ceil)
  const calculatedTotal = taxableAmount + totalTax;
  const roundedTotal = Math.ceil(calculatedTotal);
  const roundOff = roundedTotal - calculatedTotal;

  // Create invoice
  const invoice = await Invoice.create({
    hotel: booking.hotel._id,
    booking: booking._id,
    guest: {
      name: booking.guest.name,
      email: booking.guest.email,
      phone: booking.guest.phone,
      address: booking.guest.address,
    },
    lineItems,
    charges: {
      roomCharges,
      foodCharges,
      serviceCharges: 0,
      otherCharges: 0,
    },
    pricing: {
      subtotal,
      discount: {
        amount: discountAmount,
        reason: discount?.reason || '',
      },
      taxableAmount,
      tax: {
        cgst: {
          rate: 2.5,
          amount: Math.ceil(cgstAmount),
        },
        sgst: {
          rate: 2.5,
          amount: Math.ceil(sgstAmount),
        },
        total: Math.ceil(totalTax),
      },
      roundOff,
      total: roundedTotal,
    },
    status: INVOICE_STATUS.GENERATED,
    paymentStatus: PAYMENT_STATUS.PENDING,
    paidAmount: booking.advancePayment || 0,
    dates: {
      generated: new Date(),
      due: new Date(Date.now() + 24 * 60 * 60 * 1000), // Due in 24 hours
    },
    notes,
    createdBy: req.user._id,
  });

  // If advance payment was made, add it to payments
  if (booking.advancePayment > 0) {
    invoice.payments.push({
      amount: booking.advancePayment,
      method: 'cash', // Default, should be tracked from booking
      reference: `Advance payment for booking ${booking.bookingNumber}`,
      paidAt: booking.createdAt,
      receivedBy: booking.createdBy,
    });

    if (invoice.paidAmount >= invoice.pricing.total) {
      invoice.paymentStatus = PAYMENT_STATUS.PAID;
      invoice.dates.paid = new Date();
    } else {
      invoice.paymentStatus = PAYMENT_STATUS.PARTIALLY_PAID;
    }

    await invoice.save();
  }

  const populatedInvoice = await Invoice.findById(invoice._id)
    .populate('hotel', 'name code address contact gst')
    .populate('booking', 'bookingNumber guest')
    .populate('createdBy', 'name email');

  return successResponse(
    res,
    HTTP_STATUS.CREATED,
    'Invoice generated successfully',
    { invoice: populatedInvoice }
  );
});

/**
 * Add Payment to Invoice
 * POST /api/billing/invoices/:id/payment
 * Access: Hotel Admin, Manager, Cashier
 */
export const addPayment = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { amount, method, reference } = req.body;

  const invoice = await Invoice.findById(id);

  if (!invoice) {
    throw new AppError('Invoice not found', HTTP_STATUS.NOT_FOUND);
  }

  // Authorization check
  if (req.user.role !== USER_ROLES.SUPER_ADMIN) {
    if (!req.user.hotel || invoice.hotel.toString() !== req.user.hotel._id.toString()) {
      throw new AppError('Access denied to this invoice', HTTP_STATUS.FORBIDDEN);
    }
  }

  // Check if already fully paid
  if (invoice.isFullyPaid()) {
    throw new AppError('Invoice is already fully paid', HTTP_STATUS.BAD_REQUEST);
  }

  // Validate payment amount
  const remainingAmount = invoice.pricing.total - invoice.paidAmount;
  if (amount > remainingAmount) {
    throw new AppError(`Payment amount exceeds balance. Balance: ₹${remainingAmount}`, HTTP_STATUS.BAD_REQUEST);
  }

  // Add payment
  invoice.addPayment(amount, method, reference, req.user._id);
  await invoice.save();

  const updatedInvoice = await Invoice.findById(id)
    .populate('hotel', 'name code')
    .populate('payments.receivedBy', 'name email');

  return successResponse(
    res,
    HTTP_STATUS.OK,
    'Payment added successfully',
    {
      invoice: updatedInvoice,
      remainingBalance: updatedInvoice.balanceAmount,
    }
  );
});

/**
 * Get All Invoices
 * GET /api/billing/invoices
 * Access: Authenticated users
 */
export const getAllInvoices = asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = PAGINATION.DEFAULT_LIMIT,
    hotel,
    status,
    paymentStatus,
    search,
  } = req.query;

  // Build query
  const query = {};

  if (req.user.role !== USER_ROLES.SUPER_ADMIN) {
    query.hotel = req.user.hotel._id;
  } else if (hotel) {
    query.hotel = hotel;
  }

  if (status) {
    query.status = status;
  }

  if (paymentStatus) {
    query.paymentStatus = paymentStatus;
  }

  if (search) {
    query.$or = [
      { invoiceNumber: new RegExp(search, 'i') },
      { 'guest.name': new RegExp(search, 'i') },
      { 'guest.phone': new RegExp(search, 'i') },
    ];
  }

  // Pagination
  const pageNum = parseInt(page);
  const limitNum = Math.min(parseInt(limit), PAGINATION.MAX_LIMIT);
  const skip = (pageNum - 1) * limitNum;

  // Fetch invoices
  const invoices = await Invoice.find(query)
    .populate('hotel', 'name code')
    .populate('booking', 'bookingNumber room')
    .populate('createdBy', 'name email')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limitNum);

  const total = await Invoice.countDocuments(query);

  return paginatedResponse(
    res,
    invoices,
    pageNum,
    limitNum,
    total,
    'Invoices fetched successfully'
  );
});

/**
 * Get Single Invoice
 * GET /api/billing/invoices/:id
 * Access: Authenticated users
 */
export const getInvoiceById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const invoice = await Invoice.findById(id)
    .populate('hotel', 'name code address contact gst')
    .populate({
      path: 'booking',
      populate: { path: 'room', select: 'roomNumber roomType' },
    })
    .populate('createdBy', 'name email')
    .populate('payments.receivedBy', 'name email');

  if (!invoice) {
    throw new AppError('Invoice not found', HTTP_STATUS.NOT_FOUND);
  }

  // Authorization check
  if (req.user.role !== USER_ROLES.SUPER_ADMIN) {
    if (!req.user.hotel || invoice.hotel._id.toString() !== req.user.hotel._id.toString()) {
      throw new AppError('Access denied to this invoice', HTTP_STATUS.FORBIDDEN);
    }
  }

  return successResponse(
    res,
    HTTP_STATUS.OK,
    'Invoice details fetched successfully',
    { invoice }
  );
});

/**
 * Get Pending Payments
 * GET /api/billing/pending
 * Access: Hotel Admin, Manager, Cashier
 */
export const getPendingPayments = asyncHandler(async (req, res) => {
  const { hotel } = req.query;

  let assignedHotel = hotel;
  if (req.user.role !== USER_ROLES.SUPER_ADMIN) {
    assignedHotel = req.user.hotel._id;
  }

  const invoices = await Invoice.find({
    hotel: assignedHotel,
    paymentStatus: { $in: [PAYMENT_STATUS.PENDING, PAYMENT_STATUS.PARTIALLY_PAID] },
  })
    .populate('hotel', 'name code')
    .populate('booking', 'bookingNumber guest.name')
    .sort({ 'dates.due': 1 });

  const totalPending = invoices.reduce((sum, inv) => sum + inv.balanceAmount, 0);

  return successResponse(
    res,
    HTTP_STATUS.OK,
    'Pending payments fetched successfully',
    {
      invoices,
      count: invoices.length,
      totalPending: Math.ceil(totalPending),
    }
  );
});