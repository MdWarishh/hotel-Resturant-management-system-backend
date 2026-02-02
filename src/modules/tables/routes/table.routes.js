import express from 'express';
import {
  createTable,
  getTables,
  updateTable,
  updateTableStatus,
} from '../controllers/table.controller.js';

import {
  validateCreateTable,
  validateUpdateTable,
} from '../validators/table.validator.js';

import { protect, authorize } from '../../../middlewares/auth.middleware.js';
import { USER_ROLES } from '../../../config/constants.js';

const router = express.Router();

router.use(protect);

/**
 * Create table
 * Super Admin / Hotel Admin
 */
router.post(
  '/',
  authorize(USER_ROLES.SUPER_ADMIN, USER_ROLES.HOTEL_ADMIN),
  validateCreateTable,
  createTable
);

/**
 * Get tables
 */
router.get('/', getTables);

/**
 * Update table
 */
router.put(
  '/:id',
  authorize(USER_ROLES.SUPER_ADMIN, USER_ROLES.HOTEL_ADMIN),
  validateUpdateTable,
  updateTable
);

/**
 * Update table status
 */
router.patch(
  '/:id/status',
  authorize(USER_ROLES.SUPER_ADMIN, USER_ROLES.HOTEL_ADMIN),
  updateTableStatus
);

export default router;
