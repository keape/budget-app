const express = require('express');
const mongoose = require('mongoose');
const Rettifica = require('../models/Rettifica');
const Componente = require('../models/Componente');
const { authenticateToken } = require('./auth');
const { logError } = require('../utils/logger');
const patrimonio = require('../services/patrimonio');
const router = express.Router();

// Una Rettifica cambia il valore di UNA sola Voce, senza controparte: una rivalutazione,
// un interesse addebitato, il saldo vero del conto corrente. NON entra nel budget.

// GET /api/rettifiche
router.get('/', authenticateToken, async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 200, 1000);
    const rettifiche = await Rettifica.find({ userId: req.user.userId })
      .sort({ data: -1 })
      .limit(limit)
      .lean();
    return res.json({ success: true, data: rettifiche });
  } catch (err) {
    logError('❌ Errore nel recupero delle rettifiche:', err);
    return res.status(500).json({ success: false, error: 'Errore nel recupero delle rettifiche' });
  }
});

// POST /api/rettifiche — { voceId, importo, data?, descrizione?, componenteId? }
// L'importo è un delta con segno: positivo se il valore sale.
router.post('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { voceId, voceSpecie, componenteId, importo, data, descrizione, origine } = req.body;

    const importoNumerico = Number(importo);
    if (importo === undefined || importo === null || importo === '' || Number.isNaN(importoNumerico)) {
      return res.status(400).json({ success: false, error: 'L\'importo deve essere un numero' });
    }
    if (importoNumerico === 0) {
      return res.status(400).json({ success: false, error: 'Una rettifica di zero non cambia nulla' });
    }

    const { voce, componente, specie } = await patrimonio.risolviVoce(userId, voceId, voceSpecie || 'attivita');

    let componenteScelta = componente;
    if (componenteId) {
      const trovata = await Componente.findOne({ _id: componenteId, userId });
      if (!trovata) {
        return res.status(400).json({ success: false, error: 'Componente non trovata' });
      }
      componenteScelta = trovata;
    }

    const rettifica = await Rettifica.create({
      userId,
      voceSpecie: specie,
      voceId: voce._id,
      componenteId: componenteScelta._id,
      importo: importoNumerico,
      data: data ? new Date(data) : new Date(),
      descrizione: descrizione ? String(descrizione) : '',
      origine: origine === 'sistema' ? 'sistema' : 'utente'
    });

    return res.status(201).json({ success: true, data: rettifica });
  } catch (err) {
    if (err instanceof patrimonio.ErroreVoce) {
      return res.status(err.status || 400).json({ success: false, error: err.message });
    }
    logError('❌ Errore nella creazione della rettifica:', err);
    return res.status(500).json({ success: false, error: 'Errore nella creazione della rettifica' });
  }
});

// PATCH /api/rettifiche/:id — corregge importo, data o descrizione. Non cambia il conto:
// una Rettifica appartiene alla Voce su cui è stata registrata, e il conto si corregge
// dalla scheda del conto, non da qui.
router.patch('/:id', authenticateToken, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(String(req.params.id))) {
      return res.status(400).json({ success: false, error: 'Rettifica non valida' });
    }

    const { importo, data, descrizione } = req.body;
    const aggiornamento = {};

    if (importo !== undefined) {
      const importoNumerico = Number(importo);
      if (importo === null || importo === '' || Number.isNaN(importoNumerico)) {
        return res.status(400).json({ success: false, error: 'L\'importo deve essere un numero' });
      }
      if (importoNumerico === 0) {
        return res.status(400).json({ success: false, error: 'Una rettifica di zero non cambia nulla' });
      }
      aggiornamento.importo = importoNumerico;
    }
    if (data !== undefined) aggiornamento.data = data ? new Date(data) : new Date();
    if (descrizione !== undefined) aggiornamento.descrizione = String(descrizione);

    if (!Object.keys(aggiornamento).length) {
      return res.status(400).json({ success: false, error: 'Nessuna modifica indicata' });
    }

    const rettifica = await Rettifica.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.userId },
      aggiornamento,
      { new: true }
    );
    if (!rettifica) {
      return res.status(404).json({ success: false, error: 'Rettifica non trovata' });
    }
    return res.json({ success: true, data: rettifica });
  } catch (err) {
    logError('❌ Errore nella modifica della rettifica:', err);
    return res.status(500).json({ success: false, error: 'Errore nella modifica della rettifica' });
  }
});

// DELETE /api/rettifiche/:id
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(String(req.params.id))) {
      return res.status(400).json({ success: false, error: 'Rettifica non valida' });
    }
    const esito = await Rettifica.deleteOne({ _id: req.params.id, userId: req.user.userId });
    if (!esito.deletedCount) {
      return res.status(404).json({ success: false, error: 'Rettifica non trovata' });
    }
    return res.json({ success: true, message: 'Rettifica eliminata' });
  } catch (err) {
    logError('❌ Errore nell\'eliminazione della rettifica:', err);
    return res.status(500).json({ success: false, error: 'Errore nell\'eliminazione della rettifica' });
  }
});

module.exports = router;
