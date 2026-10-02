const mongoose = require('mongoose');

// Una Componente è una delle parti di una Voce patrimoniale: il valore della Voce è la
// somma delle sue Componenti (i singoli pezzi di un conto Gioielli, i titoli e la liquidità
// di un conto investimenti). La modalità di valorizzazione appartiene alla Componente, non
// alla Voce (ADR-0002): nello stesso conto investimenti convivono titoli a mercato e
// liquidità a movimenti.
//
//   movimenti  — vale la somma dei suoi Movimenti (la liquidità di un Conto)
//   mercato    — vale il prezzo corrente, che cambia senza intervento dell'utente (un titolo)
//   dichiarata — vale il valore indicato dall'utente, valido finché non lo aggiorna
//                (un immobile, un gioiello)
//
// Costo di acquisto e Valutazione restano distinti: il primo dice quanto è costata, la
// seconda quanto vale; alla vendita (Realizzo) servono entrambi.

const valutazioneSchema = new mongoose.Schema(
  {
    valore: { type: Number, required: true },
    data: { type: Date, default: Date.now },
    nota: { type: String, default: '' }
  },
  { _id: false }
);

const componenteSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    // La Voce a cui appartiene. Due collezioni di Voci (Attività e Debito) richiedono
    // il discriminatore: è un riferimento, non una classificazione.
    voceSpecie: {
      type: String,
      enum: ['attivita', 'debito'],
      default: 'attivita',
      required: true
    },
    voceId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true
    },
    nome: {
      type: String,
      required: true,
      trim: true
    },
    valorizzazione: {
      type: String,
      enum: ['movimenti', 'mercato', 'dichiarata'],
      default: 'movimenti',
      required: true
    },
    // Vero per la Componente che riceve i Movimenti della Voce: l'app la risolve da sé
    // quando l'utente sceglie il conto e non il singolo pezzo.
    predefinita: {
      type: Boolean,
      default: false
    },
    costoAcquisto: { type: Number },
    dataCosto: { type: Date },
    valutazione: { type: Number },
    dataValutazione: { type: Date },
    valutazioni: { type: [valutazioneSchema], default: [] },
    documento: { type: String, default: '' },
    chiusa: { type: Boolean, default: false },
    dataChiusura: { type: Date },
    // Prezzo effettivamente incassato alla vendita: può differire dall'ultima Valutazione.
    realizzo: { type: Number }
  },
  { timestamps: true }
);

componenteSchema.index({ voceSpecie: 1, voceId: 1 });

module.exports = mongoose.model('Componente', componenteSchema);
