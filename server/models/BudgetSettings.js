const mongoose = require('mongoose');

const budgetSettingsSchema = new mongoose.Schema({
  anno: {
    type: Number,
    required: true
  },
  mese: {
    type: Number, 
    // Mese is no longer strictly required, can be null for yearly
    required: false, 
    min: 0,
    max: 11,
    // Use null instead of undefined for querying yearly settings
    default: undefined 
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

// Index to quickly find settings by year and month (including null month for yearly)
// Allow multiple documents for the same year if month is specified,
// but only one document per year where month is null.
budgetSettingsSchema.index({ anno: 1, mese: 1 }, { 
  unique: true, 
  partialFilterExpression: { mese: { $type: 'number' } } // Unique constraint only for monthly settings
});
budgetSettingsSchema.index({ anno: 1, mese: null }, { 
  unique: true, 
  partialFilterExpression: { mese: null } // Unique constraint for yearly settings
});

module.exports = mongoose.model('BudgetSettings', budgetSettingsSchema);
