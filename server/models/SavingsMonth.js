const mongoose = require('mongoose');

const savingsMonthSchema = new mongoose.Schema(
  {
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  anno: {
    type: Number,
    required: true
  },
  mese: {
    type: Number,
    required: true
  },
  income: {
    type: Number,
    required: true
  },
  expenses: {
    type: Number,
    required: true
  },
  savings: {
    type: Number,
    required: true
  },
  status: {
    type: String,
    enum: ['open', 'closed'],
    default: 'open'
  },
  closedAt: {
    type: Date
  }
  },
  { timestamps: true }
);

// Compound index without unique constraint
savingsMonthSchema.index({ userId: 1, anno: 1, mese: 1 });

module.exports = mongoose.model('SavingsMonth', savingsMonthSchema);
