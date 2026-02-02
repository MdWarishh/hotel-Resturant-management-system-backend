import express from 'express';
import {
  generateInvoice,
  addPayment,
  getAllInvoices,
  getInvoiceById,
  getPendingPayments,
} from '../controllers/billing.controller.js';
import { protect, authorize } from '../../../middlewares/auth.middleware.js';
import {
  validateGenerateInvoice,
  validateAddPayment,
  validateInvoiceId,
} from '../validators/billing.validator.js';
import { USER_ROLES } from '../../../config/constants.js';

const router = express.Router();

/**
 * All routes require authentication
 */
router.use(protect);

/**
 * Billing & Invoice Routes
 */

// Get pending payments
router.get(
  '/pending',
  authorize(
    USER_ROLES.SUPER_ADMIN,
    USER_ROLES.HOTEL_ADMIN,
    USER_ROLES.MANAGER,
    USER_ROLES.CASHIER
  ),
  getPendingPayments
);

// Get all invoices
router.get('/invoices', getAllInvoices);

// Generate invoice for booking
router.post(
  '/generate',
  authorize(
    USER_ROLES.SUPER_ADMIN,
    USER_ROLES.HOTEL_ADMIN,
    USER_ROLES.MANAGER,
    USER_ROLES.CASHIER
  ),
  validateGenerateInvoice,
  generateInvoice
);

// Get single invoice
router.get(
  '/invoices/:id',
  validateInvoiceId,
  getInvoiceById
);

// Add payment to invoice
router.post(
  '/invoices/:id/payment',
  validateInvoiceId,
  authorize(
    USER_ROLES.SUPER_ADMIN,
    USER_ROLES.HOTEL_ADMIN,
    USER_ROLES.MANAGER,
    USER_ROLES.CASHIER
  ),
  validateAddPayment,
  addPayment
);

export default router;