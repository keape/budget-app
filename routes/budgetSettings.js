const express = require('express');
const router = express.Router();
const BudgetSettings = require('../models/BudgetSettings'); // Assicurati che il percorso sia corretto
const auth = require('../middleware/auth'); // Assicurati che il percorso sia corretto

// GET /api/budget-settings - Recupera impostazioni budget (con fallback annuale)
router.get('/', auth, async (req, res) => {
  // Aggiunto log per GET
  console.log(`[DIAGNOSTIC LOG - GET v1.1] Received request for anno=${req.query.anno}, mese=${req.query.mese}, user=${req.user.id}`);
  try {
    const { anno } = req.query;
    let { mese } = req.query; // Può essere undefined

    if (!anno) {
      return res.status(400).json({ message: 'Anno è richiesto' });
    }

    const parsedAnno = parseInt(anno);
    let parsedMese = (mese !== undefined && mese !== null && !isNaN(parseInt(mese)) && parseInt(mese) >= 0 && parseInt(mese) <= 11) 
                     ? parseInt(mese) 
                     : null; 

    let query;
    let settings = null;

    if (parsedMese !== null) {
      query = { anno: parsedAnno, mese: parsedMese, user: req.user.id };
      console.log(`[GET Budget] Searching specific month for user ${req.user.id}:`, query);
      settings = await BudgetSettings.findOne(query);
      if (!settings) {
        query = { anno: parsedAnno, mese: null, user: req.user.id };
        console.log(`[GET Budget] Specific not found, searching annual fallback for user ${req.user.id}:`, query);
        settings = await BudgetSettings.findOne(query);
      }
    } else {
      query = { anno: parsedAnno, mese: null, user: req.user.id };
      console.log(`[GET Budget] Searching only annual for user ${req.user.id}:`, query);
      settings = await BudgetSettings.findOne(query);
    }

    let result = { spese: {}, entrate: {} };
    if (settings) {
      console.log(`[GET Budget] Settings found:`, settings._id, `for query:`, query);
      result = {
        spese: settings.spese ? Object.fromEntries(settings.spese) : {},
        entrate: settings.entrate ? Object.fromEntries(settings.entrate) : {}
      };
    } else {
       console.log(`[GET Budget] No settings found for query:`, query);
    }
    res.json(result);
  } catch (error) {
    console.error('Errore nel recupero delle impostazioni del budget:', error);
    res.status(500).json({ message: 'Errore interno nel recupero delle impostazioni del budget' });
  }
});

// POST /api/budget-settings - Crea o aggiorna impostazioni (mensili o annuali)
router.post('/', auth, async (req, res) => {
  // *** LOG DIAGNOSTICO AGGIUNTO QUI ***
  console.log(`[DIAGNOSTIC LOG - POST v1.1] Received request body:`, JSON.stringify(req.body)); 
  console.log(`[DIAGNOSTIC LOG - POST v1.1] User ID from auth: ${req.user.id}`);
  
  try {
    const { anno, settings } = req.body;
    const mese = req.body.mese === null ? null : parseInt(req.body.mese); 
    
    // Log dei valori interpretati
    console.log(`[POST Budget v1.1] Interpreted - Anno: ${anno}, Mese: ${mese} (Type: ${typeof mese}), User: ${req.user.id}`);

    if (!anno || mese === undefined || !settings) {
      console.error('[POST Budget v1.1] Validation Error: Dati mancanti');
      return res.status(400).json({ message: 'Dati mancanti (anno, mese - può essere null, settings)' });
    }
    
    const parsedAnno = parseInt(anno);
    if(isNaN(parsedAnno)) {
      console.error('[POST Budget v1.1] Validation Error: Anno non valido');
      return res.status(400).json({ message: 'Anno non valido.' });
    }

    // Mese può essere null, quindi la validazione <0 o >11 si applica solo se non è null
    if (mese !== null && (isNaN(mese) || mese < 0 || mese > 11)) {
         console.error('[POST Budget v1.1] Validation Error: Mese non valido (non nullo)');
         return res.status(400).json({ message: 'Mese non valido. Deve essere tra 0 e 11, o null per annuale.' });
    }

    if (!settings.spese || typeof settings.spese !== 'object' || !settings.entrate || typeof settings.entrate !== 'object') {
        console.error('[POST Budget v1.1] Validation Error: Struttura settings non corretta');
        return res.status(400).json({ message: 'La struttura dei dati settings non è corretta (spese/entrate devono essere oggetti)' });
    }

    const spese = new Map();
    const entrate = new Map();
    Object.entries(settings.spese).forEach(([key, value]) => {
      const numValue = parseFloat(value);
      if (typeof key === 'string' && key.trim() !== '' && value !== null && value !== undefined && !isNaN(numValue)) {
        spese.set(key.trim(), numValue); 
      }
    });
    Object.entries(settings.entrate).forEach(([key, value]) => {
       const numValue = parseFloat(value);
       if (typeof key === 'string' && key.trim() !== '' && value !== null && value !== undefined && !isNaN(numValue)) {
        entrate.set(key.trim(), numValue);
      }
    });

    const query = { anno: parsedAnno, mese: mese, user: req.user.id }; 
    const update = { anno: parsedAnno, mese: mese, spese, entrate, user: req.user.id };
    const options = { new: true, upsert: true, setDefaultsOnInsert: true };

    console.log(`[POST Budget v1.1] Saving settings for user ${req.user.id} with query:`, query);
    const result = await BudgetSettings.findOneAndUpdate(query, update, options);

    const response = {
      spese: result.spese ? Object.fromEntries(result.spese) : {},
      entrate: result.entrate ? Object.fromEntries(result.entrate) : {}
    };
    
    console.log(`[POST Budget v1.1] Settings saved/updated successfully for user ${req.user.id}, query:`, query);
    res.json(response);

  } catch (error) {
    console.error('[POST Budget v1.1] Errore nel salvataggio delle impostazioni del budget:', error);
    console.error('[POST Budget v1.1] Error details:', error.message, error.stack);
    if (error.name === 'ValidationError') {
        // Log specifico per errori di validazione
        console.error('[POST Budget v1.1] Mongoose Validation Error:', error.errors);
        return res.status(400).json({ message: 'Errore di validazione: ' + error.message, errors: error.errors });
    }
    res.status(500).json({ message: 'Errore interno nel salvataggio delle impostazioni del budget' });
  }
});

module.exports = router;
