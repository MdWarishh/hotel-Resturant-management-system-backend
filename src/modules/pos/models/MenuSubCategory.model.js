import mongoose from 'mongoose';

const menuSubCategorySchema = new mongoose.Schema(
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
      required: [true, 'Parent category is required'],
      index: true,
    },
    name: {
      type: String,
      required: [true, 'Sub-category name is required'],
      trim: true,
      minlength: [2, 'Sub-category name must be at least 2 characters'],
      maxlength: [50, 'Sub-category name cannot exceed 50 characters'],
    },
    description: {
      type: String,
      maxlength: [200, 'Description cannot exceed 200 characters'],
      default: '',
    },
    displayOrder: {
      type: Number,
      default: 0,
      min: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    image: {
      type: String,
      default: null,
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

// Compound index for unique sub-category names within a category
menuSubCategorySchema.index({ category: 1, name: 1 }, { unique: true });

// Index for sorting
menuSubCategorySchema.index({ hotel: 1, category: 1, displayOrder: 1 });

const MenuSubCategory = mongoose.model('MenuSubCategory', menuSubCategorySchema);

export default MenuSubCategory;