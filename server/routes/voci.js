const express = require('express');
const mongoose = require('mongoose');
const Attivita = require('../models/Attivita');
const Debito = require('../models/Debito');
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
// immobili, veicoli e beni nella Fetta 3) e i Debiti (mutui, finanziamenti, carte), con le
// loro Componenti. Le due specie vivono in due collezioni (ADR-0006): le rotte qui sotto
// lavorano su una o sull'altra a seconda del Tipo scelto, e quando la specie non è indicata
// la deducono cercando in tutte e due.

const idValido = (valore) => mongoose.Types.ObjectId.isValid(String(valore || ''));

// Trova una Voce in una delle due collezioni. La specie può arrivare dal client; se non
// arriva, o se è sbagliata, si guarda anche nell'altra: una risposta «non trovata» sbagliata
// è peggio di una lettura in più.
async function trovaVoce(userId, id, specieIndicata) {
  const ordine = specieIndicata === 'debito' ? ['debito', 'attivita'] : ['attivita', 'debito'];
  for (const specie of ordine) {
    const voce = await (specie === 'debito' ? Debito : Attivita).findOne({ _id: id, userId });
    if (voce) return { voce, specie };
  }
  return { voce: null, specie: null };
}

// Una data di calendario come la scrive un <input type="date">: mezzanotte UTC, che è il
// modo in cui il resto dell'app scrive le date. Una data con l'ora si prende com'è.
function dataScelta(valore) {
  const testo = String(valore || '');
  if (/^\d{4}-\d{2}-\d{2}$/.test(testo)) return new Date(`${testo}T00:00:00.000Z`);
  const data = new Date(valore);
  return Number.isNaN(data.getTime()) ? null : data;
}

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

// POST /api/voci — crea una Voce: un'Attività (un conto, un bene) o un Debito, secondo la
// specie del Tipo scelto (ADR-0006). La Voce nasce con la sua Componente predefinita.
//
// Un Debito nasce con il residuo di oggi, che è il suo valore di partenza: si registra come
// Rettifica (importo negativo, perché il residuo è l'opposto dei Movimenti) con origine di
// sistema, così è riconoscibile come la fotografia iniziale e non come una correzione
// dell'utente. Del piano bastano residuo, rata e scadenza: il resto lo ricava il Debito.
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { nome, tipoId, note, importo, rata, scadenza, tasso, categoriaRata, giornoRata } = req.body;
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
      const residuo = Number(importo);
      if (!Number.isFinite(residuo) || residuo <= 0) {
        return res.status(400).json({
          success: false,
          error: 'Indica il residuo del debito',
          message: 'Quanto devi oggi: è il valore di partenza del debito.'
        });
      }

      const rataNumerica = Number(rata);
      const dataScadenza = dataScelta(scadenza);
      // Con un piano di ammortamento rata e scadenza sono obbligatorie: senza, il debito non
      // ha modo di dire quanto manca. Una carta di credito non ha piano, e ha solo il residuo.
      if (tipo.pianoAmmortamento) {
        if (!Number.isFinite(rataNumerica) || rataNumerica <= 0) {
          return res.status(400).json({
            success: false,
            error: 'Indica la rata',
            message: `Per un debito di tipo «${tipo.nome}» la rata è necessaria.`
          });
        }
        if (!dataScadenza) {
          return res.status(400).json({
            success: false,
            error: 'Indica la scadenza',
            message: 'La data dell\'ultima rata: da lì il debito conta le rate che restano.'
          });
        }
      }

      const debito = await Debito.create({
        userId: req.user.userId,
        nome: String(nome).trim(),
        tipoId: tipo._id,
        note: note ? String(note) : '',
        rata: Number.isFinite(rataNumerica) && rataNumerica > 0 ? rataNumerica : undefined,
        scadenza: dataScadenza || undefined,
        tasso: Number.isFinite(Number(tasso)) && Number(tasso) > 0 ? Number(tasso) : undefined,
        giornoRata: Number(giornoRata) >= 1 && Number(giornoRata) <= 31 ? Number(giornoRata) : undefined,
        categoriaRata: categoriaRata ? String(categoriaRata).trim() : ''
      });

      const componente = await patrimonio.componentePredefinita(req.user.userId, 'debito', debito._id);
      await Rettifica.create({
        userId: req.user.userId,
        voceSpecie: 'debito',
        voceId: debito._id,
        componenteId: componente._id,
        importo: -Math.abs(residuo),
        descrizione: 'Residuo iniziale',
        origine: 'sistema'
      });

      debugLog('✅ Debito creato:', debito.nome, residuo);
      return res.status(201).json({
        success: true,
        message: `Debito "${debito.nome}" creato con un residuo di ${residuo}`,
        data: {
          id: debito._id,
          nome: debito.nome,
          tipoId: debito.tipoId,
          specie: 'debito',
          componenteId: componente._id,
          residuo
        }
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
      data: { id: voce._id, nome: voce.nome, tipoId: voce.tipoId, specie: 'attivita', componenteId: componente._id }
    });
  } catch (err) {
    logError('❌ Errore nella creazione della voce patrimoniale:', err);
    return res.status(500).json({ success: false, error: 'Errore nella creazione della voce patrimoniale' });
  }
});

// PATCH /api/voci/:id — rinomina, cambia Tipo, archivia o ripristina; per un Debito anche
// il piano (rata, scadenza, tasso, categoria della rata, giorno). Cambiare il piano non
// scrive Movimenti: cambia solo i calcoli della prossima rata.
router.patch('/:id', authenticateToken, async (req, res) => {
  try {
    const { nome, tipoId, note, archiviata, rata, scadenza, tasso, categoriaRata, giornoRata } = req.body;
    const { voce, specie } = await trovaVoce(req.user.userId, req.params.id, req.body.voceSpecie || req.query.specie);
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
      if (tipo.specie !== specie) {
        return res.status(400).json({
          success: false,
          error: specie === 'debito' ? 'Un\'Debito non può diventare un\'Attività' : 'Un\'Attività non può diventare un Debito',
          message: 'La specie è dell\'entità, non del Tipo: per cambiarla si crea una Voce nuova.'
        });
      }
      voce.tipoId = tipo._id;
    }

    if (specie === 'debito') {
      if (rata !== undefined) voce.rata = Number(rata) > 0 ? Number(rata) : undefined;
      if (scadenza !== undefined) voce.scadenza = dataScelta(scadenza) || undefined;
      if (tasso !== undefined) {
        voce.tasso = Number(tasso) > 0 ? Number(tasso) : undefined;
        // Un tasso scritto a mano non è più «ricavato»: il numero è dell'utente.
        voce.tassoRicavato = false;
      }
      if (categoriaRata !== undefined) voce.categoriaRata = String(categoriaRata).trim();
      if (giornoRata !== undefined && Number(giornoRata) >= 1 && Number(giornoRata) <= 31) {
        voce.giornoRata = Number(giornoRata);
      }
    }

    await voce.save();
    return res.json({ success: true, data: { ...voce.toObject(), specie } });
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
    const { voce, specie } = await trovaVoce(req.user.userId, req.params.id, req.body?.voceSpecie || req.query.specie);
    if (!voce) {
      return res.status(404).json({ success: false, error: 'Voce patrimoniale non trovata' });
    }

    const componenti = await Componente.find({ voceSpecie: specie, voceId: voce._id });
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
        // Le rate di un Debito scrivono una Spesa sul CONTO che paga, non sul Debito: senza
        // questa riga la cancellazione di un Debito lascerebbe in giro gli interessi pagati.
        specie === 'debito'
          ? Spesa.deleteMany({ userId: req.user.userId, rataDebitoId: voce._id })
          : Promise.resolve(),
        specie === 'debito'
          ? Trasferimento.deleteMany({ userId: req.user.userId, rataDebitoId: voce._id })
          : Promise.resolve(),,
        // Le ricorrenze che puntavano a questo conto tornano senza conto indicato: le loro
        // transazioni finiranno sul Conto principale invece di fallire.
        TransazionePeriodica.updateMany(
          { userId: req.user.userId, voceId: voce._id },
          { $unset: { voceId: '' } }
        )
      ]);
    }

    await Componente.deleteMany({ voceSpecie: specie, voceId: voce._id });
    await voce.deleteOne();

    debugLog('🗑️ Voce eliminata:', specie, voce.nome, conteggi);
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

// POST /api/voci/:id/componenti — aggiunge un pezzo alla Voce (i gioielli di un conto
// Beni, la liquidità di un conto investimenti, la seconda tranche di un finanziamento).
router.post('/:id/componenti', authenticateToken, async (req, res) => {
  try {
    const { voce, specie } = await trovaVoce(req.user.userId, req.params.id, req.body.voceSpecie || req.query.specie);
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
      voceSpecie: specie,
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
