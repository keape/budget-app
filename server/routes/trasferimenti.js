const express = require('express');
const mongoose = require('mongoose');
const Trasferimento = require('../models/Trasferimento');
const Attivita = require('../models/Attivita');
const { authenticateToken } = require('./auth');
const { logError } = require('../utils/logger');
const patrimonio = require('../services/patrimonio');
const router = express.Router();

// Un Trasferimento sposta valore tra due Voci: comprare un gioiello, pagare la carta,
// finanziare il broker, ricevere l'erogazione di un mutuo. NON entra nel budget: se ci
// entrasse, il valore spostato risulterebbe in due posti e gonfierebbe il Patrimonio.

async function risolviEstremo(userId, estremo) {
  if (estremo && estremo.voceId) {
    const { voce, componente, specie } = await patrimonio.risolviVoce(userId, estremo.voceId, estremo.voceSpecie || 'attivita');
    return { voceSpecie: specie, voceId: voce._id, componenteId: componente._id };
  }
  // Senza indicazione: il Conto principale, che è l'origine predefinita dei Trasferimenti.
  const { voce, componente } = await patrimonio.assicuraContoPrincipale(userId);
  return { voceSpecie: 'attivita', voceId: voce._id, componenteId: componente._id };
}

// GET /api/trasferimenti
router.get('/', authenticateToken, async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 200, 1000);
    const trasferimenti = await Trasferimento.find({ userId: req.user.userId })
      .sort({ data: -1 })
      .limit(limit)
      .lean();

    const ids = new Set();
    trasferimenti.forEach((t) => {
      ids.add(String(t.da.voceId));
      ids.add(String(t.a.voceId));
    });

    const voci = ids.size
      ? await Attivita.find({ _id: { $in: [...ids] }, userId: req.user.userId }).select('nome').lean()
      : [];
    const nomePerId = new Map(voci.map((v) => [String(v._id), v.nome]));

    return res.json({
      success: true,
      data: trasferimenti.map((t) => ({
        ...t,
        daNome: nomePerId.get(String(t.da.voceId)) || 'Voce eliminata',
        aNome: nomePerId.get(String(t.a.voceId)) || 'Voce eliminata'
      }))
    });
  } catch (err) {
    logError('❌ Errore nel recupero dei trasferimenti:', err);
    return res.status(500).json({ success: false, error: 'Errore nel recupero dei trasferimenti' });
  }
});

// POST /api/trasferimenti — { daVoceId?, aVoceId, importo, data?, descrizione? }
router.post('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { daVoceId, aVoceId, daVoceSpecie, aVoceSpecie, importo, data, descrizione, origine } = req.body;

    const importoNumerico = Number(importo);
    if (!importo || Number.isNaN(importoNumerico) || importoNumerico <= 0) {
      return res.status(400).json({ success: false, error: 'L\'importo deve essere un numero maggiore di zero' });
    }
    if (!aVoceId) {
      return res.status(400).json({ success: false, error: 'Indica la voce di destinazione' });
    }

    const da = await risolviEstremo(userId, { voceId: daVoceId, voceSpecie: daVoceSpecie });
    const a = await risolviEstremo(userId, { voceId: aVoceId, voceSpecie: aVoceSpecie });

    if (String(da.voceId) === String(a.voceId)) {
      return res.status(400).json({ success: false, error: 'Origine e destinazione devono essere due voci diverse' });
    }

    const trasferimento = await Trasferimento.create({
      userId,
      da,
      a,
      importo: Math.abs(importoNumerico),
      data: data ? new Date(data) : new Date(),
      descrizione: descrizione ? String(descrizione) : '',
      origine: origine === 'sistema' ? 'sistema' : 'utente'
    });

    return res.status(201).json({ success: true, data: trasferimento });
  } catch (err) {
    if (err instanceof patrimonio.ErroreVoce) {
      return res.status(err.status || 400).json({ success: false, error: err.message });
    }
    logError('❌ Errore nella creazione del trasferimento:', err);
    return res.status(500).json({ success: false, error: 'Errore nella creazione del trasferimento' });
  }
});

// PUT /api/trasferimenti/:id — corregge importo, data, descrizione e, se indicati, i due
// estremi. L'importo resta positivo: la direzione la dà la coppia da → a.
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(String(req.params.id))) {
      return res.status(400).json({ success: false, error: 'Trasferimento non valido' });
    }

    const trasferimento = await Trasferimento.findOne({ _id: req.params.id, userId: req.user.userId });
    if (!trasferimento) {
      return res.status(404).json({ success: false, error: 'Trasferimento non trovato' });
    }

    const { daVoceId, aVoceId, daVoceSpecie, aVoceSpecie, importo, data, descrizione } = req.body;
    const aggiornamento = {};

    if (importo !== undefined) {
      const importoNumerico = Number(importo);
      if (importo === null || importo === '' || Number.isNaN(importoNumerico) || importoNumerico <= 0) {
        return res.status(400).json({ success: false, error: 'L\'importo deve essere un numero maggiore di zero' });
      }
      aggiornamento.importo = Math.abs(importoNumerico);
    }
    if (data !== undefined) aggiornamento.data = data ? new Date(data) : new Date();
    if (descrizione !== undefined) aggiornamento.descrizione = String(descrizione);

    // Gli estremi si cambiano solo se il client li indica: senza, il Trasferimento resta
    // fra i due conti su cui era stato registrato.
    const da = daVoceId ? await risolviEstremo(req.user.userId, { voceId: daVoceId, voceSpecie: daVoceSpecie }) : trasferimento.da;
    const a = aVoceId ? await risolviEstremo(req.user.userId, { voceId: aVoceId, voceSpecie: aVoceSpecie }) : trasferimento.a;
    if (String(da.voceId) === String(a.voceId)) {
      return res.status(400).json({ success: false, error: 'Origine e destinazione devono essere due voci diverse' });
    }
    aggiornamento.da = da;
    aggiornamento.a = a;

    const salvato = await Trasferimento.findOneAndUpdate(
      { _id: trasferimento._id, userId: req.user.userId },
      aggiornamento,
      { new: true }
    );
    return res.json({ success: true, data: salvato });
  } catch (err) {
    if (err instanceof patrimonio.ErroreVoce) {
      return res.status(err.status || 400).json({ success: false, error: err.message });
    }
    logError('❌ Errore nella modifica del trasferimento:', err);
    return res.status(500).json({ success: false, error: 'Errore nella modifica del trasferimento' });
  }
});

// DELETE /api/trasferimenti/:id
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(String(req.params.id))) {
      return res.status(400).json({ success: false, error: 'Trasferimento non valido' });
    }
    const esito = await Trasferimento.deleteOne({ _id: req.params.id, userId: req.user.userId });
    if (!esito.deletedCount) {
      return res.status(404).json({ success: false, error: 'Trasferimento non trovato' });
    }
    return res.json({ success: true, message: 'Trasferimento eliminato' });
  } catch (err) {
    logError('❌ Errore nell\'eliminazione del trasferimento:', err);
    return res.status(500).json({ success: false, error: 'Errore nell\'eliminazione del trasferimento' });
  }
});

module.exports = router;
