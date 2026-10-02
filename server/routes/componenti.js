const express = require('express');
const Componente = require('../models/Componente');
const Spesa = require('../models/Spesa');
const Entrata = require('../models/Entrata');
const Trasferimento = require('../models/Trasferimento');
const Rettifica = require('../models/Rettifica');
const { authenticateToken } = require('./auth');
const { logError } = require('../utils/logger');
const router = express.Router();

// Le Componenti di una Voce: la scheda del singolo pezzo (un titolo, un gioiello, la
// liquidità di un conto). Il valore della Voce è la somma di queste.

const ricavaUtente = (req) => req.user.userId;

// PATCH /api/componenti/:id — nome, costo di acquisto, nuova Valutazione, chiusura.
router.patch('/:id', authenticateToken, async (req, res) => {
  try {
    const { nome, costoAcquisto, dataCosto, valutazione, notaValutazione, documento, chiusa, realizzo, predefinita } = req.body;

    const componente = await Componente.findOne({ _id: req.params.id, userId: ricavaUtente(req) });
    if (!componente) {
      return res.status(404).json({ success: false, error: 'Componente non trovata' });
    }

    if (nome !== undefined) {
      if (!String(nome).trim()) {
        return res.status(400).json({ success: false, error: 'Il nome della componente è obbligatorio' });
      }
      componente.nome = String(nome).trim();
    }
    if (documento !== undefined) componente.documento = String(documento);
    if (costoAcquisto !== undefined) {
      componente.costoAcquisto = costoAcquisto === null ? undefined : Number(costoAcquisto);
    }
    if (dataCosto !== undefined) componente.dataCosto = dataCosto ? new Date(dataCosto) : undefined;

    // Una nuova Valutazione si aggiunge allo storico: il costo dice quanto è costata, le
    // valutazioni quanto vale.
    if (valutazione !== undefined && valutazione !== null) {
      const valore = Number(valutazione);
      if (Number.isNaN(valore)) {
        return res.status(400).json({ success: false, error: 'Valutazione non valida' });
      }
      componente.valutazione = valore;
      componente.dataValutazione = new Date();
      componente.valutazioni.push({ valore, data: new Date(), nota: notaValutazione ? String(notaValutazione) : '' });
    }

    if (predefinita === true) {
      await Componente.updateMany(
        { voceSpecie: componente.voceSpecie, voceId: componente.voceId, _id: { $ne: componente._id } },
        { $set: { predefinita: false } }
      );
      componente.predefinita = true;
    }

    if (chiusa === true) {
      componente.chiusa = true;
      componente.dataChiusura = new Date();
      componente.realizzo = realizzo === undefined || realizzo === null ? undefined : Number(realizzo);
    } else if (chiusa === false) {
      componente.chiusa = false;
      componente.dataChiusura = undefined;
    }

    await componente.save();
    return res.json({ success: true, data: componente });
  } catch (err) {
    logError('❌ Errore nella modifica della componente:', err);
    return res.status(500).json({ success: false, error: 'Errore nella modifica della componente' });
  }
});

// DELETE /api/componenti/:id — solo se non ha Movimenti (una Componente con movimenti
// si chiude, non si cancella: altrimenti il patrimonio perderebbe la sua storia).
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const componente = await Componente.findOne({ _id: req.params.id, userId: ricavaUtente(req) });
    if (!componente) {
      return res.status(404).json({ success: false, error: 'Componente non trovata' });
    }

    const [spese, entrate, uscite, entrateTrasferite, rettifiche] = await Promise.all([
      Spesa.countDocuments({ componenteId: componente._id }),
      Entrata.countDocuments({ componenteId: componente._id }),
      Trasferimento.countDocuments({ 'da.componenteId': componente._id }),
      Trasferimento.countDocuments({ 'a.componenteId': componente._id }),
      Rettifica.countDocuments({ componenteId: componente._id })
    ]);
    const movimenti = spese + entrate + uscite + entrateTrasferite + rettifiche;

    if (movimenti > 0) {
      return res.status(409).json({
        success: false,
        error: 'La componente ha movimenti registrati',
        message: `Questa componente ha ${movimenti} movimenti: chiudila invece di cancellarla.`
      });
    }

    await componente.deleteOne();
    return res.json({ success: true, message: 'Componente eliminata' });
  } catch (err) {
    logError('❌ Errore nell\'eliminazione della componente:', err);
    return res.status(500).json({ success: false, error: 'Errore nell\'eliminazione della componente' });
  }
});

module.exports = router;
