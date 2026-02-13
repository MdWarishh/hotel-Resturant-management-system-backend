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

/**
 * 🌍 PUBLIC: Place Order (No Authentication Required)
 * POST /api/public/:hotelCode/order
 * Access: Public
 */
export const placePublicOrder = asyncHandler(async (req, res) => {
  const { hotelCode } = req.params;
  const {
    orderType, // 'dine-in', 'room-service', 'takeaway', 'delivery'
    tableNumber,
    roomNumber,
    customer, // { name, phone, email, address }
    items, // [{ menuItem, quantity, variant, specialInstructions }]
    specialInstructions,
  } = req.body;

  // ========================================
  // 1️⃣ VALIDATE HOTEL
  // ========================================
  const hotel = await Hotel.findOne({
    code: hotelCode.toUpperCase(),
    status: 'active',
  });

  if (!hotel) {
    throw new AppError('Hotel not found or inactive', HTTP_STATUS.NOT_FOUND);
  }

  // ========================================
  // 2️⃣ VALIDATE ORDER TYPE
  // ========================================
  const validOrderTypes = ['dine-in', 'room-service', 'takeaway', 'delivery'];
  if (!validOrderTypes.includes(orderType)) {
    throw new AppError(
      `Invalid order type. Must be one of: ${validOrderTypes.join(', ')}`,
      HTTP_STATUS.BAD_REQUEST
    );
  }

  // ========================================
  // 3️⃣ VALIDATE CUSTOMER INFO
  // ========================================
  if (!customer || !customer.name || !customer.phone) {
    throw new AppError(
      'Customer name and phone are required',
      HTTP_STATUS.BAD_REQUEST
    );
  }

  // Phone validation (10 digits)
  if (!/^[0-9]{10}$/.test(customer.phone)) {
    throw new AppError(
      'Please enter a valid 10-digit phone number',
      HTTP_STATUS.BAD_REQUEST
    );
  }

  // ========================================
  // 4️⃣ VALIDATE ORDER TYPE SPECIFIC FIELDS
  // ========================================

  // DINE-IN: Table number required
  if (orderType === 'dine-in') {
    if (!tableNumber) {
      throw new AppError('Table number is required for dine-in orders', HTTP_STATUS.BAD_REQUEST);
    }

    // Check if table exists and is available
    const table = await Table.findOne({
      hotel: hotel._id,
      tableNumber: tableNumber,
    });

    if (!table) {
      throw new AppError('Invalid table number', HTTP_STATUS.BAD_REQUEST);
    }

    if (table.status !== 'available') {
      throw new AppError(
        `Table ${tableNumber} is not available. Please select another table.`,
        HTTP_STATUS.BAD_REQUEST
      );
    }
  }

  // ROOM SERVICE: Room number required
  if (orderType === 'room-service') {
    if (!roomNumber) {
      throw new AppError('Room number is required for room service', HTTP_STATUS.BAD_REQUEST);
    }

    // Check if room exists and is occupied
    const room = await Room.findOne({
      hotel: hotel._id,
      roomNumber: roomNumber.toUpperCase(),
    });

    if (!room) {
      throw new AppError('Invalid room number', HTTP_STATUS.BAD_REQUEST);
    }

    if (room.status !== 'occupied') {
      throw new AppError(
        `Room ${roomNumber} is not occupied. Room service is only available for checked-in guests.`,
        HTTP_STATUS.BAD_REQUEST
      );
    }
  }

  // DELIVERY: Address required
  if (orderType === 'delivery') {
    if (!customer.address || customer.address.trim().length < 10) {
      throw new AppError(
        'Delivery address is required and must be at least 10 characters',
        HTTP_STATUS.BAD_REQUEST
      );
    }
  }

  // ========================================
  // 5️⃣ VALIDATE ITEMS
  // ========================================
  if (!items || items.length === 0) {
    throw new AppError('Order must contain at least one item', HTTP_STATUS.BAD_REQUEST);
  }

  // ========================================
  // 6️⃣ FETCH & VALIDATE MENU ITEMS
  // ========================================
  const orderItems = [];
  let subtotal = 0;

  for (const item of items) {
    // Fetch menu item from database
    const menuItem = await MenuItem.findOne({
      _id: item.menuItem,
      hotel: hotel._id,
      isActive: true,
    });

    if (!menuItem) {
      throw new AppError(`Menu item not found: ${item.menuItem}`, HTTP_STATUS.NOT_FOUND);
    }

    // Check availability
    if (!menuItem.isAvailable) {
      throw new AppError(
        `Item "${menuItem.name}" is currently unavailable`,
        HTTP_STATUS.BAD_REQUEST
      );
    }

    // Validate quantity
    if (!item.quantity || item.quantity < 1) {
      throw new AppError('Item quantity must be at least 1', HTTP_STATUS.BAD_REQUEST);
    }

    // Calculate price (variant price if exists, else base price)
    let itemPrice = menuItem.price;

    if (item.variant && menuItem.variants && menuItem.variants.length > 0) {
      const variantData = menuItem.variants.find((v) => v.name === item.variant);
      if (variantData && variantData.price) {
        itemPrice = variantData.price;
      }
    }

    const itemSubtotal = itemPrice * item.quantity;
    subtotal += itemSubtotal;

    // Add to order items
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

  // ========================================
  // 7️⃣ CALCULATE PRICING (GST 5%)
  // ========================================
  const taxRate = hotel.settings?.taxRate || 5; // Default 5% GST
  const tax = Math.ceil((subtotal * taxRate) / 100); // Round up
  const total = subtotal + tax;

  // ========================================
  // 8️⃣ CREATE ORDER
  // ========================================
  const order = await Order.create({
    hotel: hotel._id,
    orderType,
    tableNumber: orderType === 'dine-in' ? tableNumber : undefined,
    room: orderType === 'room-service' ? 
      (await Room.findOne({ hotel: hotel._id, roomNumber: roomNumber.toUpperCase() }))?._id : 
      undefined,
    customer: {
      name: customer.name.trim(),
      phone: customer.phone,
      email: customer.email?.trim() || '',
      address: customer.address?.trim() || '',
    },
    items: orderItems,
    pricing: {
      subtotal,
      discount: 0,
      tax,
      total,
    },
    status: ORDER_STATUS.PENDING, // Cashier will approve
    payment: {
      status: 'UNPAID',
    },
    specialInstructions: specialInstructions || '',
    timestamps: {
      placed: new Date(),
    },
    isPublicOrder: true, // Mark as public order
    createdBy: null, // No user authentication
  });

  // ========================================
  // 9️⃣ UPDATE TABLE STATUS (if dine-in)
  // ========================================
  if (orderType === 'dine-in' && tableNumber) {
    await Table.findOneAndUpdate(
      { hotel: hotel._id, tableNumber: tableNumber },
      { status: 'reserved' } // Reserve table until order is served
    );

    // Emit socket event for real-time table update
    const io = req.app.get('io');
    if (io) {
      io.of('/pos').emit('table:updated', {
        hotelId: hotel._id,
        tableNumber,
        status: 'reserved',
      });
    }
  }

  // ========================================
  // 🔟 EMIT SOCKET EVENT (New Public Order)
  // ========================================
  const io = req.app.get('io');
  if (io) {
    const populatedOrder = await Order.findById(order._id)
      .populate('hotel', 'name code')
      .populate('items.menuItem', 'name images');

    io.of('/pos').emit('order:new-public', populatedOrder);
  }

  // ========================================
  // ✅ SEND RESPONSE
  // ========================================
  return successResponse(
    res,
    HTTP_STATUS.CREATED,
    'Order placed successfully! Waiting for cashier approval.',
    {
      order: {
        orderNumber: order.orderNumber,
        orderType: order.orderType,
        status: order.status,
        customer: order.customer,
        items: order.items.map(item => ({
          name: item.name,
          variant: item.variant,
          quantity: item.quantity,
          price: item.price,
          subtotal: item.subtotal,
        })),
        pricing: order.pricing,
        estimatedTime: '15-30 minutes',
      },
    }
  );
});

/**
 * 🌍 PUBLIC: Get Order Status (Track Order)
 * GET /api/public/:hotelCode/order/:orderNumber
 * Access: Public (Anyone with order number can track)
 */
export const trackPublicOrder = asyncHandler(async (req, res) => {
  const { hotelCode, orderNumber } = req.params;

   console.log('🔍 Track Order Request:');
  console.log('Hotel Code:', hotelCode);
  console.log('Order Number:', orderNumber);

  // Find hotel
  const hotel = await Hotel.findOne({
    code: hotelCode.toUpperCase(),
    status: 'active',
  });

   console.log('🏨 Hotel Found:', hotel ? hotel.name : 'NOT FOUND');

  if (!hotel) {
    throw new AppError('Hotel not found', HTTP_STATUS.NOT_FOUND);
  }

  // Find order
  const order = await Order.findOne({
    hotel: hotel._id,
    orderNumber: orderNumber.toUpperCase(),
    isPublicOrder: true,
  })
    .populate('items.menuItem', 'name images preparationTime')
    .select('-createdBy -preparedBy -servedBy -notes');

     console.log('📦 Order Found:', order ? order.orderNumber : 'NOT FOUND');
  console.log('🔍 Query:', {
    hotel: hotel._id,
    orderNumber: orderNumber.toUpperCase(),
    isPublicOrder: true,
  });

  
  if (!order) {
    throw new AppError('Order not found', HTTP_STATUS.NOT_FOUND);
  }

  // Calculate estimated time
  let estimatedTime = 'Processing...';
  if (order.status === ORDER_STATUS.PREPARING) {
    estimatedTime = '10-15 minutes';
  } else if (order.status === ORDER_STATUS.READY) {
    estimatedTime = 'Ready for pickup/delivery';
  } else if (order.status === ORDER_STATUS.SERVED) {
    estimatedTime = 'Completed';
  }

  return successResponse(
    res,
    HTTP_STATUS.OK,
    'Order details fetched successfully',
    {
      order: {
        orderNumber: order.orderNumber,
        orderType: order.orderType,
        status: order.status,
        customer: order.customer,
        items: order.items,
        pricing: order.pricing,
        specialInstructions: order.specialInstructions,
        timestamps: order.timestamps,
        estimatedTime,
      },
    }
  );
});