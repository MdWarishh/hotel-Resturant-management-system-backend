import mongoose from 'mongoose';

const stockTransactionSchema = new mongoose.Schema(
  {
    hotel: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Hotel',
      required: true,
      index: true,
    },
    inventoryItem: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'InventoryItem',
      required: true,
      index: true,
    },
    transactionType: {
      type: String,
      enum: ['purchase', 'usage', 'wastage', 'adjustment', 'return', 'transfer'],
      required: true,
      index: true,
    },
    quantity: {
      type: Number,
      required: true,
    },
    unit: {
      type: String,
      required: true,
    },
    previousStock: {
      type: Number,
      required: true,
      min: 0,
    },
    newStock: {
      type: Number,
      required: true,
      min: 0,
    },
    cost: {
      unitPrice: {
        type: Number,
        default: 0,
        min: 0,
      },
      totalPrice: {
        type: Number,
        default: 0,
        min: 0,
      },
    },
    reference: {
      type: {
        type: String,
        enum: ['order', 'purchase-order', 'manual', 'system'],
        default: 'manual',
      },
      id: {
        type: mongoose.Schema.Types.ObjectId,
        default: null,
      },
      number: {
        type: String,
        default: '',
      },
    },
    supplier: {
      name: {
        type: String,
        default: '',
      },
      invoice: {
        type: String,
        default: '',
      },
    },
    reason: {
      type: String,
      maxlength: 500,
      default: '',
    },
    notes: {
      type: String,
      maxlength: 500,
      default: '',
    },
    performedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for reporting
stockTransactionSchema.index({ hotel: 1, transactionType: 1, createdAt: -1 });
stockTransactionSchema.index({ inventoryItem: 1, createdAt: -1 });

const StockTransaction = mongoose.model('StockTransaction', stockTransactionSchema);

export default StockTransaction;