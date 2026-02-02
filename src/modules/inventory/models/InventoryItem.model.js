import mongoose from 'mongoose';
import { INVENTORY_CATEGORIES, STOCK_LEVELS } from '../../../config/constants.js';

const inventoryItemSchema = new mongoose.Schema(
  {
    hotel: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Hotel',
      required: [true, 'Hotel is required'],
      index: true,
    },
    name: {
      type: String,
      required: [true, 'Item name is required'],
      trim: true,
      minlength: [2, 'Item name must be at least 2 characters'],
      maxlength: [100, 'Item name cannot exceed 100 characters'],
    },
    category: {
      type: String,
      enum: Object.values(INVENTORY_CATEGORIES),
      required: true,
      index: true,
    },
    sku: {
      type: String,
      uppercase: true,
      trim: true,
      unique: true,
      sparse: true,
    },
    description: {
      type: String,
      maxlength: [500, 'Description cannot exceed 500 characters'],
      default: '',
    },
    unit: {
      type: String,
      required: [true, 'Unit is required'],
      enum: ['kg', 'g', 'l', 'ml', 'pcs', 'box', 'packet', 'bottle', 'can'],
      default: 'kg',
    },
    quantity: {
      current: {
        type: Number,
        required: true,
        default: 0,
        min: 0,
      },
      minimum: {
        type: Number,
        required: true,
        default: STOCK_LEVELS.LOW,
        min: 0,
      },
      maximum: {
        type: Number,
        default: null,
        min: 0,
      },
    },
    pricing: {
      purchasePrice: {
        type: Number,
        required: [true, 'Purchase price is required'],
        min: 0,
      },
      sellingPrice: {
        type: Number,
        default: null,
        min: 0,
      },
      currency: {
        type: String,
        default: 'INR',
      },
    },
    supplier: {
      name: {
        type: String,
        trim: true,
        default: '',
      },
      contact: {
        type: String,
        default: '',
      },
      email: {
        type: String,
        lowercase: true,
        trim: true,
        default: '',
      },
    },
    storage: {
      location: {
        type: String,
        trim: true,
        default: '',
      },
      conditions: {
        type: String,
        enum: ['room-temp', 'refrigerated', 'frozen', 'dry', 'cool'],
        default: 'room-temp',
      },
    },
    expiryTracking: {
      enabled: {
        type: Boolean,
        default: false,
      },
      expiryDate: {
        type: Date,
        default: null,
      },
      shelfLife: {
        type: Number, // in days
        default: null,
      },
    },
    reorderPoint: {
      type: Number,
      default: STOCK_LEVELS.LOW,
      min: 0,
    },
    lastRestocked: {
      type: Date,
      default: null,
    },
    lastUsed: {
      type: Date,
      default: null,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    notes: {
      type: String,
      maxlength: 500,
      default: '',
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

// Indexes for common queries
inventoryItemSchema.index({ hotel: 1, category: 1 });
inventoryItemSchema.index({ hotel: 1, 'quantity.current': 1 });
inventoryItemSchema.index({ name: 'text', description: 'text' });

// Virtual for stock status
inventoryItemSchema.virtual('stockStatus').get(function () {
  if (this.quantity.current === 0) {
    return 'out-of-stock';
  } else if (this.quantity.current <= STOCK_LEVELS.CRITICAL) {
    return 'critical';
  } else if (this.quantity.current <= this.quantity.minimum) {
    return 'low';
  } else if (this.quantity.maximum && this.quantity.current >= this.quantity.maximum) {
    return 'overstocked';
  }
  return 'in-stock';
});

// Virtual for expiry status
inventoryItemSchema.virtual('expiryStatus').get(function () {
  if (!this.expiryTracking.enabled || !this.expiryTracking.expiryDate) {
    return null;
  }

  const now = new Date();
  const expiry = new Date(this.expiryTracking.expiryDate);
  const daysToExpiry = Math.ceil((expiry - now) / (1000 * 60 * 60 * 24));

  if (daysToExpiry < 0) {
    return 'expired';
  } else if (daysToExpiry <= 7) {
    return 'expiring-soon';
  }
  return 'fresh';
});

// Method to check if reorder needed
inventoryItemSchema.methods.needsReorder = function () {
  return this.quantity.current <= this.reorderPoint;
};

// Method to update stock
inventoryItemSchema.methods.updateStock = function (quantity, type = 'add') {
  if (type === 'add') {
    this.quantity.current += quantity;
    this.lastRestocked = new Date();
  } else if (type === 'deduct') {
    this.quantity.current = Math.max(0, this.quantity.current - quantity);
    this.lastUsed = new Date();
  }
  return this.quantity.current;
};

const InventoryItem = mongoose.model('InventoryItem', inventoryItemSchema);

export default InventoryItem;