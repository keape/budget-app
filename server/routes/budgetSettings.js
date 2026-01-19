const express = require('express');
const mongoose = require('mongoose');
const { authenticateToken } = require('./auth');
const BudgetSettings = require('../models/BudgetSettings');
const router = express.Router();

// NEW APPROACH: Use direct MongoDB collection without any indexes or constraints
const getBudgetCollection = () => {
  return mongoose.connection.db.collection('budgetsettings_new');
};

// GET Budget Settings
router.get('/', authenticateToken, async (req, res) => {
  try {
    console.log('🔍 GET BUDGET SETTINGS - User:', req.user.username, 'ID:', req.user.userId);
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

    console.log('🔍 Query GET:', query);
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

      console.log(`✅ Aggregated ${allSettings.length} months for user ${req.user.username}`);
      return res.json(aggregated);
    }

  } catch (error) {
    console.error('❌ GET Error for user', req.user.username, ':', error);
    res.status(500).json({ message: "Errore nel recupero delle impostazioni del budget" });
  }
});

// POST Budget Settings - COMPLETAMENTE RICOSTRUITO
router.post('/', authenticateToken, async (req, res) => {
  try {
    console.log('🚀 POST BUDGET SETTINGS START');
    console.log('🔍 User:', req.user.username, 'ID:', req.user.userId);
    console.log('🔍 Request body keys:', Object.keys(req.body));
    console.log('🔍 Full request body:', JSON.stringify(req.body, null, 2));

    const { anno, mese, isYearly, settings } = req.body;

    // Validazione base
    if (!anno || !settings) {
      console.log('❌ Dati mancanti - anno:', anno, 'settings:', !!settings);
      return res.status(400).json({ message: "Anno e settings sono richiesti" });
    }

    if (!settings.spese || !settings.entrate) {
      console.log('❌ Struttura settings non valida');
      return res.status(400).json({ message: "La struttura dei dati (settings.spese/entrate) non è corretta" });
    }

    // Determina il valore del mese
    let meseValue = null;
    if (!isYearly) {
      if (mese === undefined || mese === null) {
        console.log('❌ Mese richiesto per impostazioni mensili');
        return res.status(400).json({ message: "Mese è richiesto per impostazioni mensili" });
      }
      const meseInt = parseInt(mese);
      if (isNaN(meseInt) || meseInt < 0 || meseInt > 11) {
        console.log('❌ Mese non valido:', mese);
        return res.status(400).json({ message: "Mese non valido (deve essere 0-11)" });
      }
      meseValue = meseInt;
    }

    console.log('✅ Validazione completata - Anno:', anno, 'Mese:', meseValue, 'isYearly:', isYearly);

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

    console.log('✅ Dati convertiti - Spese count:', spese.size, 'Entrate count:', entrate.size);

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

    console.log('🔍 Query documento:', query);

    // Dati da salvare
    const updateData = {
      userId: req.user.userId,
      anno: parseInt(anno),
      mese: meseValue,
      spese,
      entrate
    };

    console.log('🔍 Usando nuova collezione senza indici...');
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

    console.log('📝 Salvando direttamente in collezione nuova...');
    await collection.replaceOne(query, dataToSave, { upsert: true });

    const result = dataToSave;

    console.log('✅ Operazione completata con successo per user:', req.user.username);

    // Risposta
    const response = {
      spese: result.spese || {},
      entrate: result.entrate || {}
    };

    res.json(response);

  } catch (error) {
    console.error('❌ POST Error for user', req.user?.username || 'UNKNOWN', ':', error);
    console.error('❌ Error stack:', error.stack);

    // RIMOSSO: Check per errore 11000 che causava 409
    // Ora tutti gli errori vengono gestiti come 500 generici

    res.status(500).json({
      message: "Errore nel salvataggio delle impostazioni del budget",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// EMERGENCY ENDPOINT - Remove unique index from MongoDB
router.post('/remove-unique-index', authenticateToken, async (req, res) => {
  try {
    console.log('🚨 REMOVING UNIQUE INDEX - User:', req.user.username);

    // Drop the unique index
    try {
      await BudgetSettings.collection.dropIndex({ userId: 1, anno: 1, mese: 1 });
      console.log('✅ Unique index dropped successfully');
    } catch (indexError) {
      console.log('⚠️ Index may not exist or already dropped:', indexError.message);
    }

    // List remaining indexes for verification
    const indexes = await BudgetSettings.collection.listIndexes().toArray();
    console.log('📋 Remaining indexes:', indexes.map(idx => ({ name: idx.name, key: idx.key })));

    res.json({
      message: 'Unique index removal completed',
      remainingIndexes: indexes.map(idx => ({ name: idx.name, key: idx.key }))
    });

  } catch (error) {
    console.error('❌ Index removal error:', error);
    res.status(500).json({ message: 'Index removal failed', error: error.message });
  }
});

// EMERGENCY ENDPOINT - Remove duplicates and fix unique index issues  
router.post('/emergency-fix', authenticateToken, async (req, res) => {
  try {
    console.log('🚨 EMERGENCY FIX - User:', req.user.username);

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
    console.log('🔍 Found', userDocs.length, 'documents for user');

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
        console.log(`🧹 Cleaning duplicates for ${key}:`, docs.length, 'found');
        // Sort by creation date, keep the newest
        docs.sort((a, b) => b.createdAt - a.createdAt);
        const toDelete = docs.slice(1);

        for (const doc of toDelete) {
          await collection.deleteOne({ _id: doc._id });
          deletedCount++;
          console.log('🗑️ Deleted duplicate:', doc._id);
        }
      }
    }

    res.json({
      message: 'Emergency fix completed',
      deletedDuplicates: deletedCount,
      remainingDocuments: userDocs.length - deletedCount
    });

  } catch (error) {
    console.error('❌ Emergency fix error:', error);
    res.status(500).json({ message: 'Emergency fix failed', error: error.message });
  }
});

module.exports = router;