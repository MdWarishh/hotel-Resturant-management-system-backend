import express from 'express';
import { getSuperAdminStats } from '../controllers/stats.controller.js';
import { protect } from '../../../middlewares/auth.middleware.js';


const router = express.Router();

// Only Super Admins should be able to see these global numbers
router.get('/stats', protect, getSuperAdminStats);

export default router;