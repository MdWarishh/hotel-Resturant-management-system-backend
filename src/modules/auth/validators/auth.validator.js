import { errorResponse } from '../../../utils/responseHandler.js';
import { HTTP_STATUS, USER_ROLES } from '../../../config/constants.js';

/**
 * Validate Registration Data
 */
export const validateRegister = (req, res, next) => {
  const { name, email, password, phone, role } = req.body;
  const errors = [];

  // Name validation
  if (!name || name.trim().length < 2) {
    errors.push('Name must be at least 2 characters');
  }

  // Email validation
  const emailRegex = /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/;
  if (!email || !emailRegex.test(email)) {
    errors.push('Please provide a valid email');
  }

  // Password validation
  if (!password || password.length < 6) {
    errors.push('Password must be at least 6 characters');
  }

  // Phone validation
  const phoneRegex = /^[0-9]{10}$/;
  if (!phone || !phoneRegex.test(phone)) {
    errors.push('Please provide a valid 10-digit phone number');
  }

  // Role validation
  if (role && !Object.values(USER_ROLES).includes(role)) {
    errors.push('Invalid role specified');
  }

  // If errors exist, return error response
  if (errors.length > 0) {
    return errorResponse(res, HTTP_STATUS.BAD_REQUEST, 'Validation failed', errors);
  }

  next();
};

/**
 * Validate Login Data
 */
export const validateLogin = (req, res, next) => {
  const { email, password } = req.body;
  const errors = [];

  // Email validation
  if (!email || !email.trim()) {
    errors.push('Email is required');
  }

  // Password validation
  if (!password || !password.trim()) {
    errors.push('Password is required');
  }

  // If errors exist, return error response
  if (errors.length > 0) {
    return errorResponse(res, HTTP_STATUS.BAD_REQUEST, 'Validation failed', errors);
  }

  next();
};

/**
 * Validate Profile Update Data
 */
export const validateProfileUpdate = (req, res, next) => {
  const { name, phone } = req.body;
  const errors = [];

  // Name validation (if provided)
  if (name && name.trim().length < 2) {
    errors.push('Name must be at least 2 characters');
  }

  // Phone validation (if provided)
  const phoneRegex = /^[0-9]{10}$/;
  if (phone && !phoneRegex.test(phone)) {
    errors.push('Please provide a valid 10-digit phone number');
  }

  // If errors exist, return error response
  if (errors.length > 0) {
    return errorResponse(res, HTTP_STATUS.BAD_REQUEST, 'Validation failed', errors);
  }

  next();
};

/**
 * Validate Change Password Data
 */
export const validateChangePassword = (req, res, next) => {
  const { currentPassword, newPassword } = req.body;
  const errors = [];

  // Current password validation
  if (!currentPassword || !currentPassword.trim()) {
    errors.push('Current password is required');
  }

  // New password validation
  if (!newPassword || newPassword.length < 6) {
    errors.push('New password must be at least 6 characters');
  }

  // Check if passwords are different
  if (currentPassword === newPassword) {
    errors.push('New password must be different from current password');
  }

  // If errors exist, return error response
  if (errors.length > 0) {
    return errorResponse(res, HTTP_STATUS.BAD_REQUEST, 'Validation failed', errors);
  }

  next();
};