import mongoose from 'mongoose';
import { INVOICE_STATUS, PAYMENT_STATUS, PAYMENT_METHODS } from '../../../config/constants.js';

const invoiceSchema = new mongoose.Schema(
  {
    invoiceNumber: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
    },
    hotel: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Hotel',
      required: true,
      index: true,
    },
    booking: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Booking',
      required: true,
      index: true,
    },
    guest: {
      name: {
        type: String,
        required: true,
        trim: true,
      },
      email: {
        type: String,
        lowercase: true,
        trim: true,
      },
      phone: {
        type: String,
        required: true,
      },
      address: {
        street: String,
        city: String,
        state: String,
        pincode: String,
      },
      gstNumber: {
        type: String,
        uppercase: true,
        trim: true,
        default: null,
      },
    },
    lineItems: [
      {
        type: {
          type: String,
          enum: ['room', 'food', 'service', 'other'],
          required: true,
        },
        description: {
          type: String,
          required: true,
        },
        reference: {
          type: mongoose.Schema.Types.ObjectId,
          refPath: 'lineItems.referenceModel',
        },
        referenceModel: {
          type: String,
          enum: ['Booking', 'Order'],
        },
        quantity: {
          type: Number,
          required: true,
          min: 0,
        },
        unit: {
          type: String,
          default: 'unit',
        },
        rate: {
          type: Number,
          required: true,
          min: 0,
        },
        amount: {
          type: Number,
          required: true,
          min: 0,
        },
      },
    ],
    charges: {
      roomCharges: {
        type: Number,
        default: 0,
        min: 0,
      },
      foodCharges: {
        type: Number,
        default: 0,
        min: 0,
      },
      serviceCharges: {
        type: Number,
        default: 0,
        min: 0,
      },
      otherCharges: {
        type: Number,
        default: 0,
        min: 0,
      },
    },
    pricing: {
      subtotal: {
        type: Number,
        required: true,
        min: 0,
      },
      discount: {
        amount: {
          type: Number,
          default: 0,
          min: 0,
        },
        reason: {
          type: String,
          default: '',
        },
      },
      taxableAmount: {
        type: Number,
        required: true,
        min: 0,
      },
      tax: {
        cgst: {
          rate: {
            type: Number,
            default: 2.5,
          },
          amount: {
            type: Number,
            default: 0,
          },
        },
        sgst: {
          rate: {
            type: Number,
            default: 2.5,
          },
          amount: {
            type: Number,
            default: 0,
          },
        },
        total: {
          type: Number,
          required: true,
          min: 0,
        },
      },
      roundOff: {
        type: Number,
        default: 0,
      },
      total: {
        type: Number,
        required: true,
        min: 0,
      },
    },
    payments: [
      {
        amount: {
          type: Number,
          required: true,
          min: 0,
        },
        method: {
          type: String,
          enum: Object.values(PAYMENT_METHODS),
          required: true,
        },
        reference: {
          type: String,
          default: '',
        },
        paidAt: {
          type: Date,
          default: Date.now,
        },
        receivedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
          required: true,
        },
      },
    ],
    status: {
      type: String,
      enum: Object.values(INVOICE_STATUS),
      default: INVOICE_STATUS.DRAFT,
      index: true,
    },
    paymentStatus: {
      type: String,
      enum: Object.values(PAYMENT_STATUS),
      default: PAYMENT_STATUS.PENDING,
      index: true,
    },
    paidAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    balanceAmount: {
      type: Number,
      default: 0,
    },
    dates: {
      generated: {
        type: Date,
        default: null,
      },
      due: {
        type: Date,
        default: null,
      },
      paid: {
        type: Date,
        default: null,
      },
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
invoiceSchema.index({ hotel: 1, status: 1 });
invoiceSchema.index({ hotel: 1, paymentStatus: 1 });
invoiceSchema.index({ hotel: 1, createdAt: -1 });
invoiceSchema.index({ 'guest.phone': 1 });

// Generate invoice number
invoiceSchema.pre('save', async function (next) {
  if (!this.invoiceNumber) {
    const date = new Date();
    const year = date.getFullYear().toString().slice(-2);
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    this.invoiceNumber = `INV${year}${month}${random}`;
  }
  next();
});

// Update balance amount before saving
invoiceSchema.pre('save', function (next) {
  this.balanceAmount = this.pricing.total - this.paidAmount;
  next();
});

// Method to check if fully paid
invoiceSchema.methods.isFullyPaid = function () {
  return this.paidAmount >= this.pricing.total;
};

// Method to add payment
invoiceSchema.methods.addPayment = function (amount, method, reference, receivedBy) {
  this.payments.push({
    amount,
    method,
    reference,
    receivedBy,
    paidAt: new Date(),
  });

  this.paidAmount += amount;

  // Update payment status
  if (this.paidAmount >= this.pricing.total) {
    this.paymentStatus = PAYMENT_STATUS.PAID;
    this.dates.paid = new Date();
  } else if (this.paidAmount > 0) {
    this.paymentStatus = PAYMENT_STATUS.PARTIALLY_PAID;
  }

  return this;
};

const Invoice = mongoose.model('Invoice', invoiceSchema);

export default Invoice;