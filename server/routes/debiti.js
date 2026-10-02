const express = require('express');
const mongoose = require('mongoose');
const Debito = require('../models/Debito');
const Spesa = require('../models/Spesa');
const Trasferimento = require('../models/Trasferimento');
const Rettifica = require('../models/Rettifica');
const TipoVoce = require('../models/TipoVoce');
const { authenticateToken } = require('./auth');
const { debugLog, logError } = require('../utils/logger');
const patrimonio = require('../services/patrimonio');
const servizioDebiti = require('../services/debiti');
const router = express.Router();

// La meccanica di un Debito (ADR-0004): la rata, il residuo e l'aggiornamento del residuo.
// Il valore di un Debito non si scrive: si legge dai suoi Movimenti (il residuo è l'opposto
// della loro somma). Qui ci sono le sole due operazioni che scrivono Movimenti per conto
// dell'utente — la rata e la correzione del residuo — più l'annullamento di una rata.

const arrotonda = (valore) => Math.round((Number(valore) || 0) * 100) / 100;

// Il residuo di adesso: il valore della Componente predefinita, chiesto al motore perché è
// il motore che conosce il segno dei Debiti — e perché una Componente dichiarata vale il suo
// valore dichiarato, non la somma dei Movimenti.
async function residuoDi(userId, debito) {
  const componente = await patrimonio.componentePredefinita(userId, 'debito', debito._id);
  const saldi = await patrimonio.saldiPerComponente(userId);
  return {
    componente,
    residuo: patrimonio.valoreComponente(componente, saldi.get(String(componente._id)), 'debito')
  };
}

// Il mese (a Roma) di una data, per riconoscere la rata già registrata.
const meseDi = (data) => servizioDebiti.dataISO(servizioDebiti.dataARoma(data)).slice(0, 7);

// GET /api/debiti/:id — residuo e piano: quanto manca, quanto costa ancora, la prossima
// rata. È la lettura che serve alla scheda dopo aver registrato una rata, senza ricalcolare
// tutto il Patrimonio.
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const debito = await Debito.findOne({ _id: req.params.id, userId: req.user.userId });
    if (!debito) {
      return res.status(404).json({ success: false, error: 'Debito non trovato' });
    }
    const { residuo } = await residuoDi(req.user.userId, debito);
    return res.json({ success: true, data: { id: debito._id, nome: debito.nome, residuo, piano: servizioDebiti.piano(debito, residuo) } });
  } catch (err) {
    logError('❌ Errore nella lettura del debito:', err);
    return res.status(500).json({ success: false, error: 'Errore nella lettura del debito' });
  }
});

// GET /api/debiti/:id/rate — le rate registrate su questo Debito, dalla più recente: gli
// interessi (la Spesa sul conto) e la quota capitale (il Trasferimento al Debito) riuniti
// dallo stesso `rataId`.
router.get('/:id/rate', authenticateToken, async (req, res) => {
  try {
    const debito = await Debito.findOne({ _id: req.params.id, userId: req.user.userId });
    if (!debito) {
      return res.status(404).json({ success: false, error: 'Debito non trovato' });
    }

    const filtro = { userId: req.user.userId, rataDebitoId: debito._id };
    const [spese, trasferimenti] = await Promise.all([
      Spesa.find(filtro).sort({ data: -1 }).lean(),
      Trasferimento.find(filtro).sort({ data: -1 }).lean()
    ]);

    const rate = new Map();
    const riga = (rataId) => {
      const chiave = String(rataId);
      if (!rate.has(chiave)) rate.set(chiave, { rataId: chiave, data: null, interessi: 0, capitale: 0 });
      return rate.get(chiave);
    };

    spese.forEach((s) => {
      const r = riga(s.rataId);
      r.interessi = arrotonda(r.interessi + Math.abs(s.importo));
      r.data = !r.data || s.data > r.data ? s.data : r.data;
      r.categoria = s.categoria;
    });
    trasferimenti.forEach((t) => {
      const r = riga(t.rataId);
      r.capitale = arrotonda(r.capitale + t.importo);
      r.data = !r.data || t.data > r.data ? t.data : r.data;
      r.daVoceId = t.da.voceId;
      r.daComponenteId = t.da.componenteId;
    });

    const elenco = [...rate.values()]
      .map((r) => ({ ...r, totale: arrotonda(r.interessi + r.capitale) }))
      .sort((a, b) => new Date(b.data) - new Date(a.data));

    return res.json({ success: true, data: elenco });
  } catch (err) {
    logError('❌ Errore nel recupero delle rate del debito:', err);
    return res.status(500).json({ success: false, error: 'Errore nel recupero delle rate del debito' });
  }
});

// POST /api/debiti/:id/rate — registra una rata.
//
// Scrive due Movimenti, e solo questi due (ADR-0004): la Spesa della quota interessi sul
// conto che paga — è il costo, e va nel budget — e il Trasferimento della quota capitale dal
// conto al Debito, che abbassa il residuo senza essere una Spesa. Il Patrimonio scende degli
// interessi, non della rata.
//
// Gli importi li calcola il Debito (residuo, rata, tasso, rate residue) e il client li può
// correggere: la banca può aver applicato un tasso diverso, e il numero vero è quello della
// banca. Il residuo si abbassa della quota capitale comunicata.
router.post('/:id/rate', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const debito = await Debito.findOne({ _id: req.params.id, userId });
    if (!debito) {
      return res.status(404).json({ success: false, error: 'Debito non trovato' });
    }

    const { componente, residuo } = await residuoDi(userId, debito);
    if (residuo <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Questo debito non ha residuo aperto',
        message: 'Il residuo è a zero: non c\'è una rata da registrare.'
      });
    }

    const piano = servizioDebiti.piano(debito, residuo);
    const dataRata = req.body.data ? new Date(req.body.data) : new Date();

    // Una rata al mese. Registrarla due volte capita (il pulsante premuto due volte, il mese
    // sbagliato): la seconda si accetta solo se il client conferma di volerla.
    if (!req.body.conferma) {
      const ultima = await Trasferimento.findOne({ userId, rataDebitoId: debito._id, rataId: { $ne: null } })
        .sort({ data: -1 })
        .lean();
      if (ultima && meseDi(ultima.data) === meseDi(dataRata)) {
        return res.status(409).json({
          success: false,
          error: 'La rata di questo mese è già registrata',
          message: `Risulta già una rata del ${meseDi(ultima.data)}, con ${servizioDebiti.giornoRata(debito)} come giorno di pagamento.`,
          rata: { rataId: ultima.rataId, data: ultima.data, importo: arrotonda(ultima.importo) },
          conferma: 'Ripeti la richiesta con conferma: true per registrarla comunque.'
        });
      }
    }

    // Gli importi: quelli del client se ci sono (sono i veri numeri della banca), altrimenti
    // quelli calcolati. La quota capitale non può superare il residuo: non si rimborsa più di
    // quanto si deve, altrimenti il residuo diventa negativo.
    let interessi = req.body.interessi === undefined || req.body.interessi === null
      ? piano.interessi
      : Math.abs(Number(req.body.interessi));
    let capitale = req.body.capitale === undefined || req.body.capitale === null
      ? piano.capitale
      : Math.abs(Number(req.body.capitale));
    if (!Number.isFinite(interessi) || !Number.isFinite(capitale) || interessi < 0 || capitale < 0) {
      return res.status(400).json({ success: false, error: 'Quota interessi e quota capitale devono essere numeri non negativi' });
    }
    const capitaleChiesto = capitale;
    if (capitale > residuo) capitale = residuo;
    if (interessi <= 0 && capitale <= 0) {
      return res.status(400).json({ success: false, error: 'Una rata di zero non cambia nulla' });
    }

    // Il conto che paga: quello indicato, altrimenti il Conto principale.
    const conto = await patrimonio.risolviVoce(userId, req.body.contoId, 'attivita');
    const tipo = await TipoVoce.findOne({ _id: debito.tipoId, userId }).lean();
    const categoria = String(req.body.categoria || debito.categoriaRata || (tipo && tipo.nome) || 'Altre spese').trim();
    const rataId = new mongoose.Types.ObjectId();

    let spesa = null;
    if (interessi > 0) {
      spesa = await Spesa.create({
        userId,
        descrizione: `Interessi rata ${debito.nome}`,
        importo: -Math.abs(interessi),
        categoria,
        data: dataRata,
        voceSpecie: 'attivita',
        voceId: conto.voce._id,
        componenteId: conto.componente._id,
        rataId,
        rataDebitoId: debito._id
      });
    }

    let trasferimento = null;
    if (capitale > 0) {
      trasferimento = await Trasferimento.create({
        userId,
        da: { voceSpecie: 'attivita', voceId: conto.voce._id, componenteId: conto.componente._id },
        a: { voceSpecie: 'debito', voceId: debito._id, componenteId: componente._id },
        importo: capitale,
        data: dataRata,
        descrizione: `Quota capitale rata ${debito.nome}`,
        origine: 'sistema',
        rataId,
        rataDebitoId: debito._id
      });
    }

    const residuoDopo = arrotonda(residuo - capitale);
    debugLog('💸 Rata registrata:', debito.nome, { interessi, capitale, residuoDopo });

    return res.status(201).json({
      success: true,
      message: `Rata registrata: ${arrotonda(interessi)} di interessi e ${arrotonda(capitale)} di capitale`,
      data: {
        rataId,
        data: dataRata,
        interessi: arrotonda(interessi),
        capitale: arrotonda(capitale),
        totale: arrotonda(interessi + capitale),
        capitaleLimitato: capitaleChiesto > residuo,
        conto: conto.voce.nome,
        categoria,
        residuo: residuoDopo,
        piano: servizioDebiti.piano(debito, residuoDopo),
        spesa: spesa ? spesa._id : null,
        trasferimento: trasferimento ? trasferimento._id : null
      }
    });
  } catch (err) {
    if (err instanceof patrimonio.ErroreVoce) {
      return res.status(err.status || 400).json({ success: false, error: err.message });
    }
    logError('❌ Errore nella registrazione della rata:', err);
    return res.status(500).json({ success: false, error: 'Errore nella registrazione della rata' });
  }
});

// DELETE /api/debiti/:id/rate/:rataId — annulla una rata: cancella i due Movimenti che
// l'avevano scritta, e il residuo torna dov'era.
router.delete('/:id/rate/:rataId', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const debito = await Debito.findOne({ _id: req.params.id, userId });
    if (!debito) {
      return res.status(404).json({ success: false, error: 'Debito non trovato' });
    }
    if (!mongoose.Types.ObjectId.isValid(String(req.params.rataId))) {
      return res.status(400).json({ success: false, error: 'Rata non valida' });
    }

    const filtro = { userId, rataId: req.params.rataId, rataDebitoId: debito._id };
    const [spese, trasferimenti] = await Promise.all([
      Spesa.deleteMany(filtro),
      Trasferimento.deleteMany(filtro)
    ]);
    const cancellati = (spese.deletedCount || 0) + (trasferimenti.deletedCount || 0);
    if (!cancellati) {
      return res.status(404).json({ success: false, error: 'Rata non trovata' });
    }

    const { residuo } = await residuoDi(userId, debito);
    return res.json({
      success: true,
      message: 'Rata annullata',
      data: { cancellati, residuo, piano: servizioDebiti.piano(debito, residuo) }
    });
  } catch (err) {
    logError('❌ Errore nell\'annullamento della rata:', err);
    return res.status(500).json({ success: false, error: 'Errore nell\'annullamento della rata' });
  }
});

// POST /api/debiti/:id/residuo — il residuo vero, quello scritto dalla banca. Il Debito
// registra la differenza come Rettifica (un Movimento senza controparte): il residuo non si
// dichiara mai al posto dei Movimenti, si corregge.
//
// Il segno della Rettifica si ricava qui: il residuo è l'opposto della somma dei Movimenti,
// quindi per portarlo al valore nuovo l'importo è l'opposto della differenza. Chi legge il
// Movimento vede una Rettifica col segno giusto per il Debito (la scheda la mostra
// comunque come «residuo sceso di 1.234»).
router.post('/:id/residuo', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const debito = await Debito.findOne({ _id: req.params.id, userId });
    if (!debito) {
      return res.status(404).json({ success: false, error: 'Debito non trovato' });
    }

    const nuovo = Number(req.body.residuo);
    if (!Number.isFinite(nuovo) || nuovo < 0) {
      return res.status(400).json({ success: false, error: 'Il residuo deve essere un numero non negativo' });
    }

    const { componente, residuo } = await residuoDi(userId, debito);
    const differenza = arrotonda(nuovo - residuo);
    if (differenza === 0) {
      return res.json({
        success: true,
        message: 'Il residuo è già quello indicato',
        data: { residuo, differenza: 0, piano: servizioDebiti.piano(debito, residuo) }
      });
    }

    const rettifica = await Rettifica.create({
      userId,
      voceSpecie: 'debito',
      voceId: debito._id,
      componenteId: componente._id,
      importo: -differenza,
      data: req.body.data ? new Date(req.body.data) : new Date(),
      descrizione: req.body.descrizione ? String(req.body.descrizione) : 'Residuo aggiornato',
      origine: 'utente'
    });

    return res.json({
      success: true,
      message: `Residuo aggiornato da ${residuo} a ${arrotonda(nuovo)}`,
      data: {
        residuo: arrotonda(nuovo),
        differenza,
        rettifica: rettifica._id,
        piano: servizioDebiti.piano(debito, nuovo)
      }
    });
  } catch (err) {
    logError('❌ Errore nell\'aggiornamento del residuo:', err);
    return res.status(500).json({ success: false, error: 'Errore nell\'aggiornamento del residuo' });
  }
});

module.exports = router;
