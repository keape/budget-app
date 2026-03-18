const mongoose = require('mongoose');

const instrumentAllocationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    savingsMonthId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'SavingsMonth',
      required: true
    },
    instrumentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Instrument',
      required: true
    },
    amount: {
      type: Number,
      required: true
    },
    quantity: {
      type: Number
    },
    priceAtAllocation: {
      type: Number
    }
  },
  { timestamps: true }
);

// Compound index for efficient querying
instrumentAllocationSchema.index({ userId: 1, savingsMonthId: 1 });

module.exports = mongoose.model('InstrumentAllocation', instrumentAllocationSchema);
