import Hotel from '../../hotels/models/Hotel.model.js';
import Room from '../../rooms/models/Room.model.js';
import Booking from '../../rooms/models/Booking.model.js';
import Order from '../../pos/models/Order.model.js';
import Invoice from '../../billing/models/Invoice.model.js';
import InventoryItem from '../../inventory/models/InventoryItem.model.js';
import User from '../../auth/models/User.model.js';
import { successResponse } from '../../../utils/responseHandler.js';
import { HTTP_STATUS, USER_ROLES, BOOKING_STATUS, ORDER_STATUS, PAYMENT_STATUS, ROOM_STATUS } from '../../../config/constants.js';
import asyncHandler from '../../../utils/asyncHandler.js';

/**
 * Get Dashboard Statistics
 * GET /api/reports/dashboard
 * Access: Authenticated users (role-based data)
 */
export const getDashboardStats = asyncHandler(async (req, res) => {
  const { hotel } = req.query;

  let assignedHotel = hotel;
  if (req.user.role !== USER_ROLES.SUPER_ADMIN) {
    assignedHotel = req.user.hotel._id;
  }

  // Get date ranges
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const thisMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const nextMonthStart = new Date(today.getFullYear(), today.getMonth() + 1, 1);

  const thisYearStart = new Date(today.getFullYear(), 0, 1);

  // Initialize stats object
  const stats = {
    hotel: null,
    rooms: {
      total: 0,
      available: 0,
      occupied: 0,
      maintenance: 0,
      occupancyRate: 0,
    },
    bookings: {
      today: 0,
      thisMonth: 0,
      active: 0,
      checkInsToday: 0,
      checkOutsToday: 0,
    },
    revenue: {
      today: 0,
      thisMonth: 0,
      thisYear: 0,
      pending: 0,
    },
    orders: {
      today: 0,
      thisMonth: 0,
      pending: 0,
      preparing: 0,
    },
    inventory: {
      total: 0,
      lowStock: 0,
      outOfStock: 0,
    },
  };

  // Get hotel info
  if (assignedHotel) {
    stats.hotel = await Hotel.findById(assignedHotel).select('name code totalRooms');

    // Room statistics
    const rooms = await Room.find({ hotel: assignedHotel, isActive: true });
    stats.rooms.total = rooms.length;
    stats.rooms.available = rooms.filter((r) => r.status === ROOM_STATUS.AVAILABLE).length;
    stats.rooms.occupied = rooms.filter((r) => r.status === ROOM_STATUS.OCCUPIED).length;
    stats.rooms.maintenance = rooms.filter((r) => r.status === ROOM_STATUS.MAINTENANCE).length;
    stats.rooms.occupancyRate = stats.rooms.total > 0 
      ? Math.round((stats.rooms.occupied / stats.rooms.total) * 100) 
      : 0;

    // Booking statistics
    stats.bookings.today = await Booking.countDocuments({
      hotel: assignedHotel,
      createdAt: { $gte: today, $lt: tomorrow },
    });

    stats.bookings.thisMonth = await Booking.countDocuments({
      hotel: assignedHotel,
      createdAt: { $gte: thisMonthStart, $lt: nextMonthStart },
    });

    stats.bookings.active = await Booking.countDocuments({
      hotel: assignedHotel,
      status: { $in: [BOOKING_STATUS.CONFIRMED, BOOKING_STATUS.CHECKED_IN] },
    });

    stats.bookings.checkInsToday = await Booking.countDocuments({
      hotel: assignedHotel,
      'dates.checkIn': { $gte: today, $lt: tomorrow },
      status: BOOKING_STATUS.CONFIRMED,
    });

    stats.bookings.checkOutsToday = await Booking.countDocuments({
      hotel: assignedHotel,
      'dates.checkOut': { $gte: today, $lt: tomorrow },
      status: BOOKING_STATUS.CHECKED_IN,
    });

    // Revenue statistics
    const todayRevenue = await Invoice.aggregate([
      {
        $match: {
          hotel: assignedHotel,
          createdAt: { $gte: today, $lt: tomorrow },
          status: 'generated',
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$pricing.total' },
        },
      },
    ]);

    const monthRevenue = await Invoice.aggregate([
      {
        $match: {
          hotel: assignedHotel,
          createdAt: { $gte: thisMonthStart, $lt: nextMonthStart },
          status: 'generated',
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$pricing.total' },
        },
      },
    ]);

    const yearRevenue = await Invoice.aggregate([
      {
        $match: {
          hotel: assignedHotel,
          createdAt: { $gte: thisYearStart },
          status: 'generated',
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$pricing.total' },
        },
      },
    ]);

    const pendingRevenue = await Invoice.aggregate([
      {
        $match: {
          hotel: assignedHotel,
          paymentStatus: { $in: [PAYMENT_STATUS.PENDING, PAYMENT_STATUS.PARTIALLY_PAID] },
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$balanceAmount' },
        },
      },
    ]);

    stats.revenue.today = todayRevenue[0]?.total || 0;
    stats.revenue.thisMonth = monthRevenue[0]?.total || 0;
    stats.revenue.thisYear = yearRevenue[0]?.total || 0;
    stats.revenue.pending = pendingRevenue[0]?.total || 0;

    // Order statistics (POS)
    stats.orders.today = await Order.countDocuments({
      hotel: assignedHotel,
      createdAt: { $gte: today, $lt: tomorrow },
    });

    stats.orders.thisMonth = await Order.countDocuments({
      hotel: assignedHotel,
      createdAt: { $gte: thisMonthStart, $lt: nextMonthStart },
    });

    stats.orders.pending = await Order.countDocuments({
      hotel: assignedHotel,
      status: ORDER_STATUS.PENDING,
    });

    stats.orders.preparing = await Order.countDocuments({
      hotel: assignedHotel,
      status: ORDER_STATUS.PREPARING,
    });

    // Inventory statistics
    const inventoryItems = await InventoryItem.find({
      hotel: assignedHotel,
      isActive: true,
    });

    stats.inventory.total = inventoryItems.length;
    stats.inventory.lowStock = inventoryItems.filter(
      (item) => item.quantity.current <= item.quantity.minimum && item.quantity.current > 0
    ).length;
    stats.inventory.outOfStock = inventoryItems.filter(
      (item) => item.quantity.current === 0
    ).length;
  }

  // Super Admin gets system-wide stats
  if (req.user.role === USER_ROLES.SUPER_ADMIN && !assignedHotel) {
    const totalHotels = await Hotel.countDocuments({ status: 'active' });
    const totalUsers = await User.countDocuments({ status: 'active' });
    const totalRooms = await Room.countDocuments({ isActive: true });

    stats.system = {
      totalHotels,
      totalUsers,
      totalRooms,
    };
  }

  return successResponse(
    res,
    HTTP_STATUS.OK,
    'Dashboard statistics fetched successfully',
    { stats }
  );
});