const express = require('express');
const BudgetSettings = require('../models/BudgetSettings');
const { authenticateToken } = require('./auth');
const router = express.Router();

// GET Budget Settings - SEMPLIFICATO
router.get('/', authenticateToken, async (req, res) => {
  try {
    console.log('🔍 GET BUDGET SETTINGS - User:', req.user.username, 'ID:', req.user.userId);
    const { anno, mese } = req.query;
    
    if (!anno) {
      return res.status(400).json({ message: "Anno è richiesto" });
    }

    const query = {
      userId: req.user.userId,
      anno: parseInt(anno),
      mese: mese && !isNaN(mese) ? parseInt(mese) : null
    };

    console.log('🔍 Query GET:', query);
    const settings = await BudgetSettings.findOne(query);
    
    if (!settings) {
      console.log('🔍 Nessuna impostazione trovata, restituisco oggetto vuoto');
      return res.json({ spese: {}, entrate: {} }); 
    }

    const result = {
      spese: Object.fromEntries(settings.spese),
      entrate: Object.fromEntries(settings.entrate)
    };

    console.log('✅ GET risultato inviato per', req.user.username);
    res.json(result);

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
    
    // Query per trovare documento esistente
    const query = {
      userId: req.user.userId,
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
    
    console.log('🔍 Cerco documento esistente...');
    let result = await BudgetSettings.findOne(query);
    
    if (result) {
      console.log('📝 Aggiorno documento esistente');
      result.spese = spese;
      result.entrate = entrate;
      await result.save();
    } else {
      console.log('📝 Creo nuovo documento');
      result = new BudgetSettings(updateData);
      await result.save();
    }
    
    console.log('✅ Operazione completata con successo per user:', req.user.username);
    
    // Risposta
    const response = {
      spese: Object.fromEntries(result.spese),
      entrate: Object.fromEntries(result.entrate)
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
    
    // Find all documents for this user
    const userDocs = await BudgetSettings.find({ userId: req.user.userId });
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
          await BudgetSettings.deleteOne({ _id: doc._id });
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