const express = require('express');
const mongoose = require('mongoose');
const { authenticateToken } = require('./auth');
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

module.exports = router;