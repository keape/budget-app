const express = require('express');
const mongoose = require('mongoose');
const Attivita = require('../models/Attivita');
const Componente = require('../models/Componente');
const TipoVoce = require('../models/TipoVoce');
const Spesa = require('../models/Spesa');
const Entrata = require('../models/Entrata');
const Trasferimento = require('../models/Trasferimento');
const Rettifica = require('../models/Rettifica');
const { authenticateToken } = require('./auth');
const { debugLog, logError } = require('../utils/logger');
const patrimonio = require('../services/patrimonio');
const router = express.Router();

// Le Voci patrimoniali: i conti (contanti e conti correnti nella Fetta 1; investimenti,
// immobili, veicoli e beni nella Fetta 3) e le loro Componenti.

const idValido = (valore) => mongoose.Types.ObjectId.isValid(String(valore || ''));

// GET /api/voci — le Voci dell'utente con il valore calcolato, più il catalogo dei Tipi.
router.get('/', authenticateToken, async (req, res) => {
  try {
    const dati = await patrimonio.calcolaPatrimonio(req.user.userId);
    const tipi = await patrimonio.assicuraCatalogoTipi(req.user.userId);

    return res.json({
      success: true,
      data: {
        voci: dati.voci,
        gruppi: dati.gruppi,
        patrimonio: dati.patrimonio,
        attivita: dati.attivita,
        debiti: dati.debiti,
        tipi: tipi.map((t) => ({
          id: t._id,
          nome: t.nome,
          specie: t.specie,
          denaro: t.denaro,
          pianoAmmortamento: t.pianoAmmortamento,
          sistema: t.sistema,
          archiviato: t.archiviato
        }))
      }
    });
  } catch (err) {
    logError('❌ Errore nel recupero delle voci patrimoniali:', err);
    return res.status(500).json({ success: false, error: 'Errore nel recupero delle voci patrimoniali' });
  }
});

// GET /api/voci/:id — la scheda di un conto: valore, storia mese per mese e Movimenti.
// Prima di leggerla ripara gli eventuali Movimenti senza Componente, altrimenti la lista
// del conto mostrerebbe meno movimenti di quelli che il conto contiene.
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    if (!idValido(req.params.id)) {
      return res.status(400).json({ success: false, error: 'Voce non valida' });
    }
    await patrimonio.riparaMovimentiOrfani(req.user.userId);
    const dettaglio = await patrimonio.dettaglioVoce(req.user.userId, req.params.id);
    if (!dettaglio) {
      return res.status(404).json({ success: false, error: 'Voce patrimoniale non trovata' });
    }
    return res.json({ success: true, data: dettaglio });
  } catch (err) {
    logError('❌ Errore nel dettaglio della voce patrimoniale:', err);
    return res.status(500).json({ success: false, error: 'Errore nel dettaglio della voce patrimoniale' });
  }
});

// POST /api/voci — crea un'Attività (un conto) e la sua Componente predefinita.
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { nome, tipoId, note } = req.body;
    if (!nome || !String(nome).trim()) {
      return res.status(400).json({ success: false, error: 'Il nome della voce è obbligatorio' });
    }
    if (!idValido(tipoId)) {
      return res.status(400).json({ success: false, error: 'Tipo di voce mancante o non valido' });
    }

    const tipo = await TipoVoce.findOne({ _id: tipoId, userId: req.user.userId });
    if (!tipo) {
      return res.status(400).json({ success: false, error: 'Tipo di voce non trovato' });
    }
    if (tipo.specie === 'debito') {
      return res.status(400).json({
        success: false,
        error: 'I Debiti saranno gestiti in una fetta successiva',
        message: 'Oggi si possono creare solo Attività (denaro e beni).'
      });
    }

    const voce = await Attivita.create({
      userId: req.user.userId,
      nome: String(nome).trim(),
      tipoId: tipo._id,
      note: note ? String(note) : ''
    });

    const componente = await patrimonio.componentePredefinita(req.user.userId, 'attivita', voce._id);
    debugLog('✅ Voce patrimoniale creata:', voce.nome);

    return res.status(201).json({
      success: true,
      message: `Voce "${voce.nome}" creata`,
      data: { id: voce._id, nome: voce.nome, tipoId: voce.tipoId, componenteId: componente._id }
    });
  } catch (err) {
    logError('❌ Errore nella creazione della voce patrimoniale:', err);
    return res.status(500).json({ success: false, error: 'Errore nella creazione della voce patrimoniale' });
  }
});

// PATCH /api/voci/:id — rinomina, cambia Tipo, archivia o ripristina.
router.patch('/:id', authenticateToken, async (req, res) => {
  try {
    const { nome, tipoId, note, archiviata } = req.body;
    const voce = await Attivita.findOne({ _id: req.params.id, userId: req.user.userId });
    if (!voce) {
      return res.status(404).json({ success: false, error: 'Voce patrimoniale non trovata' });
    }

    if (nome !== undefined) {
      if (!String(nome).trim()) {
        return res.status(400).json({ success: false, error: 'Il nome della voce è obbligatorio' });
      }
      voce.nome = String(nome).trim();
    }
    if (note !== undefined) voce.note = String(note);
    if (archiviata !== undefined) voce.archiviata = Boolean(archiviata);
    if (tipoId !== undefined) {
      const tipo = await TipoVoce.findOne({ _id: tipoId, userId: req.user.userId });
      if (!tipo) return res.status(400).json({ success: false, error: 'Tipo di voce non trovato' });
      if (tipo.specie === 'debito') {
        return res.status(400).json({ success: false, error: 'Un\'Attività non può diventare un Debito' });
      }
      voce.tipoId = tipo._id;
    }

    await voce.save();
    return res.json({ success: true, data: voce });
  } catch (err) {
    logError('❌ Errore nella modifica della voce patrimoniale:', err);
    return res.status(500).json({ success: false, error: 'Errore nella modifica della voce patrimoniale' });
  }
});

// DELETE /api/voci/:id — solo se la Voce non ha Movimenti: altrimenti si archivia.
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const voce = await Attivita.findOne({ _id: req.params.id, userId: req.user.userId });
    if (!voce) {
      return res.status(404).json({ success: false, error: 'Voce patrimoniale non trovata' });
    }

    const componenti = await Componente.find({ voceSpecie: 'attivita', voceId: voce._id });
    const ids = componenti.map((c) => c._id);
    const [spese, entrate, uscite, entrateTrasferite, rettifiche] = await Promise.all([
      ids.length ? Spesa.countDocuments({ componenteId: { $in: ids } }) : 0,
      ids.length ? Entrata.countDocuments({ componenteId: { $in: ids } }) : 0,
      ids.length ? Trasferimento.countDocuments({ 'da.componenteId': { $in: ids } }) : 0,
      ids.length ? Trasferimento.countDocuments({ 'a.componenteId': { $in: ids } }) : 0,
      ids.length ? Rettifica.countDocuments({ componenteId: { $in: ids } }) : 0
    ]);
    const movimenti = spese + entrate + uscite + entrateTrasferite + rettifiche;

    if (movimenti > 0) {
      return res.status(409).json({
        success: false,
        error: 'La voce ha movimenti registrati',
        message: `Questa voce ha ${movimenti} movimenti: archiviala invece di cancellarla, così i movimenti restano leggibili.`
      });
    }

    await Componente.deleteMany({ voceSpecie: 'attivita', voceId: voce._id });
    await voce.deleteOne();
    return res.json({ success: true, message: 'Voce patrimoniale eliminata' });
  } catch (err) {
    logError('❌ Errore nell\'eliminazione della voce patrimoniale:', err);
    return res.status(500).json({ success: false, error: 'Errore nell\'eliminazione della voce patrimoniale' });
  }
});

// POST /api/voci/:id/componenti — aggiunge un pezzo alla Voce (Fetta 3: i gioielli,
// i titoli). Nella Fetta 1 i conti di cassa ne hanno una sola, creata da sola.
router.post('/:id/componenti', authenticateToken, async (req, res) => {
  try {
    const voce = await Attivita.findOne({ _id: req.params.id, userId: req.user.userId });
    if (!voce) {
      return res.status(404).json({ success: false, error: 'Voce patrimoniale non trovata' });
    }

    const { nome, valorizzazione, valutazione, costoAcquisto, dataCosto, documento } = req.body;
    if (!nome || !String(nome).trim()) {
      return res.status(400).json({ success: false, error: 'Il nome della componente è obbligatorio' });
    }
    const modalita = valorizzazione || 'dichiarata';
    if (!['movimenti', 'mercato', 'dichiarata'].includes(modalita)) {
      return res.status(400).json({ success: false, error: 'Valorizzazione non valida' });
    }

    const componente = await Componente.create({
      userId: req.user.userId,
      voceSpecie: 'attivita',
      voceId: voce._id,
      nome: String(nome).trim(),
      valorizzazione: modalita,
      valutazione: valutazione === undefined || valutazione === null ? undefined : Number(valutazione),
      dataValutazione: valutazione === undefined || valutazione === null ? undefined : new Date(),
      costoAcquisto: costoAcquisto === undefined || costoAcquisto === null ? undefined : Number(costoAcquisto),
      dataCosto: dataCosto ? new Date(dataCosto) : undefined,
      documento: documento ? String(documento) : ''
    });

    return res.status(201).json({ success: true, data: componente });
  } catch (err) {
    logError('❌ Errore nella creazione della componente:', err);
    return res.status(500).json({ success: false, error: 'Errore nella creazione della componente' });
  }
});

module.exports = router;
