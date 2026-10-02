const mongoose = require('mongoose');
const TipoVoce = require('../models/TipoVoce');
const Attivita = require('../models/Attivita');
const Componente = require('../models/Componente');
const Trasferimento = require('../models/Trasferimento');
const Rettifica = require('../models/Rettifica');
const Spesa = require('../models/Spesa');
const Entrata = require('../models/Entrata');
const Fotografia = require('../models/Fotografia');

// Motore del Patrimonio (Fetta 1: conti di cassa).
//
// Regole che questo modulo è l'unico a conoscere:
//  - il valore di una Voce è la somma delle sue Componenti (ADR-0002);
//  - la valorizzazione appartiene alla Componente: a movimenti (Spese, Entrate,
//    Trasferimenti e Rettifiche), dichiarata (ultima Valutazione) o a mercato (Fetta 2);
//  - il segno della Voce deriva dall'entità: le Attività sommano, i Debiti sottraggono
//    (ADR-0005);
//  - Spese ed Entrate hanno il segno già normalizzato dalle rotte (spesa negativa,
//    entrata positiva); i Trasferimenti hanno importo positivo e la direzione nella
//    coppia da → a; le Rettifiche portano un delta con segno.

const arrotonda = (valore) => Math.round((Number(valore) || 0) * 100) / 100;

const oggettoId = (valore) => new mongoose.Types.ObjectId(String(valore));

const GRUPPO_DA_TIPO = (tipo) => {
  if (tipo && tipo.specie === 'debito') return 'debiti';
  return tipo && tipo.denaro ? 'denaro' : 'beni';
};

class ErroreVoce extends Error {
  constructor(messaggio) {
    super(messaggio);
    this.status = 400;
    this.name = 'ErroreVoce';
  }
}

// ---------------------------------------------------------------------------
// Precondizioni: catalogo Tipi, Conto principale, Componente predefinita
// ---------------------------------------------------------------------------

// Il catalogo iniziale è un elenco di dati, non di codice: l'utente può creare «barca»
// o «cripto» senza che nessuno tocchi una riga di sorgente.
async function assicuraCatalogoTipi(userId) {
  const esistenti = await TipoVoce.find({ userId });
  const perNome = new Set(esistenti.map((t) => t.nome.trim().toLowerCase()));
  const mancanti = TipoVoce.CATALOGO_INIZIALE
    .filter((t) => !perNome.has(t.nome.toLowerCase()))
    .map((t) => ({ ...t, userId, sistema: true }));

  if (mancanti.length > 0) {
    try {
      await TipoVoce.insertMany(mancanti, { ordered: false });
    } catch (err) {
      // Due richieste in parallelo possono provare a creare lo stesso Tipo: l'indice
      // unico {userId, nome} decide, e qui si prosegue con quelli già presenti.
      if (err.code !== 11000 && !(err.writeErrors || []).every((e) => e.code === 11000)) {
        throw err;
      }
    }
  }

  return TipoVoce.find({ userId }).sort({ specie: 1, nome: 1 });
}

// Ogni utente ha un Conto principale: l'Attività che riceve i Movimenti già registrati e
// che il sistema propone come origine dei Trasferimenti.
async function assicuraContoPrincipale(userId) {
  let tipo = await TipoVoce.findOne({ userId, nome: 'Conti correnti' });
  if (!tipo) {
    tipo = await TipoVoce.findOne({ userId, specie: 'attivita', denaro: true }).sort({ createdAt: 1 });
  }
  if (!tipo) {
    await assicuraCatalogoTipi(userId);
    tipo = await TipoVoce.findOne({ userId, nome: 'Conti correnti' })
      || await TipoVoce.findOne({ userId, specie: 'attivita', denaro: true });
  }
  if (!tipo) {
    throw new ErroreVoce('Nessun Tipo di voce disponibile per creare il Conto principale');
  }

  let voce = await Attivita.findOne({ userId, nome: 'Conto principale' });
  if (!voce) {
    voce = await Attivita.create({
      userId,
      nome: 'Conto principale',
      tipoId: tipo._id,
      note: 'Conto creato da Budget365 per i movimenti registrati prima dei conti.'
    });
  }

  let componente = await Componente.findOne({ voceSpecie: 'attivita', voceId: voce._id, predefinita: true });
  if (!componente) {
    componente = await Componente.create({
      userId,
      voceSpecie: 'attivita',
      voceId: voce._id,
      nome: 'Conto',
      valorizzazione: 'movimenti',
      predefinita: true
    });
  }

  return { voce, componente, tipo };
}

// La Componente che riceve i Movimenti di una Voce. Una Voce senza Componente non esiste
// nel modello: se ne trova una senza, le se ne crea una qui invece di rifiutare il Movimento.
async function componentePredefinita(userId, voceSpecie, voceId) {
  let componente = await Componente.findOne({ voceSpecie, voceId, chiusa: false, predefinita: true });
  if (componente) return componente;

  componente = await Componente.findOne({ voceSpecie, voceId, chiusa: false, valorizzazione: 'movimenti' });
  if (componente) return componente;

  return Componente.create({
    userId,
    voceSpecie,
    voceId,
    nome: 'Conto',
    valorizzazione: 'movimenti',
    predefinita: true
  });
}

// Risolve la Voce scelta dal client (o il Conto principale se non ne ha scelta una) e la
// Componente che riceverà il Movimento.
async function risolviVoce(userId, voceId, voceSpecie = 'attivita') {
  if (!voceId) {
    const { voce, componente } = await assicuraContoPrincipale(userId);
    return { voce, componente, specie: 'attivita' };
  }

  if (voceSpecie !== 'attivita') {
    throw new ErroreVoce('I Debiti saranno gestiti in una fetta successiva');
  }

  const voce = await Attivita.findOne({ _id: voceId, userId });
  if (!voce) throw new ErroreVoce('Voce patrimoniale non trovata');

  const componente = await componentePredefinita(userId, 'attivita', voce._id);
  return { voce, componente, specie: 'attivita' };
}

// ---------------------------------------------------------------------------
// Calcolo del Patrimonio
// ---------------------------------------------------------------------------

// Saldo a movimenti per Componente: Spese (negative) + Entrate (positive) − Trasferimenti
// uscenti + entranti + Rettifiche (delta con segno).
async function saldiPerComponente(userId) {
  const uid = oggettoId(userId);
  const conComponente = { userId: uid, componenteId: { $ne: null } };

  const [spese, entrate, uscite, entrateTrasferite, rettifiche] = await Promise.all([
    Spesa.aggregate([{ $match: conComponente }, { $group: { _id: '$componenteId', totale: { $sum: '$importo' } } }]),
    Entrata.aggregate([{ $match: conComponente }, { $group: { _id: '$componenteId', totale: { $sum: '$importo' } } }]),
    Trasferimento.aggregate([{ $match: { userId: uid } }, { $group: { _id: '$da.componenteId', totale: { $sum: '$importo' } } }]),
    Trasferimento.aggregate([{ $match: { userId: uid } }, { $group: { _id: '$a.componenteId', totale: { $sum: '$importo' } } }]),
    Rettifica.aggregate([{ $match: { userId: uid } }, { $group: { _id: '$componenteId', totale: { $sum: '$importo' } } }])
  ]);

  const saldi = new Map();
  const somma = (id, valore) => {
    if (!id) return;
    const chiave = String(id);
    saldi.set(chiave, (saldi.get(chiave) || 0) + valore);
  };

  spese.forEach((r) => somma(r._id, r.totale));
  entrate.forEach((r) => somma(r._id, r.totale));
  uscite.forEach((r) => somma(r._id, -r.totale));
  entrateTrasferite.forEach((r) => somma(r._id, r.totale));
  rettifiche.forEach((r) => somma(r._id, r.totale));

  return saldi;
}

// Il valore di una Componente dipende dalla sua valorizzazione, non dalla Voce.
function valoreComponente(componente, saldoMovimenti) {
  if (componente.valorizzazione === 'movimenti') {
    return arrotonda(saldoMovimenti || 0);
  }
  // 'dichiarata' e, per ora, 'mercato': il prezzo arriva dal motore titoli nella Fetta 2.
  const dichiarato = componente.valutazione ?? componente.costoAcquisto ?? 0;
  return arrotonda(dichiarato);
}

// Ricalcola il Patrimonio dell'utente: voci per gruppo, totali, dettaglio per Componente.
async function calcolaPatrimonio(userId) {
  await assicuraCatalogoTipi(userId);

  const [tipi, voci, componenti, saldi] = await Promise.all([
    TipoVoce.find({ userId }),
    Attivita.find({ userId, archiviata: false }).sort({ nome: 1 }),
    Componente.find({ userId, chiusa: false }).sort({ createdAt: 1 }),
    saldiPerComponente(userId)
  ]);

  const tipoPerId = new Map(tipi.map((t) => [String(t._id), t]));
  const componentiPerVoce = new Map();
  componenti.forEach((c) => {
    const chiave = `${c.voceSpecie}:${String(c.voceId)}`;
    if (!componentiPerVoce.has(chiave)) componentiPerVoce.set(chiave, []);
    componentiPerVoce.get(chiave).push(c);
  });

  const costruisci = (voceEntita, specie) => {
    const tipo = tipoPerId.get(String(voceEntita.tipoId));
    const sue = componentiPerVoce.get(`${specie}:${String(voceEntita._id)}`) || [];
    const dettaglio = sue.map((c) => ({
      id: c._id,
      nome: c.nome,
      valorizzazione: c.valorizzazione,
      valore: valoreComponente(c, saldi.get(String(c._id))),
      costoAcquisto: c.costoAcquisto ?? null,
      valutazione: c.valutazione ?? null
    }));
    const valore = arrotonda(dettaglio.reduce((somma, c) => somma + c.valore, 0));
    return {
      id: voceEntita._id,
      nome: voceEntita.nome,
      specie,
      tipo: tipo ? { id: tipo._id, nome: tipo.nome, specie: tipo.specie, denaro: tipo.denaro } : null,
      gruppo: specie === 'debito' ? 'debiti' : GRUPPO_DA_TIPO(tipo),
      valore,
      componenti: dettaglio
    };
  };

  const vociAttivita = voci.map((v) => costruisci(v, 'attivita'));
  // I Debiti esistono come specie (ADR-0005) ma la loro collezione arriva con la Fetta 3.
  const vociDebito = [];

  const gruppi = {
    denaro: { totale: 0, voci: [] },
    beni: { totale: 0, voci: [] },
    debiti: { totale: 0, voci: [] }
  };

  [...vociAttivita, ...vociDebito].forEach((voce) => {
    gruppi[voce.gruppo].voci.push(voce);
    gruppi[voce.gruppo].totale = arrotonda(gruppi[voce.gruppo].totale + voce.valore);
  });

  const attivita = arrotonda(
    [...vociAttivita, ...vociDebito].filter((v) => v.specie === 'attivita').reduce((s, v) => s + v.valore, 0)
  );
  const debiti = arrotonda(
    [...vociAttivita, ...vociDebito].filter((v) => v.specie === 'debito').reduce((s, v) => s + v.valore, 0)
  );

  return {
    patrimonio: arrotonda(attivita - debiti),
    attivita,
    debiti,
    gruppi,
    voci: [...vociAttivita, ...vociDebito]
  };
}

// Rete di sicurezza: un Movimento senza Voce non comparirebbe in nessun saldo. Se ne
// esistono (per esempio creati prima della migrazione), vanno al Conto principale.
async function riparaMovimentiOrfani(userId) {
  const [orfaneSpese, orfaneEntrate] = await Promise.all([
    Spesa.countDocuments({ userId, componenteId: null }),
    Entrata.countDocuments({ userId, componenteId: null })
  ]);
  if (orfaneSpese + orfaneEntrate === 0) return 0;

  const { voce, componente } = await assicuraContoPrincipale(userId);
  const aggiornamento = {
    $set: { voceSpecie: 'attivita', voceId: voce._id, componenteId: componente._id }
  };
  const [r1, r2] = await Promise.all([
    Spesa.updateMany({ userId, componenteId: null }, aggiornamento),
    Entrata.updateMany({ userId, componenteId: null }, aggiornamento)
  ]);

  return (r1.modifiedCount || 0) + (r2.modifiedCount || 0);
}

// ---------------------------------------------------------------------------
// Fotografia mensile
// ---------------------------------------------------------------------------

// Scrive (o riscrive) la Fotografia del mese. È idempotente: la Fotografia del mese in
// corso resta provvisoria e viene aggiornata a ogni ricalcolo, mentre i mesi precedenti
// vengono congelati.
async function salvaFotografia(userId, anno, mese, datiPatrimonio) {
  await Fotografia.updateMany(
    {
      userId,
      chiusa: false,
      $or: [{ anno: { $lt: anno } }, { anno, mese: { $lt: mese } }]
    },
    { $set: { chiusa: true } }
  );

  return Fotografia.findOneAndUpdate(
    { userId, anno, mese },
    {
      $set: {
        data: new Date(),
        patrimonio: datiPatrimonio.patrimonio,
        attivita: datiPatrimonio.attivita,
        debiti: datiPatrimonio.debiti,
        voci: datiPatrimonio.voci.map((v) => ({
          voceId: v.id,
          voceSpecie: v.specie,
          nome: v.nome,
          tipo: v.tipo ? v.tipo.nome : '',
          gruppo: v.gruppo,
          valore: v.valore
        }))
      },
      $setOnInsert: { chiusa: false }
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
}

// Il Patrimonio letto oggi dal client è anche quello che entra nello storico del mese:
// non serve un cron perché la Fotografia del mese in corso è provvisoria per definizione.
async function fotografiaDelMeseCorrente(userId, datiPatrimonio) {
  const oggi = new Date();
  return salvaFotografia(userId, oggi.getFullYear(), oggi.getMonth(), datiPatrimonio);
}

module.exports = {
  ErroreVoce,
  arrotonda,
  assicuraCatalogoTipi,
  assicuraContoPrincipale,
  componentePredefinita,
  risolviVoce,
  saldiPerComponente,
  valoreComponente,
  calcolaPatrimonio,
  riparaMovimentiOrfani,
  salvaFotografia,
  fotografiaDelMeseCorrente
};
