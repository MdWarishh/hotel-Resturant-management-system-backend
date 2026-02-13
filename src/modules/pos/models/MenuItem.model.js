import mongoose from 'mongoose';

const menuItemSchema = new mongoose.Schema(
  {
    hotel: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Hotel',
      required: [true, 'Hotel is required'],
      index: true,
    },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'MenuCategory',
      required: [true, 'Category is required'],
      index: true,
    },
    name: {
      type: String,
      required: [true, 'Item name is required'],
      trim: true,
      minlength: [2, 'Item name must be at least 2 characters'],
      maxlength: [100, 'Item name cannot exceed 100 characters'],
    },
    description: {
      type: String,
      maxlength: [500, 'Description cannot exceed 500 characters'],
      default: '',
    },
    price: {
      type: Number,
      required: [true, 'Price is required'],
      min: [0, 'Price cannot be negative'],
    },
    variants: [
      {
        name: {
          type: String,
          required: true,
          trim: true,
        },
        price: {
          type: Number,
          required: true,
          min: 0,
        },
      },
    ],
    type: {
      type: String,
      enum: ['veg', 'non-veg', 'vegan', 'beverage'],
      default: 'veg',
      index: true,
    },
    cuisine: {
      type: String,
      enum: ['indian', 'chinese', 'continental', 'italian', 'mexican', 'thai', 'other'],
      default: 'indian',
    },
    spicyLevel: {
      type: String,
      enum: ['none', 'mild', 'medium', 'hot', 'extra-hot'],
      default: 'none',
    },
    preparationTime: {
      type: Number, // in minutes
      default: 15,
      min: 0,
    },
    tags: [
      {
        type: String,
        trim: true,
      },
    ],
    images: [
      {
        type: String,
        default: '',
      },
    ],
    isAvailable: {
      type: Boolean,
      default: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    displayOrder: {
      type: Number,
      default: 0,
      min: 0,
    },
    veg: {
    type: Boolean,
    default: true, // Veg/non-veg flag
  },
    ingredients: [
      {
        inventoryItem: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'InventoryItem',
        },
        quantity: {
          type: Number,
          required: true,
          min: 0,
        },
        unit: {
          type: String,
          required: true,
        },
      },
    ],
    nutritionalInfo: {
      calories: Number,
      protein: Number,
      carbs: Number,
      fat: Number,
    },
    allergens: [
      {
        type: String,
        trim: true,
      },
    ],
    totalOrders: {
      type: Number,
      default: 0,
      min: 0,
    },
    rating: {
      average: {
        type: Number,
        default: 0,
        min: 0,
        max: 5,
      },
      count: {
        type: Number,
        default: 0,
        min: 0,
      },
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
menuItemSchema.index({ hotel: 1, category: 1 });
menuItemSchema.index({ hotel: 1, isAvailable: 1, isActive: 1 });
menuItemSchema.index({ hotel: 1, type: 1 });
menuItemSchema.index({ name: 'text', description: 'text' });

// Method to check if item is orderable
menuItemSchema.methods.canOrder = function () {
  return this.isAvailable && this.isActive;
};

// Method to get price (including variant)
menuItemSchema.methods.getPrice = function (variantName = null) {
  if (variantName && this.variants.length > 0) {
    const variant = this.variants.find((v) => v.name === variantName);
    return variant ? variant.price : this.price;
  }
  return this.price;
};

const MenuItem = mongoose.model('MenuItem', menuItemSchema);

export default MenuItem;