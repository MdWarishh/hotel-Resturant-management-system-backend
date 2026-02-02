import mongoose from 'mongoose';
import { ROOM_STATUS, ROOM_TYPES } from '../../../config/constants.js';

const roomSchema = new mongoose.Schema(
  {
    hotel: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Hotel',
      required: [true, 'Hotel is required'],
      index: true,
    },
    roomNumber: {
      type: String,
      required: [true, 'Room number is required'],
      trim: true,
      uppercase: true,
    },
    roomType: {
      type: String,
      enum: Object.values(ROOM_TYPES),
      required: [true, 'Room type is required'],
      index: true,
    },
    floor: {
      type: Number,
      required: [true, 'Floor number is required'],
      min: [0, 'Floor cannot be negative'],
    },
    capacity: {
      adults: {
        type: Number,
        required: true,
        min: 1,
        default: 2,
      },
      children: {
        type: Number,
        default: 1,
        min: 0,
      },
    },
    pricing: {
      basePrice: {
        type: Number,
        required: [true, 'Base price is required'],
        min: [0, 'Price cannot be negative'],
      },
      weekendPrice: {
        type: Number,
        min: [0, 'Price cannot be negative'],
      },
      extraAdultCharge: {
        type: Number,
        default: 0,
        min: 0,
      },
      extraChildCharge: {
        type: Number,
        default: 0,
        min: 0,
      },
    },
    status: {
      type: String,
      enum: Object.values(ROOM_STATUS),
      default: ROOM_STATUS.AVAILABLE,
      index: true,
    },
    description: {
      type: String,
      maxlength: [500, 'Description cannot exceed 500 characters'],
      default: '',
    },
    amenities: [
      {
        type: String,
        trim: true,
      },
    ],
    features: {
      bedType: {
        type: String,
        enum: ['single', 'double', 'queen', 'king', 'twin'],
        default: 'double',
      },
      view: {
        type: String,
        enum: ['city', 'garden', 'pool', 'mountain', 'ocean', 'none'],
        default: 'none',
      },
      smokingAllowed: {
        type: Boolean,
        default: false,
      },
      petsAllowed: {
        type: Boolean,
        default: false,
      },
      balcony: {
        type: Boolean,
        default: false,
      },
      bathroom: {
        type: String,
        enum: ['shared', 'attached', 'premium'],
        default: 'attached',
      },
    },
    images: [
      {
        type: String,
      },
    ],
    maintenanceNotes: {
      type: String,
      default: '',
    },
    lastCleaned: {
      type: Date,
      default: null,
    },
    lastMaintenance: {
      type: Date,
      default: null,
    },
    currentBooking: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Booking',
      default: null,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for unique room numbers within a hotel
roomSchema.index({ hotel: 1, roomNumber: 1 }, { unique: true });

// Indexes for common queries
roomSchema.index({ hotel: 1, status: 1 });
roomSchema.index({ hotel: 1, roomType: 1 });
roomSchema.index({ hotel: 1, floor: 1 });

// Virtual for display name
roomSchema.virtual('displayName').get(function () {
  return `${this.roomType.toUpperCase()} - ${this.roomNumber}`;
});

// Method to check if room is available
roomSchema.methods.isAvailable = function () {
  return this.status === ROOM_STATUS.AVAILABLE && this.isActive;
};

// Method to check if room is occupied
roomSchema.methods.isOccupied = function () {
  return this.status === ROOM_STATUS.OCCUPIED;
};

// Method to get current price (weekday vs weekend)
roomSchema.methods.getCurrentPrice = function (isWeekend = false) {
  if (isWeekend && this.pricing.weekendPrice) {
    return this.pricing.weekendPrice;
  }
  return this.pricing.basePrice;
};

const Room = mongoose.model('Room', roomSchema);

export default Room;