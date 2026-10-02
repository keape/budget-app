const mongoose = require('mongoose');

// La Fotografia mensile è il valore del Patrimonio registrato alla chiusura di un mese:
// il grafico dell'andamento si costruisce da queste, perché il passato non è ricostruibile
// (i prezzi salvati sono solo quelli attuali).
//
// La Fotografia del mese in corso è PROVVISORIA: viene riscritta ogni volta che il
// Patrimonio viene ricalcolato, e diventa definitiva (chiusa) quando il mese successivo
// la sostituisce. `mese` è 0-indexato come ovunque nell'app (0 = gennaio).

const voceFotografataSchema = new mongoose.Schema(
  {
    voceId: { type: mongoose.Schema.Types.ObjectId, required: true },
    voceSpecie: {
      type: String,
      enum: ['attivita', 'debito'],
      default: 'attivita'
    },
    nome: { type: String, default: '' },
    tipo: { type: String, default: '' },
    gruppo: {
      type: String,
      enum: ['denaro', 'beni', 'debiti'],
      default: 'denaro'
    },
    valore: { type: Number, default: 0 }
  },
  { _id: false }
);

const fotografiaSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    anno: { type: Number, required: true },
    mese: { type: Number, required: true, min: 0, max: 11 },
    data: { type: Date, default: Date.now },
    patrimonio: { type: Number, default: 0 },
    attivita: { type: Number, default: 0 },
    debiti: { type: Number, default: 0 },
    voci: { type: [voceFotografataSchema], default: [] },
    // Provvisoria (mese in corso) finché un mese successivo non la congela.
    chiusa: { type: Boolean, default: false }
  },
  { timestamps: true }
);

fotografiaSchema.index({ userId: 1, anno: 1, mese: 1 }, { unique: true });

module.exports = mongoose.model('Fotografia', fotografiaSchema);
