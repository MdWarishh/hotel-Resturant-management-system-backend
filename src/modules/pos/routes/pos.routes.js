import express from 'express';

import Hotel from '../../hotels/models/Hotel.model.js';
import MenuCategory from '../models/MenuCategory.model.js';
import MenuItem from '../models/MenuItem.model.js';
import Order from '../models/Order.model.js';
// Controllers
import {
  createCategory,
  getAllCategories,
  getCategoryById,
  updateCategory,
  deleteCategory,
} from '../controllers/menuCategory.controller.js';

import {
  createMenuItem,
  getAllMenuItems,
  getMenuItemById,
  updateMenuItem,
  toggleAvailability,
  deleteMenuItem,
  getFullMenu,
} from '../controllers/menuItem.controller.js';

import {
  createOrder,
  getAllOrders,
  getOrderById,
  updateOrderStatus,
  getKitchenOrders,
  checkoutOrder,
  getRunningOrders,
  getOrderInvoicePDF,
} from '../controllers/order.controller.js';

// Middleware
import { protect, authorize } from '../../../middlewares/auth.middleware.js';

// Validators
import {
  validateCreateCategory,
  validateCreateMenuItem,
  validateUpdateMenuItem,
  validateCreateOrder,
  validateOrderStatus,
  validateAvailability,
  validateObjectId,
} from '../validators/pos.validator.js';

import { USER_ROLES } from '../../../config/constants.js';
import { getTodaySummary } from '../controllers/analytics.controller.js';
import { markOrderPaid } from '../controllers/orderPayment.controller.js';
import { getAllPublicHotels, getPublicMenu } from '../controllers/publicMenu.controller.js';
import { generateHotelQR, getFeedbackSummary } from '../controllers/qrAndFeedback.controller.js';

const router = express.Router();

/**
 * All routes require authentication
 */
router.use(protect);

/**
 * ============================================
 * MENU CATEGORY ROUTES
 * ============================================
 */

// Get all categories
router.get('/categories', getAllCategories);

// Create category
router.post(
  '/categories',
  authorize(USER_ROLES.SUPER_ADMIN, USER_ROLES.HOTEL_ADMIN, USER_ROLES.MANAGER),
  validateCreateCategory,
  createCategory
);

// Get single category
router.get('/categories/:id', validateObjectId, getCategoryById);

// Update category
router.put(
  '/categories/:id',
  validateObjectId,
  authorize(USER_ROLES.SUPER_ADMIN, USER_ROLES.HOTEL_ADMIN, USER_ROLES.MANAGER),
  updateCategory
);

// Delete category
router.delete(
  '/categories/:id',
  validateObjectId,
  authorize(USER_ROLES.SUPER_ADMIN, USER_ROLES.HOTEL_ADMIN),
  deleteCategory
);

/**
 * ============================================
 * MENU ITEM ROUTES
 * ============================================
 */

// Get full menu (grouped by category)
router.get('/menu', getFullMenu);

// Get all menu items
router.get('/items', getAllMenuItems);

// Create menu item
router.post(
  '/items',
  authorize(USER_ROLES.SUPER_ADMIN, USER_ROLES.HOTEL_ADMIN, USER_ROLES.MANAGER),
  validateCreateMenuItem,
  createMenuItem
);

// Get single menu item
router.get('/items/:id', validateObjectId, getMenuItemById);

// Update menu item
router.put(
  '/items/:id',
  validateObjectId,
  authorize(USER_ROLES.SUPER_ADMIN, USER_ROLES.HOTEL_ADMIN, USER_ROLES.MANAGER),
  validateUpdateMenuItem,
  updateMenuItem
);

// Toggle item availability
router.patch(
  '/items/:id/availability',
  validateObjectId,
  authorize(
    USER_ROLES.SUPER_ADMIN,
    USER_ROLES.HOTEL_ADMIN,
    USER_ROLES.MANAGER,
    USER_ROLES.CASHIER
  ),
  validateAvailability,
  toggleAvailability
);

// Delete menu item
router.delete(
  '/items/:id',
  validateObjectId,
  authorize(USER_ROLES.SUPER_ADMIN, USER_ROLES.HOTEL_ADMIN),
  deleteMenuItem
);

/**
 * ============================================
 * ORDER ROUTES
 * ============================================
 */

// Get kitchen orders (for kitchen staff)
router.get(
  '/orders/kitchen',
  authorize(
    USER_ROLES.SUPER_ADMIN,
    USER_ROLES.HOTEL_ADMIN,
    USER_ROLES.MANAGER,
    USER_ROLES.KITCHEN_STAFF
  ),
  getKitchenOrders
);

// Running orders (Cashier)
router.get(
  '/orders/running',
  authorize(
    USER_ROLES.SUPER_ADMIN,
    USER_ROLES.HOTEL_ADMIN,
    USER_ROLES.MANAGER,
    USER_ROLES.CASHIER
  ),
  getRunningOrders
);

// Get all orders
router.get('/orders', getAllOrders);

// Create order
router.post(
  '/orders',
  authorize(
    USER_ROLES.SUPER_ADMIN,
    USER_ROLES.HOTEL_ADMIN,
    USER_ROLES.MANAGER,
    USER_ROLES.CASHIER
  ),
  validateCreateOrder,
  createOrder
);

// Get single order
router.get('/orders/:id', validateObjectId, getOrderById);

// Update order status
router.patch(
  '/orders/:id/status',
  validateObjectId,
  authorize(
    USER_ROLES.SUPER_ADMIN,
    USER_ROLES.HOTEL_ADMIN,
    USER_ROLES.MANAGER,
    USER_ROLES.CASHIER,
    USER_ROLES.KITCHEN_STAFF
  ),
  validateOrderStatus,
  updateOrderStatus
);

router.post(
  '/orders/:id/checkout',
  protect,
  authorize(
    USER_ROLES.SUPER_ADMIN,
    USER_ROLES.HOTEL_ADMIN,
    USER_ROLES.MANAGER,
    USER_ROLES.CASHIER
  ),
  checkoutOrder
);



router.get(
  '/reports/summary',
  protect,
  authorize(USER_ROLES.HOTEL_ADMIN, USER_ROLES.MANAGER),
  getTodaySummary
);

// Mark order as paid
router.patch(
  '/orders/:id/payment',
  authorize(
    USER_ROLES.SUPER_ADMIN,
    USER_ROLES.HOTEL_ADMIN,
    USER_ROLES.MANAGER,
    USER_ROLES.CASHIER
  ),
  validateObjectId,
  markOrderPaid
);

router.get(
  '/orders/:id/invoice/pdf',
  validateObjectId,
  authorize(USER_ROLES.SUPER_ADMIN, USER_ROLES.HOTEL_ADMIN, USER_ROLES.MANAGER, USER_ROLES.CASHIER),
  getOrderInvoicePDF
);


// Public: Get categories for a hotel
router.get('/:hotelCode/categories', async (req, res) => {
  try {
    const hotel = await Hotel.findOne({ code: req.params.hotelCode });
    if (!hotel) return res.status(404).json({ message: 'Hotel not found' });
    const categories = await MenuCategory.find({ hotel: hotel._id }).sort('order');
    res.json(categories);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Public: Get items for a category
router.get('/:hotelCode/items/:categoryId', async (req, res) => {
  try {
    const hotel = await Hotel.findOne({ code: req.params.hotelCode });
    if (!hotel) return res.status(404).json({ message: 'Hotel not found' });
    const items = await MenuItem.find({ hotel: hotel._id, category: req.params.categoryId, isAvailable: true });
    res.json(items);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Admin-only: Add category/item (use your auth middleware)
router.post('/categories', protect, async (req, res) => { /* Add logic */ });
// Similarly for items



// Public: Place order
router.post('/:hotelCode', async (req, res) => {
  try {
    const hotel = await Hotel.findOne({ code: req.params.hotelCode });
    if (!hotel) return res.status(404).json({ message: 'Hotel not found' });

    const { items, customerDetails } = req.body;
    // Validate items (fetch prices, calculate total)
    let totalAmount = 0;
    const orderItems = [];
    for (let cartItem of items) {
      const menuItem = await MenuItem.findById(cartItem.itemId);
      if (!menuItem || !menuItem.isAvailable) throw new Error('Item not available');
      const itemPrice = menuItem.price * cartItem.quantity;
      totalAmount += itemPrice;
      orderItems.push({ item: menuItem._id, quantity: cartItem.quantity, price: menuItem.price });
    }

    const order = new Order({
      hotel: hotel._id,
      items: orderItems,
      totalAmount,
      customerDetails,
    });
    await order.save();

    // Optional: Emit real-time event to admin (if using Socket.io)
    // io.to('adminRoom').emit('newOrder', order);

    res.status(201).json({ message: 'Order placed successfully', orderId: order._id });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});



// Add these routes AFTER your existing routes (before export default router)

/**
 * ============================================
 * 🔲 QR CODE ROUTES (Admin only)
 * ============================================
 */

/**
 * Generate QR code for hotel
 * GET /api/pos/qr-code
 * Access: Hotel Admin, Manager
 */
router.get(
  '/qr-code',
  authorize(USER_ROLES.SUPER_ADMIN, USER_ROLES.HOTEL_ADMIN, USER_ROLES.MANAGER),
  generateHotelQR
);

// Admin-only: Get orders
router.get('/:hotelId', protect, async (req, res) => {
  const orders = await Order.find({ hotel: req.params.hotelId }).sort('-createdAt');
  res.json(orders);
});

// Admin: Update order status
router.patch('/:orderId', protect, async (req, res) => { /* Logic to update status */ });


// Purane routes (with authentication)
router.get('/categories', getAllCategories); // Already working

// Naye public routes (NO authentication)
router.get('/public/hotels', getAllPublicHotels); // NEW
router.get('/public/:hotelCode/menu', getPublicMenu); // NEW
// ... aur bhi



// backend/src/modules/pos/routes/pos.routes.js
// Add these routes to your existing pos.routes.js file




/**
 * ============================================
 * ⭐ FEEDBACK ROUTES (Admin)
 * ============================================
 */

/**
 * Get feedback summary for hotel
 * GET /api/pos/feedback/summary
 * Access: Hotel Admin, Manager
 */
router.get(
  '/feedback/summary',
  authorize(USER_ROLES.SUPER_ADMIN, USER_ROLES.HOTEL_ADMIN, USER_ROLES.MANAGER),
  getFeedbackSummary
);

// NOTE: Copy these routes and add them to your existing pos.routes.js file
// Don't replace the entire file - just add these new routes

export default router;