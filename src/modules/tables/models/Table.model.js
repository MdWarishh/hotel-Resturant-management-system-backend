import mongoose from 'mongoose';
import { ROOM_STATUS } from '../../../config/constants.js';

const tableSchema = new mongoose.Schema(
  {
    hotel: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Hotel',
      required: true,
      index: true,
    },

    tableNumber: {
      type: String,
      required: true,
      trim: true,
    },

    capacity: {
      type: Number,
      required: true,
      min: 1,
    },

    status: {
      type: String,
      enum: ['available', 'occupied', 'reserved'],
      default: 'available',
      index: true,
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  { timestamps: true }
);

// 🔒 One table number per hotel
tableSchema.index({ hotel: 1, tableNumber: 1 }, { unique: true });

export default mongoose.model('Table', tableSchema);
