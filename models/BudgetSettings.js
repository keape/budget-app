const mongoose = require('mongoose');

const budgetSettingsSchema = new mongoose.Schema({
  anno: {
    type: Number,
    required: true
  },
  mese: {
    type: Number,
    required: true,
    min: 0,
    max: 11
  },
  spese: {
    type: Map,
    of: Number,
    default: {}
  },
  entrate: {
    type: Map,
    of: Number,
    default: {}
  }
}, {
  timestamps: true
});

// Indice composto per anno e mese
budgetSettingsSchema.index({ anno: 1, mese: 1 }, { unique: true });

const BudgetSettings = mongoose.model('BudgetSettings', budgetSettingsSchema);

module.exports = BudgetSettings; 