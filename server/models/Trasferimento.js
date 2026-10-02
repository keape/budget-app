const mongoose = require('mongoose');

// Un Trasferimento sposta valore tra due Voci patrimoniali (compro un gioiello, pago la
// carta, finanzi il broker, ricevo l'erogazione di un mutuo). Non è una Spesa né
// un'Entrata e NON entra nel budget: senza di esso il valore spostato risulterebbe in
// entrambe le Voci e gonfierebbe il Patrimonio.
//
// Ogni estremo nomina Voce e Componente: la Voce è ciò che l'utente sceglie, la
// Componente è il pezzo che riceve o perde il valore.

const estremoSchema = new mongoose.Schema(
  {
    voceSpecie: {
      type: String,
      enum: ['attivita', 'debito'],
      default: 'attivita',
      required: true
    },
    voceId: { type: mongoose.Schema.Types.ObjectId, required: true },
    componenteId: { type: mongoose.Schema.Types.ObjectId, required: true }
  },
  { _id: false }
);

const trasferimentoSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    da: { type: estremoSchema, required: true },
    a: { type: estremoSchema, required: true },
    // Sempre positivo: la direzione la dà la coppia da → a.
    importo: { type: Number, required: true, min: 0 },
    data: { type: Date, default: Date.now },
    descrizione: { type: String, default: '' },
    // I Trasferimenti generati dal sistema (rate di un Debito, assegnazione del risparmio)
    // devono restare riconoscibili come tali.
    origine: {
      type: String,
      enum: ['utente', 'sistema'],
      default: 'utente'
    },
    // Presente solo sulla quota capitale di una rata di un Debito, con lo stesso valore
    // della Spesa degli interessi della stessa rata: è l'identificativo della rata.
    rataId: {
      type: mongoose.Schema.Types.ObjectId
    },
    // Il Debito a cui la rata appartiene (vedi models/Spesa.js).
    rataDebitoId: {
      type: mongoose.Schema.Types.ObjectId
    }
  },
  { timestamps: true }
);

trasferimentoSchema.index({ userId: 1, data: -1 });
trasferimentoSchema.index({ 'da.componenteId': 1 });
trasferimentoSchema.index({ 'a.componenteId': 1 });
trasferimentoSchema.index({ userId: 1, rataId: 1 });
trasferimentoSchema.index({ userId: 1, rataDebitoId: 1 });

module.exports = mongoose.model('Trasferimento', trasferimentoSchema);
