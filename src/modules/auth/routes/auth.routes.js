import express from 'express';
import {
  register,
  login,
  getProfile,
  updateProfile,
  changePassword,
} from '../controllers/auth.controller.js';
import { protect, authorize } from '../../../middlewares/auth.middleware.js';
import {
  validateRegister,
  validateLogin,
  validateProfileUpdate,
  validateChangePassword,
} from '../validators/auth.validator.js';
import { USER_ROLES } from '../../../config/constants.js';

const router = express.Router();

/**
 * Public Routes
 */

// Login
router.post('/login', validateLogin, login);

// Register Super Admin (first time setup)
router.post('/register/super-admin', validateRegister, register);

/**
 * Protected Routes
 */

// Get current user profile
router.get('/me', protect, getProfile);

// Update current user profile
router.put('/profile', protect, validateProfileUpdate, updateProfile);

// Change password
router.put('/change-password', protect, validateChangePassword, changePassword);

/**
 * Admin Only Routes
 */

// Register new users (Hotel Admin, Manager, Cashier, Kitchen Staff)
// Only Super Admin and Hotel Admin can create users
router.post(
  '/register',
  protect,
  authorize(USER_ROLES.SUPER_ADMIN, USER_ROLES.HOTEL_ADMIN),
  validateRegister,
  register
);

export default router;