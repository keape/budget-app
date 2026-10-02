// La meccanica di un Debito (ADR-0004): quante rate restano, quanto valgono, quanta parte
// della rata è interessi e quanta è capitale. È un modulo di calcolo, senza database: non
// conosce il residuo se non glielo si passa, così la stessa funzione serve alla rotta, alla
// scheda del Debito e a uno script di verifica.
//
// Delle tre cose che l'utente dichiara — l'importo (il residuo), la rata e la scadenza —
// le prime due e la terza bastano per ricavare il resto: le rate residue sono i mesi che
// mancano alla scadenza, e il tasso è quello che rende vera l'uguaglianza fra residuo, rata
// e numero di rate (`tassoImplicito`). Il tasso dichiarato resta preferito: se c'è, vince.
//
// La rata è mensile e costante (la forma normale di un mutuo italiano): la formula è quella
// standard, quota interessi = residuo × tasso mensile, quota capitale = rata − interessi.

const arrotonda = (valore) => Math.round((Number(valore) || 0) * 100) / 100;

// Le date si leggono nel fuso dell'utente, non in quello del server: su Render il processo
// gira in UTC e una scadenza del 1° del mese diventerebbe il 31 del mese prima.
const FORMATO_ROMA = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Rome',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit'
});

function dataARoma(data = new Date()) {
  const [anno, mese, giorno] = FORMATO_ROMA.format(new Date(data)).split('-').map(Number);
  return { anno, mese, giorno };
}

function dataISO({ anno, mese, giorno }) {
  return `${anno}-${String(mese).padStart(2, '0')}-${String(giorno).padStart(2, '0')}`;
}

// Le rate di un Debito non possono essere più di queste: è un numero di sicurezza contro
// una scadenza scritta male (un secolo di rate), non un limite del modello.
const RATE_MASSIME = 600;
const TASSO_MENSILE_MASSIMO = 0.1; // 120% annuo: oltre non è un tasso, è un refuso

// Il giorno del mese della rata: quello dichiarato, altrimenti quello della scadenza.
function giornoRata(debito) {
  const dichiarato = Number(debito && debito.giornoRata);
  if (dichiarato >= 1 && dichiarato <= 31) return dichiarato;
  if (debito && debito.scadenza) return dataARoma(debito.scadenza).giorno;
  return 1;
}

// La prossima rata: il giorno della rata a partire da oggi (oggi stesso se il giorno non è
// ancora passato).
function prossimaRata(debito, adesso = new Date()) {
  const oggi = dataARoma(adesso);
  const giorno = giornoRata(debito);
  let { anno, mese } = oggi;
  if (giorno < oggi.giorno) {
    mese += 1;
    if (mese > 12) { mese = 1; anno += 1; }
  }
  return { anno, mese, giorno: Math.min(giorno, 31) };
}

function mesiDopo({ anno, mese }, quante) {
  const totale = anno * 12 + (mese - 1) + quante;
  return { anno: Math.floor(totale / 12), mese: (totale % 12) + 1 };
}

// Quante rate restano: i mesi dalla prossima rata alla scadenza, estremi inclusi. Zero
// quando la scadenza è passata — il Debito è finito, e non si contano rate negative.
function numeroRateResidue(debito, adesso = new Date()) {
  if (!debito || !debito.scadenza) return null;
  const inizio = prossimaRata(debito, adesso);
  const fine = dataARoma(debito.scadenza);
  const mesi = (fine.anno - inizio.anno) * 12 + (fine.mese - inizio.mese) + 1;
  if (mesi <= 0) return 0;
  return Math.min(mesi, RATE_MASSIME);
}

// Il tasso che rende vera l'uguaglianza: residuo = rata × (1 − (1+i)^−n) / i. Si risolve
// per bisezione, che è noiosa e infallibile: la funzione è monotona, quindi basta
// stringere l'intervallo finché la differenza è trascurabile.
// Ritorna { tasso, trovato }: `trovato: false` significa che con quella rata e quelle rate
// il residuo non si estingue a un tasso plausibile (rata troppo bassa: i dati non tornano).
function tassoImplicito(residuo, rata, rate) {
  const valore = arrotonda(residuo);
  const importo = Number(rata);
  const quante = Number(rate);
  if (!(valore > 0) || !(importo > 0) || !(quante > 0)) return { tasso: null, trovato: false };

  // Quanto la rata, capitalizzata al tasso mensile `i`, supera il residuo: zero quando `i`
  // è il tasso giusto. Con `i` a zero la formula non si calcola (divisione per zero), e il
  // valore del limite è rata × rate − residuo.
  const differenza = (i) => (i <= 0
    ? importo * quante - valore
    : importo * (1 - Math.pow(1 + i, -quante)) / i - valore);

  // La differenza è decrescente nel tasso: parte positiva (rata × rate sopra il residuo,
  // quando il tasso è zero) e scende. Con la rata che, moltiplicata per le rate, non copre
  // nemmeno il residuo, non c'è interesse da cercare: il tasso è zero.
  if (differenza(1e-12) <= 0) return { tasso: 0, trovato: true };
  // Se anche al tasso massimo la rata non basta a estinguere il residuo, il tasso vero è
  // più alto di così: i tre dati non tornano, e dirlo è meglio che inventare un numero.
  if (differenza(TASSO_MENSILE_MASSIMO) > 0) return { tasso: null, trovato: false };

  let basso = 1e-12;
  let alto = TASSO_MENSILE_MASSIMO;
  for (let passo = 0; passo < 200; passo += 1) {
    const medio = (basso + alto) / 2;
    if (differenza(medio) > 0) basso = medio; else alto = medio;
  }
  return { tasso: arrotonda(((basso + alto) / 2) * 12 * 100), trovato: true };
}

// La rata che estingue il residuo in `rate` rate al tasso dato (rata costante).
function rataTeorica(residuo, tassoAnnuo, rate) {
  const valore = Number(residuo);
  const quante = Number(rate);
  if (!(valore > 0) || !(quante > 0)) return 0;
  const i = (Number(tassoAnnuo) || 0) / 100 / 12;
  if (i <= 0) return arrotonda(valore / quante);
  return arrotonda(valore * i / (1 - Math.pow(1 + i, -quante)));
}

// La rata divisa nelle sue due parti. L'ultima rata è più bassa: non si rimborsa più
// capitale di quanto se ne deve.
function splitRata({ residuo, tassoAnnuo, rata, rate }) {
  const valore = arrotonda(residuo);
  const interessi = arrotonda(valore * ((Number(tassoAnnuo) || 0) / 100 / 12));
  const quante = Number(rate);

  if (valore <= 0) return { rata: 0, interessi: 0, capitale: 0, ultima: true };

  let capitale = rata > 0 ? arrotonda(Number(rata) - interessi) : arrotonda(valore / Math.max(quante || 1, 1));
  let ultima = false;
  if (capitale < 0) capitale = 0;
  if (quante === 1 || capitale >= valore) {
    capitale = valore;
    ultima = true;
  }
  return { rata: arrotonda(capitale + interessi), capitale, interessi, ultima };
}

// Tutto quello che serve alla scheda di un Debito: com'è messo adesso e come finirà.
// `completo` è falso quando manca il piano: in quel caso il Debito è solo un residuo che
// si muove con i Movimenti, e la scheda non promette calcoli che non può fare.
function piano(debito, residuo, adesso = new Date()) {
  const valore = arrotonda(residuo);
  const rateDichiarate = numeroRateResidue(debito, adesso);
  let tasso = Number(debito && debito.tasso) > 0 ? Number(debito.tasso) : null;
  let tassoRicavato = false;

  if (tasso === null && Number(debito && debito.rata) > 0 && rateDichiarate > 0) {
    const ricavato = tassoImplicito(valore, debito.rata, rateDichiarate);
    if (ricavato.trovato) {
      tasso = ricavato.tasso;
      tassoRicavato = true;
    }
  }

  const rate = rateDichiarate;
  const rata = Number(debito && debito.rata) > 0
    ? arrotonda(debito.rata)
    : (rate > 0 && tasso !== null ? rataTeorica(valore, tasso, rate) : 0);
  // Scadenza passata e residuo ancora aperto: i dati si contraddicono, e l'unica lettura
  // sensata è che manchi il saldo finale. Si mostra come ultima rata, senza interessi.
  const parti = rate === 0 && valore > 0
    ? { rata: valore, capitale: valore, interessi: 0, ultima: true }
    : splitRata({ residuo: valore, tassoAnnuo: tasso || 0, rata, rate });
  const prossima = prossimaRata(debito, adesso);

  return {
    residuo: valore,
    rata,
    rate,
    tasso,
    tassoRicavato,
    interessi: parti.interessi,
    capitale: parti.capitale,
    rataPiena: parti.rata,
    ultimaRata: parti.ultima,
    // Quanto costa ancora il debito in interessi: quello che resta da pagare meno quello
    // che si deve. È il numero che dice se conviene estinguere prima.
    interessiResidui: rata > 0 && rate ? arrotonda(Math.max(rata * rate - valore, 0)) : null,
    giornoRata: giornoRata(debito),
    prossimaRata: dataISO(prossima),
    ultimaRataIl: rate ? dataISO({ ...mesiDopo(prossima, rate - 1), giorno: prossima.giorno }) : null,
    scadenza: debito && debito.scadenza ? dataISO(dataARoma(debito.scadenza)) : null,
    // Categoria della rata: la categoria con cui si registra la Spesa della quota interessi.
    categoriaRata: (debito && debito.categoriaRata) || '',
    residuoAzzerato: valore <= 0,
    completo: Boolean(debito && debito.rata && debito.scadenza)
  };
}

module.exports = {
  arrotonda,
  dataARoma,
  dataISO,
  giornoRata,
  prossimaRata,
  numeroRateResidue,
  tassoImplicito,
  rataTeorica,
  splitRata,
  piano,
  RATE_MASSIME
};
