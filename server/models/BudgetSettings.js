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
    default: new Map()
  },
  entrate: {
    type: Map,
    of: Number,
    default: new Map()
  }
}, {
  timestamps: true
});

// Indice composto per anno e mese
budgetSettingsSchema.index({ anno: 1, mese: 1 }, { unique: true });

module.exports = mongoose.model('BudgetSettings', budgetSettingsSchema); 