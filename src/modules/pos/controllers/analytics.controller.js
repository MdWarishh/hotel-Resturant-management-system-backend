import Order from '../models/Order.model.js';
import { successResponse } from '../../../utils/responseHandler.js';
import { ORDER_STATUS } from '../../../config/constants.js';

export const getTodaySummary = async (req, res) => {
  const hotelId = req.user.hotel._id;

  const start = new Date();
  start.setHours(0, 0, 0, 0);

  const end = new Date();
  end.setHours(23, 59, 59, 999);

  const orders = await Order.find({
    hotel: hotelId,
    status: ORDER_STATUS.COMPLETED,
    createdAt: { $gte: start, $lte: end },
  });

  const totalOrders = orders.length;
  const totalSales = orders.reduce(
    (sum, o) => sum + (o.pricing?.total || 0),
    0
  );

  const avgOrderValue =
    totalOrders === 0
      ? 0
      : Math.ceil(totalSales / totalOrders);

  return successResponse(res, 200, 'POS summary', {
    totalSales,
    totalOrders,
    avgOrderValue,
    paymentSplit: {},
    topItems: [],
    peakHours: [],
  });
};