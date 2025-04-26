const mongoose = require('mongoose');

const budgetSettingsSchema = new mongoose.Schema({
  anno: {
    type: Number,
    required: true
  },
  mese: {
    type: Number, 
    // Mese is no longer strictly required, can be null for yearly.
    // Removed min/max constraints to allow null.
    required: false, 
    // Use null instead of undefined for querying yearly settings.
    // Using `null` as the default helps clarify intent.
    default: null 
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
  },
  user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
  }
}, {
  timestamps: true
});

// Index to quickly find settings by user, year, and month (including null month for yearly)
// Ensure a user can have only one setting per year/month combination
// and only one yearly setting per year.

budgetSettingsSchema.index({ user: 1, anno: 1, mese: 1 }, { 
  unique: true, 
  // Partial filter to enforce uniqueness only when 'mese' is a number (0-11).
  // Allows multiple users to have settings for the same period.
  // Allows a single user to have both monthly and yearly settings.
  partialFilterExpression: { mese: { $type: 'number' } } 
});

budgetSettingsSchema.index({ user: 1, anno: 1, mese: null }, { 
  unique: true, 
  // Partial filter to enforce uniqueness for yearly settings (mese is null).
  // Allows only one yearly setting per user per year.
  partialFilterExpression: { mese: null } 
});


// Ensure the combination of user and year/month is unique
// budgetSettingsSchema.index({ user: 1, anno: 1, mese: 1 }, { unique: true });

module.exports = mongoose.model('BudgetSettings', budgetSettingsSchema);
