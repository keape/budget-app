const mongoose = require('mongoose');

const spesaSchema = new mongoose.Schema({
  descrizione: {
    type: String,
    required: false
  },
  importo: {
    type: Number,
    required: true
  },
  categoria: {
    type: String,
    required: true
  },
  data: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Spesa', spesaSchema);
