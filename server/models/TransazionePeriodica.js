const mongoose = require('mongoose');

const transazionePeriodicaSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: 'User'
  },
  
  // Dati della transazione
  importo: {
    type: Number,
    required: true
  },
  categoria: {
    type: String,
    required: true
  },
  descrizione: {
    type: String,
    required: true
  },
  
  // Configurazione ripetizione
  tipo_ripetizione: {
    type: String,
    required: true,
    enum: ['giornaliera', 'settimanale', 'quindicinale', 'mensile', 'bimestrale', 'trimestrale', 'semestrale', 'annuale', 'personalizzata']
  },
  
  configurazione: {
    // Per mensile/bimestrale/trimestrale/semestrale
    giorno: { type: Number, min: 1, max: 31 },
    gestione_giorno_mancante: { 
      type: String, 
      enum: ['ultimo_disponibile', 'primo_disponibile'],
      default: 'ultimo_disponibile'
    },
    ogni_n_mesi: { type: Number, default: 1 },
    
    // Per annuale
    mese: { type: Number, min: 1, max: 12 },
    
    // Per settimanale
    giorni_settimana: [{ type: Number, min: 0, max: 6 }], // 0 = Domenica
    
    // Per quindicinale
    giorno_settimana: { type: Number, min: 0, max: 6 },
    
    // Per personalizzata
    ogni_n_giorni: { type: Number }
  },
  
  // Date e stato
  data_inizio: {
    type: Date,
    required: true
  },
  data_fine: {
    type: Date,
    default: null // null = infinito
  },
  attiva: {
    type: Boolean,
    default: true
  },
  
  // Tracking delle transazioni generate
  transazioni_generate: [{
    data: { type: Date, required: true },
    transazione_id: { type: mongoose.Schema.Types.ObjectId, required: true }
  }],
  
  // Audit e versioning
  versione: {
    type: Number,
    default: 1
  }
}, {
  timestamps: true // Aggiunge createdAt e updatedAt automaticamente
});

// Indice per performance
transazionePeriodicaSchema.index({ userId: 1, attiva: 1 });
transazionePeriodicaSchema.index({ data_inizio: 1, data_fine: 1 });

module.exports = mongoose.model('TransazionePeriodica', transazionePeriodicaSchema);