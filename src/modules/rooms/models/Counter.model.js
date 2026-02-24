import mongoose from 'mongoose';

const counterSchema = new mongoose.Schema({
  hotel: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Hotel',
    required: true,
  },
  type: {
    type: String,
    enum: ['invoice', 'booking'],
    required: true,
  },
  year: {
    type: Number,
    required: true,
  },
  count: {
    type: Number,
    default: 0,
  },
});

counterSchema.index({ hotel: 1, type: 1, year: 1 }, { unique: true });

const Counter = mongoose.model('Counter', counterSchema);
export default Counter;
