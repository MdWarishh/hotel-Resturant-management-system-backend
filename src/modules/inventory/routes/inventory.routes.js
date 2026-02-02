import express from 'express';
import {
  createInventoryItem,
  getAllInventoryItems,
  getInventoryItemById,
  updateInventoryItem,
  adjustStock,
  getLowStockItems,
  getStockTransactions,
} from '../controllers/inventory.controller.js';
import { protect, authorize } from '../../../middlewares/auth.middleware.js';
import {
  validateCreateInventoryItem,
  validateUpdateInventoryItem,
  validateStockAdjustment,
  validateInventoryId,
} from '../validators/inventory.validator.js';
import { USER_ROLES } from '../../../config/constants.js';

const router = express.Router();

/**
 * All routes require authentication
 */
router.use(protect);

/**
 * Inventory Management Routes
 */

// Get low stock alerts
router.get(
  '/alerts/low-stock',
  authorize(USER_ROLES.SUPER_ADMIN, USER_ROLES.HOTEL_ADMIN, USER_ROLES.MANAGER),
  getLowStockItems
);

// Get all inventory items
router.get('/', getAllInventoryItems);

// Create inventory item
router.post(
  '/',
  authorize(USER_ROLES.SUPER_ADMIN, USER_ROLES.HOTEL_ADMIN, USER_ROLES.MANAGER),
  validateCreateInventoryItem,
  createInventoryItem
);

// Get single inventory item
router.get(
  '/:id',
  validateInventoryId,
  getInventoryItemById
);

// Update inventory item
router.put(
  '/:id',
  validateInventoryId,
  authorize(USER_ROLES.SUPER_ADMIN, USER_ROLES.HOTEL_ADMIN, USER_ROLES.MANAGER),
  validateUpdateInventoryItem,
  updateInventoryItem
);

// Adjust stock (add or deduct)
router.post(
  '/:id/adjust',
  validateInventoryId,
  authorize(USER_ROLES.SUPER_ADMIN, USER_ROLES.HOTEL_ADMIN, USER_ROLES.MANAGER),
  validateStockAdjustment,
  adjustStock
);

// Get stock transactions for an item
router.get(
  '/:id/transactions',
  validateInventoryId,
  getStockTransactions
);

export default router;