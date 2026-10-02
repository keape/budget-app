const express = require('express');
const TipoVoce = require('../models/TipoVoce');
const Attivita = require('../models/Attivita');
const { authenticateToken } = require('./auth');
const { logError } = require('../utils/logger');
const patrimonio = require('../services/patrimonio');
const router = express.Router();

// Il catalogo dei Tipi di voce è dell'utente: aggiungere «barca» o «cripto» è un dato,
// non codice. Il Tipo decide la specie della Voce (Attività o Debito) e, dentro le
// Attività, se è denaro o bene materiale. `ordine` decide dove compare nel menù.

// GET /api/tipi-voce
router.get('/', authenticateToken, async (req, res) => {
  try {
    const tipi = await patrimonio.assicuraCatalogoTipi(req.user.userId);
    return res.json({ success: true, data: tipi });
  } catch (err) {
    logError('❌ Errore nel recupero dei tipi di voce:', err);
    return res.status(500).json({ success: false, error: 'Errore nel recupero dei tipi di voce' });
  }
});

// POST /api/tipi-voce — { nome, specie: 'attivita'|'debito', denaro?, pianoAmmortamento?, ordine? }
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { nome, specie, denaro, pianoAmmortamento, ordine } = req.body;
    if (!nome || !String(nome).trim()) {
      return res.status(400).json({ success: false, error: 'Il nome del tipo è obbligatorio' });
    }
    if (!['attivita', 'debito'].includes(specie)) {
      return res.status(400).json({ success: false, error: 'La specie deve essere "attivita" o "debito"' });
    }

    const tipo = await TipoVoce.create({
      userId: req.user.userId,
      nome: String(nome).trim(),
      specie,
      denaro: specie === 'attivita' ? Boolean(denaro) : false,
      pianoAmmortamento: specie === 'debito' ? Boolean(pianoAmmortamento) : false,
      ordine: ordine === undefined ? undefined : Number(ordine),
      sistema: false
    });

    return res.status(201).json({ success: true, data: tipo });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ success: false, error: 'Esiste già un tipo con questo nome' });
    }
    logError('❌ Errore nella creazione del tipo di voce:', err);
    return res.status(500).json({ success: false, error: 'Errore nella creazione del tipo di voce' });
  }
});

// PATCH /api/tipi-voce/:id — rinomina, archivia, cambia denaro/piano di ammortamento/ordine.
// La specie non si cambia: un Debito non diventa un'Attività per sbaglio.
router.patch('/:id', authenticateToken, async (req, res) => {
  try {
    const { nome, denaro, pianoAmmortamento, archiviato, ordine } = req.body;
    const tipo = await TipoVoce.findOne({ _id: req.params.id, userId: req.user.userId });
    if (!tipo) {
      return res.status(404).json({ success: false, error: 'Tipo di voce non trovato' });
    }

    if (nome !== undefined) {
      if (!String(nome).trim()) {
        return res.status(400).json({ success: false, error: 'Il nome del tipo è obbligatorio' });
      }
      tipo.nome = String(nome).trim();
    }
    if (denaro !== undefined && tipo.specie === 'attivita') tipo.denaro = Boolean(denaro);
    if (pianoAmmortamento !== undefined && tipo.specie === 'debito') tipo.pianoAmmortamento = Boolean(pianoAmmortamento);
    if (archiviato !== undefined) tipo.archiviato = Boolean(archiviato);
    if (ordine !== undefined && !Number.isNaN(Number(ordine))) tipo.ordine = Number(ordine);

    await tipo.save();
    return res.json({ success: true, data: tipo });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ success: false, error: 'Esiste già un tipo con questo nome' });
    }
    logError('❌ Errore nella modifica del tipo di voce:', err);
    return res.status(500).json({ success: false, error: 'Errore nella modifica del tipo di voce' });
  }
});

// DELETE /api/tipi-voce/:id — solo se nessuna Voce lo usa.
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const tipo = await TipoVoce.findOne({ _id: req.params.id, userId: req.user.userId });
    if (!tipo) {
      return res.status(404).json({ success: false, error: 'Tipo di voce non trovato' });
    }

    // I Tipi del catalogo si rinominano o si archiviano, non si cancellano: se sparissero
    // tornerebbero alla prima lettura del catalogo, e l'utente crederebbe di averli tolti.
    if (tipo.sistema) {
      return res.status(409).json({
        success: false,
        error: 'Tipo del catalogo',
        message: 'I tipi del catalogo si possono rinominare o archiviare, non eliminare.'
      });
    }

    const voci = await Attivita.countDocuments({ userId: req.user.userId, tipoId: tipo._id });
    if (voci > 0) {
      return res.status(409).json({
        success: false,
        error: 'Il tipo è in uso',
        message: `${voci} voci usano questo tipo: cambia il loro tipo oppure archivialo.`
      });
    }

    await tipo.deleteOne();
    return res.json({ success: true, message: 'Tipo di voce eliminato' });
  } catch (err) {
    logError('❌ Errore nell\'eliminazione del tipo di voce:', err);
    return res.status(500).json({ success: false, error: 'Errore nell\'eliminazione del tipo di voce' });
  }
});

module.exports = router;
