const express = require('express');
const router = express.Router();
const BudgetSettings = require('../models/BudgetSettings'); // Assicurati che il percorso sia corretto
const auth = require('../middleware/auth'); // Assicurati che il percorso sia corretto

// GET /api/budget-settings - Recupera impostazioni budget (con fallback annuale)
router.get('/', auth, async (req, res) => {
  try {
    const { anno } = req.query;
    let { mese } = req.query; // Può essere undefined

    if (!anno) {
      return res.status(400).json({ message: 'Anno è richiesto' });
    }

    const parsedAnno = parseInt(anno);
    // Converte in numero (0-11) o null se non è un mese valido o non fornito
    let parsedMese = (mese !== undefined && mese !== null && !isNaN(parseInt(mese)) && parseInt(mese) >= 0 && parseInt(mese) <= 11) 
                     ? parseInt(mese) 
                     : null; 

    let query;
    let settings = null;

    // Se è richiesto un mese specifico (0-11)
    if (parsedMese !== null) {
      // 1. Cerca l'impostazione specifica per il mese
      query = { anno: parsedAnno, mese: parsedMese, user: req.user.id }; // Aggiunto user
      console.log(`[GET Budget] Searching specific month for user ${req.user.id}:`, query);
      settings = await BudgetSettings.findOne(query);

      // 2. Se non trovata, cerca l'impostazione annuale come fallback
      if (!settings) {
        query = { anno: parsedAnno, mese: null, user: req.user.id }; // Cerca l'impostazione annuale (Aggiunto user)
        console.log(`[GET Budget] Specific not found, searching annual fallback for user ${req.user.id}:`, query);
        settings = await BudgetSettings.findOne(query);
      }
    } else {
      // Se non è richiesto un mese specifico (mese non fornito o non valido), cerca solo l'annuale
      query = { anno: parsedAnno, mese: null, user: req.user.id }; // Aggiunto user
      console.log(`[GET Budget] Searching only annual for user ${req.user.id}:`, query);
      settings = await BudgetSettings.findOne(query);
    }

    // Prepara la risposta
    let result = {
      spese: {},
      entrate: {}
    };

    if (settings) {
      console.log(`[GET Budget] Settings found:`, settings._id, `for query:`, query);
      // Converti le Map in oggetti plain se sono state trovate impostazioni
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
  try {
    const { anno, settings } = req.body;
    // Mese può essere un numero (0-11) o null per annuale
    const mese = req.body.mese === null ? null : parseInt(req.body.mese); 

    if (!anno || mese === undefined || !settings) {
       // Mese può essere null, quindi controlliamo solo per undefined
      return res.status(400).json({ message: 'Dati mancanti (anno, mese - può essere null, settings)' });
    }
    
    const parsedAnno = parseInt(anno);
    if(isNaN(parsedAnno)) {
        return res.status(400).json({ message: 'Anno non valido.' });
    }

    // Verifica validità mese se non è null
    if (mese !== null && (isNaN(mese) || mese < 0 || mese > 11)) {
         return res.status(400).json({ message: 'Mese non valido. Deve essere tra 0 e 11, o null per annuale.' });
    }


    if (!settings.spese || typeof settings.spese !== 'object' || !settings.entrate || typeof settings.entrate !== 'object') {
        return res.status(400).json({ message: 'La struttura dei dati settings non è corretta (spese/entrate devono essere oggetti)' });
    }


    const spese = new Map();
    const entrate = new Map();

    // Popola le Map assicurandosi che le chiavi siano stringhe e i valori numeri
    Object.entries(settings.spese).forEach(([key, value]) => {
      const numValue = parseFloat(value); // Usa parseFloat per gestire decimali
      // Salva solo se la chiave è una stringa non vuota e il valore è un numero valido
      if (typeof key === 'string' && key.trim() !== '' && value !== null && value !== undefined && !isNaN(numValue)) {
        spese.set(key.trim(), numValue); 
      }
    });

    Object.entries(settings.entrate).forEach(([key, value]) => {
       const numValue = parseFloat(value); // Usa parseFloat per gestire decimali
       // Salva solo se la chiave è una stringa non vuota e il valore è un numero valido
       if (typeof key === 'string' && key.trim() !== '' && value !== null && value !== undefined && !isNaN(numValue)) {
        entrate.set(key.trim(), numValue);
      }
    });

    // Query per trovare/aggiornare: usa anno, mese (che può essere null) e user
    const query = { anno: parsedAnno, mese: mese, user: req.user.id }; 
    const update = { 
        anno: parsedAnno,
        mese: mese,
        spese,
        entrate,
        user: req.user.id // Associa all'utente loggato
      };
    const options = { 
        new: true, // Restituisce il documento aggiornato
        upsert: true, // Crea se non esiste
        setDefaultsOnInsert: true // Applica i default del modello se si inserisce
      };

    console.log(`[POST Budget] Saving settings for user ${req.user.id} with query:`, query);
    const result = await BudgetSettings.findOneAndUpdate(query, update, options);

    const response = {
      spese: result.spese ? Object.fromEntries(result.spese) : {},
      entrate: result.entrate ? Object.fromEntries(result.entrate) : {}
    };
    
    console.log(`[POST Budget] Settings saved/updated successfully for user ${req.user.id}, query:`, query);
    res.json(response);

  } catch (error) {
    console.error('Errore nel salvataggio delle impostazioni del budget:', error);
     // Log più dettagliato dell'errore
    console.error('Error details:', error.message, error.stack);
    // Controlla errori di validazione Mongoose
    if (error.name === 'ValidationError') {
        return res.status(400).json({ message: 'Errore di validazione: ' + error.message, errors: error.errors });
    }
    res.status(500).json({ message: 'Errore interno nel salvataggio delle impostazioni del budget' });
  }
});

module.exports = router;
