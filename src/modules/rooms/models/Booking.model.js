import mongoose from 'mongoose';
import { BOOKING_STATUS, PAYMENT_STATUS } from '../../../config/constants.js';
import Counter from '../../pos/models/Counter.model.js'; 

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

    bookingType: {
      type: String,
      enum: ['daily', 'hourly'],
      default: 'daily',
      required: true,
      index: true,
    },

    hours: {
      type: Number,
      min: 1,
    },

    source: {
      type: String,
      enum: ['Direct', 'OYO', 'MakeMyTrip', 'Booking.com', 'Goibibo', 'Airbnb', 'Agoda', 'Other'],
      default: 'Direct',
      required: true,
      index: true,
    },

    // ✅ Invoice Number — atomic counter based
    invoiceNumber: {
      type: String,
      unique: true,
      sparse: true,
      uppercase: true,
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
        // ✅ No strict email regex — accept as-is
      },
      phone: {
        type: String,
        required: [true, 'Guest phone is required'],
        trim: true,
        // ✅ No strict 10-digit validation — accept any format
      },
      idProof: {
        type: {
          type: String,
          enum: ['aadhar', 'pan', 'passport', 'driving-license', 'driving_license', 'voter-id', 'voter_id'],
        },
        number: String,
        image: {
          public_id: { type: String },
          url: { type: String },
        },
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

    additionalGuests: [
      {
        name: {
          type: String,
          trim: true,
          required: true,
        },
        phone: {
          type: String,
          trim: true,
          default: '',
        },
      },
    ],

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
      customCharges: [
        {
          label: { type: String, trim: true },
          amount: { type: Number, min: 0 },
        },
      ],
      manualDailyRate: { type: Number, default: 0, min: 0 },
      manualHourlyRate: { type: Number, default: 0, min: 0 },
      discount: {
        type: Number,
        default: 0,
        min: 0,
      },
      subtotal: { type: Number },
      taxableAmount: { type: Number, min: 0 },
      cgstAmount: { type: Number, default: 0, min: 0 },
      sgstAmount: { type: Number, default: 0, min: 0 },
      igstAmount: { type: Number, default: 0, min: 0 },
      gstRate: { type: Number, min: 0 },
      tax: { type: Number },
      total: { type: Number },
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

    // ✅ Payment Method — cash / upi / card
    paymentMethod: {
      type: String,
      enum: ['cash', 'upi', 'card'],
      default: null,
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

// Indexes
bookingSchema.index({ hotel: 1, status: 1 });
bookingSchema.index({ hotel: 1, 'dates.checkIn': 1 });
bookingSchema.index({ hotel: 1, 'dates.checkOut': 1 });
bookingSchema.index({ hotel: 1, room: 1, 'dates.checkIn': 1, 'dates.checkOut': 1 });

// ✅ Pre-save: Booking number + Atomic invoice number
bookingSchema.pre('save', async function () {
  // Booking number — date + random
  if (!this.bookingNumber) {
    const date = new Date();
    const year = date.getFullYear().toString().slice(-2);
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const random = Math.floor(Math.random() * 9000 + 1000).toString();
    this.bookingNumber = `BKG${year}${month}${random}`;
  }

  // ✅ Invoice number — atomic counter, race-condition safe
  if (!this.invoiceNumber) {
    try {
      const counter = await Counter.findOneAndUpdate(
        { hotel: this.hotel, name: 'booking-invoice' },
        { $inc: { seq: 1 } },
        { new: true, upsert: true }
      );
      this.invoiceNumber = `INV-${counter.seq.toString().padStart(4, '0')}`;
    } catch (error) {
      console.error('Error generating booking invoice number:', error);
      this.invoiceNumber = `INV-${Date.now()}`;
    }
  }
});

// Calculate duration
bookingSchema.methods.getDuration = function () {
  if (this.bookingType === 'hourly') {
    return this.hours;
  }
  const checkIn = new Date(this.dates.checkIn);
  const checkOut = new Date(this.dates.checkOut);
  const diffTime = Math.abs(checkOut - checkIn);
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

bookingSchema.methods.getTotalNights = function () {
  if (this.bookingType === 'hourly') return 0;
  return this.getDuration();
};

bookingSchema.methods.getFormattedDuration = function () {
  if (this.bookingType === 'hourly') {
    return `${this.hours} Hour${this.hours > 1 ? 's' : ''}`;
  }
  const nights = this.getDuration();
  return `${nights} Night${nights > 1 ? 's' : ''}`;
};

bookingSchema.methods.isActive = function () {
  return [BOOKING_STATUS.CONFIRMED, BOOKING_STATUS.CHECKED_IN].includes(this.status);
};

const Booking = mongoose.model('Booking', bookingSchema);

export default Booking;