import express from 'express';
import {
  createRoom,
  getAllRooms,
  getRoomById,
  updateRoom,
  deleteRoom,
  updateRoomStatus,
  getAvailableRooms,
} from '../controllers/room.controller.js';
import { protect, authorize } from '../../../middlewares/auth.middleware.js';
import {
  validateCreateRoom,
  validateUpdateRoom,
  validateRoomStatus,
  validateRoomId,
} from '../validators/room.validator.js';
import { USER_ROLES } from '../../../config/constants.js';

const router = express.Router();

/**
 * All routes require authentication
 */
router.use(protect);

/**
 * Room CRUD Routes
 */

// Get all rooms (with filters)
router.get('/', getAllRooms);

// Get available rooms
router.get('/available', getAvailableRooms);

// Create new room
// Super Admin: any hotel, Hotel Admin: their hotel only
router.post(
  '/',
  authorize(USER_ROLES.SUPER_ADMIN, USER_ROLES.HOTEL_ADMIN),
  validateCreateRoom,
  createRoom
);

// Get single room details
router.get(
  '/:id',
  validateRoomId,
  getRoomById
);

// Update room
router.put(
  '/:id',
  validateRoomId,
  authorize(USER_ROLES.SUPER_ADMIN, USER_ROLES.HOTEL_ADMIN),
  validateUpdateRoom,
  updateRoom
);

// Update room status
router.patch(
  '/:id/status',
  validateRoomId,
  authorize(
    USER_ROLES.SUPER_ADMIN,
    USER_ROLES.HOTEL_ADMIN,
    USER_ROLES.MANAGER,
    USER_ROLES.CASHIER
  ),
  validateRoomStatus,
  updateRoomStatus
);

// Delete room (soft delete)
router.delete(
  '/:id',
  validateRoomId,
  authorize(USER_ROLES.SUPER_ADMIN, USER_ROLES.HOTEL_ADMIN),
  deleteRoom
);

export default router;