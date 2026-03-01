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
      max: 12,
      validate: {
        validator: function(value) {
          if (this.bookingType === 'hourly') {
            return value != null && value >= 1 && value <= 12;
          }
          return true;
        },
        message: 'Hours must be between 1 and 12 for hourly bookings'
      }
    },
    
    source: {
      type: String,
      enum: ['Direct', 'OYO', 'MakeMyTrip', 'Booking.com', 'Goibibo', 'Airbnb', 'Agoda', 'Other'],
      default: 'Direct',
      required: true,
      index: true,
    },
    
    // 🔥 Invoice Number Field
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

    // Additional guests (optional - name + phone)
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
      discount: {
        type: Number,
        default: 0,
        min: 0,
      },
      subtotal: {
        type: Number,
      },
      taxableAmount: { type: Number, min: 0 },
      cgstAmount: { type: Number, default: 0, min: 0 },
      sgstAmount: { type: Number, default: 0, min: 0 },
      igstAmount: { type: Number, default: 0, min: 0 },
      gstRate: { type: Number, min: 0 },
      tax: {
        type: Number,
      },
      total: {
        type: Number,
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

// 🔥 UPDATED: Generate booking number AND invoice number
bookingSchema.pre('save', async function () {
  // Generate booking number
  if (!this.bookingNumber) {
    const date = new Date();
    const year = date.getFullYear().toString().slice(-2);
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    this.bookingNumber = `BKG${year}${month}${random}`;
  }

  // 🔥 NEW: Generate invoice number (INV-0001 format)
  if (!this.invoiceNumber) {
    try {
      // Find the latest invoice number for this hotel
      const lastBooking = await this.constructor.findOne({
        hotel: this.hotel,
        invoiceNumber: { $exists: true, $ne: null }
      })
      .sort({ createdAt: -1 })
      .select('invoiceNumber');

      let nextNumber = 1;

      if (lastBooking && lastBooking.invoiceNumber) {
        // Extract number from INV-0001 format
        const lastNumber = parseInt(lastBooking.invoiceNumber.replace('INV-', '')) || 0;
        nextNumber = lastNumber + 1;
      }

      // Format: INV-0001, INV-0002, etc.
      this.invoiceNumber = `INV-${nextNumber.toString().padStart(4, '0')}`;
      
      console.log(`✅ Generated invoice number: ${this.invoiceNumber} for hotel: ${this.hotel}`);
      
    } catch (error) {
      console.error('❌ Error generating invoice number:', error);
      // Fallback: Use booking number-based invoice
      const fallbackNum = parseInt(this.bookingNumber.replace(/[^0-9]/g, '')) || 1;
      this.invoiceNumber = `INV-${fallbackNum.toString().padStart(4, '0')}`;
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
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
};

// Method to calculate total nights
bookingSchema.methods.getTotalNights = function () {
  if (this.bookingType === 'hourly') {
    return 0;
  }
  return this.getDuration();
};

// Get formatted duration string
bookingSchema.methods.getFormattedDuration = function () {
  if (this.bookingType === 'hourly') {
    return `${this.hours} Hour${this.hours > 1 ? 's' : ''}`;
  }
  const nights = this.getDuration();
  return `${nights} Night${nights > 1 ? 's' : ''}`;
};

// Method to check if booking is active
bookingSchema.methods.isActive = function () {
  return [BOOKING_STATUS.CONFIRMED, BOOKING_STATUS.CHECKED_IN].includes(this.status);
};

const Booking = mongoose.model('Booking', bookingSchema);

export default Booking;