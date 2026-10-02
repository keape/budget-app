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
  },
  // La Voce patrimoniale su cui l'Entrata è registrata (il conto). Obbligatoria a livello
  // applicativo: le rotte la risolvono da sé quando il client non la manda (Conto principale).
  voceSpecie: {
    type: String,
    enum: ['attivita', 'debito'],
    default: 'attivita'
  },
  voceId: {
    type: mongoose.Schema.Types.ObjectId
  },
  // La Componente che riceve il Movimento (la liquidità del conto): risolta dalla Voce.
  componenteId: {
    type: mongoose.Schema.Types.ObjectId
  }
},
// I timbri mancavano solo a Entrata e Spesa: Trasferimento, Rettifica, Attività, Debito e
// Componente li hanno già. Senza, una modifica a un Movimento non lascia traccia di quando
// è avvenuta, e non si può ricostruire che cosa è cambiato dopo. Non coprono le scritture
// fatte con il driver grezzo (scripts) né le cancellazioni, che non lasciano traccia.
{ timestamps: true }
);

// Index per performance nelle query per utente
entrataSchema.index({ userId: 1, data: -1 });
entrataSchema.index({ userId: 1, componenteId: 1 });

module.exports = mongoose.model('Entrata', entrataSchema); 