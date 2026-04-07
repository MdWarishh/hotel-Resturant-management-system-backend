// backend/src/modules/pos/models/PushSubscription.model.js
import mongoose from 'mongoose';

const pushSubscriptionSchema = new mongoose.Schema({
  hotel: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Hotel',
    required: true,
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  subscription: {
    endpoint: { type: String, required: true, unique: true },
    keys: {
      p256dh: String,
      auth: String,
    },
  },
  // Sirf delivery/takeaway notifications chahiye? Configure karo
  notifyFor: {
    type: [String],
    default: ['delivery', 'takeaway', 'room-service', 'dine-in'],
  },
}, { timestamps: true });

export default mongoose.model('PushSubscription', pushSubscriptionSchema);