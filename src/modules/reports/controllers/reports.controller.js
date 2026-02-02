import Invoice from '../../billing/models/Invoice.model.js';
import Booking from '../../rooms/models/Booking.model.js';
import Order from '../../pos/models/Order.model.js';
import Room from '../../rooms/models/Room.model.js';
import StockTransaction from '../../inventory/models/StockTransaction.model.js';
import { successResponse } from '../../../utils/responseHandler.js';
import { HTTP_STATUS, USER_ROLES } from '../../../config/constants.js';
import asyncHandler from '../../../utils/asyncHandler.js';
import AppError from '../../../utils/AppError.js';

/**
 * Get Revenue Report
 * GET /api/reports/revenue
 * Access: Hotel Admin, Manager
 */
export const getRevenueReport = asyncHandler(async (req, res) => {
  const { hotel, startDate, endDate, groupBy = 'day' } = req.query;

  let assignedHotel = hotel;
  if (req.user.role !== USER_ROLES.SUPER_ADMIN) {
    assignedHotel = req.user.hotel._id;
  }

  if (!assignedHotel) {
    throw new AppError('Hotel ID is required', HTTP_STATUS.BAD_REQUEST);
  }

  // Date range
  const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const end = endDate ? new Date(endDate) : new Date();

  // Group by format
  let dateFormat;
  switch (groupBy) {
    case 'month':
      dateFormat = { $dateToString: { format: '%Y-%m', date: '$createdAt' } };
      break;
    case 'year':
      dateFormat = { $dateToString: { format: '%Y', date: '$createdAt' } };
      break;
    default: // day
      dateFormat = { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } };
  }

  // Aggregate revenue
  const revenueData = await Invoice.aggregate([
    {
      $match: {
        hotel: assignedHotel,
        createdAt: { $gte: start, $lte: end },
        status: 'generated',
      },
    },
    {
      $group: {
        _id: dateFormat,
        totalRevenue: { $sum: '$pricing.total' },
        roomRevenue: { $sum: '$charges.roomCharges' },
        foodRevenue: { $sum: '$charges.foodCharges' },
        taxCollected: { $sum: '$pricing.tax.total' },
        invoiceCount: { $sum: 1 },
      },
    },
    {
      $sort: { _id: 1 },
    },
  ]);

  // Calculate totals
  const totals = {
    totalRevenue: revenueData.reduce((sum, item) => sum + item.totalRevenue, 0),
    roomRevenue: revenueData.reduce((sum, item) => sum + item.roomRevenue, 0),
    foodRevenue: revenueData.reduce((sum, item) => sum + item.foodRevenue, 0),
    taxCollected: revenueData.reduce((sum, item) => sum + item.taxCollected, 0),
    invoiceCount: revenueData.reduce((sum, item) => sum + item.invoiceCount, 0),
  };

  return successResponse(
    res,
    HTTP_STATUS.OK,
    'Revenue report fetched successfully',
    {
      report: revenueData,
      totals,
      period: { startDate: start, endDate: end, groupBy },
    }
  );
});

/**
 * Get Occupancy Report
 * GET /api/reports/occupancy
 * Access: Hotel Admin, Manager
 */
export const getOccupancyReport = asyncHandler(async (req, res) => {
  const { hotel, startDate, endDate } = req.query;

  let assignedHotel = hotel;
  if (req.user.role !== USER_ROLES.SUPER_ADMIN) {
    assignedHotel = req.user.hotel._id;
  }

  if (!assignedHotel) {
    throw new AppError('Hotel ID is required', HTTP_STATUS.BAD_REQUEST);
  }

  const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const end = endDate ? new Date(endDate) : new Date();

  // Get total rooms
  const totalRooms = await Room.countDocuments({
    hotel: assignedHotel,
    isActive: true,
  });

  // Aggregate bookings by date
  const occupancyData = await Booking.aggregate([
    {
      $match: {
        hotel: assignedHotel,
        $or: [
          {
            'dates.checkIn': { $gte: start, $lte: end },
          },
          {
            'dates.checkOut': { $gte: start, $lte: end },
          },
          {
            $and: [
              { 'dates.checkIn': { $lte: start } },
              { 'dates.checkOut': { $gte: end } },
            ],
          },
        ],
        status: { $in: ['confirmed', 'checked_in', 'checked_out'] },
      },
    },
    {
      $group: {
        _id: {
          $dateToString: { format: '%Y-%m-%d', date: '$dates.checkIn' },
        },
        occupiedRooms: { $sum: 1 },
        totalGuests: { $sum: '$numberOfGuests.adults' },
      },
    },
    {
      $sort: { _id: 1 },
    },
  ]);

  // Calculate occupancy percentage
  const report = occupancyData.map((item) => ({
    date: item._id,
    occupiedRooms: item.occupiedRooms,
    totalRooms,
    occupancyRate: totalRooms > 0 ? Math.round((item.occupiedRooms / totalRooms) * 100) : 0,
    totalGuests: item.totalGuests,
  }));

  // Calculate average occupancy
  const avgOccupancy =
    report.length > 0
      ? Math.round(report.reduce((sum, item) => sum + item.occupancyRate, 0) / report.length)
      : 0;

  return successResponse(
    res,
    HTTP_STATUS.OK,
    'Occupancy report fetched successfully',
    {
      report,
      summary: {
        totalRooms,
        averageOccupancy: avgOccupancy,
        period: { startDate: start, endDate: end },
      },
    }
  );
});

/**
 * Get Sales Report (POS)
 * GET /api/reports/sales
 * Access: Hotel Admin, Manager
 */
export const getSalesReport = asyncHandler(async (req, res) => {
  const { hotel, startDate, endDate, groupBy = 'day' } = req.query;

  let assignedHotel = hotel;
  if (req.user.role !== USER_ROLES.SUPER_ADMIN) {
    assignedHotel = req.user.hotel._id;
  }

  if (!assignedHotel) {
    throw new AppError('Hotel ID is required', HTTP_STATUS.BAD_REQUEST);
  }

  const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const end = endDate ? new Date(endDate) : new Date();

  // Group by format
  let dateFormat;
  switch (groupBy) {
    case 'month':
      dateFormat = { $dateToString: { format: '%Y-%m', date: '$createdAt' } };
      break;
    default:
      dateFormat = { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } };
  }

  const salesData = await Order.aggregate([
    {
      $match: {
        hotel: assignedHotel,
        createdAt: { $gte: start, $lte: end },
        status: 'served',
      },
    },
    {
      $group: {
        _id: dateFormat,
        totalSales: { $sum: '$pricing.total' },
        orderCount: { $sum: 1 },
        avgOrderValue: { $avg: '$pricing.total' },
      },
    },
    {
      $sort: { _id: 1 },
    },
  ]);

  // Top selling items
  const topItems = await Order.aggregate([
    {
      $match: {
        hotel: assignedHotel,
        createdAt: { $gte: start, $lte: end },
        status: 'served',
      },
    },
    { $unwind: '$items' },
    {
      $group: {
        _id: '$items.name',
        quantity: { $sum: '$items.quantity' },
        revenue: { $sum: '$items.subtotal' },
      },
    },
    {
      $sort: { quantity: -1 },
    },
    {
      $limit: 10,
    },
  ]);

  const totals = {
    totalSales: salesData.reduce((sum, item) => sum + item.totalSales, 0),
    orderCount: salesData.reduce((sum, item) => sum + item.orderCount, 0),
    avgOrderValue: salesData.length > 0
      ? Math.round(salesData.reduce((sum, item) => sum + item.avgOrderValue, 0) / salesData.length)
      : 0,
  };

  return successResponse(
    res,
    HTTP_STATUS.OK,
    'Sales report fetched successfully',
    {
      report: salesData,
      topItems,
      totals,
      period: { startDate: start, endDate: end, groupBy },
    }
  );
});

/**
 * Get Inventory Report
 * GET /api/reports/inventory
 * Access: Hotel Admin, Manager
 */
export const getInventoryReport = asyncHandler(async (req, res) => {
  const { hotel, startDate, endDate, transactionType } = req.query;

  let assignedHotel = hotel;
  if (req.user.role !== USER_ROLES.SUPER_ADMIN) {
    assignedHotel = req.user.hotel._id;
  }

  if (!assignedHotel) {
    throw new AppError('Hotel ID is required', HTTP_STATUS.BAD_REQUEST);
  }

  const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const end = endDate ? new Date(endDate) : new Date();

  const matchQuery = {
    hotel: assignedHotel,
    createdAt: { $gte: start, $lte: end },
  };

  if (transactionType) {
    matchQuery.transactionType = transactionType;
  }

  const inventoryData = await StockTransaction.aggregate([
    {
      $match: matchQuery,
    },
    {
      $lookup: {
        from: 'inventoryitems',
        localField: 'inventoryItem',
        foreignField: '_id',
        as: 'item',
      },
    },
    {
      $unwind: '$item',
    },
    {
      $group: {
        _id: {
          item: '$item.name',
          type: '$transactionType',
        },
        totalQuantity: { $sum: '$quantity' },
        totalCost: { $sum: '$cost.totalPrice' },
        transactionCount: { $sum: 1 },
      },
    },
    {
      $sort: { totalQuantity: -1 },
    },
  ]);

  const summary = {
    totalTransactions: inventoryData.reduce((sum, item) => sum + item.transactionCount, 0),
    totalCost: inventoryData.reduce((sum, item) => sum + item.totalCost, 0),
  };

  return successResponse(
    res,
    HTTP_STATUS.OK,
    'Inventory report fetched successfully',
    {
      report: inventoryData,
      summary,
      period: { startDate: start, endDate: end },
    }
  );
});