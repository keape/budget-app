const mongoose = require('mongoose');

// Un Debito è una Voce patrimoniale che SOTTRAE dal Patrimonio: un mutuo, un
// finanziamento, il saldo di una carta di credito. È la seconda specie di Voce
// (ADR-0005) e vive in una collezione sua (ADR-0006), speculare ad Attivita.
//
// IL RESIDUO NON È UN CAMPO. È il valore della Componente del Debito, cioè i suoi
// Movimenti, com'è per ogni Voce (ADR-0002). L'unica regola da ricordare è il segno:
// **il residuo è l'opposto della somma dei Movimenti della Componente**. Detto
// dall'altro lato: quello che entra nel Debito lo abbassa, quello che ne esce lo alza.
//
//   Trasferimento conto → Debito   la quota capitale della rata: il residuo scende
//   Trasferimento Debito → conto   l'erogazione di un mutuo: il residuo sale
//   Spesa registrata sul Debito   un acquisto fatto con la carta: il residuo sale
//   Entrata registrata sul Debito un rimborso ricevuto sulla carta: il residuo scende
//   Rettifica                      la correzione del residuo (positiva se il residuo scende)
//
// Il motore applica questo segno in un punto solo (`services/patrimonio.js`) e la scheda
// del Debito mostra sempre l'effetto sul residuo, così l'utente non vede mai il segno
// interno. Le collezioni dei Movimenti restano fedeli alle loro regole: una Spesa è
// negativa anche quando è registrata su una carta di credito.
//
// Del PIANO solo tre dati sono indispensabili: l'importo (il residuo di oggi), la rata e
// la scadenza. Il tasso, se l'utente non lo sa, si ricava da questi; le rate residue sono
// i mesi che mancano alla scadenza (`services/debiti.js`). Un Tipo senza piano di
// ammortamento (una carta di credito) ha solo il residuo e si muove con i Movimenti.

const debitoSchema = new mongoose.Schema(
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
    },
    // --- Piano di ammortamento (facoltativo: una carta di credito non ce l'ha) ---
    // L'importo della rata mensile.
    rata: {
      type: Number,
      min: 0
    },
    // La data dell'ULTIMA rata: da qui si contano le rate residue.
    scadenza: {
      type: Date
    },
    // Tasso annuo nominale in percentuale (2.75 = 2,75%). Se l'utente non lo conosce si
    // ricava da residuo, rata e rate residue: in quel caso `tassoRicavato` è vero.
    tasso: {
      type: Number,
      min: 0
    },
    tassoRicavato: {
      type: Boolean,
      default: false
    },
    // Il giorno del mese in cui cade la rata (1-31). Si ricava dalla scadenza.
    giornoRata: {
      type: Number,
      min: 1,
      max: 31
    },
    // La categoria con cui si registra la Spesa della quota interessi (es. "Mutuo").
    categoriaRata: {
      type: String,
      default: ''
    }
  },
  { timestamps: true }
);

debitoSchema.index({ userId: 1, archiviata: 1 });

// Il giorno della rata non può contraddire la scadenza: se c'è una scadenza, il giorno
// viene da lì. Lo tiene allineato il modello, non chi scrive.
debitoSchema.pre('validate', function (next) {
  if (this.scadenza && !this.giornoRata) {
    const giorno = new Date(this.scadenza);
    this.giornoRata = Math.min(Math.max(giorno.getUTCDate(), 1), 31);
  }
  next();
});

module.exports = mongoose.model('Debito', debitoSchema);
