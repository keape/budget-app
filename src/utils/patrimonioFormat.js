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
  { id: '1m', etichetta: '1 mese', mesi: 1, variazione: "nell'ultimo mese" },
  { id: '6m', etichetta: '6 mesi', mesi: 6, variazione: 'negli ultimi 6 mesi' },
  { id: '1a', etichetta: '1 anno', mesi: 12, variazione: 'negli ultimi 12 mesi' },
  { id: 'tutto', etichetta: 'Tutto', mesi: null, variazione: 'da quando hai i conti' }
];

export const etichettaVariazione = (periodo) =>
  (PERIODI.find((p) => p.id === periodo) || { variazione: 'nel periodo' }).variazione;

// Taglia la serie all'ultimo periodo richiesto. Con un solo punto disponibile il grafico
// non ha nulla da disegnare: chi lo usa mostra lo stato vuoto invece di una linea piatta.
export const filtraPeriodo = (punti, periodo) => {
  const scelto = PERIODI.find((p) => p.id === periodo);
  if (!scelto || !scelto.mesi || punti.length <= scelto.mesi + 1) return punti;
  return punti.slice(-(scelto.mesi + 1));
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
      testo: 'Quello che devi: riduce il patrimonio. I Debiti arrivano con la fetta successiva.'
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
  Finanziamenti: '📉',
  'Altre liability': '📉'
};
