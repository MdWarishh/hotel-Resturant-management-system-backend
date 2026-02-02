import User from '../../auth/models/User.model.js';
import Hotel from '../../hotels/models/Hotel.model.js';
import { successResponse, paginatedResponse } from '../../../utils/responseHandler.js';
import { HTTP_STATUS, PAGINATION, USER_ROLES } from '../../../config/constants.js';
import asyncHandler from '../../../utils/asyncHandler.js';
import AppError from '../../../utils/AppError.js';

/**
 * Get All Users
 * GET /api/users
 * Access: Super Admin (all users), Hotel Admin (their hotel's users)
 */
export const getAllUsers = asyncHandler(async (req, res) => {
  const { page = 1, limit = PAGINATION.DEFAULT_LIMIT, role, status, hotel, search } = req.query;

  // Build query
  const query = {};

  // If Hotel Admin, only show their hotel's users
  if (req.user.role === USER_ROLES.HOTEL_ADMIN) {
    query.hotel = req.user.hotel._id;
  }
  // If Manager/Cashier/Kitchen Staff, only their hotel
  else if (req.user.role !== USER_ROLES.SUPER_ADMIN) {
    query.hotel = req.user.hotel._id;
  }

  // Apply filters
  if (role) {
    query.role = role;
  }

  if (status) {
    query.status = status;
  }

  if (hotel && req.user.role === USER_ROLES.SUPER_ADMIN) {
    query.hotel = hotel;
  }

  if (search) {
    query.$or = [
      { name: new RegExp(search, 'i') },
      { email: new RegExp(search, 'i') },
      { phone: new RegExp(search, 'i') },
    ];
  }

  // Pagination
  const pageNum = parseInt(page);
  const limitNum = Math.min(parseInt(limit), PAGINATION.MAX_LIMIT);
  const skip = (pageNum - 1) * limitNum;

  // Fetch users
  const users = await User.find(query)
    .populate('hotel', 'name code address.city')
    .populate('createdBy', 'name email')
    .select('-password')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limitNum);

  // Get total count
  const total = await User.countDocuments(query);

  return paginatedResponse(
    res,
    users,
    pageNum,
    limitNum,
    total,
    'Users fetched successfully'
  );
});

/**
 * Get Single User
 * GET /api/users/:id
 * Access: Super Admin (any), Hotel Admin (their hotel's users)
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

  return successResponse(
    res,
    HTTP_STATUS.OK,
    'User details fetched successfully',
    { user }
  );
});

/**
 * Create Staff Member
 * POST /api/users
 * Access: Super Admin (any hotel), Hotel Admin (only their hotel)
 */
export const createUser = asyncHandler(async (req, res) => {
  const { name, email, password, phone, role, hotel, address } = req.body;

  // Check if user already exists
  const existingUser = await User.findOne({ email });
  if (existingUser) {
    throw new AppError('User with this email already exists', HTTP_STATUS.CONFLICT);
  }

  // Authorization: Hotel Admin can only create users for their hotel
  let assignedHotel = hotel;

  if (req.user.role === USER_ROLES.HOTEL_ADMIN) {
    // Hotel Admin must assign to their own hotel
    assignedHotel = req.user.hotel._id;

    // Hotel Admin cannot create Super Admin or Hotel Admin
    if ([USER_ROLES.SUPER_ADMIN, USER_ROLES.HOTEL_ADMIN].includes(role)) {
      throw new AppError('You cannot create users with this role', HTTP_STATUS.FORBIDDEN);
    }
  }

  // Super Admin validation - ensure hotel exists
  if (req.user.role === USER_ROLES.SUPER_ADMIN && role !== USER_ROLES.SUPER_ADMIN) {
    const hotelExists = await Hotel.findById(assignedHotel);
    if (!hotelExists) {
      throw new AppError('Hotel not found', HTTP_STATUS.NOT_FOUND);
    }
  }

  // Create user
  const userData = {
    name,
    email,
    password,
    phone,
    role: role || USER_ROLES.CASHIER,
    status: 'active',
    createdBy: req.user._id,
  };

  // Add hotel if not super admin
  if (role !== USER_ROLES.SUPER_ADMIN) {
    userData.hotel = assignedHotel;
  }

  // Add address if provided
  if (address) {
    userData.address = address;
  }

  const user = await User.create(userData);

  // Return user data without password
  const userResponse = await User.findById(user._id)
    .populate('hotel', 'name code')
    .select('-password');

  return successResponse(
    res,
    HTTP_STATUS.CREATED,
    'User created successfully',
    { user: userResponse }
  );
});

/**
 * Update User
 * PUT /api/users/:id
 * Access: Super Admin (any), Hotel Admin (their hotel's users)
 */
export const updateUser = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { name, phone, address, status, role } = req.body;

  // Find user
  const user = await User.findById(id);

  if (!user) {
    throw new AppError('User not found', HTTP_STATUS.NOT_FOUND);
  }

  // Authorization check
  if (req.user.role === USER_ROLES.HOTEL_ADMIN) {
    // Hotel Admin can only update their hotel's users
    if (!req.user.hotel || user.hotel?.toString() !== req.user.hotel._id.toString()) {
      throw new AppError('Access denied to update this user', HTTP_STATUS.FORBIDDEN);
    }

    // Hotel Admin cannot update Super Admin or Hotel Admin
    if ([USER_ROLES.SUPER_ADMIN, USER_ROLES.HOTEL_ADMIN].includes(user.role)) {
      throw new AppError('You cannot update users with this role', HTTP_STATUS.FORBIDDEN);
    }

    // Hotel Admin cannot change role to Super Admin or Hotel Admin
    if (role && [USER_ROLES.SUPER_ADMIN, USER_ROLES.HOTEL_ADMIN].includes(role)) {
      throw new AppError('You cannot assign this role', HTTP_STATUS.FORBIDDEN);
    }
  }

  // Users cannot update themselves through this endpoint
  if (user._id.toString() === req.user._id.toString()) {
    throw new AppError('Use profile update endpoint to update your own profile', HTTP_STATUS.BAD_REQUEST);
  }

  // Update fields
  if (name) user.name = name;
  if (phone) user.phone = phone;
  if (address) user.address = address;
  if (status) user.status = status;
  if (role) user.role = role;

  await user.save();

  // Return updated user
  const updatedUser = await User.findById(id)
    .populate('hotel', 'name code')
    .select('-password');

  return successResponse(
    res,
    HTTP_STATUS.OK,
    'User updated successfully',
    { user: updatedUser }
  );
});

/**
 * Delete User
 * DELETE /api/users/:id
 * Access: Super Admin (any), Hotel Admin (their hotel's users)
 */
export const deleteUser = asyncHandler(async (req, res) => {
  const { id } = req.params;

  // Find user
  const user = await User.findById(id);

  if (!user) {
    throw new AppError('User not found', HTTP_STATUS.NOT_FOUND);
  }

  // Authorization check
  if (req.user.role === USER_ROLES.HOTEL_ADMIN) {
    // Hotel Admin can only delete their hotel's users
    if (!req.user.hotel || user.hotel?.toString() !== req.user.hotel._id.toString()) {
      throw new AppError('Access denied to delete this user', HTTP_STATUS.FORBIDDEN);
    }

    // Hotel Admin cannot delete Super Admin or Hotel Admin
    if ([USER_ROLES.SUPER_ADMIN, USER_ROLES.HOTEL_ADMIN].includes(user.role)) {
      throw new AppError('You cannot delete users with this role', HTTP_STATUS.FORBIDDEN);
    }
  }

  // Users cannot delete themselves
  if (user._id.toString() === req.user._id.toString()) {
    throw new AppError('You cannot delete your own account', HTTP_STATUS.BAD_REQUEST);
  }

  // Instead of deleting, deactivate the user
  user.status = 'inactive';
  await user.save();

  return successResponse(
    res,
    HTTP_STATUS.OK,
    'User deactivated successfully'
  );
});

/**
 * Get Users by Hotel
 * GET /api/users/hotel/:hotelId
 * Access: Super Admin, Hotel Admin (their hotel only)
 */
export const getUsersByHotel = asyncHandler(async (req, res) => {
  const { hotelId } = req.params;
  const { role, status } = req.query;

  // Authorization check
  if (req.user.role !== USER_ROLES.SUPER_ADMIN) {
    if (!req.user.hotel || req.user.hotel._id.toString() !== hotelId) {
      throw new AppError('Access denied to this hotel', HTTP_STATUS.FORBIDDEN);
    }
  }

  // Build query
  const query = { hotel: hotelId };

  if (role) query.role = role;
  if (status) query.status = status;

  // Fetch users
  const users = await User.find(query)
    .populate('createdBy', 'name email')
    .select('-password')
    .sort({ createdAt: -1 });

  return successResponse(
    res,
    HTTP_STATUS.OK,
    'Hotel users fetched successfully',
    { users, count: users.length }
  );
});