import mongoose from 'mongoose';

// ✅ Slab schema — reusable for both delivery & packaging
const chargeSlabSchema = new mongoose.Schema(
  {
    minOrder: { type: Number, required: true, min: 0 },  // order amount >= minOrder
    maxOrder: { type: Number, default: null },            // null = no upper limit
    charge: { type: Number, required: true, min: 0 },    // charge amount for this slab
  },
  { _id: false }
);

const hotelSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Hotel name is required'],
      trim: true,
      minlength: [3, 'Hotel name must be at least 3 characters'],
      maxlength: [100, 'Hotel name cannot exceed 100 characters'],
    },
    code: {
      type: String,
      required: [true, 'Hotel code is required'],
      unique: true,
      uppercase: true,
      trim: true,
      match: [/^[A-Z0-9]{3,10}$/, 'Hotel code must be 3-10 alphanumeric characters'],
    },
    description: {
      type: String,
      maxlength: [500, 'Description cannot exceed 500 characters'],
      default: '',
    },
    address: {
      street: { type: String, required: [true, 'Street address is required'], trim: true },
      city: { type: String, required: [true, 'City is required'], trim: true },
      stateCode: {
        type: String,
        required: false,
        match: [/^[0-9]{2}$/, 'State code must be 2 digits (01-37)'],
      },
      state: { type: String, required: [true, 'State is required'], trim: true },
      pincode: {
        type: String,
        required: [true, 'Pincode is required'],
        match: [/^[0-9]{6}$/, 'Please enter a valid 6-digit pincode'],
      },
      country: { type: String, default: 'India' },
    },
    contact: {
      phone: {
        type: String,
        required: [true, 'Contact phone is required'],
        match: [/^[0-9]{10}$/, 'Please enter a valid 10-digit phone number'],
      },
      email: {
        type: String,
        required: [true, 'Contact email is required'],
        lowercase: true,
        trim: true,
        match: [
          /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
          'Please enter a valid email',
        ],
      },
      website: { type: String, default: '' },
    },
    gst: {
      number: {
        type: String,
        required: [true, 'GST number is required'],
        unique: true,
        uppercase: true,
        trim: true,
        match: [
          /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/,
          'Please enter a valid GST number',
        ],
      },
      name: { type: String, required: [true, 'Business name for GST is required'], trim: true },
    },
    settings: {
      checkInTime: {
        type: String,
        default: '14:00',
        match: [/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time format (HH:MM)'],
      },
      checkOutTime: {
        type: String,
        default: '11:00',
        match: [/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time format (HH:MM)'],
      },
      currency: { type: String, default: 'INR' },
      timezone: { type: String, default: 'Asia/Kolkata' },
      taxRate: { type: Number, default: 5, min: 0, max: 100 },

      // ─── DELIVERY ───────────────────────────────────────────
      deliveryEnabled: { type: Boolean, default: false },

      // 'fixed' → use deliveryCharge field
      // 'slab'  → use deliverySlabs array
      deliveryChargeType: {
        type: String,
        enum: ['fixed', 'slab'],
        default: 'fixed',
      },
      deliveryCharge: { type: Number, default: 0, min: 0 }, // used when type = fixed
      deliverySlabs: { type: [chargeSlabSchema], default: [] }, // used when type = slab

      // ─── PACKAGING ──────────────────────────────────────────
      packagingEnabled: { type: Boolean, default: false },

      // Which order types get packaging charge
      packagingApplicableOn: {
        type: [String],
        enum: ['delivery', 'takeaway', 'dine-in', 'room-service'],
        default: ['delivery', 'takeaway'],
      },

      // 'fixed' → use packagingCharge field
      // 'slab'  → use packagingSlabs array
      packagingChargeType: {
        type: String,
        enum: ['fixed', 'slab'],
        default: 'fixed',
      },
      packagingCharge: { type: Number, default: 0, min: 0 }, // used when type = fixed
      packagingSlabs: { type: [chargeSlabSchema], default: [] }, // used when type = slab
    },

    status: {
      type: String,
      enum: ['active', 'inactive', 'maintenance'],
      default: 'active',
    },
    totalRooms: { type: Number, default: 0, min: 0 },
    logo: { type: String, default: null },
    images: [{ type: String }],
    amenities: [{ type: String, trim: true }],
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    totalMenuCategories: { type: Number, default: 0 },
    totalMenuItems: { type: Number, default: 0 },
  },
  { timestamps: true }
);

// Indexes
hotelSchema.index({ code: 1 });
hotelSchema.index({ status: 1 });
hotelSchema.index({ 'address.city': 1, 'address.state': 1 });

// Virtual for full address
hotelSchema.virtual('fullAddress').get(function () {
  return `${this.address.street}, ${this.address.city}, ${this.address.state} - ${this.address.pincode}`;
});

hotelSchema.methods.isOperational = function () {
  return this.status === 'active';
};

// ✅ Helper: Calculate delivery charge based on settings + order subtotal
hotelSchema.methods.calcDeliveryCharge = function (subtotal) {
  const s = this.settings;
  if (!s.deliveryEnabled) return 0;
  if (s.deliveryChargeType === 'fixed') return s.deliveryCharge || 0;

  // slab based
  const slab = s.deliverySlabs.find(
    (sl) => subtotal >= sl.minOrder && (sl.maxOrder === null || subtotal <= sl.maxOrder)
  );
  return slab ? slab.charge : 0;
};

// ✅ Helper: Calculate packaging charge based on settings + order type + subtotal
hotelSchema.methods.calcPackagingCharge = function (orderType, subtotal) {
  const s = this.settings;
  if (!s.packagingEnabled) return 0;
  if (!s.packagingApplicableOn.includes(orderType)) return 0;

  if (s.packagingChargeType === 'fixed') return s.packagingCharge || 0;

  // slab based
  const slab = s.packagingSlabs.find(
    (sl) => subtotal >= sl.minOrder && (sl.maxOrder === null || subtotal <= sl.maxOrder)
  );
  return slab ? slab.charge : 0;
};

const Hotel = mongoose.model('Hotel', hotelSchema);

export default Hotel;