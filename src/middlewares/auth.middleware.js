import { verifyToken } from '../utils/jwt.js';
import User from '../modules/auth/models/User.model.js';
import { errorResponse } from '../utils/responseHandler.js';
import { HTTP_STATUS, ERROR_MESSAGES } from '../config/constants.js';
import asyncHandler from '../utils/asyncHandler.js';
import AppError from '../utils/AppError.js';

/**
 * Protect Routes - Verify JWT Token
 * Middleware to authenticate users
 */
export const protect = asyncHandler(async (req, res, next) => {
  let token;

  // Check if token exists in Authorization header
// Check if token exists in Authorization header
if (
  req.headers.authorization &&
  req.headers.authorization.startsWith('Bearer')
) {
  token = req.headers.authorization.split(' ')[1];
}

// 🔽 ADD THIS BLOCK (FOR PDF DOWNLOAD / DIRECT ACCESS)
if (!token && req.query.token) {
  token = req.query.token;
}

// Check if token exists
if (!token) {
  throw new AppError(ERROR_MESSAGES.UNAUTHORIZED, HTTP_STATUS.UNAUTHORIZED);
}


  try {
    // Verify token
    const decoded = verifyToken(token);

    // Find user by ID from token
    const user = await User.findById(decoded.id).populate('hotel', 'name address');

    // Check if user exists
    if (!user) {
      throw new AppError('User not found. Token invalid.', HTTP_STATUS.UNAUTHORIZED);
    }

    // Check if user is active
    if (user.status !== 'active') {
      throw new AppError('Your account is inactive.', HTTP_STATUS.FORBIDDEN);
    }

    // Attach user to request object
    req.user = user;
    next();

  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    throw new AppError(ERROR_MESSAGES.INVALID_TOKEN, HTTP_STATUS.UNAUTHORIZED);
  }
});

/**
 * Role-Based Authorization
 * Middleware to restrict access based on user roles
 * @param  {...String} roles - Allowed roles
 */
export const authorize = (...roles) => {
  return (req, res, next) => {
    // Check if user exists (should be set by protect middleware)
    if (!req.user) {
      return errorResponse(
        res,
        HTTP_STATUS.UNAUTHORIZED,
        ERROR_MESSAGES.UNAUTHORIZED
      );
    }

    // Check if user's role is in allowed roles
    if (!roles.includes(req.user.role)) {
      return errorResponse(
        res,
        HTTP_STATUS.FORBIDDEN,
        `Role '${req.user.role}' is not authorized to access this route`
      );
    }

    next();
  };
};

/**
 * Hotel-Based Authorization
 * Ensures user can only access their hotel's data
 */
export const authorizeHotel = asyncHandler(async (req, res, next) => {
  const { hotelId } = req.params;

  // Super admin can access all hotels
  if (req.user.role === 'super_admin') {
    return next();
  }

  // Check if user belongs to the requested hotel
  if (!req.user.hotel || req.user.hotel._id.toString() !== hotelId) {
    throw new AppError(
      'You do not have permission to access this hotel',
      HTTP_STATUS.FORBIDDEN
    );
  }

  next();
});