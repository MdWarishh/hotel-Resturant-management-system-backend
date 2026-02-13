import mongoose from 'mongoose';
import { ORDER_STATUS, PAYMENT_STATUS } from '../../../config/constants.js';

const orderSchema = new mongoose.Schema(
  {
    orderNumber: {
      type: String,
    //   required: true,
      unique: true,
      uppercase: true,
    },
    hotel: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Hotel',
      required: true,
      index: true,
    },
    orderType: {
      type: String,
      enum: ['dine-in', 'room-service', 'takeaway', 'delivery'],
      required: true,
      default: 'dine-in',
      index: true,
    },
    tableNumber: {
      type: String,
      trim: true,
    },
    room: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Room',
      default: null,
    },
    booking: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Booking',
      default: null,
    },
    customer: {
      name: {
        type: String,
        trim: true,
      },
      phone: {
        type: String,
        match: [/^[0-9]{10}$/, 'Please enter a valid 10-digit phone number'],
      },
      email: {
        type: String,
        lowercase: true,
        trim: true,
      },
         address: { type: String, maxlength: 300 },
    },
    items: [
      {
        menuItem: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'MenuItem',
          required: true,
        },
        name: {
          type: String,
          required: true,
        },
        variant: {
          type: String,
          default: null,
        },
        quantity: {
          type: Number,
          required: true,
          min: 1,
        },
        price: {
          type: Number,
          required: true,
          min: 0,
        },
        subtotal: {
          type: Number,
          required: true,
          min: 0,
        },
        specialInstructions: {
          type: String,
          maxlength: 200,
          default: '',
        },
        status: {
          type: String,
          enum: Object.values(ORDER_STATUS),
          default: ORDER_STATUS.PENDING,
        },
      },
    ],
    pricing: {
      subtotal: {
        type: Number,
        required: true,
        min: 0,
      },
      discount: {
        type: Number,
        default: 0,
        min: 0,
      },
      tax: {
        type: Number,
        required: true,
        min: 0,
      },
      total: {
        type: Number,
        required: true,
        min: 0,
      },
    },
    status: {
      type: String,
      enum: Object.values(ORDER_STATUS),
      default: ORDER_STATUS.PENDING,
      index: true,
    },
payment: {
  mode: {
    type: String,
    enum: ['CASH', 'UPI', 'CARD'],
  },
  status: {
    type: String,
    enum: ['PAID', 'UNPAID'],
    default: 'UNPAID',
  },
  paidAt: {
    type: Date,
  },
  paidBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
},
    specialInstructions: {
      type: String,
      maxlength: 500,
      default: '',
    },
    notes: {
      type: String,
      maxlength: 500,
      default: '',
    },
    timestamps: {
      placed: {
        type: Date,
        default: Date.now,
      },
      confirmed: {
        type: Date,
        default: null,
      },
      preparing: {
        type: Date,
        default: null,
      },
      ready: {
        type: Date,
        default: null,
      },
      served: {
        type: Date,
        default: null,
      },
      completed: {
        type: Date,
        default: null,
      },
      cancelled: {
        type: Date,
        default: null,
      },
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    preparedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    servedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    isPublicOrder: {
  type: Boolean,
  default: false,
  index: true,
},
  },
  {
    timestamps: true,
  }
);

// Indexes for common queries
orderSchema.index({ hotel: 1, status: 1 });
orderSchema.index({ hotel: 1, orderType: 1 });
orderSchema.index({ hotel: 1, createdAt: -1 });
orderSchema.index({ booking: 1 });
orderSchema.index({ room: 1 });
orderSchema.index({ hotel: 1, isPublicOrder: 1 }); 

// Generate order number
orderSchema.pre('save', async function () {
  if (!this.orderNumber) {
    const date = new Date();
    const year = date.getFullYear().toString().slice(-2);
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    this.orderNumber = `ORD${year}${month}${day}${random}`;
  }

});

// Method to check if order is active
orderSchema.methods.isActive = function () {
  return ![ORDER_STATUS.SERVED, ORDER_STATUS.CANCELLED].includes(this.status);
};

// Method to calculate total preparation time
orderSchema.methods.estimatedTime = function () {
  if (!this.items || this.items.length === 0) return 0;
  // Return the maximum preparation time among all items
  return Math.max(...this.items.map((item) => item.menuItem?.preparationTime || 15));
};

const Order = mongoose.model('Order', orderSchema);

export default Order;