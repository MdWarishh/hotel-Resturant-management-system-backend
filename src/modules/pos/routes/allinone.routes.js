// backend/src/modules/pos/routes/allinone.routes.js

import express from 'express';

// AllInOne Controllers
import {
  getAllPublicHotels,
  getPublicHotelByCode,
  getPublicMenu,
  getPublicCategories,
  getPublicCategoryItems,
  getAvailableTables,
  getAvailableRooms,
  getPublicMenuItem,
} from '../controllers/publicMenu.controller.js';

import {
  placePublicOrder,
  trackPublicOrder,
} from '../controllers/publicOrder.controller.js';

import {
  submitFeedback,
  getItemFeedback,
} from '../controllers/qrAndFeedback.controller.js';

const router = express.Router();

/**
 * ============================================
 * 🌐 ALLINONE ROUTES (NO AUTHENTICATION)
 * ============================================
 * These routes are accessible without login
 * Used for public menu viewing and ordering
 */
router.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'AllInOne API is working 🚀'
  });
});


// ============================================
// HOTEL ROUTES
// ============================================

/**
 * Get all active hotels/restaurants
 * GET /api/allinone/hotels
 * Query params: ?city=Delhi&search=restaurant
 */
router.get('/hotels', getAllPublicHotels);

/**
 * Get hotel details by code
 * GET /api/allinone/hotels/:hotelCode
 * Example: /api/allinone/hotels/HOTEL001
 */
router.get('/hotels/:hotelCode', getPublicHotelByCode);

// ============================================
// MENU ROUTES
// ============================================

/**
 * Get full menu (categories + items) by hotel code
 * GET /api/allinone/:hotelCode/menu
 * Example: /api/allinone/HOTEL001/menu
 */
router.get('/:hotelCode/menu', getPublicMenu);

/**
 * Get only categories by hotel code
 * GET /api/allinone/:hotelCode/categories
 * Example: /api/allinone/HOTEL001/categories
 */
router.get('/:hotelCode/categories', getPublicCategories);

/**
 * Get menu items by category
 * GET /api/allinone/:hotelCode/categories/:categoryId/items
 * Example: /api/allinone/HOTEL001/categories/64f8a2b1c3d4e5f6/items
 */
router.get('/:hotelCode/categories/:categoryId/items', getPublicCategoryItems);

/**
 * Get single menu item details
 * GET /api/allinone/:hotelCode/items/:itemId
 * Example: /api/allinone/HOTEL001/items/64f8a2b1c3d4e5f6
 */
router.get('/:hotelCode/items/:itemId', getPublicMenuItem);

// ============================================
// RESOURCES ROUTES (Tables & Rooms)
// ============================================

/**
 * Get available tables for dine-in
 * GET /api/allinone/:hotelCode/tables/available
 * Example: /api/allinone/HOTEL001/tables/available
 */
router.get('/:hotelCode/tables/available', getAvailableTables);

/**
 * Get occupied rooms for room service
 * GET /api/allinone/:hotelCode/rooms/available
 * Example: /api/allinone/HOTEL001/rooms/available
 */
router.get('/:hotelCode/rooms/available', getAvailableRooms);

// ============================================
// ORDER ROUTES
// ============================================

/**
 * Place a public order (no authentication)
 * POST /api/allinone/:hotelCode/order
 * Example: /api/allinone/HOTEL001/order
 * Body: {
 *   orderType: 'dine-in' | 'room-service' | 'takeaway' | 'delivery',
 *   tableNumber: 'T5', // for dine-in
 *   roomNumber: '101', // for room-service
 *   customer: { name, phone, email, address },
 *   items: [{ menuItem, quantity, variant, specialInstructions }],
 *   specialInstructions: 'Extra spicy'
 * }
 */
router.post('/:hotelCode/order', placePublicOrder);

/**
 * Track order status (no authentication)
 * GET /api/allinone/:hotelCode/order/:orderNumber
 * Example: /api/allinone/HOTEL001/order/ORD2402101234
 */
router.get('/:hotelCode/order/:orderNumber', trackPublicOrder);

// ============================================
// ⭐ FEEDBACK ROUTES
// ============================================

/**
 * Submit feedback for a menu item (no authentication)
 * POST /api/allinone/:hotelCode/feedback
 * Example: /api/allinone/HOTEL001/feedback
 * Body: {
 *   menuItemId: '64f8a2b1c3d4e5f6',
 *   orderNumber: 'ORD2402101234', // optional
 *   rating: 5,
 *   comment: 'Delicious!',
 *   customer: { name: 'John', phone: '1234567890' }
 * }
 */
router.post('/:hotelCode/feedback', submitFeedback);

/**
 * Get feedback for a specific item (no authentication)
 * GET /api/allinone/:hotelCode/items/:itemId/feedback
 * Example: /api/allinone/HOTEL001/items/64f8a2b1c3d4e5f6/feedback
 */
router.get('/:hotelCode/items/:itemId/feedback', getItemFeedback);

// ============================================
// EXPORT
// ============================================
export default router;