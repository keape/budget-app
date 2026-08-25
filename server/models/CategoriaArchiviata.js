const mongoose = require('mongoose');

const categoriaArchiviataSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: 'User'
  },
  tipo: {
    type: String,
    required: true,
    enum: ['spese', 'entrate']
  },
  categoria: {
    type: String,
    required: true
  }
}, {
  timestamps: true
});

categoriaArchiviataSchema.index({ userId: 1, tipo: 1, categoria: 1 }, { unique: true });

module.exports = mongoose.model('CategoriaArchiviata', categoriaArchiviataSchema);
