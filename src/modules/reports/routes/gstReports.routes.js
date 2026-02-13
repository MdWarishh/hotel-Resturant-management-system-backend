// backend/src/modules/reports/routes/gstReports.routes.js

import express from 'express';
import {
  getBookingsGSTReport,
  getPOSGSTReport,
  exportBookingsGSTExcel,
  exportPOSGSTExcel,
} from '../controllers/gstReports.controller.js';
import { protect, authorize } from '../../../middlewares/auth.middleware.js';
import { USER_ROLES } from '../../../config/constants.js';

const router = express.Router();

/**
 * All routes require authentication
 */
router.use(protect);

/**
 * ============================================
 * BOOKINGS GST REPORTS
 * ============================================
 */

/**
 * Get Bookings GST Report (JSON)
 * GET /api/reports/gst/bookings
 * Query params: ?startDate=2024-01-01&endDate=2024-01-31&hotel=hotelId
 */
router.get(
  '/bookings',
  authorize(USER_ROLES.SUPER_ADMIN, USER_ROLES.HOTEL_ADMIN, USER_ROLES.MANAGER),
  getBookingsGSTReport
);

/**
 * Export Bookings GST Report to Excel
 * GET /api/reports/gst/bookings/excel
 * Query params: ?startDate=2024-01-01&endDate=2024-01-31&hotel=hotelId
 */
router.get(
  '/bookings/excel',
  authorize(USER_ROLES.SUPER_ADMIN, USER_ROLES.HOTEL_ADMIN, USER_ROLES.MANAGER),
  exportBookingsGSTExcel
);

/**
 * ============================================
 * POS GST REPORTS
 * ============================================
 */

/**
 * Get POS GST Report (JSON)
 * GET /api/reports/gst/pos
 * Query params: ?startDate=2024-01-01&endDate=2024-01-31&hotel=hotelId
 */
router.get(
  '/pos',
  authorize(USER_ROLES.SUPER_ADMIN, USER_ROLES.HOTEL_ADMIN, USER_ROLES.MANAGER),
  getPOSGSTReport
);

/**
 * Export POS GST Report to Excel
 * GET /api/reports/gst/pos/excel
 * Query params: ?startDate=2024-01-01&endDate=2024-01-31&hotel=hotelId
 */
router.get(
  '/pos/excel',
  authorize(USER_ROLES.SUPER_ADMIN, USER_ROLES.HOTEL_ADMIN, USER_ROLES.MANAGER),
  exportPOSGSTExcel
);

export default router;