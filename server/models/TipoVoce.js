const mongoose = require('mongoose');

// Un Tipo è l'etichetta che raggruppa le Voci patrimoniali (Contanti, Immobili, Mutui…).
// Il Tipo decide la SPECIE della Voce (attivita | debito) e, dentro le Attività, se è
// denaro o bene materiale: da quella scelta dipendono il gruppo della Home (Denaro, Beni,
// Debiti) e i Movimenti ammessi (una Spesa non ha senso su un bene materiale).
// Il catalogo è dell'utente: si crea, rinomina, archivia. Aggiungere «barca» è un dato.

const CATALOGO_INIZIALE = [
  { nome: 'Contanti', specie: 'attivita', denaro: true },
  { nome: 'Conti correnti', specie: 'attivita', denaro: true },
  { nome: 'Investimenti', specie: 'attivita', denaro: true },
  { nome: 'Crediti', specie: 'attivita', denaro: true },
  { nome: 'Immobili', specie: 'attivita', denaro: false },
  { nome: 'Veicoli', specie: 'attivita', denaro: false },
  { nome: 'Beni di valore', specie: 'attivita', denaro: false },
  { nome: 'Carte di credito', specie: 'debito', pianoAmmortamento: false },
  { nome: 'Mutui', specie: 'debito', pianoAmmortamento: true },
  { nome: 'Finanziamenti', specie: 'debito', pianoAmmortamento: true }
];

const tipoVoceSchema = new mongoose.Schema(
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
    specie: {
      type: String,
      enum: ['attivita', 'debito'],
      required: true
    },
    // Solo per specie 'attivita': vero = il Tipo è denaro, falso = bene materiale.
    denaro: {
      type: Boolean,
      default: false
    },
    // Solo per specie 'debito': decide se il Debito ha un piano di ammortamento
    // (mutui e finanziamenti sì, carte di credito no).
    pianoAmmortamento: {
      type: Boolean,
      default: false
    },
    // Vero per i Tipi creati dal catalogo iniziale: si possono rinominare, non cancellare.
    sistema: {
      type: Boolean,
      default: false
    },
    archiviato: {
      type: Boolean,
      default: false
    }
  },
  { timestamps: true }
);

// I due flag non possono contraddire la specie.
tipoVoceSchema.pre('validate', function (next) {
  if (this.specie === 'debito') {
    this.denaro = false;
  } else {
    this.pianoAmmortamento = false;
  }
  next();
});

tipoVoceSchema.index({ userId: 1, nome: 1 }, { unique: true });

const TipoVoce = mongoose.model('TipoVoce', tipoVoceSchema);

TipoVoce.CATALOGO_INIZIALE = CATALOGO_INIZIALE;

module.exports = TipoVoce;
