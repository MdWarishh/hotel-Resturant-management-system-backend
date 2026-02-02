import express from 'express';
import {
  createHotel,
  getAllHotels,
  getHotelById,
  updateHotel,
  deleteHotel,
  getHotelStats,
} from '../controllers/hotel.controller.js';
import { protect, authorize } from '../../../middlewares/auth.middleware.js';
import {
  validateCreateHotel,
  validateUpdateHotel,
  validateHotelId,
} from '../validators/hotel.validator.js';
import { USER_ROLES } from '../../../config/constants.js';

const router = express.Router();

/**
 * All routes require authentication
 */
router.use(protect);

/**
 * Hotel CRUD Routes
 */

// Get all hotels (Super Admin sees all, others see their own)
router.get('/', getAllHotels);

// Create new hotel (Super Admin only)
router.post(
  '/',
  authorize(USER_ROLES.SUPER_ADMIN),
  validateCreateHotel,
  createHotel
);

// Get single hotel details
router.get(
  '/:id',
  validateHotelId,
  getHotelById
);

// Update hotel (Super Admin or Hotel Admin of that hotel)
router.put(
  '/:id',
  validateHotelId,
  authorize(USER_ROLES.SUPER_ADMIN, USER_ROLES.HOTEL_ADMIN),
  validateUpdateHotel,
  updateHotel
);

// Delete/Deactivate hotel (Super Admin only)
router.delete(
  '/:id',
  validateHotelId,
  authorize(USER_ROLES.SUPER_ADMIN),
  deleteHotel
);

/**
 * Hotel Statistics Route
 */

// Get hotel statistics
router.get(
  '/:id/stats',
  validateHotelId,
  authorize(USER_ROLES.SUPER_ADMIN, USER_ROLES.HOTEL_ADMIN, USER_ROLES.MANAGER),
  getHotelStats
);

export default router;