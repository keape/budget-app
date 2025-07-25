const mongoose = require('mongoose');

const budgetSettingsSchema = new mongoose.Schema({
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
    required: false, 
    min: 0,  // Ripristinato a 0-11 per compatibilità JS
    max: 11, // Ripristinato a 0-11 per compatibilità JS
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
  }
}, {
  timestamps: true
});

// Index con userId per user isolation e performance
budgetSettingsSchema.index({ userId: 1, anno: 1, mese: 1 }, { 
  unique: true
});

module.exports = mongoose.model('BudgetSettings', budgetSettingsSchema);
