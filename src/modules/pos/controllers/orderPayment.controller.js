// src/modules/pos/controllers/orderPayment.controller.js

import Order from '../models/Order.model.js';
import asyncHandler from '../../../utils/asyncHandler.js';
import AppError from '../../../utils/AppError.js';
import { successResponse } from '../../../utils/responseHandler.js';
import { HTTP_STATUS, USER_ROLES, ORDER_STATUS } from '../../../config/constants.js';

/**
 * Mark Order as Paid
 * PATCH /api/pos/orders/:id/payment
 * Access: Super Admin, Hotel Admin, Manager, Cashier
 */
export const markOrderPaid = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { mode } = req.body;

  // 🔍 Validate payment mode
  if (!['CASH', 'UPI', 'CARD'].includes(mode)) {
    throw new AppError(
      'Invalid payment mode. Must be CASH, UPI, or CARD',
      HTTP_STATUS.BAD_REQUEST
    );
  }

  const order = await Order.findById(id);

  if (!order) {
    throw new AppError('Order not found', HTTP_STATUS.NOT_FOUND);
  }

  // 🔒 Hotel authorization
  if (
    req.user.role !== USER_ROLES.SUPER_ADMIN &&
    order.hotel.toString() !== req.user.hotel._id.toString()
  ) {
    throw new AppError('Access denied', HTTP_STATUS.FORBIDDEN);
  }

  // ❌ Cancelled orders cannot be paid
  if (order.status === ORDER_STATUS.CANCELLED) {
    throw new AppError(
      'Cancelled order cannot be paid',
      HTTP_STATUS.BAD_REQUEST
    );
  }

  // ❌ Already paid
  if (order.payment?.status === 'PAID') {
    throw new AppError(
      'Order is already marked as paid',
      HTTP_STATUS.BAD_REQUEST
    );
  }

  // ✅ Mark payment
  order.payment = {
    mode,
    status: 'PAID',
    paidAt: new Date(),
    paidBy: req.user._id,
  };

  // ✅ Auto mark as served
  order.status = ORDER_STATUS.SERVED;
  order.timestamps.served = new Date();
  order.servedBy = req.user._id;

  await order.save();

  const populatedOrder = await Order.findById(order._id)
    .populate('hotel', 'name code')
    .populate('servedBy', 'name email');

  // 🔊 Emit socket event
  const io = req.app.get('io');
  io.of('/pos').emit('order:paid', populatedOrder);

  return successResponse(
    res,
    HTTP_STATUS.OK,
    'Payment recorded successfully',
    { order: populatedOrder }
  );
});