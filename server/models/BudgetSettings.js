const mongoose = require('mongoose');

const budgetSettingsSchema = new mongoose.Schema({
  anno: {
    type: Number,
    required: true
  },
  mese: {
    type: Number,
    required: true,
    min: 1,
    max: 12
  },
  budgetSpese: {
    type: Map,
    of: Number,
    required: true
  },
  budgetEntrate: {
    type: Map,
    of: Number,
    required: true
  }
}, {
  timestamps: true
});

// Indice composto per anno e mese
budgetSettingsSchema.index({ anno: 1, mese: 1 }, { unique: true });

module.exports = mongoose.model('BudgetSettings', budgetSettingsSchema); 