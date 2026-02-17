import User from '../../auth/models/User.model.js';
import Hotel from '../../hotels/models/Hotel.model.js';
import { successResponse, paginatedResponse } from '../../../utils/responseHandler.js';
import { HTTP_STATUS, PAGINATION, USER_ROLES } from '../../../config/constants.js';
import asyncHandler from '../../../utils/asyncHandler.js';
import AppError from '../../../utils/AppError.js';
import multer from 'multer';

const upload = multer({ dest: 'uploads/cv/' });

/**
 * Get All Users
 * GET /api/users
 */
export const getAllUsers = asyncHandler(async (req, res) => {
  const { page = 1, limit = PAGINATION.DEFAULT_LIMIT, role, status, hotel, search } = req.query;

  const query = {};

  if (req.user.role === USER_ROLES.HOTEL_ADMIN) {
    query.hotel = req.user.hotel._id;
  } else if (req.user.role !== USER_ROLES.SUPER_ADMIN) {
    query.hotel = req.user.hotel._id;
  }

  if (role)   query.role   = role;
  if (status) query.status = status;

  if (hotel && req.user.role === USER_ROLES.SUPER_ADMIN) {
    query.hotel = hotel;
  }

  if (search) {
    query.$or = [
      { name:  new RegExp(search, 'i') },
      { email: new RegExp(search, 'i') },
      { phone: new RegExp(search, 'i') },
    ];
  }

  const pageNum  = parseInt(page);
  const limitNum = Math.min(parseInt(limit), PAGINATION.MAX_LIMIT);
  const skip     = (pageNum - 1) * limitNum;

  const users = await User.find(query)
    .populate('hotel', 'name code address.city')
    .populate('createdBy', 'name email')
    .select('-password')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limitNum);

  const total = await User.countDocuments(query);

  return paginatedResponse(res, users, pageNum, limitNum, total, 'Users fetched successfully');
});

/**
 * Get Single User
 * GET /api/users/:id
 */
export const getUserById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const user = await User.findById(id)
    .populate('hotel', 'name code address contact')
    .populate('createdBy', 'name email role')
    .select('-password');

  if (!user) {
    throw new AppError('User not found', HTTP_STATUS.NOT_FOUND);
  }

  // Authorization check
  if (req.user.role !== USER_ROLES.SUPER_ADMIN) {
    if (!req.user.hotel || user.hotel?._id.toString() !== req.user.hotel._id.toString()) {
      throw new AppError('Access denied to this user', HTTP_STATUS.FORBIDDEN);
    }
  }

  return successResponse(res, HTTP_STATUS.OK, 'User details fetched successfully', { user });
});

/**
 * Create Staff Member
 * POST /api/users
 */
export const createUser = asyncHandler(async (req, res) => {
  const { name, email, password, phone, role, hotel, address } = req.body;
  const cvFile = req.file;

  const existingUser = await User.findOne({ email });
  if (existingUser) {
    throw new AppError('User with this email already exists', HTTP_STATUS.CONFLICT);
  }

  // if (!cvFile) {
  //   throw new AppError('CV file is required', HTTP_STATUS.BAD_REQUEST);
  // }

  let assignedHotel = hotel;

  if (req.user.role === USER_ROLES.HOTEL_ADMIN) {
    assignedHotel = req.user.hotel._id;
    if ([USER_ROLES.SUPER_ADMIN, USER_ROLES.HOTEL_ADMIN].includes(role)) {
      throw new AppError('You cannot create users with this role', HTTP_STATUS.FORBIDDEN);
    }
  }

  if (req.user.role === USER_ROLES.SUPER_ADMIN && role !== USER_ROLES.SUPER_ADMIN) {
    const hotelExists = await Hotel.findById(assignedHotel);
    if (!hotelExists) {
      throw new AppError('Hotel not found', HTTP_STATUS.NOT_FOUND);
    }
  }

  const userData = {
    name,
    email,
    password,
    phone,
    role:      role || USER_ROLES.CASHIER,
    cvUrl:     cvFile.path,
    status:    'active',
    createdBy: req.user._id,
  };

  if (role !== USER_ROLES.SUPER_ADMIN) {
    userData.hotel = assignedHotel;
  }

  if (address) {
    userData.address = typeof address === 'string' ? JSON.parse(address) : address;
  }

  const user = await User.create(userData);

  const userResponse = await User.findById(user._id)
    .populate('hotel', 'name code')
    .select('-password');

  return successResponse(res, HTTP_STATUS.CREATED, 'User created successfully', { user: userResponse });
});

/**
 * Update User
 * PUT /api/users/:id
 * ✅ FIX: Now properly handles role update + clear error messages for live debugging
 */
export const updateUser = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { name, phone, address, status, role } = req.body;

  const user = await User.findById(id);
  if (!user) {
    throw new AppError('User not found', HTTP_STATUS.NOT_FOUND);
  }

  // Authorization check
  if (req.user.role === USER_ROLES.HOTEL_ADMIN) {
    if (!req.user.hotel || user.hotel?.toString() !== req.user.hotel._id.toString()) {
      throw new AppError('Access denied to update this user', HTTP_STATUS.FORBIDDEN);
    }
    if ([USER_ROLES.SUPER_ADMIN, USER_ROLES.HOTEL_ADMIN].includes(user.role)) {
      throw new AppError('You cannot update users with this role', HTTP_STATUS.FORBIDDEN);
    }
    if (role && [USER_ROLES.SUPER_ADMIN, USER_ROLES.HOTEL_ADMIN].includes(role)) {
      throw new AppError('You cannot assign this role', HTTP_STATUS.FORBIDDEN);
    }
  }

  // Users cannot update themselves through this endpoint
  if (user._id.toString() === req.user._id.toString()) {
    throw new AppError('Use profile update endpoint to update your own profile', HTTP_STATUS.BAD_REQUEST);
  }

  // Apply updates - only update fields that were actually sent
  if (name   !== undefined && name   !== null) user.name   = name.trim();
  if (phone  !== undefined && phone  !== null) user.phone  = phone.trim();
  if (status !== undefined && status !== null) user.status = status;
  if (role   !== undefined && role   !== null) user.role   = role;
  if (address) user.address = address;

  await user.save();

  const updatedUser = await User.findById(id)
    .populate('hotel', 'name code')
    .select('-password');

  return successResponse(res, HTTP_STATUS.OK, 'User updated successfully', { user: updatedUser });
});

/**
 * Delete User (soft delete)
 * DELETE /api/users/:id
 */
export const deleteUser = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const user = await User.findById(id);
  if (!user) {
    throw new AppError('User not found', HTTP_STATUS.NOT_FOUND);
  }

  if (req.user.role === USER_ROLES.HOTEL_ADMIN) {
    if (!req.user.hotel || user.hotel?.toString() !== req.user.hotel._id.toString()) {
      throw new AppError('Access denied to delete this user', HTTP_STATUS.FORBIDDEN);
    }
    if ([USER_ROLES.SUPER_ADMIN, USER_ROLES.HOTEL_ADMIN].includes(user.role)) {
      throw new AppError('You cannot delete users with this role', HTTP_STATUS.FORBIDDEN);
    }
  }

  if (user._id.toString() === req.user._id.toString()) {
    throw new AppError('You cannot delete your own account', HTTP_STATUS.BAD_REQUEST);
  }

  user.status = 'inactive';
  await user.save();

  return successResponse(res, HTTP_STATUS.OK, 'User deactivated successfully');
});

/**
 * Get Users by Hotel
 * GET /api/users/hotel/:hotelId
 */
export const getUsersByHotel = asyncHandler(async (req, res) => {
  const { hotelId } = req.params;
  const { role, status } = req.query;

  if (req.user.role !== USER_ROLES.SUPER_ADMIN) {
    if (!req.user.hotel || req.user.hotel._id.toString() !== hotelId) {
      throw new AppError('Access denied to this hotel', HTTP_STATUS.FORBIDDEN);
    }
  }

  const query = { hotel: hotelId };
  if (role)   query.role   = role;
  if (status) query.status = status;

  const users = await User.find(query)
    .populate('createdBy', 'name email')
    .select('-password')
    .sort({ createdAt: -1 });

  return successResponse(res, HTTP_STATUS.OK, 'Hotel users fetched successfully', {
    users,
    count: users.length,
  });
});

/**
 * Reset User Password (Admin Override)
 * POST /api/users/:id/reset-password
 * ✅ FIX: Validates newPassword, proper error messages
 */
export const resetPassword = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { newPassword } = req.body;

  if (!newPassword || typeof newPassword !== 'string' || newPassword.trim().length < 6) {
    throw new AppError('Please provide a new password (minimum 6 characters)', HTTP_STATUS.BAD_REQUEST);
  }

  const user = await User.findById(id);
  if (!user) {
    throw new AppError('User not found', HTTP_STATUS.NOT_FOUND);
  }

  // Authorization: Super Admin can reset anyone, Hotel Admin only their hotel's users
  if (req.user.role === USER_ROLES.HOTEL_ADMIN) {
    if (!req.user.hotel || user.hotel?.toString() !== req.user.hotel._id.toString()) {
      throw new AppError('Access denied to reset this user\'s password', HTTP_STATUS.FORBIDDEN);
    }
    if ([USER_ROLES.SUPER_ADMIN, USER_ROLES.HOTEL_ADMIN].includes(user.role)) {
      throw new AppError('You cannot reset this user\'s password', HTTP_STATUS.FORBIDDEN);
    }
  }

  // Update password — User model pre-save hook will hash it automatically
  user.password = newPassword.trim();
  await user.save();

  return successResponse(res, HTTP_STATUS.OK, 'Password reset successfully');
});