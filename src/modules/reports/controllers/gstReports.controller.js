// backend/src/modules/reports/controllers/gstReports.controller.js

import Booking from '../../rooms/models/Booking.model.js';
import Order from '../../pos/models/Order.model.js';
import Hotel from '../../hotels/models/Hotel.model.js';
import { successResponse } from '../../../utils/responseHandler.js';
import { HTTP_STATUS, USER_ROLES, ORDER_STATUS } from '../../../config/constants.js';
import asyncHandler from '../../../utils/asyncHandler.js';
import AppError from '../../../utils/AppError.js';
import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';

/**
 * 📊 Get Bookings GST Report
 * GET /api/reports/gst/bookings
 * Access: Hotel Admin, Manager
 */
export const getBookingsGSTReport = asyncHandler(async (req, res) => {
  const { startDate, endDate, hotel } = req.query;

  // Validate dates
  if (!startDate || !endDate) {
    throw new AppError('Start date and end date are required', HTTP_STATUS.BAD_REQUEST);
  }

  // Build query
  const query = {
    createdAt: {
      $gte: new Date(startDate),
      $lte: new Date(new Date(endDate).setHours(23, 59, 59, 999)),
    },
  };

  // Hotel filter
  if (req.user.role !== USER_ROLES.SUPER_ADMIN) {
    query.hotel = req.user.hotel._id;
  } else if (hotel) {
    query.hotel = hotel;
  }

  // Fetch bookings
  const bookings = await Booking.find(query)
    .populate('hotel', 'name code gst')
    .populate('room', 'roomNumber roomType')
    .populate('guest', 'name email phone')
    .sort({ createdAt: -1 });

  // Calculate totals
  let totalBookings = 0;
  let totalRevenue = 0;
  let totalGST = 0;
  let totalNet = 0;

  const dailyBreakdown = {};

  bookings.forEach((booking) => {
    totalBookings++;
    const revenue = booking.pricing?.totalAmount || 0;
    const gst = booking.pricing?.gst || 0;
    const net = revenue + gst;

    totalRevenue += revenue;
    totalGST += gst;
    totalNet += net;

    // Daily breakdown
    const date = new Date(booking.createdAt).toISOString().split('T')[0];
    if (!dailyBreakdown[date]) {
      dailyBreakdown[date] = {
        date,
        bookings: 0,
        revenue: 0,
        gst: 0,
        net: 0,
      };
    }
    dailyBreakdown[date].bookings++;
    dailyBreakdown[date].revenue += revenue;
    dailyBreakdown[date].gst += gst;
    dailyBreakdown[date].net += net;
  });

  // Convert daily breakdown to array
  const dailyData = Object.values(dailyBreakdown).sort(
    (a, b) => new Date(a.date) - new Date(b.date)
  );

  return successResponse(res, HTTP_STATUS.OK, 'Bookings GST report fetched successfully', {
    summary: {
      totalBookings,
      totalRevenue: Math.round(totalRevenue),
      totalGST: Math.round(totalGST),
      totalNet: Math.round(totalNet),
      startDate,
      endDate,
    },
    dailyBreakdown: dailyData,
    bookings: bookings.map((b) => ({
      bookingId: b.bookingId,
      guestName: b.guest?.name || 'N/A',
      roomNumber: b.room?.roomNumber || 'N/A',
      checkIn: b.checkIn,
      checkOut: b.checkOut,
      revenue: b.pricing?.totalAmount || 0,
      gst: b.pricing?.gst || 0,
      total: (b.pricing?.totalAmount || 0) + (b.pricing?.gst || 0),
      status: b.status,
      createdAt: b.createdAt,
    })),
  });
});

/**
 * 📊 Get POS GST Report
 * GET /api/reports/gst/pos
 * Access: Hotel Admin, Manager
 */
export const getPOSGSTReport = asyncHandler(async (req, res) => {
  const { startDate, endDate, hotel } = req.query;

  // Validate dates
  if (!startDate || !endDate) {
    throw new AppError('Start date and end date are required', HTTP_STATUS.BAD_REQUEST);
  }

  // Build query
  const query = {
    createdAt: {
      $gte: new Date(startDate),
      $lte: new Date(new Date(endDate).setHours(23, 59, 59, 999)),
    },
    status: { $ne: ORDER_STATUS.CANCELLED }, // Exclude cancelled orders
  };

  // Hotel filter
  if (req.user.role !== USER_ROLES.SUPER_ADMIN) {
    query.hotel = req.user.hotel._id;
  } else if (hotel) {
    query.hotel = hotel;
  }

  // Fetch orders
  const orders = await Order.find(query)
    .populate('hotel', 'name code gst')
    .populate('createdBy', 'name')
    .sort({ createdAt: -1 });

  // Calculate totals
  let totalOrders = 0;
  let totalRevenue = 0;
  let totalGST = 0;
  let totalNet = 0;

  const dailyBreakdown = {};
  const orderTypeBreakdown = {
    'dine-in': { count: 0, revenue: 0, gst: 0 },
    'room-service': { count: 0, revenue: 0, gst: 0 },
    'takeaway': { count: 0, revenue: 0, gst: 0 },
    'delivery': { count: 0, revenue: 0, gst: 0 },
  };

  orders.forEach((order) => {
    totalOrders++;
    const revenue = order.pricing?.subtotal || 0;
    const gst = order.pricing?.tax || 0;
    const net = order.pricing?.total || 0;

    totalRevenue += revenue;
    totalGST += gst;
    totalNet += net;

    // Order type breakdown
    if (orderTypeBreakdown[order.orderType]) {
      orderTypeBreakdown[order.orderType].count++;
      orderTypeBreakdown[order.orderType].revenue += revenue;
      orderTypeBreakdown[order.orderType].gst += gst;
    }

    // Daily breakdown
    const date = new Date(order.createdAt).toISOString().split('T')[0];
    if (!dailyBreakdown[date]) {
      dailyBreakdown[date] = {
        date,
        orders: 0,
        revenue: 0,
        gst: 0,
        net: 0,
      };
    }
    dailyBreakdown[date].orders++;
    dailyBreakdown[date].revenue += revenue;
    dailyBreakdown[date].gst += gst;
    dailyBreakdown[date].net += net;
  });

  // Convert daily breakdown to array
  const dailyData = Object.values(dailyBreakdown).sort(
    (a, b) => new Date(a.date) - new Date(b.date)
  );

  return successResponse(res, HTTP_STATUS.OK, 'POS GST report fetched successfully', {
    summary: {
      totalOrders,
      totalRevenue: Math.round(totalRevenue),
      totalGST: Math.round(totalGST),
      totalNet: Math.round(totalNet),
      startDate,
      endDate,
    },
    dailyBreakdown: dailyData,
    orderTypeBreakdown,
    orders: orders.map((o) => ({
      orderNumber: o.orderNumber,
      orderType: o.orderType,
      customerName: o.customer?.name || 'N/A',
      itemsCount: o.items?.length || 0,
      revenue: o.pricing?.subtotal || 0,
      gst: o.pricing?.tax || 0,
      total: o.pricing?.total || 0,
      status: o.status,
      createdAt: o.createdAt,
    })),
  });
});

/**
 * 📥 Export Bookings GST Report to Excel
 * GET /api/reports/gst/bookings/excel
 * Access: Hotel Admin, Manager
 */
export const exportBookingsGSTExcel = asyncHandler(async (req, res) => {
  const { startDate, endDate, hotel } = req.query;

  if (!startDate || !endDate) {
    throw new AppError('Start date and end date are required', HTTP_STATUS.BAD_REQUEST);
  }

  // Build query (same as getBookingsGSTReport)
  const query = {
    createdAt: {
      $gte: new Date(startDate),
      $lte: new Date(new Date(endDate).setHours(23, 59, 59, 999)),
    },
  };

  if (req.user.role !== USER_ROLES.SUPER_ADMIN) {
    query.hotel = req.user.hotel._id;
  } else if (hotel) {
    query.hotel = hotel;
  }

  const bookings = await Booking.find(query)
    .populate('hotel', 'name code gst')
    .populate('room', 'roomNumber roomType')
    .populate('guest', 'name email phone')
    .sort({ createdAt: 1 });

  const hotelData = await Hotel.findById(query.hotel);

  // Create workbook
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Bookings GST Report');

  // Header styling
  worksheet.mergeCells('A1:H1');
  worksheet.getCell('A1').value = `${hotelData?.name || 'Hotel'} - Bookings GST Report`;
  worksheet.getCell('A1').font = { size: 16, bold: true };
  worksheet.getCell('A1').alignment = { horizontal: 'center' };

  worksheet.mergeCells('A2:H2');
  worksheet.getCell('A2').value = `Period: ${new Date(startDate).toLocaleDateString()} - ${new Date(endDate).toLocaleDateString()}`;
  worksheet.getCell('A2').alignment = { horizontal: 'center' };

  worksheet.addRow([]);

  // Column headers
  const headerRow = worksheet.addRow([
    'Date',
    'Booking ID',
    'Guest Name',
    'Room',
    'Check-In',
    'Check-Out',
    'Revenue (₹)',
    'GST (₹)',
    'Total (₹)',
    'Status',
  ]);

  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF0070C0' },
  };

  // Data rows
  let totalRevenue = 0;
  let totalGST = 0;
  let totalNet = 0;

  bookings.forEach((booking) => {
    const revenue = booking.pricing?.totalAmount || 0;
    const gst = booking.pricing?.gst || 0;
    const net = revenue + gst;

    totalRevenue += revenue;
    totalGST += gst;
    totalNet += net;

    worksheet.addRow([
      new Date(booking.createdAt).toLocaleDateString(),
      booking.bookingId,
      booking.guest?.name || 'N/A',
      booking.room?.roomNumber || 'N/A',
      new Date(booking.checkIn).toLocaleDateString(),
      new Date(booking.checkOut).toLocaleDateString(),
      revenue,
      gst,
      net,
      booking.status,
    ]);
  });

  // Total row
  const totalRow = worksheet.addRow([
    '',
    '',
    '',
    '',
    '',
    'TOTAL:',
    totalRevenue,
    totalGST,
    totalNet,
    '',
  ]);
  totalRow.font = { bold: true };
  totalRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE7E6E6' },
  };

  // Column widths
  worksheet.columns = [
    { width: 12 },
    { width: 15 },
    { width: 20 },
    { width: 10 },
    { width: 12 },
    { width: 12 },
    { width: 12 },
    { width: 12 },
    { width: 12 },
    { width: 12 },
  ];

  // Send file
  res.setHeader(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  );
  res.setHeader(
    'Content-Disposition',
    `attachment; filename=Bookings_GST_Report_${startDate}_to_${endDate}.xlsx`
  );

  await workbook.xlsx.write(res);
  res.end();
});

/**
 * 📥 Export POS GST Report to Excel
 * GET /api/reports/gst/pos/excel
 * Access: Hotel Admin, Manager
 */
export const exportPOSGSTExcel = asyncHandler(async (req, res) => {
  const { startDate, endDate, hotel } = req.query;

  if (!startDate || !endDate) {
    throw new AppError('Start date and end date are required', HTTP_STATUS.BAD_REQUEST);
  }

  const query = {
    createdAt: {
      $gte: new Date(startDate),
      $lte: new Date(new Date(endDate).setHours(23, 59, 59, 999)),
    },
    status: { $ne: ORDER_STATUS.CANCELLED },
  };

  if (req.user.role !== USER_ROLES.SUPER_ADMIN) {
    query.hotel = req.user.hotel._id;
  } else if (hotel) {
    query.hotel = hotel;
  }

  const orders = await Order.find(query)
    .populate('hotel', 'name code gst')
    .sort({ createdAt: 1 });

  const hotelData = await Hotel.findById(query.hotel);

  // Create workbook
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('POS GST Report');

  // Header
  worksheet.mergeCells('A1:J1');
  worksheet.getCell('A1').value = `${hotelData?.name || 'Hotel'} - POS GST Report`;
  worksheet.getCell('A1').font = { size: 16, bold: true };
  worksheet.getCell('A1').alignment = { horizontal: 'center' };

  worksheet.mergeCells('A2:J2');
  worksheet.getCell('A2').value = `Period: ${new Date(startDate).toLocaleDateString()} - ${new Date(endDate).toLocaleDateString()}`;
  worksheet.getCell('A2').alignment = { horizontal: 'center' };

  worksheet.addRow([]);

  // Column headers
  const headerRow = worksheet.addRow([
    'Date',
    'Order No.',
    'Order Type',
    'Customer',
    'Items',
    'Revenue (₹)',
    'GST (₹)',
    'Total (₹)',
    'Payment',
    'Status',
  ]);

  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFFF6600' },
  };

  // Data rows
  let totalRevenue = 0;
  let totalGST = 0;
  let totalNet = 0;

  orders.forEach((order) => {
    const revenue = order.pricing?.subtotal || 0;
    const gst = order.pricing?.tax || 0;
    const net = order.pricing?.total || 0;

    totalRevenue += revenue;
    totalGST += gst;
    totalNet += net;

    worksheet.addRow([
      new Date(order.createdAt).toLocaleDateString(),
      order.orderNumber,
      order.orderType,
      order.customer?.name || 'N/A',
      order.items?.length || 0,
      revenue,
      gst,
      net,
      order.payment?.status || 'UNPAID',
      order.status,
    ]);
  });

  // Total row
  const totalRow = worksheet.addRow([
    '',
    '',
    '',
    '',
    'TOTAL:',
    totalRevenue,
    totalGST,
    totalNet,
    '',
    '',
  ]);
  totalRow.font = { bold: true };
  totalRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE7E6E6' },
  };

  // Column widths
  worksheet.columns = [
    { width: 12 },
    { width: 15 },
    { width: 15 },
    { width: 18 },
    { width: 8 },
    { width: 12 },
    { width: 12 },
    { width: 12 },
    { width: 12 },
    { width: 12 },
  ];

  // Send file
  res.setHeader(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  );
  res.setHeader(
    'Content-Disposition',
    `attachment; filename=POS_GST_Report_${startDate}_to_${endDate}.xlsx`
  );

  await workbook.xlsx.write(res);
  res.end();
});