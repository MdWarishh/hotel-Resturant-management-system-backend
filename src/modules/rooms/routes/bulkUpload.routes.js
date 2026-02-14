// backend/src/modules/rooms/routes/bulkUpload.routes.js

import express from 'express';
import multer from 'multer';
import { protect, authorize } from '../../../middlewares/auth.middleware.js';
import { USER_ROLES } from '../../../config/constants.js';
import {
  downloadRoomsTemplate,
  bulkUploadRooms,
  getBulkUploadHistory
} from '../controllers/bulkUpload.controller.js';

const router = express.Router();

// Configure multer for Excel file upload
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    // Accept only Excel files
    if (
      file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
      file.mimetype === 'application/vnd.ms-excel'
    ) {
      cb(null, true);
    } else {
      cb(new Error('Only Excel files (.xlsx, .xls) are allowed'));
    }
  },
});

/**
 * All routes require authentication
 */
router.use(protect);

/**
 * Bulk Upload Routes
 * Access: Super Admin, Hotel Admin
 */

// Download Excel template
router.get(
  '/template',
  authorize(USER_ROLES.SUPER_ADMIN, USER_ROLES.HOTEL_ADMIN),
  downloadRoomsTemplate
);

// Upload Excel file
router.post(
  '/',
  authorize(USER_ROLES.SUPER_ADMIN, USER_ROLES.HOTEL_ADMIN),
  upload.single('file'),
  bulkUploadRooms
);

// Get upload history
router.get(
  '/history',
  authorize(USER_ROLES.SUPER_ADMIN, USER_ROLES.HOTEL_ADMIN),
  getBulkUploadHistory
);

export default router;