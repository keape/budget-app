const express = require('express');
const router = express.Router();
const BudgetSettings = require('../models/BudgetSettings');
const auth = require('../middleware/auth');

// GET /api/budget-settings - Recupera tutte le impostazioni del budget
router.get('/', auth, async (req, res) => {
  try {
    const { anno, mese } = req.query;
    let query = {};
    
    if (anno) {
      query.anno = parseInt(anno);
    }
    if (mese !== undefined) {
      query.mese = parseInt(mese);
    }

    const settings = await BudgetSettings.find(query);
    
    // Trasforma i risultati in un oggetto organizzato per anno e mese
    const organizedSettings = settings.reduce((acc, setting) => {
      if (!acc[setting.anno]) {
        acc[setting.anno] = [];
      }
      acc[setting.anno][setting.mese] = {
        spese: Object.fromEntries(setting.spese),
        entrate: Object.fromEntries(setting.entrate)
      };
      return acc;
    }, {});

    res.json(organizedSettings);
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

    // Converti le impostazioni in Map per il salvataggio
    const spese = new Map(Object.entries(settings.spese || {}));
    const entrate = new Map(Object.entries(settings.entrate || {}));

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

    res.json(result);
  } catch (error) {
    console.error('Errore nel salvataggio delle impostazioni del budget:', error);
    res.status(500).json({ message: 'Errore nel salvataggio delle impostazioni del budget' });
  }
});

module.exports = router; 