import { errorResponse } from '../../../utils/responseHandler.js';
import { HTTP_STATUS, USER_ROLES } from '../../../config/constants.js';

/**
 * Validate Create User Data
 */
export const validateCreateUser = (req, res, next) => {
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
 * Validate Update User Data
 */
export const validateUpdateUser = (req, res, next) => {
  const { name, phone, role, status } = req.body;
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

  // Role validation (if provided)
  if (role && !Object.values(USER_ROLES).includes(role)) {
    errors.push('Invalid role specified');
  }

  // Status validation (if provided)
  if (status && !['active', 'inactive', 'suspended'].includes(status)) {
    errors.push('Invalid status specified');
  }

  // If errors exist, return error response
  if (errors.length > 0) {
    return errorResponse(res, HTTP_STATUS.BAD_REQUEST, 'Validation failed', errors);
  }

  next();
};

/**
 * Validate MongoDB ObjectId
 */
export const validateUserId = (req, res, next) => {
  const { id, hotelId } = req.params;
  const errors = [];
  
  // Basic MongoDB ObjectId validation
  const objectIdRegex = /^[0-9a-fA-F]{24}$/;
  
  if (id && !objectIdRegex.test(id)) {
    errors.push('Invalid user ID format');
  }

  if (hotelId && !objectIdRegex.test(hotelId)) {
    errors.push('Invalid hotel ID format');
  }

  if (errors.length > 0) {
    return errorResponse(res, HTTP_STATUS.BAD_REQUEST, 'Validation failed', errors);
  }

  next();
};