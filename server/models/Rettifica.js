const mongoose = require('mongoose');

// Una Rettifica cambia il valore di UNA sola Voce, senza controparte: una rivalutazione,
// un interesse addebitato, la correzione di una stima, il saldo vero del conto corrente.
// Non è una Spesa né un'Entrata e NON entra nel budget.
//
// L'importo è un delta con segno: positivo se il valore sale, negativo se scende.

const rettificaSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    voceSpecie: {
      type: String,
      enum: ['attivita', 'debito'],
      default: 'attivita',
      required: true
    },
    voceId: { type: mongoose.Schema.Types.ObjectId, required: true },
    componenteId: { type: mongoose.Schema.Types.ObjectId, required: true },
    importo: { type: Number, required: true },
    data: { type: Date, default: Date.now },
    descrizione: { type: String, default: '' },
    origine: {
      type: String,
      enum: ['utente', 'sistema'],
      default: 'utente'
    }
  },
  { timestamps: true }
);

rettificaSchema.index({ userId: 1, data: -1 });
rettificaSchema.index({ componenteId: 1 });

module.exports = mongoose.model('Rettifica', rettificaSchema);
