const mongoose = require('mongoose');

const sheetTransactionSchema = new mongoose.Schema({
  importo: {
    type: Number,
    required: true
  },
  descrizione: {
    type: String,
    default: ''
  },
  categoria: {
    type: String,
    required: true
  },
  tipo: {
    type: String,
    enum: ['entrata', 'uscita'],
    required: true
  },
  data: {
    type: Date,
    default: Date.now
  },
  sheetId: {
    type: String,
    required: true
  },
  processato: {
    type: Boolean,
    default: false
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('SheetTransaction', sheetTransactionSchema); 