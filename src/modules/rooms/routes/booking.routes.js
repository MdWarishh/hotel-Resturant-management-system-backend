import express from 'express';
import {
  createBooking,
  checkInGuest,
  checkOutGuest,
  getAllBookings,
  getBookingById,
  cancelBooking,
  markNoShow,
  updatePayment,
  downloadInvoicePDF,
} from '../controllers/booking.controller.js';
import { protect, authorize } from '../../../middlewares/auth.middleware.js';
import {
  validateCreateBooking,
  validateBookingId,
} from '../validators/booking.validator.js';
import { USER_ROLES } from '../../../config/constants.js';

const router = express.Router();

/**
 * All routes require authentication
 */
router.use(protect);

/**
 * Booking Management Routes
 */

// Get all bookings (with filters)
router.get('/', getAllBookings);

// Create new booking
router.post(
  '/',
  authorize(
    USER_ROLES.SUPER_ADMIN,
    USER_ROLES.HOTEL_ADMIN,
    USER_ROLES.MANAGER,
    USER_ROLES.CASHIER
  ),
  validateCreateBooking,
  createBooking
);

// Get single booking details
router.get(
  '/:id',
  validateBookingId,
  getBookingById
);

// Check-in guest
router.post(
  '/:id/checkin',
  validateBookingId,
  authorize(
    USER_ROLES.SUPER_ADMIN,
    USER_ROLES.HOTEL_ADMIN,
    USER_ROLES.MANAGER,
    USER_ROLES.CASHIER
  ),
  checkInGuest
);

// Check-out guest
router.post(
  '/:id/checkout',
  validateBookingId,
  authorize(
    USER_ROLES.SUPER_ADMIN,
    USER_ROLES.HOTEL_ADMIN,
    USER_ROLES.MANAGER,
    USER_ROLES.CASHIER
  ),
  checkOutGuest
);


router.post('/:id/cancel', protect, cancelBooking);
router.post('/:id/no-show', protect, markNoShow);
router.post('/:id/payment', protect, updatePayment);
router.get('/:id/invoice/pdf', protect, downloadInvoicePDF);



export default router;