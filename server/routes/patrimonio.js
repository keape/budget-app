const express = require('express');
const Fotografia = require('../models/Fotografia');
const { authenticateToken } = require('./auth');
const { logError } = require('../utils/logger');
const patrimonio = require('../services/patrimonio');
const router = express.Router();

// Il Patrimonio complessivo: la vista che la Home mostra come blocco centrale, più le
// Fotografie mensili da cui si costruisce il grafico dell'andamento.

// GET /api/patrimonio — patrimonio di adesso, voci raggruppate (Denaro, Beni, Debiti),
// Fotografia del mese e storico.
//
// La lettura scrive la Fotografia del mese in corso: è volutamente idempotente e
// provvisoria (vedi models/Fotografia.js), così lo storico comincia a esistere senza
// dipendere da un cron che su Render non è affidabile.
router.get('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    await patrimonio.riparaMovimentiOrfani(userId);
    const dati = await patrimonio.calcolaPatrimonio(userId);
    const fotografia = await patrimonio.fotografiaDelMeseCorrente(userId, dati);
    const fotografie = await Fotografia.find({ userId }).sort({ anno: 1, mese: 1 });

    return res.json({
      success: true,
      data: {
        patrimonio: dati.patrimonio,
        attivita: dati.attivita,
        debiti: dati.debiti,
        gruppi: dati.gruppi,
        voci: dati.voci,
        fotografiaCorrente: fotografia,
        fotografie: fotografie.map((f) => ({
          anno: f.anno,
          mese: f.mese,
          patrimonio: f.patrimonio,
          attivita: f.attivita,
          debiti: f.debiti,
          chiusa: f.chiusa,
          data: f.data
        }))
      }
    });
  } catch (err) {
    logError('❌ Errore nel calcolo del patrimonio:', err);
    return res.status(500).json({ success: false, error: 'Errore nel calcolo del patrimonio' });
  }
});

// GET /api/patrimonio/fotografie — solo lo storico, senza scrivere nulla.
router.get('/fotografie', authenticateToken, async (req, res) => {
  try {
    const fotografie = await Fotografia.find({ userId: req.user.userId }).sort({ anno: 1, mese: 1 });
    return res.json({ success: true, data: fotografie });
  } catch (err) {
    logError('❌ Errore nel recupero delle fotografie:', err);
    return res.status(500).json({ success: false, error: 'Errore nel recupero delle fotografie' });
  }
});

// POST /api/patrimonio/fotografie — scrive la Fotografia di un mese indicato (o di quello
// corrente). Serve quando si chiude un mese a mano; il passato non è ricostruibile e
// quindi non si riscrive all'indietro.
router.post('/fotografie', authenticateToken, async (req, res) => {
  try {
    const oggi = new Date();
    const anno = req.body.anno === undefined ? oggi.getFullYear() : Number(req.body.anno);
    const mese = req.body.mese === undefined ? oggi.getMonth() : Number(req.body.mese);

    if (!Number.isInteger(anno) || !Number.isInteger(mese) || mese < 0 || mese > 11) {
      return res.status(400).json({ success: false, error: 'Anno o mese non validi' });
    }

    const dati = await patrimonio.calcolaPatrimonio(req.user.userId);
    const fotografia = await patrimonio.salvaFotografia(req.user.userId, anno, mese, dati);

    return res.json({ success: true, data: fotografia });
  } catch (err) {
    logError('❌ Errore nel salvataggio della fotografia:', err);
    return res.status(500).json({ success: false, error: 'Errore nel salvataggio della fotografia' });
  }
});

module.exports = router;
