const mongoose = require('mongoose');

// Un'Attività è una Voce patrimoniale che somma al Patrimonio: denaro, titoli, immobili,
// veicoli, beni di valore, crediti. Il segno positivo NON è un campo: deriva dall'entità
// (il Debito è un'altra collezione, vedi ADR-0005). Il Tipo dice se è denaro o bene.
// Il valore dell'Attività è la somma delle sue Componenti (ADR-0002).

const attivitaSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    nome: {
      type: String,
      required: true,
      trim: true
    },
    tipoId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'TipoVoce',
      required: true
    },
    note: {
      type: String,
      default: ''
    },
    archiviata: {
      type: Boolean,
      default: false
    }
  },
  { timestamps: true }
);

attivitaSchema.index({ userId: 1, archiviata: 1 });

module.exports = mongoose.model('Attivita', attivitaSchema);
