import Hotel from '../../hotels/models/Hotel.model.js';
import User from '../../auth/models/User.model.js';
import Booking from '../../rooms/models/Booking.model.js';
import { successResponse } from '../../../utils/responseHandler.js';
import asyncHandler from '../../../utils/asyncHandler.js';

export const getSuperAdminStats = asyncHandler(async (req, res) => {
  // 1. Count Total Hotels across the system
  const totalHotels = await Hotel.countDocuments();

  // 2. Count Total Users across the system
  const totalUsers = await User.countDocuments();

  // 3. Calculate Total Revenue from all "paid" bookings
  const revenueData = await Booking.aggregate([
    { $match: { paymentStatus: 'paid' } },
    { $group: { _id: null, total: { $sum: '$pricing.total' } } }
  ]);
  const totalRevenue = revenueData.length > 0 ? revenueData[0].total : 0;

  // 4. Count Active Staff only (Exclude Super Admins, only active status)
  // ✅ FIX: Added status: 'active' filter — was showing all users as "inactive" before
  const activeStaff = await User.countDocuments({
    role: { $ne: 'super_admin' },
    status: 'active',
  });

  return successResponse(res, 200, 'Super Admin Stats', {
    totalHotels,
    totalUsers,
    activeStaff,
    totalRevenue,
  });
});