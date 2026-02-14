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

/**
 * ============================================
 * 📲 QR CODE ROUTES (Admin only)
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

export default router;