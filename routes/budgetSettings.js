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

// POST /api/budget-settings - Crea o aggiorna le impostazioni del budget
router.post('/', auth, async (req, res) => {
  try {
    const { anno, mese, settings } = req.body;

    if (!anno || mese === undefined || !settings) {
      return res.status(400).json({ message: 'Dati mancanti' });
    }

    // Verifica che settings contenga spese ed entrate
    if (!settings.spese || !settings.entrate) {
      return res.status(400).json({ message: 'La struttura dei dati non è corretta' });
    }

    // Crea le Map per il salvataggio
    const spese = new Map();
    const entrate = new Map();

    // Popola le Map con i dati ricevuti
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

    // Cerca e aggiorna le impostazioni esistenti, o crea nuove se non esistono
    const result = await BudgetSettings.findOneAndUpdate(
      { anno, mese },
      { 
        anno,
        mese,
        spese,
        entrate
      },
      { 
        new: true,
        upsert: true
      }
    );

    // Converti il risultato in un formato compatibile con il frontend
    const response = {
      spese: Object.fromEntries(result.spese),
      entrate: Object.fromEntries(result.entrate)
    };

    res.json(response);
  } catch (error) {
    console.error('Errore nel salvataggio delle impostazioni del budget:', error);
    res.status(500).json({ message: 'Errore nel salvataggio delle impostazioni del budget' });
  }
});

module.exports = router; 