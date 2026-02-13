// backend/src/modules/pos/models/Feedback.model.js

import mongoose from 'mongoose';

const feedbackSchema = new mongoose.Schema(
  {
    hotel: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Hotel',
      required: true,
      index: true,
    },
    menuItem: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'MenuItem',
      required: true,
      index: true,
    },
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      default: null,
    },
    customer: {
      name: {
        type: String,
        required: true,
        trim: true,
      },
      phone: {
        type: String,
        required: true,
      },
    },
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },
    comment: {
      type: String,
      maxlength: 500,
      default: '',
      trim: true,
    },
    isApproved: {
      type: Boolean,
      default: true, // Auto-approve for now
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
feedbackSchema.index({ hotel: 1, menuItem: 1 });
feedbackSchema.index({ hotel: 1, isApproved: 1 });
feedbackSchema.index({ menuItem: 1, isApproved: 1 });

// Calculate average rating for a menu item
feedbackSchema.statics.getAverageRating = async function (menuItemId) {
  const result = await this.aggregate([
    {
      $match: {
        menuItem: new mongoose.Types.ObjectId(menuItemId),
        isApproved: true,
      },
    },
    {
      $group: {
        _id: null,
        averageRating: { $avg: '$rating' },
        totalReviews: { $sum: 1 },
      },
    },
  ]);

  if (result.length > 0) {
    return {
      averageRating: Math.round(result[0].averageRating * 10) / 10, // Round to 1 decimal
      totalReviews: result[0].totalReviews,
    };
  }

  return {
    averageRating: 0,
    totalReviews: 0,
  };
};

const Feedback = mongoose.model('Feedback', feedbackSchema);

export default Feedback;