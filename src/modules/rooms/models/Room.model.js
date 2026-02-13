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
      
      // 🔥 NEW: Hourly pricing
      hourlyRate: {
        type: Number,
        min: [0, 'Hourly rate cannot be negative'],
        default: 0,
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
      
      // 🔥 NEW: Support hourly bookings
      allowHourlyBooking: {
        type: Boolean,
        default: false,
      },
    },
    images: [
      {
        url: {
          type: String,
          required: [true, 'Image URL is required'],
        },
        public_id: {
          type: String,
          required: [true, 'Image Public ID is required'],
        },
        isPrimary: {
          type: Boolean,
          default: false,
        },
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

// 🔥 UPDATED: Get current price based on booking type
roomSchema.methods.getCurrentPrice = function (bookingType = 'daily', isWeekend = false) {
  if (bookingType === 'hourly') {
    return this.pricing.hourlyRate || 0;
  }
  
  // For daily bookings
  if (isWeekend && this.pricing.weekendPrice) {
    return this.pricing.weekendPrice;
  }
  return this.pricing.basePrice;
};

// 🔥 NEW: Check if room supports hourly bookings
roomSchema.methods.supportsHourlyBooking = function () {
  return this.features.allowHourlyBooking && this.pricing.hourlyRate > 0;
};

const Room = mongoose.model('Room', roomSchema);

export default Room;