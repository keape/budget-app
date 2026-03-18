const express = require('express');
const Spesa = require('../models/Spesa');
const Entrata = require('../models/Entrata');
const User = require('../models/User');
const router = express.Router();

// API Key fissa per l'automazione (in produzione dovrebbe essere in .env)
const AUTOMATION_API_KEY = 'budget-automation-2025';

// Middleware per verificare l'API Key
const verifyApiKey = (req, res, next) => {
  const apiKey = req.headers['x-api-key'];
  
  if (!apiKey) {
    return res.status(401).json({
      success: false,
      error: 'API Key mancante. Aggiungi header X-API-Key.'
    });
  }
  
  if (apiKey !== AUTOMATION_API_KEY) {
    return res.status(401).json({
      success: false,
      error: 'API Key non valida.'
    });
  }
  
  next();
};

// POST /api/automation/transaction
router.post('/transaction', verifyApiKey, async (req, res) => {
  try {
    const { tipo, importo, categoria, descrizione } = req.body;
    
    // Validazione dati obbligatori
    if (!tipo || !importo || !categoria) {
      return res.status(400).json({
        success: false,
        error: 'Campi obbligatori: tipo, importo, categoria'
      });
    }
    
    // Validazione tipo
    if (!['spesa', 'entrata'].includes(tipo)) {
      return res.status(400).json({
        success: false,
        error: 'Tipo deve essere "spesa" o "entrata"'
      });
    }
    
    // Validazione importo
    const importoNum = parseFloat(importo);
    if (isNaN(importoNum) || importoNum <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Importo deve essere un numero positivo'
      });
    }
    
    // Trova l'utente keape (hard-coded per l'automazione)
    const user = await User.findOne({ username: 'keape' });
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'Utente keape non trovato'
      });
    }
    
    // Dati della transazione
    const transactionData = {
      userId: user._id,
      importo: tipo === 'spesa' ? -Math.abs(importoNum) : Math.abs(importoNum),
      categoria: categoria.trim(),
      descrizione: descrizione ? descrizione.trim() : '',
      data: new Date().toISOString().split('T')[0] // Data di oggi
    };
    
    // Crea la transazione
    let nuovaTransazione;
    if (tipo === 'spesa') {
      nuovaTransazione = new Spesa(transactionData);
    } else {
      nuovaTransazione = new Entrata(transactionData);
    }
    
    await nuovaTransazione.save();
    
    // Risposta di successo
    res.status(201).json({
      success: true,
      message: `${tipo === 'spesa' ? 'Spesa' : 'Entrata'} inserita con successo`,
      data: {
        id: nuovaTransazione._id,
        tipo: tipo,
        importo: Math.abs(importoNum),
        categoria: categoria,
        descrizione: descrizione || '',
        data: transactionData.data
      }
    });
    
  } catch (error) {
    console.error('Errore nell\'endpoint automation:', error);
    res.status(500).json({
      success: false,
      error: 'Errore interno del server'
    });
  }
});

// GET /api/automation/health - Test endpoint
router.get('/health', verifyApiKey, (req, res) => {
  res.json({
    success: true,
    message: 'Automation API funzionante',
    timestamp: new Date().toISOString()
  });
});

module.exports = router;