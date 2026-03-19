import mongoose from 'mongoose';

/**
 * Counter Model — atomic sequence generator
 *
 * Booking.model.js ka pre-save hook is schema se query karta hai:
 *   { hotel: ObjectId, name: 'booking-invoice' }
 *
 * Isliye schema mein hotel + name fields hone chahiye,
 * aur dono ka combination unique hona chahiye.
 */
const counterSchema = new mongoose.Schema({
  hotel: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Hotel',
    required: true,
  },
  name: {
    type: String,
    required: true, // e.g. 'booking-invoice', 'pos-invoice'
  },
  seq: {
    type: Number,
    default: 0,
  },
});

// ✅ Unique constraint: har hotel ka alag counter, har type ka alag sequence
counterSchema.index({ hotel: 1, name: 1 }, { unique: true });

export default mongoose.models.Counter || mongoose.model('Counter', counterSchema);