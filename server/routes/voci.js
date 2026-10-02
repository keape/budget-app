const express = require('express');
const mongoose = require('mongoose');
const Attivita = require('../models/Attivita');
const Componente = require('../models/Componente');
const TipoVoce = require('../models/TipoVoce');
const Spesa = require('../models/Spesa');
const Entrata = require('../models/Entrata');
const Trasferimento = require('../models/Trasferimento');
const Rettifica = require('../models/Rettifica');
const TransazionePeriodica = require('../models/TransazionePeriodica');
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

// DELETE /api/voci/:id — senza `conMovimenti` si rifiuta la cancellazione di una Voce che ha
// Movimenti (409) e si suggerisce di chiuderla, così lo storico non sparisce per sbaglio.
// Con `?conMovimenti=true` si cancellano anche tutti i suoi Movimenti: compreso ogni
// Trasferimento che la coinvolge, che tocca anche l'altro conto. È l'unica operazione che
// distrugge movimenti, quindi si fa su richiesta esplicita.
// Le Fotografie mensili già scritte restano com'erano: sono la misura del passato.
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const voce = await Attivita.findOne({ _id: req.params.id, userId: req.user.userId });
    if (!voce) {
      return res.status(404).json({ success: false, error: 'Voce patrimoniale non trovata' });
    }

    const componenti = await Componente.find({ voceSpecie: 'attivita', voceId: voce._id });
    const ids = componenti.map((c) => c._id);

    if (!ids.length) {
      await voce.deleteOne();
      return res.json({ success: true, message: 'Voce patrimoniale eliminata', cancellati: null });
    }

    const conteggi = await patrimonio.conteggiMovimentiDellaVoce(req.user.userId, voce._id);
    const conMovimenti = req.query.conMovimenti === 'true' || req.body?.conMovimenti === true;

    if (conteggi.totale > 0 && !conMovimenti) {
      return res.status(409).json({
        success: false,
        error: 'La voce ha movimenti registrati',
        message: `Questa voce ha ${conteggi.totale} movimenti: chiudila invece di cancellarla, così i movimenti restano leggibili. Cancellandola insieme ai movimenti, l'operazione non si annulla.`,
        conteggi
      });
    }

    if (conteggi.totale > 0) {
      await Promise.all([
        Spesa.deleteMany({ userId: req.user.userId, componenteId: { $in: ids } }),
        Entrata.deleteMany({ userId: req.user.userId, componenteId: { $in: ids } }),
        Trasferimento.deleteMany({
          userId: req.user.userId,
          $or: [{ 'da.componenteId': { $in: ids } }, { 'a.componenteId': { $in: ids } }]
        }),
        Rettifica.deleteMany({ userId: req.user.userId, componenteId: { $in: ids } }),
        // Le ricorrenze che puntavano a questo conto tornano senza conto indicato: le loro
        // transazioni finiranno sul Conto principale invece di fallire.
        TransazionePeriodica.updateMany(
          { userId: req.user.userId, voceId: voce._id },
          { $unset: { voceId: '' } }
        )
      ]);
    }

    await Componente.deleteMany({ voceSpecie: 'attivita', voceId: voce._id });
    await voce.deleteOne();

    debugLog('🗑️ Voce eliminata:', voce.nome, conteggi);
    return res.json({
      success: true,
      message: conteggi.totale
        ? `Voce eliminata con ${conteggi.totale} movimenti`
        : 'Voce patrimoniale eliminata',
      cancellati: conteggi
    });
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
