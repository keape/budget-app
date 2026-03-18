const mongoose = require('mongoose');

const entrataSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
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

// Index per performance nelle query per utente
entrataSchema.index({ userId: 1, data: -1 });

module.exports = mongoose.model('Entrata', entrataSchema); 