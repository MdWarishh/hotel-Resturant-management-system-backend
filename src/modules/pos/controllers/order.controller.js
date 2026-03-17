import Order from '../models/Order.model.js';
import MenuItem from '../models/MenuItem.model.js';
import InventoryItem from '../../inventory/models/InventoryItem.model.js';
import StockTransaction from '../../inventory/models/StockTransaction.model.js';
import Room from '../../rooms/models/Room.model.js';
import Booking from '../../rooms/models/Booking.model.js';
import Hotel from '../../hotels/models/Hotel.model.js';
import { successResponse, paginatedResponse } from '../../../utils/responseHandler.js';
import { HTTP_STATUS, PAGINATION, USER_ROLES, ORDER_STATUS, GST_RATE } from '../../../config/constants.js';
import asyncHandler from '../../../utils/asyncHandler.js';
import AppError from '../../../utils/AppError.js';
import PDFDocument from 'pdfkit';
import Table from '../../tables/models/Table.model.js';

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
    extraCharges,
  } = req.body;

  // Authorization: Only allow for user's hotel
  let assignedHotel = hotel;
  if (req.user.role !== USER_ROLES.SUPER_ADMIN) {
    assignedHotel = req.user.hotel._id;
  }

  // ── Fetch hotel for settings (packaging/delivery) ──
  const hotelDoc = await Hotel.findById(assignedHotel);
  if (!hotelDoc) throw new AppError('Hotel not found', HTTP_STATUS.NOT_FOUND);

  // Validate order type specific requirements
  if (orderType === 'room-service' && !room && !booking) {
    throw new AppError('Room or booking is required for room service', HTTP_STATUS.BAD_REQUEST);
  }

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

  // ── Process order items ──
  const deliveryChargeFromBody = orderType === 'delivery' ? (req.body.deliveryCharge || 0) : 0;
  const processedItems = [];
  let subtotal = 0;

  for (const item of items) {
    const menuItem = await MenuItem.findById(item.menuItem);
    if (!menuItem) throw new AppError(`Menu item not found: ${item.menuItem}`, HTTP_STATUS.NOT_FOUND);
    if (!menuItem.canOrder()) throw new AppError(`Item not available: ${menuItem.name}`, HTTP_STATUS.BAD_REQUEST);

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

    menuItem.totalOrders += item.quantity;
    await menuItem.save();
  }

  // ── Extra charges (manual, from body) ──
  const validExtraCharges = Array.isArray(extraCharges)
    ? extraCharges.filter((c) => c.label && Number(c.amount) > 0)
    : [];
  const extraChargesTotal = validExtraCharges.reduce((sum, c) => sum + Number(c.amount), 0);

  // ── Auto: Delivery charge from hotel settings ──
  const autoDeliveryCharge =
    orderType === 'delivery' ? hotelDoc.calcDeliveryCharge(subtotal) : 0;

  // Use hotel settings delivery charge (ignore manual deliveryCharge from body for consistency)
  const finalDeliveryCharge = autoDeliveryCharge;

  // ── Auto: Packaging charge from hotel settings ──
  const packagingCharge = hotelDoc.calcPackagingCharge(orderType, subtotal);

  // Add packaging as an extraCharge line if applicable
  if (packagingCharge > 0) {
    validExtraCharges.push({ label: 'Packaging', amount: packagingCharge });
  }

  const finalExtraChargesTotal = validExtraCharges.reduce((sum, c) => sum + Number(c.amount), 0);

  // ── Pricing ──
  const tax = Math.ceil(((subtotal + finalExtraChargesTotal) * GST_RATE) / 100);
  const total = Math.ceil(subtotal + finalExtraChargesTotal + tax + finalDeliveryCharge);

  let paymentData = { status: 'UNPAID' };
  if (payment && payment.mode) {
    paymentData = {
      mode: payment.mode,
      status: 'PAID',
      paidAt: new Date(),
      paidBy: req.user._id,
    };
  }

  // ── Create order ──
  const order = await Order.create({
    hotel: assignedHotel,
    orderType,
    tableNumber,
    room,
    booking,
    customer,
    items: processedItems,
    extraCharges: validExtraCharges,
    pricing: {
      subtotal,
      discount: 0,
      tax,
      deliveryCharge: finalDeliveryCharge,
      extraChargesTotal: finalExtraChargesTotal,
      total,
    },
    status: ORDER_STATUS.PENDING,
    payment: paymentData,
    specialInstructions,
    createdBy: req.user._id,
  });

  // ── Update table status if dine-in ──
  if (orderType === 'dine-in' && tableNumber) {
    const updatedTable = await Table.findOneAndUpdate(
      { hotel: assignedHotel, tableNumber },
      { status: 'occupied' },
      { new: true }
    ).populate('hotel', 'name gst');

    if (updatedTable) {
      const io = req.app.get('io');
      io.of('/pos').emit('table:updated', updatedTable);
    }
  }

  const populatedOrder = await Order.findById(order._id)
    .populate('hotel', 'name code address contact gst')
    .populate('room', 'roomNumber')
    .populate('booking', 'bookingNumber')
    .populate('items.menuItem', 'name type preparationTime')
    .populate('createdBy', 'name email');

  const io = req.app.get('io');
  io.of('/pos').emit('order:created', populatedOrder);
  io.of('/pos').emit('order:updated', populatedOrder);
  io.of('/pos').emit('order:paid', populatedOrder);

  return successResponse(res, HTTP_STATUS.CREATED, 'Order created successfully', { order: populatedOrder });
});

/**
 * Get All Orders
 * GET /api/pos/orders
 */
export const getAllOrders = asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = PAGINATION.DEFAULT_LIMIT,
    hotel,
    status,
    orderType,
    search,
    startDate,
    endDate,
  } = req.query;

  const query = {};

  if (req.user.role !== USER_ROLES.SUPER_ADMIN) {
    query.hotel = req.user.hotel._id;
  } else if (hotel) {
    query.hotel = hotel;
  }

  if (status) {
    const statusArray = status.split(',');
    query.status = { $in: statusArray };
  }

  if (startDate || endDate) {
    query.createdAt = {};
    if (startDate) {
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      query.createdAt.$gte = start;
    }
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      query.createdAt.$lte = end;
    }
  }

  if (orderType) query.orderType = orderType;

  if (search) {
    query.$or = [
      { orderNumber: new RegExp(search, 'i') },
      { 'customer.name': new RegExp(search, 'i') },
      { 'customer.phone': new RegExp(search, 'i') },
      { tableNumber: new RegExp(search, 'i') },
    ];
  }

  const pageNum = parseInt(page);
  const limitNum = Math.min(parseInt(limit), PAGINATION.MAX_LIMIT);
  const skip = (pageNum - 1) * limitNum;

  const orders = await Order.find(query)
    .populate('hotel', 'name code address contact gst')
    .populate('room', 'roomNumber')
    .populate('booking', 'bookingNumber guest.name')
    .populate('items.menuItem', 'name')
    .populate('createdBy', 'name email')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limitNum);

  const total = await Order.countDocuments(query);

  return paginatedResponse(res, orders, pageNum, limitNum, total, 'Orders fetched successfully');
});

/**
 * Get Single Order
 * GET /api/pos/orders/:id
 */
export const getOrderById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const order = await Order.findById(id)
    .populate('hotel', 'name code address contact gst')
    .populate('room', 'roomNumber roomType')
    .populate('booking', 'bookingNumber guest')
    .populate('items.menuItem', 'name description type preparationTime')
    .populate('createdBy', 'name email')
    .populate('preparedBy', 'name email')
    .populate('servedBy', 'name email');

  if (!order) throw new AppError('Order not found', HTTP_STATUS.NOT_FOUND);

  if (req.user.role !== USER_ROLES.SUPER_ADMIN) {
    if (!req.user.hotel || order.hotel._id.toString() !== req.user.hotel._id.toString()) {
      throw new AppError('Access denied to this order', HTTP_STATUS.FORBIDDEN);
    }
  }

  return successResponse(res, HTTP_STATUS.OK, 'Order details fetched successfully', { order });
});

/**
 * Update Order Status
 * PATCH /api/pos/orders/:id/status
 */
export const updateOrderStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  const order = await Order.findById(id);
  if (!order) throw new AppError('Order not found', HTTP_STATUS.NOT_FOUND);

  if (req.user.role !== USER_ROLES.SUPER_ADMIN) {
    if (!req.user.hotel || order.hotel.toString() !== req.user.hotel._id.toString()) {
      throw new AppError('Access denied to update this order', HTTP_STATUS.FORBIDDEN);
    }
  }

  order.status = status;

  switch (status) {
    case ORDER_STATUS.PREPARING:
      order.timestamps.preparing = new Date();
      order.preparedBy = req.user._id;
      break;
    case ORDER_STATUS.READY:
      order.status = ORDER_STATUS.SERVED;
      order.timestamps.ready = new Date();
      order.timestamps.served = new Date();
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
    .populate('hotel', 'name code address contact gst')
    .populate('preparedBy', 'name')
    .populate('servedBy', 'name');

  const io = req.app.get('io');
  io.of('/pos').emit('order:updated', updatedOrder);

  return successResponse(res, HTTP_STATUS.OK, 'Order status updated successfully', { order: updatedOrder });
});

/**
 * Get Kitchen Orders
 * GET /api/pos/orders/kitchen
 */
export const getKitchenOrders = asyncHandler(async (req, res) => {
  const { status, all } = req.query;
  let query = { hotel: req.user.hotel._id };

  if (all === 'true') {
    query.status = { $nin: ['cancelled', 'settled', 'completed'] };
  } else if (status) {
    query.status = { $in: status.split(',') };
  } else {
    query.status = { $in: ['pending', 'preparing', 'ready', 'served', 'paid'] };
  }

  const orders = await Order.find(query)
    .populate('items.menuItem', 'name price variant')
    .populate('hotel', 'name code gst')
    .populate('room booking customer', 'name number')
    .sort({ createdAt: -1 })
    .limit(200);

  successResponse(res, HTTP_STATUS.OK, 'Kitchen orders fetched', { orders });
});

/**
 * Checkout / Complete Order
 * POST /api/pos/orders/:id/checkout
 */
export const checkoutOrder = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const order = await Order.findById(id);
  if (!order) throw new AppError('Order not found', HTTP_STATUS.NOT_FOUND);

  if (
    req.user.role !== USER_ROLES.SUPER_ADMIN &&
    order.hotel.toString() !== req.user.hotel._id.toString()
  ) {
    throw new AppError('Access denied', HTTP_STATUS.FORBIDDEN);
  }

  if (!order.payment || order.payment.status !== 'PAID') {
    throw new AppError('Order payment is pending. Cannot checkout.', HTTP_STATUS.BAD_REQUEST);
  }

  await deductInventoryForOrder(order, req.user);

  order.status = ORDER_STATUS.COMPLETED;
  order.timestamps.completed = new Date();
  await order.save();

  const io = req.app.get('io');
  io.of('/pos').emit('order:completed', order);

  return successResponse(res, HTTP_STATUS.OK, 'Order checked out successfully', { order });
});

// ── Inventory deduction helper ──
const deductInventoryForOrder = async (order, user) => {
  for (const orderItem of order.items) {
    const menuItem = await MenuItem.findById(orderItem.menuItem).populate('ingredients.inventoryItem');
    if (!menuItem || !menuItem.ingredients) continue;

    for (const ingredient of menuItem.ingredients) {
      const inventoryItem = ingredient.inventoryItem;
      if (!inventoryItem) continue;

      const requiredQty = ingredient.quantity * orderItem.quantity;

      if (inventoryItem.quantity.current < requiredQty) {
        throw new AppError(`Insufficient stock for ${inventoryItem.name}`, HTTP_STATUS.BAD_REQUEST);
      }

      const previousStock = inventoryItem.quantity.current;
      inventoryItem.quantity.current -= requiredQty;
      await inventoryItem.save();

      await StockTransaction.create({
        hotel: order.hotel,
        inventoryItem: inventoryItem._id,
        transactionType: 'sale',
        quantity: requiredQty,
        unit: inventoryItem.unit,
        previousStock,
        newStock: inventoryItem.quantity.current,
        reference: { type: 'pos_order', id: order._id },
        reason: `POS Order ${order.orderNumber}`,
        performedBy: user._id,
      });
    }
  }
};

/**
 * Get Running Orders
 * GET /api/pos/orders/running
 */
export const getRunningOrders = asyncHandler(async (req, res) => {
  let assignedHotel;
  if (req.user.role !== USER_ROLES.SUPER_ADMIN) {
    assignedHotel = req.user.hotel._id;
  }

  const orders = await Order.find({
    hotel: assignedHotel,
    status: {
      $in: [ORDER_STATUS.PENDING, ORDER_STATUS.PREPARING, ORDER_STATUS.READY, ORDER_STATUS.SERVED],
    },
  })
    .populate('room', 'roomNumber')
    .populate('items.menuItem', 'name')
    .populate('createdBy', 'name')
    .sort({ createdAt: -1 });

  return successResponse(res, HTTP_STATUS.OK, 'Running orders fetched successfully', {
    orders,
    count: orders.length,
  });
});

export const getOrderInvoicePDF = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const order = await Order.findById(id)
    .populate('hotel', 'name address contact gst')
    .populate('items.menuItem', 'name price');

  if (!order) throw new AppError('Order not found', HTTP_STATUS.NOT_FOUND);

  const doc = new PDFDocument({ size: 'A4', margin: 40, layout: 'portrait' });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename=invoice-${order.orderNumber}.pdf`);
  doc.pipe(res);

  const primaryColor = '#00ADB5';
  const accentColor = '#222831';
  const lightGray = '#EEEEEE';
  const darkGray = '#393E46';

  doc.fillColor(primaryColor).fontSize(28).font('Helvetica-Bold').text(order.hotel.name, { align: 'center' });
  doc.fillColor(darkGray).fontSize(10).text(order.hotel.address?.street || '', { align: 'center' });
  doc.text(`${order.hotel.address?.city || ''}, ${order.hotel.address?.state || ''} ${order.hotel.address?.pincode || ''}`, { align: 'center' });
  doc.moveDown(0.5);
  doc.fillColor(darkGray).fontSize(9).text(`Phone: ${order.hotel.contact?.phone || 'N/A'} | Email: ${order.hotel.contact?.email || 'N/A'}`, { align: 'center' });
  doc.moveDown(1);

  doc.fillColor(accentColor).fontSize(18).text('INVOICE', { align: 'center' });
  doc.moveDown(0.5);
  doc.fontSize(11).fillColor(darkGray);
  doc.text(`Invoice No: ${order.orderNumber}`, 50, doc.y);
  doc.text(`Date: ${new Date(order.createdAt).toLocaleDateString('en-IN')}`, 50, doc.y);
  doc.text(`Order Type: ${order.orderType.toUpperCase()}`, 50, doc.y);
  if (order.tableNumber) doc.text(`Table: ${order.tableNumber}`, 50, doc.y);
  if (order.room?.roomNumber) doc.text(`Room: ${order.room.roomNumber}`, 50, doc.y);
  doc.moveDown(1);

  doc.fillColor(primaryColor).fontSize(12).text('Bill To:', 50, doc.y);
  doc.fillColor(darkGray).fontSize(11);
  doc.text(`Name: ${order.customer?.name || 'Guest'}`, 50, doc.y);
  if (order.customer?.phone) doc.text(`Phone: ${order.customer.phone}`, 50, doc.y);
  if (order.customer?.email) doc.text(`Email: ${order.customer.email}`, 50, doc.y);
  doc.moveDown(1.5);

  const tableTop = doc.y;
  const tableHeaders = ['Item', 'Qty', 'Price', 'Amount'];
  const colWidths = [240, 60, 80, 100];
  let x = 50;

  doc.fillColor(lightGray).rect(40, tableTop - 10, 510, 30).fill();
  doc.fillColor(accentColor).font('Helvetica-Bold').fontSize(11);
  tableHeaders.forEach((header, i) => {
    doc.text(header, x, tableTop, { width: colWidths[i], align: i === 3 ? 'right' : 'left' });
    x += colWidths[i];
  });

  doc.font('Helvetica').fontSize(10).fillColor(darkGray);
  let currentY = tableTop + 30;

  order.items.forEach((item) => {
    const itemName = item.menuItem?.name || 'Unknown Item';
    x = 50;
    doc.text(itemName, x, currentY, { width: colWidths[0], align: 'left', lineBreak: true });
    x += colWidths[0];
    doc.text(item.quantity.toString(), x, currentY, { width: colWidths[1], align: 'center' });
    x += colWidths[1];
    doc.text(`₹${item.price.toFixed(2)}`, x, currentY, { width: colWidths[2], align: 'right' });
    x += colWidths[2];
    doc.text(`₹${(item.quantity * item.price).toFixed(2)}`, x, currentY, { width: colWidths[3], align: 'right' });
    currentY += 25;
  });

  doc.moveDown(1);
  doc.fillColor(primaryColor).font('Helvetica-Bold').fontSize(12).text('Summary', 400, doc.y);
  doc.moveDown(0.5);

  const totalsX = 350;
  doc.font('Helvetica').fontSize(11).fillColor(darkGray);
  doc.text('Subtotal:', totalsX, doc.y);
  doc.text(`₹${order.pricing.subtotal.toFixed(2)}`, 450, doc.y, { align: 'right' });
  doc.moveDown(0.5);

  if (order.pricing.discount > 0) {
    doc.text('Discount:', totalsX, doc.y);
    doc.text(`-₹${order.pricing.discount.toFixed(2)}`, 450, doc.y, { align: 'right' });
    doc.moveDown(0.5);
  }

  // ✅ Show packaging charge in PDF if present
  if (order.pricing.extraChargesTotal > 0) {
    order.extraCharges?.forEach((ec) => {
      doc.text(`${ec.label}:`, totalsX, doc.y);
      doc.text(`₹${ec.amount.toFixed(2)}`, 450, doc.y, { align: 'right' });
      doc.moveDown(0.5);
    });
  }

  if (order.pricing.deliveryCharge > 0) {
    doc.text('Delivery Charge:', totalsX, doc.y);
    doc.text(`₹${order.pricing.deliveryCharge.toFixed(2)}`, 450, doc.y, { align: 'right' });
    doc.moveDown(0.5);
  }

  doc.text('GST (5%):', totalsX, doc.y);
  doc.text(`₹${order.pricing.tax.toFixed(2)}`, 450, doc.y, { align: 'right' });
  doc.moveDown(0.5);

  doc.font('Helvetica-Bold').fontSize(12).fillColor(primaryColor);
  doc.text('Grand Total:', totalsX, doc.y);
  doc.text(`₹${order.pricing.total.toFixed(2)}`, 450, doc.y, { align: 'right' });

  doc.moveDown(2);
  doc.fontSize(10).fillColor(darkGray).text('Thank you for dining with us!', 50, doc.y, { align: 'center' });
  doc.text(`Payment Mode: ${order.payment?.mode || 'N/A'} • Status: ${order.payment?.status || 'Pending'}`, 50, doc.y + 15, { align: 'center' });

  doc.end();
});