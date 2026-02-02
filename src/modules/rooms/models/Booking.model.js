import mongoose from 'mongoose';
import { BOOKING_STATUS, PAYMENT_STATUS } from '../../../config/constants.js';

const bookingSchema = new mongoose.Schema(
  {
    bookingNumber: {
      type: String,
      unique: true,
      uppercase: true,
    },
    hotel: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Hotel',
      required: true,
      index: true,
    },
    room: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Room',
      required: true,
      index: true,
    },
    guest: {
      name: {
        type: String,
        required: [true, 'Guest name is required'],
        trim: true,
      },
      email: {
        type: String,
        lowercase: true,
        trim: true,
        match: [
          /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
          'Please enter a valid email',
        ],
      },
      phone: {
        type: String,
        required: [true, 'Guest phone is required'],
        match: [/^[0-9]{10}$/, 'Please enter a valid 10-digit phone number'],
      },
      idProof: {
        type: {
          type: String,
          enum: ['aadhar', 'passport', 'driving_license', 'voter_id'],
        },
        number: String,
      },
      address: {
        street: String,
        city: String,
        state: String,
        pincode: String,
      },
    },
    numberOfGuests: {
      adults: {
        type: Number,
        required: true,
        min: 1,
      },
      children: {
        type: Number,
        default: 0,
        min: 0,
      },
    },
    dates: {
      checkIn: {
        type: Date,
        required: true,
      },
      checkOut: {
        type: Date,
        required: true,
      },
      actualCheckIn: {
        type: Date,
        default: null,
      },
      actualCheckOut: {
        type: Date,
        default: null,
      },
    },
    pricing: {
      roomCharges: {
        type: Number,
        required: true,
        min: 0,
      },
      extraCharges: {
        type: Number,
        default: 0,
        min: 0,
      },
      discount: {
        type: Number,
        default: 0,
        min: 0,
      },
      subtotal: {
        type: Number,
        // required: true,
      },
      tax: {
        type: Number,
        // required: true,
      },
      total: {
        type: Number,
        // required: true,
      },
    },
    status: {
      type: String,
      enum: Object.values(BOOKING_STATUS),
      default: BOOKING_STATUS.PENDING,
      index: true,
    },
    paymentStatus: {
      type: String,
      enum: Object.values(PAYMENT_STATUS),
      default: PAYMENT_STATUS.PENDING,
      index: true,
    },
    advancePayment: {
      type: Number,
      default: 0,
      min: 0,
    },
    specialRequests: {
      type: String,
      maxlength: 500,
      default: '',
    },
    notes: {
      type: String,
      maxlength: 500,
      default: '',
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      // required: true,
    },
    checkedInBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    checkedOutBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for common queries
bookingSchema.index({ hotel: 1, status: 1 });
bookingSchema.index({ hotel: 1, 'dates.checkIn': 1 });
bookingSchema.index({ hotel: 1, 'dates.checkOut': 1 });
bookingSchema.index({ 'guest.phone': 1 });

// Generate booking number
bookingSchema.pre('save', async function () {
  if (!this.bookingNumber) {
    const date = new Date();
    const year = date.getFullYear().toString().slice(-2);
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    this.bookingNumber = `BKG${year}${month}${random}`;
  }
});

// Method to calculate total nights
bookingSchema.methods.getTotalNights = function () {
  const checkIn = new Date(this.dates.checkIn);
  const checkOut = new Date(this.dates.checkOut);
  const diffTime = Math.abs(checkOut - checkIn);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
};

// Method to check if booking is active
bookingSchema.methods.isActive = function () {
  return [BOOKING_STATUS.CONFIRMED, BOOKING_STATUS.CHECKED_IN].includes(this.status);
};

const Booking = mongoose.model('Booking', bookingSchema);

export default Booking;