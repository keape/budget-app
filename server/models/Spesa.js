const mongoose = require('mongoose');

const spesaSchema = new mongoose.Schema({
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
  // La Voce patrimoniale su cui la Spesa è registrata (il conto). Obbligatoria a livello
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
  },
  // Presente solo sui Movimenti generati dal pagamento di una rata di un Debito
  // (la Spesa degli interessi e il Trasferimento della quota capitale portano lo stesso
  // `rataId`): serve a riconoscerli, a raggrupparli nella scheda del Debito e ad
  // annullare la rata intera in un colpo solo.
  rataId: {
    type: mongoose.Schema.Types.ObjectId
  },
  // Il Debito a cui la rata appartiene. La Spesa degli interessi è registrata sul conto che
  // paga, non sul Debito: senza questo campo la rata di un Debito non si ritroverebbe
  // partendo dal Debito.
  rataDebitoId: {
    type: mongoose.Schema.Types.ObjectId
  }
},
// I timbri mancavano solo a Spesa ed Entrata: Trasferimento, Rettifica, Attività, Debito e
// Componente li hanno già. Senza, una modifica a un Movimento non lascia traccia di quando
// è avvenuta, e non si può ricostruire che cosa è cambiato dopo. Non coprono le scritture
// fatte con il driver grezzo (scripts) né le cancellazioni, che non lasciano traccia.
{ timestamps: true }
);

// Index per performance nelle query per utente
spesaSchema.index({ userId: 1, data: -1 });
spesaSchema.index({ userId: 1, componenteId: 1 });
spesaSchema.index({ userId: 1, rataId: 1 });
spesaSchema.index({ userId: 1, rataDebitoId: 1 });

module.exports = mongoose.model('Spesa', spesaSchema);
