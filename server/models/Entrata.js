const mongoose = require('mongoose');

const entrataSchema = new mongoose.Schema({
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

// Middleware pre-save per assicurarsi che l'importo sia sempre positivo
entrataSchema.pre('save', function(next) {
  if (this.importo < 0) {
    this.importo = Math.abs(this.importo);
  }
  next();
});

module.exports = mongoose.model('Entrata', entrataSchema); 