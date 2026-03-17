// backend/src/modules/pos/models/Counter.model.js
import mongoose from 'mongoose';

const CounterSchema = new mongoose.Schema({
  hotel: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Hotel',
    required: true,
  },
  name: {
    type: String,
    required: true, // e.g. "invoice"
  },
  seq: {
    type: Number,
    default: 0,
  },
});

// Compound unique index — har hotel ka apna counter
CounterSchema.index({ hotel: 1, name: 1 }, { unique: true });

export default mongoose.model('Counter', CounterSchema);