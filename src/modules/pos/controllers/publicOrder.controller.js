// backend/src/modules/pos/controllers/publicOrder.controller.js

import Order from '../models/Order.model.js';
import Hotel from '../../hotels/models/Hotel.model.js';
import MenuItem from '../models/MenuItem.model.js';
import Table from '../../tables/models/Table.model.js';
import Room from '../../rooms/models/Room.model.js';
import { successResponse } from '../../../utils/responseHandler.js';
import { HTTP_STATUS, ORDER_STATUS } from '../../../config/constants.js';
import asyncHandler from '../../../utils/asyncHandler.js';
import AppError from '../../../utils/AppError.js';
import PushSubscription from '../models/PushSubscription.model.js';
import { sendPushToAll } from '../../../services/push.service.js';

// ── 📧 Email import ──
import { sendNewOrderEmail } from '../../../services/email.service.js';

/**
 * 🌍 PUBLIC: Place Order (No Authentication Required)
 * POST /api/public/:hotelCode/order
 */
export const placePublicOrder = asyncHandler(async (req, res) => {
  const { hotelCode } = req.params;
  const {
    orderType,
    tableNumber,
    roomNumber,
    customer,
    items,
    specialInstructions,
  } = req.body;

  // ── 1. Validate Hotel ──
  const hotel = await Hotel.findOne({ code: hotelCode.toUpperCase(), status: 'active' });
  if (!hotel) throw new AppError('Hotel not found or inactive', HTTP_STATUS.NOT_FOUND);

  // ── 2. Validate Order Type ──
  const validOrderTypes = ['dine-in', 'room-service', 'takeaway', 'delivery'];
  if (!validOrderTypes.includes(orderType)) {
    throw new AppError(`Invalid order type. Must be one of: ${validOrderTypes.join(', ')}`, HTTP_STATUS.BAD_REQUEST);
  }

  // ── 3. Validate Customer ──
  if (!customer || !customer.name || !customer.phone) {
    throw new AppError('Customer name and phone are required', HTTP_STATUS.BAD_REQUEST);
  }
  if (!/^[0-9]{10}$/.test(customer.phone)) {
    throw new AppError('Please enter a valid 10-digit phone number', HTTP_STATUS.BAD_REQUEST);
  }

  // ── 4. Order-type specific validation ──
  if (orderType === 'dine-in') {
    if (!tableNumber) throw new AppError('Table number is required for dine-in orders', HTTP_STATUS.BAD_REQUEST);
    const table = await Table.findOne({ hotel: hotel._id, tableNumber });
    if (!table) throw new AppError('Invalid table number', HTTP_STATUS.BAD_REQUEST);
    if (table.status !== 'available') {
      throw new AppError(`Table ${tableNumber} is not available. Please select another table.`, HTTP_STATUS.BAD_REQUEST);
    }
  }

  if (orderType === 'room-service') {
    if (!roomNumber) throw new AppError('Room number is required for room service', HTTP_STATUS.BAD_REQUEST);
    const room = await Room.findOne({ hotel: hotel._id, roomNumber: roomNumber.toUpperCase() });
    if (!room) throw new AppError('Invalid room number', HTTP_STATUS.BAD_REQUEST);
    if (room.status !== 'occupied') {
      throw new AppError(`Room ${roomNumber} is not occupied. Room service is only available for checked-in guests.`, HTTP_STATUS.BAD_REQUEST);
    }
  }

  if (orderType === 'delivery') {
    if (!customer.address || customer.address.trim().length < 10) {
      throw new AppError('Delivery address is required and must be at least 10 characters', HTTP_STATUS.BAD_REQUEST);
    }
  }

  // ── 5. Validate Items ──
  if (!items || items.length === 0) {
    throw new AppError('Order must contain at least one item', HTTP_STATUS.BAD_REQUEST);
  }

  // ── 6. Fetch & validate menu items ──
  const orderItems = [];
  let subtotal = 0;

  for (const item of items) {
    const menuItem = await MenuItem.findOne({ _id: item.menuItem, hotel: hotel._id, isActive: true });
    if (!menuItem) throw new AppError(`Menu item not found: ${item.menuItem}`, HTTP_STATUS.NOT_FOUND);
    if (!menuItem.isAvailable) throw new AppError(`Item "${menuItem.name}" is currently unavailable`, HTTP_STATUS.BAD_REQUEST);
    if (!item.quantity || item.quantity < 1) throw new AppError('Item quantity must be at least 1', HTTP_STATUS.BAD_REQUEST);

    let itemPrice = menuItem.price;
    if (item.variant && menuItem.variants?.length > 0) {
      const variantData = menuItem.variants.find((v) => v.name === item.variant);
      if (variantData?.price) itemPrice = variantData.price;
    }

    const itemSubtotal = itemPrice * item.quantity;
    subtotal += itemSubtotal;

    orderItems.push({
      menuItem: menuItem._id,
      name: menuItem.name,
      variant: item.variant || null,
      quantity: item.quantity,
      price: itemPrice,
      subtotal: itemSubtotal,
      specialInstructions: item.specialInstructions || '',
      status: ORDER_STATUS.PENDING,
    });
  }

  // ── 7. Auto-calculate delivery charge ──
  const autoDeliveryCharge =
    orderType === 'delivery' ? hotel.calcDeliveryCharge(subtotal) : 0;

  // ── 8. Auto-calculate packaging charge ──
  const packagingCharge = hotel.calcPackagingCharge(orderType, subtotal);

  const extraCharges = [];
  if (packagingCharge > 0) {
    extraCharges.push({ label: 'Packaging', amount: packagingCharge });
  }
  const extraChargesTotal = extraCharges.reduce((sum, c) => sum + c.amount, 0);

  // ── 9. Calculate pricing ──
  const taxRate = hotel.settings?.taxRate || 5;
  const tax = Math.ceil(((subtotal + extraChargesTotal) * taxRate) / 100);
  const total = subtotal + extraChargesTotal + tax + autoDeliveryCharge;

  // ── 10. Create Order ──
  const order = await Order.create({
    hotel: hotel._id,
    orderType,
    tableNumber: orderType === 'dine-in' ? tableNumber : undefined,
    room:
      orderType === 'room-service'
        ? (await Room.findOne({ hotel: hotel._id, roomNumber: roomNumber.toUpperCase() }))?._id
        : undefined,
    customer: {
      name: customer.name.trim(),
      phone: customer.phone,
      email: customer.email?.trim() || '',
      address: customer.address?.trim() || '',
    },
    items: orderItems,
    extraCharges,
    pricing: {
      subtotal,
      discount: 0,
      tax,
      deliveryCharge: autoDeliveryCharge,
      extraChargesTotal,
      total,
    },
    status: ORDER_STATUS.PENDING,
    payment: { status: 'UNPAID' },
    specialInstructions: specialInstructions || '',
    timestamps: { placed: new Date() },
    isPublicOrder: true,
    createdBy: null,
  });

  // ── 11. Update table status if dine-in ──
  if (orderType === 'dine-in' && tableNumber) {
    await Table.findOneAndUpdate(
      { hotel: hotel._id, tableNumber },
      { status: 'reserved' }
    );
    const io = req.app.get('io');
    if (io) {
      io.of('/pos').emit('table:updated', { hotelId: hotel._id, tableNumber, status: 'reserved' });
    }
  }

  // ── 11.5 🔔 PUSH NOTIFICATION ──
  try {
    const pushSubscriptions = await PushSubscription.find({ hotel: hotel._id });
    if (pushSubscriptions.length > 0) {
      const notifConfig = {
        delivery:        { title: '🛵 New Delivery Order!'      },
        takeaway:        { title: '🥡 New Takeaway Order!'       },
        'room-service':  { title: '🛎️ New Room Service Order!'  },
        'dine-in':       { title: '🍽️ New Dine-in Order!'       },
      };
      const config = notifConfig[orderType] || { title: '🆕 New Order!' };
      const payload = {
        title: config.title,
        body: `${customer.name} • ₹${total} • Order #${order.orderNumber}`,
        tag: order.orderNumber,
        requireInteraction: true,
        data: { orderNumber: order.orderNumber, orderType, url: '/pos/orders' },
      };
      const rawSubs = pushSubscriptions.map((s) => s.subscription);
      await sendPushToAll(rawSubs, payload);
    }
  } catch (pushErr) {
    console.error('🔔 Push error (non-critical):', pushErr.message);
  }

  // ── 11.6 📧 EMAIL NOTIFICATION ──
  // Sirf delivery aur takeaway ke liye — ye wale miss ho jaate hain
  // Dine-in aur room-service ke liye bhi chahiye toh condition hata do
  if (['delivery', 'takeaway', 'room-service', 'dine-in'].includes(orderType)) {
    sendNewOrderEmail({
      orderNumber: order.orderNumber,
      orderType,
      customerName: customer.name.trim(),
      customerPhone: customer.phone,
      customerAddress: customer.address?.trim() || '',
      items: orderItems,
      total,
      specialInstructions: specialInstructions || '',
    }); // await nahi — background mein bhejo, response wait na kare
  }

  // ── 12. Socket emit ──
  const io = req.app.get('io');
  if (io) {
    const populatedOrder = await Order.findById(order._id)
      .populate('hotel', 'name code')
      .populate('items.menuItem', 'name images');
    io.of('/pos').emit('order:new-public', populatedOrder);
  }

  // ── 13. Response ──
  return successResponse(res, HTTP_STATUS.CREATED, 'Order placed successfully! Waiting for cashier approval.', {
    order: {
      orderNumber: order.orderNumber,
      orderType: order.orderType,
      status: order.status,
      customer: order.customer,
      items: order.items.map((item) => ({
        name: item.name,
        variant: item.variant,
        quantity: item.quantity,
        price: item.price,
        subtotal: item.subtotal,
      })),
      pricing: order.pricing,
      chargesBreakdown: {
        subtotal,
        ...(packagingCharge > 0 && { packagingCharge }),
        ...(autoDeliveryCharge > 0 && { deliveryCharge: autoDeliveryCharge }),
        tax,
        total,
      },
      estimatedTime: '15-30 minutes',
    },
  });
});

/**
 * 🌍 PUBLIC: Track Order
 * GET /api/public/:hotelCode/order/:orderNumber
 */
export const trackPublicOrder = asyncHandler(async (req, res) => {
  const { hotelCode, orderNumber } = req.params;

  const hotel = await Hotel.findOne({ code: hotelCode.toUpperCase(), status: 'active' });
  if (!hotel) throw new AppError('Hotel not found', HTTP_STATUS.NOT_FOUND);

  const order = await Order.findOne({
    hotel: hotel._id,
    orderNumber: orderNumber.toUpperCase(),
    isPublicOrder: true,
  })
    .populate('items.menuItem', 'name images preparationTime')
    .select('-createdBy -preparedBy -servedBy -notes');

  if (!order) throw new AppError('Order not found', HTTP_STATUS.NOT_FOUND);

  let estimatedTime = 'Processing...';
  if (order.status === ORDER_STATUS.PREPARING) estimatedTime = '10-15 minutes';
  else if (order.status === ORDER_STATUS.READY) estimatedTime = 'Ready for pickup/delivery';
  else if (order.status === ORDER_STATUS.SERVED) estimatedTime = 'Completed';

  return successResponse(res, HTTP_STATUS.OK, 'Order details fetched successfully', {
    order: {
      orderNumber: order.orderNumber,
      orderType: order.orderType,
      status: order.status,
      customer: order.customer,
      items: order.items,
      pricing: order.pricing,
      extraCharges: order.extraCharges,
      specialInstructions: order.specialInstructions,
      timestamps: order.timestamps,
      estimatedTime,
    },
  });
});