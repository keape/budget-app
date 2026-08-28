const express = require('express');
const mongoose = require('mongoose');
const { authenticateToken } = require('./auth');
const CategoriaArchiviata = require('../models/CategoriaArchiviata');
const CategoryIcon = require('../models/CategoryIcon');
const router = express.Router();

// GET Categories - Extract from budget settings
router.get('/', authenticateToken, async (req, res) => {
  try {
    console.log('🔍 GET CATEGORIES - User:', req.user.username);

    // Get budget collection (same as budget settings)
    const collection = mongoose.connection.db.collection('budgetsettings_new');

    // Find all budget settings for this user
    // Be robust: search for both string and ObjectId versions of the ID
    const userIdStr = req.user.userId.toString();
    const userIdObj = mongoose.Types.ObjectId.isValid(userIdStr) ? new mongoose.Types.ObjectId(userIdStr) : null;

    const query = {
      $or: [
        { userId: userIdStr },
        ...(userIdObj ? [{ userId: userIdObj }] : [])
      ]
    };

    const userBudgets = await collection.find(query).toArray();
    console.log(`📋 Found ${userBudgets.length} budget documents for user (using robust query)`);

    // Extract unique categories from all budget settings
    const speseSet = new Set();
    const entrateSet = new Set();

    // REMOVED HARDCODED BASE CATEGORIES
    // The user wants control over their categories via BudgetSettings.

    // Add custom categories from budget settings
    userBudgets.forEach(budget => {
      if (budget.spese && typeof budget.spese === 'object') {
        Object.keys(budget.spese).forEach(categoria => {
          if (categoria && categoria.trim()) {
            speseSet.add(categoria.trim());
          }
        });
      }

      if (budget.entrate && typeof budget.entrate === 'object') {
        Object.keys(budget.entrate).forEach(categoria => {
          if (categoria && categoria.trim()) {
            entrateSet.add(categoria.trim());
          }
        });
      }
    });

    // Convert to sorted arrays
    const speseArray = Array.from(speseSet).sort((a, b) => a.localeCompare(b, 'it', { sensitivity: 'base' }));
    const entrateArray = Array.from(entrateSet).sort((a, b) => a.localeCompare(b, 'it', { sensitivity: 'base' }));

    console.log(`✅ Returning ${speseArray.length} spese categories and ${entrateArray.length} entrate categories`);

    res.json({
      categorie: {
        spese: speseArray,
        entrate: entrateArray
      }
    });

  } catch (error) {
    console.error('❌ GET Categories Error for user', req.user?.username || 'UNKNOWN', ':', error);
    res.status(500).json({ message: "Errore nel recupero delle categorie" });
  }
});

// POST Delete Category - Using POST instead of DELETE to ensure body is received correctly
router.post('/delete', authenticateToken, async (req, res) => {
  try {
    const { name, type } = req.body;

    if (!name || !type) {
      return res.status(400).json({ message: "Nome e tipo richiesti" });
    }

    console.log(`🚨 GLOBAL DELETE (POST): Removing "${name}" from ${type} for user ${req.user.username}`);

    const collection = mongoose.connection.db.collection('budgetsettings_new');

    // ROBUST DELETE: Find exact key match (ignoring whitespace and invisible chars)
    // Be robust: search for both string and ObjectId versions of the ID
    const userIdStr = req.user.userId.toString();
    const userIdObj = mongoose.Types.ObjectId.isValid(userIdStr) ? new mongoose.Types.ObjectId(userIdStr) : null;

    const query = {
      $or: [
        { userId: userIdStr },
        ...(userIdObj ? [{ userId: userIdObj }] : [])
      ]
    };

    const userBudgets = await collection.find(query).toArray();
    let totalModified = 0;
    const debugLogs = [];

    // Helper to normalize string for comparison
    const normalize = (str) => String(str).replace(/[^a-zA-Z0-9\u00C0-\u017F]/g, "").toLowerCase();
    const targetNorm = normalize(name);

    debugLogs.push(`Target: "${name}" (Norm: "${targetNorm}")`);
    debugLogs.push(`Found ${userBudgets.length} documents for user`);

    for (const doc of userBudgets) {
      if (!doc[type]) continue;

      const keys = Object.keys(doc[type]);
      const matchedKeys = keys.filter(k => normalize(k) === targetNorm);

      if (matchedKeys.length > 0) {
        const unsetUpdate = {};
        matchedKeys.forEach(k => {
          debugLogs.push(`Match in doc ${doc._id} (Month: ${doc.mese}): Key="${k}"`);
          unsetUpdate[`${type}.${k}`] = "";
        });

        const upRes = await collection.updateOne(
          { _id: doc._id },
          { $unset: unsetUpdate }
        );
        debugLogs.push(`Update result for ${doc._id}: Mod=${upRes.modifiedCount}`);
        totalModified += upRes.modifiedCount;
      }
    }

    console.log(`✅ Robust Delete: Modified ${totalModified} documents.`);

    await CategoryIcon.deleteOne({ userId: req.user.userId, tipo: type, categoria: name });

    res.json({
      message: "Categoria eliminata globalmente",
      documentsUpdated: totalModified,
      debug: debugLogs
    });

  } catch (error) {
    console.error('❌ Global Delete Error:', error);
    res.status(500).json({ message: "Errore durante l'eliminazione globale" });
  }
});

// POST Rename Category - Global renaming across all budget settings
router.post('/rename', authenticateToken, async (req, res) => {
  try {
    const { oldName, newName, type } = req.body;

    if (!oldName || !newName || !type) {
      return res.status(400).json({ message: "Nome vecchio, nome nuovo e tipo richiesti" });
    }

    console.log(`🚨 GLOBAL RENAME: Changing "${oldName}" to "${newName}" in ${type} for user ${req.user.username}`);

    const collection = mongoose.connection.db.collection('budgetsettings_new');

    // Be robust: search for both string and ObjectId versions of the ID
    const userIdStr = req.user.userId.toString();
    const userIdObj = mongoose.Types.ObjectId.isValid(userIdStr) ? new mongoose.Types.ObjectId(userIdStr) : null;

    const query = {
      $or: [
        { userId: userIdStr },
        ...(userIdObj ? [{ userId: userIdObj }] : [])
      ]
    };

    const userBudgets = await collection.find(query).toArray();
    let totalModified = 0;
    const debugLogs = [];

    // Helper to normalize string for comparison
    const normalize = (str) => String(str).replace(/[^a-zA-Z0-9\u00C0-\u017F]/g, "").toLowerCase();
    const targetNorm = normalize(oldName);

    for (const doc of userBudgets) {
      if (!doc[type]) continue;

      const keys = Object.keys(doc[type]);
      const matchedKeys = keys.filter(k => normalize(k) === targetNorm);

      if (matchedKeys.length > 0) {
        const updateDoc = { $unset: {}, $set: {} };
        let modified = false;

        matchedKeys.forEach(k => {
          const value = doc[type][k];
          debugLogs.push(`Renaming in doc ${doc._id} (Month: ${doc.mese}): "${k}" -> "${newName}"`);

          // Remove old key and set new key
          updateDoc.$unset[`${type}.${k}`] = "";
          updateDoc.$set[`${type}.${newName}`] = value;
          modified = true;
        });

        if (modified) {
          const upRes = await collection.updateOne(
            { _id: doc._id },
            updateDoc
          );
          totalModified += upRes.modifiedCount;
        }
      }
    }

    console.log(`✅ Global Rename: Modified ${totalModified} documents.`);

    try {
      await CategoryIcon.updateOne(
        { userId: req.user.userId, tipo: type, categoria: oldName },
        { $set: { categoria: newName } }
      );
    } catch (iconError) {
      console.error('⚠️ CategoryIcon rename skipped (non-blocking):', iconError.message);
    }

    res.json({
      message: "Categoria rinominata globalmente",
      documentsUpdated: totalModified,
      debug: debugLogs
    });

  } catch (error) {
    console.error('❌ Global Rename Error:', error);
    res.status(500).json({ message: "Errore durante la rinomina globale" });
  }
});

// GET Archived Categories
router.get('/archiviate', authenticateToken, async (req, res) => {
  try {
    const archiviate = await CategoriaArchiviata.find({ userId: req.user.userId });

    res.json({
      categorie: {
        spese: archiviate.filter(c => c.tipo === 'spese').map(c => c.categoria),
        entrate: archiviate.filter(c => c.tipo === 'entrate').map(c => c.categoria)
      }
    });
  } catch (error) {
    console.error('❌ GET Archived Categories Error:', error);
    res.status(500).json({ message: "Errore nel recupero delle categorie archiviate" });
  }
});

// POST Archive Category
router.post('/archivia', authenticateToken, async (req, res) => {
  try {
    const { tipo, categoria } = req.body;

    if (!tipo || !categoria || !['spese', 'entrate'].includes(tipo)) {
      return res.status(400).json({ message: "Tipo e categoria richiesti" });
    }

    await CategoriaArchiviata.updateOne(
      { userId: req.user.userId, tipo, categoria },
      { $setOnInsert: { userId: req.user.userId, tipo, categoria } },
      { upsert: true }
    );

    res.json({ message: "Categoria archiviata" });
  } catch (error) {
    console.error('❌ Archive Category Error:', error);
    res.status(500).json({ message: "Errore durante l'archiviazione" });
  }
});

// POST Unarchive Category
router.post('/disarchivia', authenticateToken, async (req, res) => {
  try {
    const { tipo, categoria } = req.body;

    if (!tipo || !categoria || !['spese', 'entrate'].includes(tipo)) {
      return res.status(400).json({ message: "Tipo e categoria richiesti" });
    }

    await CategoriaArchiviata.deleteOne({ userId: req.user.userId, tipo, categoria });

    res.json({ message: "Categoria riattivata" });
  } catch (error) {
    console.error('❌ Unarchive Category Error:', error);
    res.status(500).json({ message: "Errore durante la riattivazione" });
  }
});

// GET Category Icons
router.get('/icons', authenticateToken, async (req, res) => {
  try {
    const { tipo } = req.query;
    const query = { userId: req.user.userId };
    if (tipo && ['spese', 'entrate'].includes(tipo)) {
      query.tipo = tipo;
    }

    const icons = await CategoryIcon.find(query);
    const map = {};
    icons.forEach(i => {
      map[i.categoria] = i.icona;
    });

    res.json({ success: true, data: map });
  } catch (error) {
    console.error('❌ GET Category Icons Error:', error);
    res.status(500).json({ success: false, message: "Errore nel recupero delle icone categoria" });
  }
});

// PUT Set Category Icon
router.put('/icons', authenticateToken, async (req, res) => {
  try {
    const { tipo, categoria, icona } = req.body;

    if (!tipo || !categoria || !icona || !['spese', 'entrate'].includes(tipo)) {
      return res.status(400).json({ success: false, message: "Tipo, categoria e icona richiesti" });
    }

    await CategoryIcon.updateOne(
      { userId: req.user.userId, tipo, categoria },
      { $set: { icona } },
      { upsert: true }
    );

    res.json({ success: true, message: "Icona categoria salvata" });
  } catch (error) {
    console.error('❌ PUT Category Icon Error:', error);
    res.status(500).json({ success: false, message: "Errore nel salvataggio dell'icona" });
  }
});

module.exports = router;