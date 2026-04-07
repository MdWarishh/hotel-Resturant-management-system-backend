// backend/src/modules/pos/routes/push.routes.js
import express from 'express';
import { protect } from '../../../middlewares/auth.middleware.js';
import PushSubscription from '../models/PushSubscription.model.js';

const router = express.Router();

// Staff apna device subscribe karta hai
router.post('/subscribe', protect, async (req, res) => {
  const { subscription } = req.body;

  if (!subscription?.endpoint) {
    return res.status(400).json({ success: false, message: 'Invalid subscription' });
  }

  // Upsert - same endpoint dobara save na ho
  await PushSubscription.findOneAndUpdate(
    { 'subscription.endpoint': subscription.endpoint },
    {
      hotel: req.user.hotel._id,
      user: req.user._id,
      subscription,
    },
    { upsert: true, new: true }
  );

  res.json({ success: true, message: 'Subscribed for push notifications' });
});

// Unsubscribe (logout pe call karo)
router.post('/unsubscribe', protect, async (req, res) => {
  const { endpoint } = req.body;
  await PushSubscription.deleteOne({ 'subscription.endpoint': endpoint });
  res.json({ success: true, message: 'Unsubscribed' });
});

// VAPID public key frontend ko dena
router.get('/vapid-public-key', (req, res) => {
  res.json({ publicKey: process.env.VAPID_PUBLIC_KEY });
});

export default router;