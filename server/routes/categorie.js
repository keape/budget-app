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
    const userBudgets = await collection.find({ userId: req.user.userId }).toArray();
    console.log(`📋 Found ${userBudgets.length} budget documents for user`);
    
    // Extract unique categories from all budget settings
    const speseSet = new Set();
    const entrateSet = new Set();
    
    // Base categories
    const categorieSpeseDiBase = [
      "Abbigliamento", "Abbonamenti", "Acqua", "Alimentari", "Altre spese", "Bar",
      "Cinema Mostre Cultura", "Elettricità", "Giardinaggio/Agricoltura/Falegnameria",
      "Manutenzione/Arredamento casa", "Mutuo", "Regali", "Ristorante", "Salute",
      "Sport/Attrezzatura sportiva", "Tecnologia", "Vacanza", "Vela"
    ];
    
    const categorieEntrateDiBase = [
      "Altra entrata", "Consulenze", "Interessi", "MBO", "Stipendio", "Ticket", "Welfare"
    ];
    
    // Add base categories
    categorieSpeseDiBase.forEach(cat => speseSet.add(cat));
    categorieEntrateDiBase.forEach(cat => entrateSet.add(cat));
    
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

module.exports = router;