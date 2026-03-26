const mongoose = require('mongoose');

const instrumentSchema = new mongoose.Schema({
  ticker: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    uppercase: true
  },
  name: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: ['azioni', 'obbligazioni', 'etf_fondi', 'conto_corrente', 'altro'],
    default: 'altro',
    required: true
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
  },
  priceUpdatedAt: {
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

module.exports = mongoose.model('Instrument', instrumentSchema);
