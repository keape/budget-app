const express = require('express');
const BudgetSettings = require('../models/BudgetSettings');
const { authenticateToken } = require('./auth');
const router = express.Router();

// GET Budget Settings (Handles Monthly and Yearly)
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { anno, mese } = req.query;
    console.log('Ricevuta richiesta GET budget settings:', { anno, mese });

    if (!anno) {
      return res.status(400).json({ message: "Anno è richiesto" });
    }

    const query = {
      userId: req.user.userId,
      anno: parseInt(anno)
    };

    // If mese is provided and is a valid number (0-11), search for monthly settings.
    // Otherwise, search for yearly settings (mese: null).
    const meseInt = parseInt(mese);
    if (!isNaN(meseInt) && meseInt >= 0 && meseInt <= 11) {
        query.mese = meseInt;
        console.log('Cercando impostazioni MENSILI con query:', query);
    } else {
        query.mese = null; // Use null to find the yearly setting
        console.log('Cercando impostazioni ANNUALI con query:', query);
    }

    const settings = await BudgetSettings.findOne(query);
    
    if (!settings) {
      console.log('Nessuna impostazione trovata, restituisco oggetto vuoto');
      // Return empty structure if no settings found for that year/month
      return res.json({
        spese: {},
        entrate: {}
      }); 
    }

    // Convert Map to plain object for JSON response
    const result = {
      spese: Object.fromEntries(settings.spese),
      entrate: Object.fromEntries(settings.entrate)
    };

    console.log('Invio risultato:', result);
    res.json(result);

  } catch (error) {
    console.error('Errore nel recupero delle impostazioni del budget:', error);
    res.status(500).json({ message: "Errore nel recupero delle impostazioni del budget" });
  }
});

// POST Budget Settings (Handles Monthly and Yearly)
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { anno, mese, isYearly, settings } = req.body; // Add isYearly flag
    console.log('Ricevuta richiesta POST budget settings:', { anno, mese, isYearly, settings });

    if (!anno || !settings) { // Mese is optional now, check isYearly instead
      return res.status(400).json({ message: "Anno e settings sono richiesti" });
    }
    if (settings.spese === undefined || settings.entrate === undefined) {
      return res.status(400).json({ message: "La struttura dei dati (settings.spese/entrate) non è corretta" });
    }
    
    const annoInt = parseInt(anno);
    let meseValue = null; // Default to null for yearly

    // If not yearly, validate and parse the month
    if (!isYearly) {
        if (mese === undefined || mese === null) {
             return res.status(400).json({ message: "Mese è richiesto per impostazioni mensili" });
        }
        const meseInt = parseInt(mese);
        if (isNaN(meseInt) || meseInt < 0 || meseInt > 11) {
            return res.status(400).json({ message: "Mese non valido (deve essere 0-11)" });
        }
        meseValue = meseInt;
    }

    // Prepare data for saving
    const spese = new Map();
    const entrate = new Map();
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

    const updateData = { 
        userId: req.user.userId,
        anno: annoInt,
        mese: meseValue, 
        spese,
        entrate
    };
    
    console.log('📝 Salvando/Aggiornando le impostazioni:', {
      userId: req.user.userId,
      anno: annoInt,
      mese: meseValue,
      isYearly,
      speseCount: spese.size,
      entrateCount: entrate.size
    });

    // Gestione più robusta per evitare errori di duplicazione
    let result;
    try {
      // Prima prova a fare un update
      console.log('🔍 Tentativo di update per documento esistente...');
      result = await BudgetSettings.findOneAndUpdate(
        { userId: req.user.userId, anno: annoInt, mese: meseValue }, // Query condition
        updateData, // Data to set
        { new: true } // Solo update, non upsert
      );
      
      // Se il documento non esiste, crealo
      if (!result) {
        console.log('📄 Documento non trovato, creazione nuovo documento...');
        result = await BudgetSettings.create(updateData);
        console.log('✅ Nuovo documento creato con successo');
      } else {
        console.log('✅ Documento esistente aggiornato con successo');
      }
    } catch (createError) {
      // Se la creazione fallisce per duplicazione, riprova con findOneAndUpdate
      if (createError.code === 11000) {
        console.log('Duplicato durante create, riprovo con update...');
        result = await BudgetSettings.findOneAndUpdate(
          { userId: req.user.userId, anno: annoInt, mese: meseValue },
          updateData,
          { new: true }
        );
        if (!result) {
          throw new Error('Impossibile creare o aggiornare il documento dopo il conflitto di duplicazione');
        }
      } else {
        throw createError;
      }
    }

    // Convert Map back to plain object for response
    const response = {
      spese: Object.fromEntries(result.spese),
      entrate: Object.fromEntries(result.entrate)
    };

    console.log('Invio risposta:', response);
    res.json(response);

  } catch (error) {
    console.error('Errore nel salvataggio delle impostazioni del budget:', error);
    // Handle potential duplicate key error during upsert if needed
    if (error.code === 11000) {
         return res.status(409).json({ message: "Errore: impostazione duplicata rilevata." });
    }
    res.status(500).json({ message: "Errore nel salvataggio delle impostazioni del budget" });
  }
});

module.exports = router;