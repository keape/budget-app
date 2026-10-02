const mongoose = require('mongoose');
const TipoVoce = require('../models/TipoVoce');
const Attivita = require('../models/Attivita');
const Debito = require('../models/Debito');
const Componente = require('../models/Componente');
const Trasferimento = require('../models/Trasferimento');
const Rettifica = require('../models/Rettifica');
const Spesa = require('../models/Spesa');
const Entrata = require('../models/Entrata');
const Fotografia = require('../models/Fotografia');
const servizioDebiti = require('./debiti');

// Motore del Patrimonio (Fetta 1: conti di cassa; Fetta 3: i Debiti).
//
// Regole che questo modulo è l'unico a conoscere:
//  - il valore di una Voce è la somma delle sue Componenti (ADR-0002);
//  - la valorizzazione appartiene alla Componente: a movimenti (Spese, Entrate,
//    Trasferimenti e Rettifiche), dichiarata (ultima Valutazione) o a mercato (Fetta 2);
//  - il segno della Voce deriva dall'entità: le Attività sommano, i Debiti sottraggono
//    (ADR-0005). Su un Debito il valore della Componente a movimenti è il RESIDUO, cioè
//    l'opposto della somma dei suoi Movimenti: è qui, in un punto solo, che viene applicato
//    quel segno (`valoreComponente`, `serieComponente`);
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
// o «cripto» senza che nessuno tocchi una riga di sorgente. La funzione crea i Tipi che
// mancano e riallinea l'ordine di quelli del catalogo, così una versione successiva del
// catalogo arriva anche agli utenti che c'erano già.
async function assicuraCatalogoTipi(userId) {
  const esistenti = await TipoVoce.find({ userId });
  const perNome = new Map(esistenti.map((t) => [t.nome.trim().toLowerCase(), t]));

  const mancanti = TipoVoce.CATALOGO_INIZIALE
    .filter((t) => !perNome.has(t.nome.toLowerCase()))
    .map((t) => ({ ...t, userId, sistema: true }));

  // L'ordine è una preferenza dell'utente: si corregge solo sui Tipi del catalogo che non
  // l'hanno mai ricevuto o che sono rimasti a un catalogo precedente, e solo se diverso.
  const daRiordinare = esistenti.filter((t) => {
    if (!t.sistema) return false;
    const previsto = TipoVoce.CATALOGO_INIZIALE.find((c) => c.nome.toLowerCase() === t.nome.trim().toLowerCase());
    return previsto && previsto.ordine !== t.ordine;
  });

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

  if (daRiordinare.length > 0) {
    await TipoVoce.bulkWrite(
      daRiordinare.map((t) => {
        const previsto = TipoVoce.CATALOGO_INIZIALE.find((c) => c.nome.toLowerCase() === t.nome.trim().toLowerCase());
        return { updateOne: { filter: { _id: t._id }, update: { $set: { ordine: previsto.ordine } } } };
      })
    );
  }

  return TipoVoce.find({ userId }).sort({ specie: 1, ordine: 1, nome: 1 });
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

  if (voceSpecie !== 'attivita' && voceSpecie !== 'debito') {
    throw new ErroreVoce('Specie di voce non riconosciuta');
  }

  const specie = voceSpecie === 'debito' ? 'debito' : 'attivita';
  const voce = specie === 'debito'
    ? await Debito.findOne({ _id: voceId, userId })
    : await Attivita.findOne({ _id: voceId, userId });
  if (!voce) throw new ErroreVoce('Voce patrimoniale non trovata');

  const componente = await componentePredefinita(userId, specie, voce._id);
  return { voce, componente, specie };
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
// Su un Debito il valore è il residuo: l'opposto della somma dei suoi Movimenti, perché una
// Voce che sottrae si legge al contrario di una che somma. Una Componente dichiarata su un
// Debito tiene invece il residuo dichiarato dall'utente, che è già positivo per come è
// stato scritto: lì non c'è nulla da ribaltare.
function valoreComponente(componente, saldoMovimenti, specie = 'attivita') {
  if (componente.valorizzazione === 'movimenti') {
    const saldo = arrotonda(saldoMovimenti || 0);
    return specie === 'debito' ? arrotonda(-saldo) : saldo;
  }
  // 'dichiarata' e, per ora, 'mercato': il prezzo arriva dal motore titoli nella Fetta 2.
  const dichiarato = componente.valutazione ?? componente.costoAcquisto ?? 0;
  return arrotonda(dichiarato);
}

// ---------------------------------------------------------------------------
// Serie mensili: la storia di un singolo conto
// ---------------------------------------------------------------------------
// Il grafico del Patrimonio complessivo nasce dalle Fotografie (ADR-0009), che esistono
// solo da quando la funzione è in uso. La storia di UN conto invece si ricostruisce dal
// conto stesso: per una Componente a movimenti il valore è esattamente la somma dei suoi
// Movimenti, quindi la curva si ricava dai Movimenti registrati — anche quelli di due anni
// fa — invece di aspettare le Fotografie. Per una Componente dichiarata la curva è la
// sequenza delle sue Valutazioni.

const MESE_ROMA = { $dateToString: { format: '%Y-%m', date: '$data', timezone: 'Europe/Rome' } };

function chiaveMese(data) {
  return new Date(data).toISOString().slice(0, 7);
}

function meseCorrenteChiave() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Rome', year: 'numeric', month: '2-digit' })
    .format(new Date())
    .slice(0, 7);
}

// Tutti i mesi fra due chiavi 'AAAA-MM', estremi inclusi: l'asse orizzontale dei grafici
// non deve avere buchi, altrimenti una curva piatta sembra un salto.
function elencoMesi(da, a) {
  const mesi = [];
  let [anno, mese] = da.split('-').map(Number);
  const [annoFine, meseFine] = a.split('-').map(Number);
  while (anno < annoFine || (anno === annoFine && mese <= meseFine)) {
    mesi.push(`${anno}-${String(mese).padStart(2, '0')}`);
    mese += 1;
    if (mese > 12) { mese = 1; anno += 1; }
  }
  return mesi;
}

// Entrate e uscite di ogni Componente, raggruppate per mese, più l'ultimo movimento.
async function flussiMensiliPerComponente(userId) {
  const uid = oggettoId(userId);
  const gruppo = (campoId) => ({ _id: { c: campoId, m: MESE_ROMA }, totale: { $sum: '$importo' }, ultimo: { $max: '$data' } });

  const [spese, entrate, uscite, entrateTrasferite, rettifiche] = await Promise.all([
    Spesa.aggregate([{ $match: { userId: uid, componenteId: { $ne: null } } }, { $group: gruppo('$componenteId') }]),
    Entrata.aggregate([{ $match: { userId: uid, componenteId: { $ne: null } } }, { $group: gruppo('$componenteId') }]),
    Trasferimento.aggregate([{ $match: { userId: uid } }, { $group: gruppo('$da.componenteId') }]),
    Trasferimento.aggregate([{ $match: { userId: uid } }, { $group: gruppo('$a.componenteId') }]),
    Rettifica.aggregate([{ $match: { userId: uid } }, { $group: gruppo('$componenteId') }])
  ]);

  const perComponente = new Map();
  const aggiungi = (righe, segno) => righe.forEach((r) => {
    if (!r._id || !r._id.c) return;
    const id = String(r._id.c);
    if (!perComponente.has(id)) perComponente.set(id, { mesi: new Map(), ultimo: null });
    const voce = perComponente.get(id);
    voce.mesi.set(r._id.m, (voce.mesi.get(r._id.m) || 0) + segno * r.totale);
    if (!voce.ultimo || r.ultimo > voce.ultimo) voce.ultimo = r.ultimo;
  });

  aggiungi(spese, 1);          // le Spese hanno importo negativo
  aggiungi(entrate, 1);
  aggiungi(uscite, -1);
  aggiungi(entrateTrasferite, 1);
  aggiungi(rettifiche, 1);

  return perComponente;
}

// Somma cumulata mese per mese: il valore del conto alla fine di ogni mese. Su un Debito la
// curva che interessa è il residuo, che è l'opposto della somma dei Movimenti.
function serieCumulata(mesi, asse, specie = 'attivita') {
  const segno = specie === 'debito' ? -1 : 1;
  let totale = 0;
  return asse.map((m) => {
    totale = arrotonda(totale + ((mesi && mesi.get(m)) || 0));
    return arrotonda(segno * totale);
  });
}

// Per una Componente dichiarata o a mercato la curva è a gradini: il valore resta quello
// dell'ultima Valutazione finché non ne arriva una nuova.
function serieDichiarata(componente, asse) {
  const punti = [];
  if (componente.costoAcquisto !== undefined && componente.costoAcquisto !== null) {
    punti.push({ mese: chiaveMese(componente.dataCosto || componente.createdAt), valore: componente.costoAcquisto });
  }
  (componente.valutazioni || []).forEach((v) => punti.push({ mese: chiaveMese(v.data), valore: v.valore }));
  if (componente.valutazione !== undefined && componente.valutazione !== null) {
    punti.push({ mese: chiaveMese(componente.dataValutazione || componente.updatedAt || componente.createdAt), valore: componente.valutazione });
  }
  punti.sort((a, b) => (a.mese < b.mese ? -1 : 1));

  let corrente = 0;
  let indice = 0;
  return asse.map((m) => {
    while (indice < punti.length && punti[indice].mese <= m) {
      corrente = punti[indice].valore;
      indice += 1;
    }
    return arrotonda(corrente);
  });
}

function serieComponente(componente, flussi, asse, specie = 'attivita') {
  if (componente.valorizzazione === 'movimenti') {
    const flusso = flussi.get(String(componente._id));
    return serieCumulata(flusso ? flusso.mesi : null, asse, specie);
  }
  return serieDichiarata(componente, asse);
}

// Il Patrimonio dell'utente più la serie mensile di ogni Voce: la sparkline nella lista e
// il grafico del singolo conto escono da qui, senza ricalcolare nulla due volte.
async function calcolaPatrimonio(userId, opzioni = {}) {
  const { conSerieCompleta = false } = opzioni;
  await assicuraCatalogoTipi(userId);

  const [tipi, voci, entitaDebito, componenti, saldi, flussi] = await Promise.all([
    TipoVoce.find({ userId }),
    // Tutte le Voci, anche quelle chiuse: le chiuse non entrano nel Patrimonio ma devono
    // restare leggibili, altrimenti il loro storico sparisce senza che nessuno possa
    // riaprirlo.
    Attivita.find({ userId }),
    Debito.find({ userId }),
    Componente.find({ userId, chiusa: false }).sort({ createdAt: 1 }),
    saldiPerComponente(userId),
    flussiMensiliPerComponente(userId)
  ]);

  const mesiConMovimenti = [];
  flussi.forEach((flusso) => flusso.mesi.forEach((_, m) => mesiConMovimenti.push(m)));
  mesiConMovimenti.sort();
  const asse = elencoMesi(mesiConMovimenti[0] || meseCorrenteChiave(), meseCorrenteChiave());

  const tipoPerId = new Map(tipi.map((t) => [String(t._id), t]));
  const componentiPerVoce = new Map();
  componenti.forEach((c) => {
    const chiave = `${c.voceSpecie}:${String(c.voceId)}`;
    if (!componentiPerVoce.has(chiave)) componentiPerVoce.set(chiave, []);
    componentiPerVoce.get(chiave).push(c);
  });

  const serieDiTutteLeVoci = [];

  const costruisci = (voceEntita, specie, contribuisce = true) => {
    const tipo = tipoPerId.get(String(voceEntita.tipoId));
    const sue = componentiPerVoce.get(`${specie}:${String(voceEntita._id)}`) || [];

    // Serie della Voce: somma, mese per mese, delle serie delle sue Componenti.
    const serieComponenti = sue.map((c) => serieComponente(c, flussi, asse, specie));
    const serie = asse.map((_, i) => arrotonda(serieComponenti.reduce((somma, s) => somma + (s[i] || 0), 0)));
    const ultimoMovimento = sue.reduce((massimo, c) => {
      const flusso = flussi.get(String(c._id));
      if (!flusso || !flusso.ultimo) return massimo;
      return !massimo || flusso.ultimo > massimo ? flusso.ultimo : massimo;
    }, null);

    const dettaglio = sue.map((c) => ({
      id: c._id,
      nome: c.nome,
      valorizzazione: c.valorizzazione,
      valore: valoreComponente(c, saldi.get(String(c._id)), specie),
      costoAcquisto: c.costoAcquisto ?? null,
      valutazione: c.valutazione ?? null
    }));

    // La curva ricostruita del Patrimonio somma i conti aperti: un conto chiuso non fa
    // più parte del Patrimonio, quindi non contribuisce alla sua serie.
    if (contribuisce) serieDiTutteLeVoci.push(serie);

    return {
      id: voceEntita._id,
      nome: voceEntita.nome,
      specie,
      archiviata: voceEntita.archiviata === true,
      tipo: tipo ? { id: tipo._id, nome: tipo.nome, specie: tipo.specie, denaro: tipo.denaro, ordine: tipo.ordine } : null,
      gruppo: specie === 'debito' ? 'debiti' : GRUPPO_DA_TIPO(tipo),
      valore: arrotonda(dettaglio.reduce((somma, c) => somma + c.valore, 0)),
      componenti: dettaglio,
      ultimoMovimento,
      // La lista mostra solo la coda della serie (le ultime 12 mensilità), il grafico del
      // singolo conto chiede la serie intera.
      sparkline: serie.slice(-12),
      deltaMese: arrotonda(serie[serie.length - 1] - (serie[serie.length - 2] ?? serie[serie.length - 1] ?? 0)),
      ...(conSerieCompleta ? { serie } : {})
    };
  };

  const perNome = (a, b) => a.nome.localeCompare(b.nome);
  const attive = voci.filter((v) => !v.archiviata).sort(perNome);
  const chiuse = voci.filter((v) => v.archiviata).sort(perNome);
  const debitiAttivi = entitaDebito.filter((d) => !d.archiviata).sort(perNome);
  const debitiChiusi = entitaDebito.filter((d) => d.archiviata).sort(perNome);

  const vociAttivita = attive.map((v) => costruisci(v, 'attivita'));
  const vociAttivitaChiuse = chiuse.map((v) => costruisci(v, 'attivita', false));
  const vociDebito = debitiAttivi.map((d) => costruisci(d, 'debito'));
  const vociDebitoChiuse = debitiChiusi.map((d) => costruisci(d, 'debito', false));

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
  const totaleDebiti = arrotonda(
    [...vociAttivita, ...vociDebito].filter((v) => v.specie === 'debito').reduce((s, v) => s + v.valore, 0)
  );

  // Serie d'insieme ricostruita dai conti che esistono oggi: serve solo finché non ci sono
  // almeno due Fotografie (la Fotografia è la fonte di verità del Patrimonio, ADR-0009).
  // Vale finché tutti i conti sono a movimenti: un bene dichiarato comparirebbe come un
  // salto nel mese in cui è stato creato, ed è il motivo per cui non è la fonte ufficiale.
  const serieRicostruita = asse.map((_, i) =>
    arrotonda(serieDiTutteLeVoci.reduce((somma, serie) => somma + (serie[i] || 0), 0))
  );

  const tutteLeAttivita = [...vociAttivita, ...vociDebito];

  return {
    patrimonio: arrotonda(attivita - totaleDebiti),
    attivita,
    debiti: totaleDebiti,
    gruppi,
    voci: tutteLeAttivita,
    chiuse: [...vociAttivitaChiuse, ...vociDebitoChiuse],
    asse,
    serieRicostruita
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
// Dettaglio di un conto: la sua storia e i suoi Movimenti
// ---------------------------------------------------------------------------

// Tutti i Movimenti registrati su una Voce, di qualunque tipo, dal più recente: Spese,
// Entrate, Trasferimenti (visti dal lato del conto: entrata o uscita, con la controparte)
// e Rettifiche. È la lista che il dettaglio del conto mostra sotto il grafico.
//
// L'importo che esce da qui è sempre l'EFFETTO SUL VALORE DELLA VOCE: su un conto positivo
// se il saldo sale, su un Debito positivo se il residuo sale (ADR-0005). Così la scheda del
// Debito non deve ribaltare niente per dire «il residuo è sceso di 285».
async function movimentiDellaVoce(userId, voceId, limite = 300, specie = 'attivita') {
  const uid = oggettoId(userId);
  const segno = specie === 'debito' ? -1 : 1;

  const [spese, entrate, trasferimenti, rettifiche] = await Promise.all([
    Spesa.find({ userId: uid, voceId }).sort({ data: -1 }).limit(limite).lean(),
    Entrata.find({ userId: uid, voceId }).sort({ data: -1 }).limit(limite).lean(),
    Trasferimento.find({ userId: uid, $or: [{ 'da.voceId': voceId }, { 'a.voceId': voceId }] })
      .sort({ data: -1 }).limit(limite).lean(),
    Rettifica.find({ userId: uid, voceId }).sort({ data: -1 }).limit(limite).lean()
  ]);

  const idControparti = new Set();
  trasferimenti.forEach((t) => {
    if (String(t.da.voceId) !== String(voceId)) idControparti.add(String(t.da.voceId));
    if (String(t.a.voceId) !== String(voceId)) idControparti.add(String(t.a.voceId));
  });
  const controparti = idControparti.size
    ? [
        ...await Attivita.find({ _id: { $in: [...idControparti] }, userId: uid }).select('nome').lean(),
        ...await Debito.find({ _id: { $in: [...idControparti] }, userId: uid }).select('nome').lean()
      ]
    : [];
  const nomePerId = new Map(controparti.map((v) => [String(v._id), v.nome]));

  const elenco = [
    ...spese.map((s) => ({
      id: s._id, tipo: 'spesa', data: s.data, descrizione: s.descrizione,
      categoria: s.categoria, importo: arrotonda(s.importo * segno),
      origine: s.rataId ? 'sistema' : 'utente', rataId: s.rataId || null
    })),
    ...entrate.map((e) => ({
      id: e._id, tipo: 'entrata', data: e.data, descrizione: e.descrizione,
      categoria: e.categoria, importo: arrotonda(e.importo * segno),
      origine: e.rataId ? 'sistema' : 'utente', rataId: e.rataId || null
    })),
    ...trasferimenti.map((t) => {
      const uscente = String(t.da.voceId) === String(voceId);
      const controparteId = uscente ? t.a.voceId : t.da.voceId;
      return {
        id: t._id, tipo: 'trasferimento', data: t.data, descrizione: t.descrizione,
        controparte: nomePerId.get(String(controparteId)) || 'Voce eliminata',
        uscente: (uscente ? -t.importo : t.importo) * segno < 0,
        importo: arrotonda((uscente ? -t.importo : t.importo) * segno),
        origine: t.origine, rataId: t.rataId || null
      };
    }),
    ...rettifiche.map((r) => ({
      id: r._id, tipo: 'rettifica', data: r.data, descrizione: r.descrizione,
      importo: arrotonda(r.importo * segno), origine: r.origine, rataId: null
    }))
  ].sort((a, b) => new Date(b.data) - new Date(a.data));

  return elenco.slice(0, limite);
}

// Tutto quello che serve alla scheda di un conto: la Voce con il suo valore, la sua serie
// mensile, i suoi Movimenti e quanti sono (per poter dire, prima di cancellare, quante
// transazioni si stanno per perdere). Trova anche i conti chiusi. Restituisce null se la
// Voce non è dell'utente.
async function dettaglioVoce(userId, voceId) {
  const dati = await calcolaPatrimonio(userId, { conSerieCompleta: true });
  const voce = [...dati.voci, ...dati.chiuse].find((v) => String(v.id) === String(voceId));
  if (!voce) return null;

  const [movimenti, conteggi, tipi, debito] = await Promise.all([
    movimentiDellaVoce(userId, voceId, 300, voce.specie),
    conteggiMovimentiDellaVoce(userId, voceId),
    // Le impostazioni di un conto cambiano anche il suo Tipo: la scheda deve poterlo mostrare.
    assicuraCatalogoTipi(userId),
    // Il piano di un Debito: quanto manca, quanto costa ancora e la prossima rata. Si
    // calcola qui perché il client non deve rifare i conti per mostrarli (ADR-0004).
    voce.specie === 'debito' ? Debito.findOne({ _id: voceId, userId }).lean() : null
  ]);

  return {
    voce,
    asse: dati.asse,
    movimenti,
    conteggi,
    piano: debito ? servizioDebiti.piano(debito, voce.valore) : null,
    tipi: tipi.map((t) => ({
      id: t._id,
      nome: t.nome,
      specie: t.specie,
      denaro: t.denaro,
      ordine: t.ordine,
      archiviato: t.archiviato
    }))
  };
}

// Quanti Movimenti tocca una Voce, per tipo: è il numero che compare nella conferma prima
// di un'eliminazione, che non si annulla.
async function conteggiMovimentiDellaVoce(userId, voceId) {
  const uid = oggettoId(userId);
  const [spese, entrate, trasferimenti, rettifiche] = await Promise.all([
    Spesa.countDocuments({ userId: uid, voceId }),
    Entrata.countDocuments({ userId: uid, voceId }),
    Trasferimento.countDocuments({ userId: uid, $or: [{ 'da.voceId': voceId }, { 'a.voceId': voceId }] }),
    Rettifica.countDocuments({ userId: uid, voceId })
  ]);
  return {
    spese,
    entrate,
    trasferimenti,
    rettifiche,
    totale: spese + entrate + trasferimenti + rettifiche
  };
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
  dettaglioVoce,
  movimentiDellaVoce,
  conteggiMovimentiDellaVoce,
  riparaMovimentiOrfani,
  salvaFotografia,
  fotografiaDelMeseCorrente
};
