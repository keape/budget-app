// Formattazione e serie per le viste del Patrimonio.
// Un solo posto per i numeri: importi, percentuali, date relative e le etichette dei mesi.

export const MESI_BREVI = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'];
export const MESI_LUNGHI = [
  'gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno',
  'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'
];

export const euro = (valore, decimali = 2) =>
  `€${Number(valore || 0).toLocaleString('it-IT', {
    minimumFractionDigits: decimali,
    maximumFractionDigits: decimali
  })}`;

// Per gli assi dei grafici: €1,2k — leggibile a colpo d'occhio.
export const euroCompatto = (valore) => {
  const numero = Number(valore) || 0;
  const assoluto = Math.abs(numero);
  const segno = numero < 0 ? '−' : '';
  if (assoluto >= 1000000) return `${segno}€${(assoluto / 1000000).toFixed(1)}M`;
  if (assoluto >= 1000) return `${segno}€${(assoluto / 1000).toFixed(assoluto >= 10000 ? 0 : 1)}k`;
  return `${segno}€${Math.round(assoluto)}`;
};

// Meno tipografico, non il trattino: nelle colonne di numeri si vede la differenza.
export const conSegno = (valore, decimali = 2) => `${valore < 0 ? '−' : '+'}${euro(Math.abs(valore), decimali)}`;

export const percentuale = (parte, totale) => (totale ? Math.round((parte / totale) * 100) : 0);

const due = (n) => String(n).padStart(2, '0');

export const chiaveMese = (data) => {
  const d = new Date(data);
  return `${d.getFullYear()}-${due(d.getMonth() + 1)}`;
};

export const etichettaMese = (chiave) => {
  const [anno, mese] = String(chiave).split('-');
  return `${MESI_BREVI[Number(mese) - 1]} ${anno.slice(2)}`;
};

export const etichettaMeseLungo = (chiave) => {
  const [anno, mese] = String(chiave).split('-');
  return `${MESI_LUNGHI[Number(mese) - 1]} ${anno}`;
};

export const dataBreve = (data) =>
  new Date(data).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' });

export const dataEstesa = (data) =>
  new Date(data).toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' });

// "oggi", "ieri", "3 giorni fa", "2 mesi fa": la stessa informazione del riferimento,
// senza costringere a fare il conto.
export const dataRelativa = (data) => {
  if (!data) return null;
  const giorni = Math.floor((Date.now() - new Date(data).getTime()) / 86400000);
  if (giorni <= 0) return 'oggi';
  if (giorni === 1) return 'ieri';
  if (giorni < 31) return `${giorni} giorni fa`;
  const mesi = Math.floor(giorni / 30);
  if (mesi === 1) return 'un mese fa';
  if (mesi < 12) return `${mesi} mesi fa`;
  const anni = Math.floor(mesi / 12);
  return anni === 1 ? 'un anno fa' : `${anni} anni fa`;
};

// La Fotografia mensile diventa un punto del grafico d'insieme. `mese` è 0-indexato.
export const puntiDaFotografie = (fotografie = []) =>
  fotografie.map((f) => ({
    chiave: `${f.anno}-${due(f.mese + 1)}`,
    valore: Number(f.patrimonio) || 0,
    chiusa: f.chiusa
  }));

export const puntiDaSerie = (asse = [], serie = []) =>
  asse.map((chiave, i) => ({ chiave, valore: Number(serie[i]) || 0 }));

export const PERIODI = [
  { id: 'mese', etichetta: 'Ultimo mese', mesi: 1, variazione: "nell'ultimo mese" },
  { id: '90g', etichetta: '90 giorni', giorni: 90, variazione: 'negli ultimi 90 giorni' },
  { id: 'anno', etichetta: 'Da inizio anno', daInizioAnno: true, variazione: "dall'inizio dell'anno" },
  { id: 'tutto', etichetta: 'Sempre', mesi: null, variazione: 'da quando hai i conti' }
];

export const etichettaVariazione = (periodo) =>
  (PERIODI.find((p) => p.id === periodo) || { variazione: 'nel periodo' }).variazione;

// Il taglio del periodo, in un solo posto: la curva e le barre devono mostrare gli stessi
// mesi, altrimenti due viste della stessa cosa raccontano storie diverse.
//
// «Ultimo mese» tiene due punti e non uno — il mese in corso e quello precedente — perché
// con un punto solo non esisterebbe né il segmento della curva né il confronto fra le barre.
// «90 giorni» non è un arrotondamento a tre mesi: la data di partenza si calcola, e a
// cavallo di un mese lungo o corto le barre possono essere quattro o cinque.
export const tagliaAsse = (asse = [], periodo, oggi = new Date()) => {
  const scelto = PERIODI.find((p) => p.id === periodo);
  if (!scelto) return asse;
  if (scelto.giorni) {
    const da = chiaveMese(new Date(oggi.getTime() - scelto.giorni * 86400000));
    return asse.filter((chiave) => chiave >= da);
  }
  if (scelto.daInizioAnno) {
    const da = `${oggi.getFullYear()}-01`;
    return asse.filter((chiave) => chiave >= da);
  }
  if (scelto.mesi === null || scelto.mesi === undefined) return asse;
  const quanti = scelto.mesi + 1;
  return asse.length <= quanti ? asse : asse.slice(-quanti);
};

// Taglia la serie all'ultimo periodo richiesto. Con un solo punto disponibile il grafico
// non ha nulla da disegnare: chi lo usa mostra lo stato vuoto invece di una linea piatta.
export const filtraPeriodo = (punti, periodo, oggi = new Date()) => {
  const ammesse = new Set(tagliaAsse(punti.map((p) => p.chiave), periodo, oggi));
  return punti.filter((p) => ammesse.has(p.chiave));
};

export const variazione = (punti) => {
  if (punti.length < 2) return null;
  return punti[punti.length - 1].valore - punti[punti.length - 2].valore;
};

// I Tipi si mostrano in due sezioni — quello che possiedi e quello che devi — e dentro ogni
// sezione nell'ordine che il catalogo dichiara (`ordine`), non in ordine alfabetico: prima i
// contanti, poi il conto corrente, e così via. La sezione è la specie della Voce.
const ORDINE_SPECIE = { denaro: 0, bene: 1, debito: 2 };

export const perOrdine = (a, b) => {
  const oa = a.ordine === undefined || a.ordine === null ? 1000 : Number(a.ordine);
  const ob = b.ordine === undefined || b.ordine === null ? 1000 : Number(b.ordine);
  return oa - ob || String(a.nome).localeCompare(String(b.nome));
};

export const tipiAttivita = (tipi = []) =>
  tipi.filter((t) => t.specie === 'attivita' && !t.archiviato).sort(perOrdine);

export const tipiDebito = (tipi = []) =>
  tipi.filter((t) => t.specie === 'debito' && !t.archiviato).sort(perOrdine);

// Come si legge la scelta: che cosa sto creando e che effetto ha sul patrimonio. È la frase
// che toglie l'ambiguità fra un'attività e un debito.
export const naturaTipo = (tipo) => {
  if (!tipo) return null;
  if (tipo.specie === 'debito') {
    return {
      titolo: 'Debito',
      testo: tipo.pianoAmmortamento
        ? 'Quello che devi: sottrae dal patrimonio e scende con le rate. Di un mutuo o di un finanziamento servono il residuo di oggi, la rata e la scadenza.'
        : 'Quello che devi: sottrae dal patrimonio. Il residuo si muove con i movimenti — una spesa fatta con la carta lo alza, un versamento lo abbassa.'
    };
  }
  return tipo.denaro
    ? {
        titolo: 'Attività · denaro',
        testo: 'Il saldo di questo conto entra nel patrimonio e può ricevere spese ed entrate.'
      }
    : {
        titolo: 'Attività · bene materiale',
        testo: 'Entra nel patrimonio al valore che dichiari; riceve trasferimenti e rettifiche, non spese.'
      };
};

export const COLORE_TIPO = [
  '#6366f1', '#0ea5e9', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'
];

// I Debiti hanno una scala propria, calda: sotto lo zero il colore deve dire «debito» anche
// senza leggere la legenda, e non deve somigliare a quello di un'Attività.
export const COLORE_DEBITO = ['#e11d48', '#f97316', '#fb7185', '#f43f5e', '#ea580c'];

// Un colore solo per Tipo in tutto il Patrimonio: il blocco nel grafico a barre e la pallina
// della sintesi devono essere la stessa cosa, e il colore non deve cambiare quando un totale
// supera un altro (l'ordine è quello del catalogo, non il totale del momento).
export const coloriPerTipo = (tipi = []) => {
  const mappa = new Map();
  let attivita = 0;
  let debiti = 0;
  [...tipi]
    .sort((a, b) => ((a.specie === 'debito' ? 1 : 0) - (b.specie === 'debito' ? 1 : 0)) || perOrdine(a, b))
    .forEach((tipo) => {
      if (!tipo || !tipo.nome || mappa.has(tipo.nome)) return;
      mappa.set(
        tipo.nome,
        tipo.specie === 'debito'
          ? COLORE_DEBITO[debiti++ % COLORE_DEBITO.length]
          : COLORE_TIPO[attivita++ % COLORE_TIPO.length]
      );
    });
  return mappa;
};

export const coloreDelTipo = (colori, nome) => (colori && colori.get(nome)) || COLORE_TIPO[0];

// Oltre questo numero di barre i mesi non si distinguono più: la storia si raggruppa per anno.
export const MAX_BARRE = 44;

const arrotonda = (valore) => Math.round((Number(valore) || 0) * 100) / 100;

// La vista a blocchi: una barra per mese, un blocco per Tipo. Le Attività stanno sopra lo
// zero, i Debiti sotto (tenuti negativi, così il grafico li disegna in basso): il vuoto fra i
// due è il patrimonio, e non serve scriverlo.
//
// Sono valori di stato, non flussi: quando i mesi sono troppi per disegnarli tutti (la storia
// intera di chi usa l'app da anni) le barre diventano annuali e ognuna porta l'ULTIMO mese
// dell'anno, non la somma dell'anno — sommare dodici saldi non è un saldo.
export const barreDelPatrimonio = (asse = [], voci = [], { colori = new Map(), mesi, maxBarre = MAX_BARRE } = {}) => {
  const perTipo = new Map();

  voci.forEach((voce) => {
    const nome = voce.tipo ? voce.tipo.nome : 'Senza tipo';
    if (!perTipo.has(nome)) {
      perTipo.set(nome, {
        nome,
        debito: voce.specie === 'debito',
        ordine: voce.tipo && voce.tipo.ordine !== undefined && voce.tipo.ordine !== null ? Number(voce.tipo.ordine) : 1000,
        serie: new Array(asse.length).fill(0)
      });
    }
    const tipo = perTipo.get(nome);
    (voce.serie || []).forEach((valore, i) => {
      if (i < tipo.serie.length) tipo.serie[i] = arrotonda(tipo.serie[i] + (Number(valore) || 0));
    });
  });

  // Attività e Debiti in due blocchi separati della legenda, ognuno nell'ordine del catalogo.
  const tipi = [...perTipo.values()]
    .sort((a, b) => ((a.debito ? 1 : 0) - (b.debito ? 1 : 0)) || (a.ordine - b.ordine) || a.nome.localeCompare(b.nome))
    .map((tipo, i) => ({
      chiave: `t${i}`,
      nome: tipo.nome,
      debito: tipo.debito,
      colore: coloreDelTipo(colori, tipo.nome),
      serie: tipo.serie
    }));

  // I mesi della vista, con l'indice che hanno nell'asse intero: le serie dei conti sono
  // allineate a quello, e tagliare l'asse senza tenere l'indice sposterebbe ogni valore.
  const ammesse = mesi ? new Set(mesi) : null;
  const punti = asse.map((chiave, i) => ({ chiave, i })).filter((p) => !ammesse || ammesse.has(p.chiave));

  const perAnno = punti.length > maxBarre;
  const gruppi = [];
  punti.forEach(({ chiave, i }) => {
    const gruppo = perAnno ? chiave.slice(0, 4) : chiave;
    const ultimo = gruppi[gruppi.length - 1];
    // A parità di anno vince l'ultimo mese incontrato: l'asse è in ordine crescente.
    if (ultimo && ultimo.gruppo === gruppo) ultimo.indice = i;
    else gruppi.push({ gruppo, indice: i });
  });

  const barre = gruppi.map(({ gruppo, indice }) => {
    const barra = {
      chiave: perAnno ? gruppo : asse[indice],
      etichetta: perAnno ? gruppo : etichettaMese(asse[indice]),
      etichettaLunga: perAnno ? gruppo : etichettaMeseLungo(asse[indice]),
      valori: {},
      totali: {},
      totaleAttivita: 0,
      totaleDebiti: 0
    };

    tipi.forEach((tipo) => {
      const valore = arrotonda(tipo.serie[indice] || 0);
      if (tipo.debito) {
        const residuo = Math.abs(valore);
        barra.valori[tipo.chiave] = -residuo;
        barra.totali[tipo.chiave] = residuo;
        barra.totaleDebiti = arrotonda(barra.totaleDebiti + residuo);
      } else {
        barra.valori[tipo.chiave] = valore;
        barra.totali[tipo.chiave] = valore;
        barra.totaleAttivita = arrotonda(barra.totaleAttivita + valore);
      }
    });

    barra.patrimonio = arrotonda(barra.totaleAttivita - barra.totaleDebiti);
    return barra;
  });

  return { barre, tipi, perAnno };
};

// Le Voci raggruppate per Tipo, ciascun gruppo con il suo totale e la sua variazione:
// è la forma dell'elenco (il Tipo è l'etichetta che l'utente riconosce).
export const raggruppaPerTipo = (voci = []) => {
  const gruppi = new Map();
  voci.forEach((voce) => {
    const nome = voce.tipo ? voce.tipo.nome : 'Senza tipo';
    const debito = voce.specie === 'debito';
    const ordine = debito ? ORDINE_SPECIE.debito : voce.tipo && voce.tipo.denaro ? ORDINE_SPECIE.denaro : ORDINE_SPECIE.bene;
    if (!gruppi.has(nome)) {
      gruppi.set(nome, {
        nome,
        ordine,
        ordineTipo: voce.tipo && voce.tipo.ordine !== undefined && voce.tipo.ordine !== null ? Number(voce.tipo.ordine) : 1000,
        debito,
        emoji: EMOJI_TIPO[nome] || (debito ? '📉' : '📦'),
        voci: [],
        totale: 0,
        delta: 0
      });
    }
    const gruppo = gruppi.get(nome);
    gruppo.voci.push(voce);
    gruppo.totale += voce.valore;
    gruppo.delta += voce.deltaMese || 0;
  });

  return [...gruppi.values()]
    .map((g) => ({ ...g, totale: Math.round(g.totale * 100) / 100, delta: Math.round(g.delta * 100) / 100 }))
    .sort((a, b) => (a.ordine - b.ordine) || (a.ordineTipo - b.ordineTipo) || a.nome.localeCompare(b.nome));
};

// L'emoji è un'etichetta del Tipo (come le icone di categoria nel resto dell'app), non un
// sostituto di un sistema di icone per i comandi.
export const EMOJI_TIPO = {
  Contanti: '💵',
  'Conti correnti': '🏦',
  Investimenti: '📈',
  Crediti: '🤝',
  Immobili: '🏠',
  Veicoli: '🚗',
  'Beni di valore': '💎',
  'Altri asset': '📦',
  'Carte di credito': '💳',
  Mutui: '🏚️',
  Debiti: '📉',
  'Altre liability': '📉'
};
