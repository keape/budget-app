const express = require('express');
const mongoose = require('mongoose');
const { authenticateToken } = require('./auth');
const BudgetSettings = require('../models/BudgetSettings');
const { debugLog, logError } = require('../utils/logger');
const router = express.Router();

const requireAdminRoutesEnabled = (req, res, next) => {
  if (process.env.ENABLE_ADMIN_ROUTES === 'true') {
    return next();
  }

  return res.status(404).json({ message: 'Endpoint non trovato' });
};

// NEW APPROACH: Use direct MongoDB collection without any indexes or constraints
const getBudgetCollection = () => {
  return mongoose.connection.db.collection('budgetsettings_new');
};

// GET Budget Settings
router.get('/', authenticateToken, async (req, res) => {
  try {
    debugLog('🔍 GET BUDGET SETTINGS - User:', req.user.username, 'ID:', req.user.userId);
    const { anno, mese } = req.query;

    if (!anno) {
      return res.status(400).json({ message: "Anno è richiesto" });
    }

    // Be robust: search for both string and ObjectId versions of the ID
    const userIdStr = req.user.userId.toString();
    const userIdObj = mongoose.Types.ObjectId.isValid(userIdStr) ? new mongoose.Types.ObjectId(userIdStr) : null;

    const hasMonth = mese !== undefined && mese !== null && mese !== '';

    const query = {
      $or: [
        { userId: userIdStr },
        ...(userIdObj ? [{ userId: userIdObj }] : [])
      ],
      anno: parseInt(anno)
    };

    if (hasMonth) {
      query.mese = parseInt(mese);
    }

    debugLog('🔍 Query GET:', query);
    const collection = getBudgetCollection();

    if (hasMonth) {
      // Single month or yearly document (if mese: null was explicitly sent)
      const settings = await collection.findOne(query);
      if (!settings) {
        return res.json({ spese: {}, entrate: {} });
      }
      return res.json({
        spese: settings.spese || {},
        entrate: settings.entrate || {}
      });
    } else {
      // "Full Year" aggregation: find all documents for this year
      const allSettings = await collection.find(query).toArray();

      const aggregated = {
        spese: {},
        entrate: {}
      };

      allSettings.forEach(doc => {
        // Aggregate Spese
        Object.entries(doc.spese || {}).forEach(([cat, val]) => {
          aggregated.spese[cat] = (aggregated.spese[cat] || 0) + (Number(val) || 0);
        });
        // Aggregate Entrate
        Object.entries(doc.entrate || {}).forEach(([cat, val]) => {
          aggregated.entrate[cat] = (aggregated.entrate[cat] || 0) + (Number(val) || 0);
        });
      });

      debugLog(`✅ Aggregated ${allSettings.length} months for user ${req.user.username}`);
      return res.json(aggregated);
    }

  } catch (error) {
    logError('❌ GET BudgetSettings error:', error);
    res.status(500).json({ message: "Errore nel recupero delle impostazioni del budget" });
  }
});

// POST Budget Settings - COMPLETAMENTE RICOSTRUITO
router.post('/', authenticateToken, async (req, res) => {
  try {
    debugLog('🚀 POST BUDGET SETTINGS START');
    debugLog('🔍 User:', req.user.username, 'ID:', req.user.userId);
    debugLog('🔍 Request body keys:', Object.keys(req.body));
    debugLog('🔍 Full request body:', JSON.stringify(req.body, null, 2));

    const { anno, mese, isYearly, settings } = req.body;

    // Validazione base
    if (!anno || !settings) {
      debugLog('❌ Dati mancanti - anno:', anno, 'settings:', !!settings);
      return res.status(400).json({ message: "Anno e settings sono richiesti" });
    }

    if (!settings.spese || !settings.entrate) {
      debugLog('❌ Struttura settings non valida');
      return res.status(400).json({ message: "La struttura dei dati (settings.spese/entrate) non è corretta" });
    }

    // Determina il valore del mese
    let meseValue = null;
    if (!isYearly) {
      if (mese === undefined || mese === null) {
        debugLog('❌ Mese richiesto per impostazioni mensili');
        return res.status(400).json({ message: "Mese è richiesto per impostazioni mensili" });
      }
      const meseInt = parseInt(mese);
      if (isNaN(meseInt) || meseInt < 0 || meseInt > 11) {
        debugLog('❌ Mese non valido:', mese);
        return res.status(400).json({ message: "Mese non valido (deve essere 0-11)" });
      }
      meseValue = meseInt;
    }

    debugLog('✅ Validazione completata - Anno:', anno, 'Mese:', meseValue, 'isYearly:', isYearly);

    // Converti e valida i dati
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

    debugLog('✅ Dati convertiti - Spese count:', spese.size, 'Entrate count:', entrate.size);

    // Be robust: search for both string and ObjectId versions of the ID
    const userIdStr = req.user.userId.toString();
    const userIdObj = mongoose.Types.ObjectId.isValid(userIdStr) ? new mongoose.Types.ObjectId(userIdStr) : null;

    // Query per trovare documento esistente (usiamo stringa come standard per i nuovi salvataggi)
    const query = {
      $or: [
        { userId: userIdStr },
        ...(userIdObj ? [{ userId: userIdObj }] : [])
      ],
      anno: parseInt(anno),
      mese: meseValue
    };

    debugLog('🔍 Query documento:', query);

    // Dati da salvare
    const updateData = {
      userId: req.user.userId,
      anno: parseInt(anno),
      mese: meseValue,
      spese,
      entrate
    };

    debugLog('🔍 Usando nuova collezione senza indici...');
    const collection = getBudgetCollection();

    // Convert Maps to plain objects for MongoDB
    const dataToSave = {
      userId: req.user.userId,
      anno: parseInt(anno),
      mese: meseValue,
      spese: Object.fromEntries(spese),
      entrate: Object.fromEntries(entrate),
      updatedAt: new Date()
    };

    debugLog('📝 Salvando direttamente in collezione nuova...');
    await collection.replaceOne(query, dataToSave, { upsert: true });

    const result = dataToSave;

    debugLog('✅ Operazione completata con successo per user:', req.user.username);

    // Risposta
    const response = {
      spese: result.spese || {},
      entrate: result.entrate || {}
    };

    res.json(response);

  } catch (error) {
    logError('❌ POST BudgetSettings error:', error);

    // RIMOSSO: Check per errore 11000 che causava 409
    // Ora tutti gli errori vengono gestiti come 500 generici

    res.status(500).json({
      message: "Errore nel salvataggio delle impostazioni del budget",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// EMERGENCY ENDPOINT - Remove unique index from MongoDB
router.post('/remove-unique-index', requireAdminRoutesEnabled, authenticateToken, async (req, res) => {
  try {
    debugLog('🚨 REMOVING UNIQUE INDEX - User:', req.user.username);

    // Drop the unique index
    try {
      await BudgetSettings.collection.dropIndex({ userId: 1, anno: 1, mese: 1 });
      debugLog('✅ Unique index dropped successfully');
    } catch (indexError) {
      debugLog('⚠️ Index may not exist or already dropped:', indexError.message);
    }

    // List remaining indexes for verification
    const indexes = await BudgetSettings.collection.listIndexes().toArray();
    debugLog('📋 Remaining indexes:', indexes.map(idx => ({ name: idx.name, key: idx.key })));

    res.json({
      message: 'Unique index removal completed',
      remainingIndexes: indexes.map(idx => ({ name: idx.name, key: idx.key }))
    });

  } catch (error) {
    logError('❌ Index removal error:', error);
    res.status(500).json({ message: 'Index removal failed', error: error.message });
  }
});

// EMERGENCY ENDPOINT - Remove duplicates and fix unique index issues  
router.post('/emergency-fix', requireAdminRoutesEnabled, authenticateToken, async (req, res) => {
  try {
    debugLog('🚨 EMERGENCY FIX - User:', req.user.username);

    const collection = getBudgetCollection();

    // Be robust: search for both string and ObjectId versions of the ID
    const userIdStr = req.user.userId.toString();
    const userIdObj = mongoose.Types.ObjectId.isValid(userIdStr) ? new mongoose.Types.ObjectId(userIdStr) : null;

    const query = {
      $or: [
        { userId: userIdStr },
        ...(userIdObj ? [{ userId: userIdObj }] : [])
      ]
    };

    // Find all documents for this user in budgetsettings_new
    const userDocs = await collection.find(query).toArray();
    debugLog('🔍 Found', userDocs.length, 'documents for user');

    // Group by anno/mese
    const grouped = {};
    userDocs.forEach(doc => {
      const key = `${doc.anno}-${doc.mese}`;
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(doc);
    });

    let deletedCount = 0;

    // For each group, keep only the most recent
    for (const [key, docs] of Object.entries(grouped)) {
      if (docs.length > 1) {
        debugLog(`🧹 Cleaning duplicates for ${key}:`, docs.length, 'found');
        // Sort by creation date, keep the newest
        docs.sort((a, b) => b.createdAt - a.createdAt);
        const toDelete = docs.slice(1);

        for (const doc of toDelete) {
          await collection.deleteOne({ _id: doc._id });
          deletedCount++;
          debugLog('🗑️ Deleted duplicate:', doc._id);
        }
      }
    }

    res.json({
      message: 'Emergency fix completed',
      deletedDuplicates: deletedCount,
      remainingDocuments: userDocs.length - deletedCount
    });

  } catch (error) {
    logError('❌ Emergency fix error:', error);
    res.status(500).json({ message: 'Emergency fix failed', error: error.message });
  }
});

module.exports = router;
