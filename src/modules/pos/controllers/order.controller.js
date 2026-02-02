import Order from '../models/Order.model.js';
import MenuItem from '../models/MenuItem.model.js';
import InventoryItem from '../../inventory/models/InventoryItem.model.js';
import StockTransaction from '../../inventory/models/StockTransaction.model.js';
import Room from '../../rooms/models/Room.model.js';
import Booking from '../../rooms/models/Booking.model.js';
import { successResponse, paginatedResponse } from '../../../utils/responseHandler.js';
import { HTTP_STATUS, PAGINATION, USER_ROLES, ORDER_STATUS, GST_RATE } from '../../../config/constants.js';
import asyncHandler from '../../../utils/asyncHandler.js';
import AppError from '../../../utils/AppError.js';

/**
 * Create Order
 * POST /api/pos/orders
 * Access: Hotel Admin, Manager, Cashier
 */
export const createOrder = asyncHandler(async (req, res) => {
  const {
    hotel,
    orderType,
    tableNumber,
    room,
    booking,
    customer,
    items,
    payment,
    specialInstructions,
  } = req.body;

  // Authorization: Only allow for user's hotel
  let assignedHotel = hotel;
  if (req.user.role !== USER_ROLES.SUPER_ADMIN) {
    assignedHotel = req.user.hotel._id;
  }

  // Validate order type specific requirements
  if (orderType === 'room-service' && !room && !booking) {
    throw new AppError('Room or booking is required for room service', HTTP_STATUS.BAD_REQUEST);
  }

  // Verify room/booking if provided
  if (room) {
    const roomData = await Room.findById(room);
    if (!roomData || roomData.hotel.toString() !== assignedHotel.toString()) {
      throw new AppError('Invalid room', HTTP_STATUS.BAD_REQUEST);
    }
  }

  if (booking) {
    const bookingData = await Booking.findById(booking);
    if (!bookingData || bookingData.hotel.toString() !== assignedHotel.toString()) {
      throw new AppError('Invalid booking', HTTP_STATUS.BAD_REQUEST);
    }
  }

  // Process order items
  const processedItems = [];
  let subtotal = 0;

  for (const item of items) {
    const menuItem = await MenuItem.findById(item.menuItem);

    if (!menuItem) {
      throw new AppError(`Menu item not found: ${item.menuItem}`, HTTP_STATUS.NOT_FOUND);
    }

    if (!menuItem.canOrder()) {
      throw new AppError(`Item not available: ${menuItem.name}`, HTTP_STATUS.BAD_REQUEST);
    }

    // Get price (consider variant if provided)
    const itemPrice = menuItem.getPrice(item.variant);
    const itemSubtotal = itemPrice * item.quantity;

    processedItems.push({
      menuItem: menuItem._id,
      name: menuItem.name,
      variant: item.variant || null,
      quantity: item.quantity,
      price: itemPrice,
      subtotal: itemSubtotal,
      specialInstructions: item.specialInstructions || '',
      status: ORDER_STATUS.PENDING,
    });

    subtotal += itemSubtotal;

    // Update item order count
    menuItem.totalOrders += item.quantity;
    await menuItem.save();
  }

  // Calculate pricing
  const tax = Math.ceil((subtotal * GST_RATE) / 100);
  const total = Math.ceil(subtotal + tax);
   let paymentData = { status: 'UNPAID' };

if (payment && payment.mode) {
  paymentData = {
    mode: payment.mode,        // CASH / UPI / CARD
    status: 'PAID',
    paidAt: new Date(),
    paidBy: req.user._id,
  };
}

  // Create order
  const order = await Order.create({
    hotel: assignedHotel,
    orderType,
    tableNumber,
    room,
    booking,
    customer,
    items: processedItems,
    pricing: {
      subtotal,
      discount: 0,
      tax,
      total,
    },
      status:
    paymentData.status === 'PAID'
      ? ORDER_STATUS.SERVED
      : ORDER_STATUS.PENDING,

  payment: paymentData,
    specialInstructions,
    createdBy: req.user._id,
  });

  const populatedOrder = await Order.findById(order._id)
    .populate('hotel', 'name code')
    .populate('room', 'roomNumber')
    .populate('booking', 'bookingNumber')
    .populate('items.menuItem', 'name type preparationTime')
    .populate('createdBy', 'name email');

    const io = req.app.get('io');
io.of('/pos').emit('order:created', populatedOrder);

  return successResponse(
    res,
    HTTP_STATUS.CREATED,
    'Order created successfully',
    { order: populatedOrder }
  );
});

/**
 * Get All Orders
 * GET /api/pos/orders
 * Access: Authenticated users
 */
export const getAllOrders = asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = PAGINATION.DEFAULT_LIMIT,
    hotel,
    status,
    orderType,
    search,
  } = req.query;

  // Build query
  const query = {};

  // If not super admin, only show their hotel's orders
  if (req.user.role !== USER_ROLES.SUPER_ADMIN) {
    query.hotel = req.user.hotel._id;
  } else if (hotel) {
    query.hotel = hotel;
  }

  if (status) {
    query.status = status;
  }

  if (orderType) {
    query.orderType = orderType;
  }

  if (search) {
    query.$or = [
      { orderNumber: new RegExp(search, 'i') },
      { 'customer.name': new RegExp(search, 'i') },
      { 'customer.phone': new RegExp(search, 'i') },
      { tableNumber: new RegExp(search, 'i') },
    ];
  }

  // Pagination
  const pageNum = parseInt(page);
  const limitNum = Math.min(parseInt(limit), PAGINATION.MAX_LIMIT);
  const skip = (pageNum - 1) * limitNum;

  // Fetch orders
  const orders = await Order.find(query)
    .populate('hotel', 'name code')
    .populate('room', 'roomNumber')
    .populate('booking', 'bookingNumber guest.name')
    .populate('items.menuItem', 'name')
    .populate('createdBy', 'name email')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limitNum);

  // Get total count
  const total = await Order.countDocuments(query);

  return paginatedResponse(
    res,
    orders,
    pageNum,
    limitNum,
    total,
    'Orders fetched successfully'
  );
});

/**
 * Get Single Order
 * GET /api/pos/orders/:id
 * Access: Authenticated users
 */
export const getOrderById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const order = await Order.findById(id)
    .populate('hotel', 'name code address contact')
    .populate('room', 'roomNumber roomType')
    .populate('booking', 'bookingNumber guest')
    .populate('items.menuItem', 'name description type preparationTime')
    .populate('createdBy', 'name email')
    .populate('preparedBy', 'name email')
    .populate('servedBy', 'name email');

  if (!order) {
    throw new AppError('Order not found', HTTP_STATUS.NOT_FOUND);
  }

  // Authorization check
  if (req.user.role !== USER_ROLES.SUPER_ADMIN) {
    if (!req.user.hotel || order.hotel._id.toString() !== req.user.hotel._id.toString()) {
      throw new AppError('Access denied to this order', HTTP_STATUS.FORBIDDEN);
    }
  }

  return successResponse(
    res,
    HTTP_STATUS.OK,
    'Order details fetched successfully',
    { order }
  );
});

/**
 * Update Order Status
 * PATCH /api/pos/orders/:id/status
 * Access: Hotel Admin, Manager, Cashier, Kitchen Staff
 */
export const updateOrderStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  const order = await Order.findById(id);

  if (!order) {
    throw new AppError('Order not found', HTTP_STATUS.NOT_FOUND);
  }

  // Authorization check
  if (req.user.role !== USER_ROLES.SUPER_ADMIN) {
    if (!req.user.hotel || order.hotel.toString() !== req.user.hotel._id.toString()) {
      throw new AppError('Access denied to update this order', HTTP_STATUS.FORBIDDEN);
    }
  }

  // Update status and timestamps
  order.status = status;

  switch (status) {
    case ORDER_STATUS.PREPARING:
      order.timestamps.preparing = new Date();
      order.preparedBy = req.user._id;
      break;
    case ORDER_STATUS.READY:
      order.timestamps.ready = new Date();
      break;
    case ORDER_STATUS.SERVED:
      order.timestamps.served = new Date();
      order.servedBy = req.user._id;
      break;
    case ORDER_STATUS.CANCELLED:
      order.timestamps.cancelled = new Date();
      break;
  }

  await order.save();

  const updatedOrder = await Order.findById(id)
    .populate('hotel', 'name code')
    .populate('preparedBy', 'name')
    .populate('servedBy', 'name');


    const io = req.app.get('io');
io.of('/pos').emit('order:updated', updatedOrder);

  return successResponse(
    res,
    HTTP_STATUS.OK,
    'Order status updated successfully',
    { order: updatedOrder }
  );
});

/**
 * Get Kitchen Orders (for kitchen staff)
 * GET /api/pos/orders/kitchen
 * Access: Kitchen Staff, Manager
 */
export const getKitchenOrders = asyncHandler(async (req, res) => {
  const { hotel } = req.query;

  // Build query
  let assignedHotel = hotel;
  if (req.user.role !== USER_ROLES.SUPER_ADMIN) {
    assignedHotel = req.user.hotel._id;
  }

  // Get active orders (pending or preparing)
  const orders = await Order.find({
    hotel: assignedHotel,
    status: { $in: [ORDER_STATUS.PENDING, ORDER_STATUS.PREPARING] },
  })
    .populate('room', 'roomNumber')
    .populate('items.menuItem', 'name type preparationTime')
    .sort({ createdAt: 1 });

  return successResponse(
    res,
    HTTP_STATUS.OK,
    'Kitchen orders fetched successfully',
    { orders, count: orders.length }
  );
});




/**
 * Checkout / Complete Order
 * POST /api/pos/orders/:id/checkout
 */
export const checkoutOrder = asyncHandler(async (req, res) => {
  const { id } = req.params;

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

  // ✅ Only served orders can be checked out
if (!order.payment || order.payment.status !== 'PAID') {
  throw new AppError(
    'Order payment is pending. Cannot checkout.',
    HTTP_STATUS.BAD_REQUEST
  );
}

  // 🔥 THIS IS THE EXACT PLACE
  await deductInventoryForOrder(order, req.user);

  // ✅ Mark order completed
  order.status = ORDER_STATUS.COMPLETED;
  order.timestamps.completed = new Date();
  await order.save();

const io = req.app.get('io');
io.of('/pos').emit('order:completed', order);

  return successResponse(
    res,
    HTTP_STATUS.OK,
    'Order checked out successfully',
    { order }
  );
});






const deductInventoryForOrder = async (order, user) => {
  for (const orderItem of order.items) {
    const menuItem = await MenuItem.findById(orderItem.menuItem).populate(
      'ingredients.inventoryItem'
    );

    if (!menuItem || !menuItem.ingredients) continue;

    for (const ingredient of menuItem.ingredients) {
      const inventoryItem = ingredient.inventoryItem;

      if (!inventoryItem) continue;

      const requiredQty =
        ingredient.quantity * orderItem.quantity;

      // ❌ Stock check
      if (inventoryItem.quantity.current < requiredQty) {
        throw new AppError(
          `Insufficient stock for ${inventoryItem.name}`,
          HTTP_STATUS.BAD_REQUEST
        );
      }

      const previousStock = inventoryItem.quantity.current;

      // ✅ Deduct stock
      inventoryItem.quantity.current -= requiredQty;
      await inventoryItem.save();

      // ✅ Create stock transaction
      await StockTransaction.create({
        hotel: order.hotel,
        inventoryItem: inventoryItem._id,
        transactionType: 'sale',
        quantity: requiredQty,
        unit: inventoryItem.unit,
        previousStock,
        newStock: inventoryItem.quantity.current,
        reference: {
          type: 'pos_order',
          id: order._id,
        },
        reason: `POS Order ${order.orderNumber}`,
        performedBy: user._id,
      });
    }
  }
};


/**
 * Get Running Orders (for cashier / billing)
 * GET /api/pos/orders/running
 * Access: Hotel Admin, Manager, Cashier
 */
export const getRunningOrders = asyncHandler(async (req, res) => {
  // 🔒 Hotel scope
  let assignedHotel;
  if (req.user.role !== USER_ROLES.SUPER_ADMIN) {
    assignedHotel = req.user.hotel._id;
  }

  const orders = await Order.find({
    hotel: assignedHotel,
    status: {
      $in: [
        ORDER_STATUS.PENDING,
        ORDER_STATUS.PREPARING,
        ORDER_STATUS.READY,
        ORDER_STATUS.SERVED,
      ],
    },
  })
    .populate('room', 'roomNumber')
    .populate('items.menuItem', 'name')
    .populate('createdBy', 'name')
    .sort({ createdAt: -1 });

  return successResponse(
    res,
    HTTP_STATUS.OK,
    'Running orders fetched successfully',
    { orders, count: orders.length }
  );
});