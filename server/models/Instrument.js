const mongoose = require('mongoose');

const instrumentSchema = new mongoose.Schema({
  ticker: {
    type: String,
    required: true,
    unique: true
  },
  name: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: ['azioni', 'obbligazioni', 'etf_fondi', 'conto_corrente', 'altro'],
    default: 'altro'
  },
  currency: {
    type: String
  },
  exchange: {
    type: String
  },
  country: {
    type: String
  },
  lastPrice: {
    type: Number
  },
  lastUpdated: {
    type: Date
  }
});

// Pre-save hook to normalize ticker to uppercase
instrumentSchema.pre('save', function(next) {
  if (this.ticker) {
    this.ticker = this.ticker.toUpperCase();
  }
  next();
});

// Index on ticker (unique constraint already handled by field unique: true)
instrumentSchema.index({ ticker: 1 });

module.exports = mongoose.model('Instrument', instrumentSchema);
