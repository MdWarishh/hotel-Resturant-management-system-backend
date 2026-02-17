import express from 'express';
import multer from 'multer';
import path from 'path';
import {
  getAllUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
  getUsersByHotel,
  resetPassword,
} from '../controllers/user.controller.js';
import { protect, authorize } from '../../../middlewares/auth.middleware.js';
import {
  validateCreateUser,
  validateUpdateUser,
  validateUserId,
} from '../validators/user.validator.js';
import { USER_ROLES } from '../../../config/constants.js';

const router = express.Router();

// ✅ FIX: Use diskStorage instead of dest — preserves original file extension
// dest: 'uploads/cv/' saves files WITHOUT extension (e.g. "2d9234fd...")
// diskStorage saves WITH extension (e.g. "2d9234fd.pdf")
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/cv/'); // folder must exist
  },
  filename: (req, file, cb) => {
    // Generate unique name: timestamp-random + original extension
    const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    const allowed = ['.pdf', '.doc', '.docx'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF, DOC, DOCX files are allowed'));
    }
  },
});

/**
 * All routes require authentication
 */
router.use(protect);

// Get all users
router.get(
  '/',
  authorize(USER_ROLES.SUPER_ADMIN, USER_ROLES.HOTEL_ADMIN, USER_ROLES.MANAGER),
  getAllUsers
);

// Create new user/staff — upload.single('cv') with diskStorage
router.post(
  '/',
  authorize(USER_ROLES.SUPER_ADMIN, USER_ROLES.HOTEL_ADMIN),
  upload.single('cv'),
  createUser
);

// Get users by hotel
router.get(
  '/hotel/:hotelId',
  validateUserId,
  authorize(USER_ROLES.SUPER_ADMIN, USER_ROLES.HOTEL_ADMIN, USER_ROLES.MANAGER),
  getUsersByHotel
);

// Get single user
router.get(
  '/:id',
  validateUserId,
  authorize(USER_ROLES.SUPER_ADMIN, USER_ROLES.HOTEL_ADMIN, USER_ROLES.MANAGER),
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

// Reset password
router.post(
  '/:id/reset-password',
  validateUserId,
  authorize(USER_ROLES.SUPER_ADMIN, USER_ROLES.HOTEL_ADMIN),
  resetPassword
);

// Update CV only (PATCH)
router.patch(
  '/:id/cv',
  validateUserId,
  authorize(USER_ROLES.SUPER_ADMIN, USER_ROLES.HOTEL_ADMIN),
  upload.single('cv'),
  async (req, res, next) => {
    try {
      const User = (await import('../../auth/models/User.model.js')).default;
      const user = await User.findById(req.params.id);
      if (!user) return res.status(404).json({ success: false, message: 'User not found' });

      if (!req.file) return res.status(400).json({ success: false, message: 'CV file is required' });

      user.cvUrl = req.file.path.replace(/\\/g, '/');
      await user.save();

      const updated = await User.findById(req.params.id).select('-password');
      res.json({ success: true, message: 'CV updated', data: { user: updated } });
    } catch (err) {
      next(err);
    }
  }
);

// Delete user (soft delete)
router.delete(
  '/:id',
  validateUserId,
  authorize(USER_ROLES.SUPER_ADMIN, USER_ROLES.HOTEL_ADMIN),
  deleteUser
);

export default router;