import express from 'express';
import { getDashboardStats } from '../controllers/dashboard.controller.js';
import {
  getRevenueReport,
  getOccupancyReport,
  getSalesReport,
  getInventoryReport,
  generateGSTReport,
} from '../controllers/reports.controller.js';
import { protect, authorize } from '../../../middlewares/auth.middleware.js';
import { USER_ROLES } from '../../../config/constants.js';

const router = express.Router();

/**
 * All routes require authentication
 */
router.use(protect);

/**
 * Dashboard Routes
 */

// Get dashboard statistics
router.get('/dashboard', getDashboardStats);

/**
 * Reports Routes
 */

// Get revenue report
router.get(
  '/revenue',
  authorize(
    USER_ROLES.SUPER_ADMIN,
    USER_ROLES.HOTEL_ADMIN,
    USER_ROLES.MANAGER,
    USER_ROLES.CASHIER
  ),
  getRevenueReport
);

// Get occupancy report
router.get(
  '/occupancy',
  authorize(
    USER_ROLES.SUPER_ADMIN,
    USER_ROLES.HOTEL_ADMIN,
    USER_ROLES.MANAGER
  ),
  getOccupancyReport
);

router.get('/gst', protect, generateGSTReport);


// Get sales report (POS)
router.get(
  '/sales',
  authorize(
    USER_ROLES.SUPER_ADMIN,
    USER_ROLES.HOTEL_ADMIN,
    USER_ROLES.MANAGER,
    USER_ROLES.CASHIER
  ),
  getSalesReport
);

// Get inventory report
router.get(
  '/inventory',
  authorize(
    USER_ROLES.SUPER_ADMIN,
    USER_ROLES.HOTEL_ADMIN,
    USER_ROLES.MANAGER
  ),
  getInventoryReport
);

export default router;