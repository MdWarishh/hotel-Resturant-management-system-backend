import User from '../models/User.model.js';
import { generateToken } from '../../../utils/jwt.js';
import { successResponse, errorResponse } from '../../../utils/responseHandler.js';
import { HTTP_STATUS, ERROR_MESSAGES, USER_ROLES } from '../../../config/constants.js';
import asyncHandler from '../../../utils/asyncHandler.js';
import AppError from '../../../utils/AppError.js';

/**
 * Register New User
 * POST /api/auth/register
 * Access: Public (for super admin) or Protected (for other roles)
 */
export const register = asyncHandler(async (req, res) => {
  const { name, email, password, phone, role, hotel, address } = req.body;

  // Check if user already exists
  const existingUser = await User.findOne({ email });
  if (existingUser) {
    throw new AppError(ERROR_MESSAGES.USER_EXISTS, HTTP_STATUS.CONFLICT);
  }

  // Validate role-based requirements
  if (role !== USER_ROLES.SUPER_ADMIN && !hotel) {
    throw new AppError('Hotel ID is required for this role', HTTP_STATUS.BAD_REQUEST);
  }

  // Create user data object
  const userData = {
    name,
    email,
    password,
    phone,
    role: role || USER_ROLES.CASHIER,
    status: 'active',
  };

  // Add hotel if provided
  if (hotel) {
    userData.hotel = hotel;
  }

  // Add address if provided
  if (address) {
    userData.address = address;
  }

  // Add creator info if authenticated user exists
  if (req.user) {
    userData.createdBy = req.user._id;
  }

  // Create new user
  const user = await User.create(userData);

  // Generate JWT token
  const token = generateToken({
    id: user._id,
    email: user.email,
    role: user.role,
    hotel: user.hotel,
  });

  // Return user data (without password)
  const userResponse = user.toPublicJSON();

  return successResponse(
    res,
    HTTP_STATUS.CREATED,
    'User registered successfully',
    {
      user: userResponse,
      token,
    }
  );
});

/**
 * Login User
 * POST /api/auth/login
 * Access: Public
 */
export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  // Validate input
  if (!email || !password) {
    throw new AppError('Please provide email and password', HTTP_STATUS.BAD_REQUEST);
  }

  // Find user by email and include password field
  const user = await User.findOne({ email })
    .select('+password')
    .populate('hotel', 'name address');

  // Check if user exists
  if (!user) {
    throw new AppError(ERROR_MESSAGES.INVALID_CREDENTIALS, HTTP_STATUS.UNAUTHORIZED);
  }

  // Check if user is active
  if (user.status !== 'active') {
    throw new AppError('Your account is inactive. Please contact administrator.', HTTP_STATUS.FORBIDDEN);
  }

  // Verify password
  const isPasswordCorrect = await user.comparePassword(password);
  if (!isPasswordCorrect) {
    throw new AppError(ERROR_MESSAGES.INVALID_CREDENTIALS, HTTP_STATUS.UNAUTHORIZED);
  }

  // Update last login
  user.lastLogin = new Date();
  await user.save();

  // Generate JWT token
  const token = generateToken({
    id: user._id,
    email: user.email,
    role: user.role,
    hotel: user.hotel?._id,
  });

  // Return user data (without password)
  const userResponse = user.toPublicJSON();

  return successResponse(
    res,
    HTTP_STATUS.OK,
    'Login successful',
    {
      user: userResponse,
      token,
    }
  );
});

/**
 * Get Current User Profile
 * GET /api/auth/me
 * Access: Protected
 */
export const getProfile = asyncHandler(async (req, res) => {
  // req.user is set by auth middleware
  const user = await User.findById(req.user._id)
    .populate('hotel', 'name address contact')
    .populate('createdBy', 'name email');

  if (!user) {
    throw new AppError(ERROR_MESSAGES.NOT_FOUND, HTTP_STATUS.NOT_FOUND);
  }

  return successResponse(
    res,
    HTTP_STATUS.OK,
    'Profile fetched successfully',
    { user: user.toPublicJSON() }
  );
});

/**
 * Update User Profile
 * PUT /api/auth/profile
 * Access: Protected
 */
export const updateProfile = asyncHandler(async (req, res) => {
  const { name, phone, address, profileImage } = req.body;

  const user = await User.findById(req.user._id);

  if (!user) {
    throw new AppError(ERROR_MESSAGES.NOT_FOUND, HTTP_STATUS.NOT_FOUND);
  }

  // Update allowed fields only
  if (name) user.name = name;
  if (phone) user.phone = phone;
  if (address) user.address = address;
  if (profileImage) user.profileImage = profileImage;

  await user.save();

  return successResponse(
    res,
    HTTP_STATUS.OK,
    'Profile updated successfully',
    { user: user.toPublicJSON() }
  );
});

/**
 * Change Password
 * PUT /api/auth/change-password
 * Access: Protected
 */
export const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    throw new AppError('Please provide current and new password', HTTP_STATUS.BAD_REQUEST);
  }

  if (newPassword.length < 6) {
    throw new AppError('New password must be at least 6 characters', HTTP_STATUS.BAD_REQUEST);
  }

  // Get user with password
  const user = await User.findById(req.user._id).select('+password');

  if (!user) {
    throw new AppError(ERROR_MESSAGES.NOT_FOUND, HTTP_STATUS.NOT_FOUND);
  }

  // Verify current password
  const isPasswordCorrect = await user.comparePassword(currentPassword);
  if (!isPasswordCorrect) {
    throw new AppError('Current password is incorrect', HTTP_STATUS.UNAUTHORIZED);
  }

  // Update password
  user.password = newPassword;
  await user.save();

  return successResponse(
    res,
    HTTP_STATUS.OK,
    'Password changed successfully'
  );
});