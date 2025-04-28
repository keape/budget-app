const express = require('express');
const router = express.Router();
const BudgetSettings = require('../models/BudgetSettings');
const auth = require('../middleware/auth');

// GET /api/budget-settings - Recupera tutte le impostazioni del budget
router.get('/', auth, async (req, res) => {
  try {
    const { anno, mese } = req.query;
    
    if (!anno || mese === undefined) {
      return res.status(400).json({ message: 'Anno e mese sono richiesti' });
    }

    const query = {
      anno: parseInt(anno),
      mese: parseInt(mese)
    };

    const settings = await BudgetSettings.findOne(query);
    
    if (!settings) {
      // Se non esistono impostazioni, restituisci un oggetto vuoto
      return res.json({
        spese: {},
        entrate: {}
      });
    }

    // Converti le Map in oggetti plain
    const result = {
      spese: Object.fromEntries(settings.spese),
      entrate: Object.fromEntries(settings.entrate)
    };

    res.json(result);
  } catch (error) {
    console.error('Errore nel recupero delle impostazioni del budget:', error);
    res.status(500).json({ message: 'Errore nel recupero delle impostazioni del budget' });
  }
});

// POST /api/budget-settings - Crea o aggiorna le impostazioni del budget per tutti i mesi dell'anno
router.post('/', auth, async (req, res) => {
  try {
    const { anno, settings } = req.body; // Removed mese, as we'll save for all months

    if (!anno || !settings) {
      return res.status(400).json({ message: 'Anno e impostazioni sono richiesti' });
    }

    // Verifica che settings contenga spese ed entrate
    if (!settings.spese || !settings.entrate) {
      return res.status(400).json({ message: 'La struttura dei dati non è corretta' });
    }

    // Create Maps for saving
    const spese = new Map();
    const entrate = new Map();

    // Populate Maps with received data
    Object.entries(settings.spese).forEach(([key, value]) => {
      if (value !== null && value !== undefined && !isNaN(value)) {
        spese.set(key, Number(value));
      }
    });

    Object.entries(settings.entrate).forEach(([key, value]) => {
      if (value !== null && value !== undefined && !isNaN(value)) {
        entrate.set(key, Number(value));
      }
    });

    const savedSettings = [];

    // Save settings for all 12 months
    for (let mese = 1; mese <= 12; mese++) {
        const result = await BudgetSettings.findOneAndUpdate(
          { anno, mese }, // Query by anno and current month
          {
            anno,
            mese,
            spese,
            entrate
          },
          {
            new: true,
            upsert: true // Create if document doesn't exist
          }
        );
        savedSettings.push(result);
    }


    // Respond with success message and the settings saved for Jan as confirmation
     const response = {
      spese: Object.fromEntries(savedSettings[0].spese), // Assuming savedSettings[0] corresponds to Jan
      entrate: Object.fromEntries(savedSettings[0].entrate)
    };

    res.json({ message: `Impostazioni salvate per tutti i mesi del ${anno}`, savedSettings: response });

  } catch (error) {
    console.error('Errore nel salvataggio delle impostazioni del budget:', error);
    res.status(500).json({ message: 'Errore nel salvataggio delle impostazioni del budget' });
  }
});

module.exports = router; 