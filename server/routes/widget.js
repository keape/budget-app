const express = require('express');
const Spesa = require('../models/Spesa');
const Entrata = require('../models/Entrata');
const mongoose = require('mongoose');
const { authenticateToken } = require('./auth');
const router = express.Router();

// GET /api/widget/riepilogo — endpoint ottimizzato per widget iOS
// Restituisce in una singola chiamata: saldo, entrate/uscite mese, categorie, ultime transazioni
router.get('/riepilogo', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const oggi = new Date();
    const inizioMese = new Date(oggi.getFullYear(), oggi.getMonth(), 1);
    const fineMese = new Date(oggi.getFullYear(), oggi.getMonth() + 1, 0);

    // Esegui query in parallelo per minimizzare latenza (cold start su Render)
    const [speseMese, entrateMese, ultimeSpese, ultimeEntrate, categorieData] = await Promise.all([
      // Totale spese mese corrente
      Spesa.aggregate([
        { $match: { userId: new mongoose.Types.ObjectId(userId), data: { $gte: inizioMese, $lte: fineMese } } },
        { $group: { _id: null, totale: { $sum: '$importo' } } }
      ]),
      // Totale entrate mese corrente
      Entrata.aggregate([
        { $match: { userId: new mongoose.Types.ObjectId(userId), data: { $gte: inizioMese, $lte: fineMese } } },
        { $group: { _id: null, totale: { $sum: '$importo' } } }
      ]),
      // Ultime 3 spese
      Spesa.find({ userId }).sort({ data: -1 }).limit(3).lean(),
      // Ultime 3 entrate
      Entrata.find({ userId }).sort({ data: -1 }).limit(3).lean(),
      // Categorie dai budget settings
      mongoose.connection.db.collection('budgetsettings_new').find({
        $or: [
          { userId: userId.toString() },
          ...(mongoose.Types.ObjectId.isValid(userId) ? [{ userId: new mongoose.Types.ObjectId(userId) }] : [])
        ]
      }).toArray()
    ]);

    // Calcola totali
    const totaleSpese = speseMese.length > 0 ? Math.abs(speseMese[0].totale) : 0;
    const totaleEntrate = entrateMese.length > 0 ? entrateMese[0].totale : 0;
    const saldo = totaleEntrate - totaleSpese;

    // Unisci e ordina ultime transazioni
    const ultimeTransazioni = [
      ...ultimeSpese.map(s => ({
        id: s._id,
        tipo: 'spesa',
        importo: Math.abs(s.importo),
        categoria: s.categoria,
        descrizione: s.descrizione || '',
        data: s.data
      })),
      ...ultimeEntrate.map(e => ({
        id: e._id,
        tipo: 'entrata',
        importo: e.importo,
        categoria: e.categoria,
        descrizione: e.descrizione || '',
        data: e.data
      }))
    ].sort((a, b) => new Date(b.data) - new Date(a.data)).slice(0, 5);

    // Estrai categorie uniche
    const speseSet = new Set();
    const entrateSet = new Set();
    categorieData.forEach(doc => {
      if (doc.spese && typeof doc.spese === 'object') {
        Object.keys(doc.spese).forEach(c => speseSet.add(c.trim()));
      }
      if (doc.entrate && typeof doc.entrate === 'object') {
        Object.keys(doc.entrate).forEach(c => entrateSet.add(c.trim()));
      }
    });

    res.json({
      success: true,
      saldo: Math.round(saldo * 100) / 100,
      entrateMese: Math.round(totaleEntrate * 100) / 100,
      speseMese: Math.round(totaleSpese * 100) / 100,
      mese: oggi.toLocaleString('it-IT', { month: 'long' }),
      anno: oggi.getFullYear(),
      ultimeTransazioni,
      categorie: {
        spese: Array.from(speseSet).sort((a, b) => a.localeCompare(b, 'it', { sensitivity: 'base' })),
        entrate: Array.from(entrateSet).sort((a, b) => a.localeCompare(b, 'it', { sensitivity: 'base' }))
      }
    });
  } catch (err) {
    console.error('❌ Widget riepilogo error:', err);

    // Graceful fallback: anche se fallisce, prova a restituire dati parziali
    try {
      const oggi = new Date();
      const inizioMese = new Date(oggi.getFullYear(), oggi.getMonth(), 1);
      const fineMese = new Date(oggi.getFullYear(), oggi.getMonth() + 1, 0);

      const [speseRaw, entrateRaw] = await Promise.all([
        Spesa.find({ userId: req.user.userId, data: { $gte: inizioMese, $lte: fineMese } }).lean(),
        Entrata.find({ userId: req.user.userId, data: { $gte: inizioMese, $lte: fineMese } }).lean()
      ]);

      const totSpese = speseRaw.reduce((a, s) => a + Math.abs(s.importo), 0);
      const totEntrate = entrateRaw.reduce((a, e) => a + e.importo, 0);

      return res.json({
        success: true,
        saldo: Math.round((totEntrate - totSpese) * 100) / 100,
        entrateMese: Math.round(totEntrate * 100) / 100,
        speseMese: Math.round(totSpese * 100) / 100,
        mese: oggi.toLocaleString('it-IT', { month: 'long' }),
        anno: oggi.getFullYear(),
        ultimeTransazioni: [],
        categorie: { spese: [], entrate: [] },
        fallback: true
      });
    } catch (fallbackErr) {
      res.status(500).json({
        success: false,
        error: 'Errore nel recupero del riepilogo'
      });
    }
  }
});

module.exports = router;
