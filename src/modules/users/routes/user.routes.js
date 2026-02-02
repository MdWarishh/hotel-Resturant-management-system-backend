import express from 'express';
import {
  getAllUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
  getUsersByHotel,
} from '../controllers/user.controller.js';
import { protect, authorize } from '../../../middlewares/auth.middleware.js';
import {
  validateCreateUser,
  validateUpdateUser,
  validateUserId,
} from '../validators/user.validator.js';
import { USER_ROLES } from '../../../config/constants.js';

const router = express.Router();

/**
 * All routes require authentication
 */
router.use(protect);

/**
 * User Management Routes
 */

// Get all users (with filters)
// Super Admin: all users, Hotel Admin: their hotel's users
router.get(
  '/',
  authorize(
    USER_ROLES.SUPER_ADMIN,
    USER_ROLES.HOTEL_ADMIN,
    USER_ROLES.MANAGER
  ),
  getAllUsers
);

// Create new user/staff
// Super Admin: any hotel, Hotel Admin: their hotel only
router.post(
  '/',
  authorize(USER_ROLES.SUPER_ADMIN, USER_ROLES.HOTEL_ADMIN),
  validateCreateUser,
  createUser
);

// Get users by hotel
router.get(
  '/hotel/:hotelId',
  validateUserId,
  authorize(
    USER_ROLES.SUPER_ADMIN,
    USER_ROLES.HOTEL_ADMIN,
    USER_ROLES.MANAGER
  ),
  getUsersByHotel
);

// Get single user details
router.get(
  '/:id',
  validateUserId,
  authorize(
    USER_ROLES.SUPER_ADMIN,
    USER_ROLES.HOTEL_ADMIN,
    USER_ROLES.MANAGER
  ),
  getUserById
);

// Update user
router.put(
  '/:id',
  validateUserId,
  authorize(USER_ROLES.SUPER_ADMIN, USER_ROLES.HOTEL_ADMIN),
  validateUpdateUser,
  updateUser
);

// Delete user (soft delete - deactivate)
router.delete(
  '/:id',
  validateUserId,
  authorize(USER_ROLES.SUPER_ADMIN, USER_ROLES.HOTEL_ADMIN),
  deleteUser
);

export default router;