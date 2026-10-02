// Filtri.js — pagina «Transazioni»: l'elenco dei movimenti, con i filtri raccolti in tre
// comandi (Cerca / Data / Filtri) sopra la lista stessa.
// L'indirizzo resta /filtri: i rimandi da Home e dal grafico del budget continuano a valere
// (?categoria=…, ?mese=…&anno=…, ?tipo=…). I grafici sono stati spostati: andranno nella
// pagina Statistiche, che è una superficie a sé.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import BASE_URL from './config';
import LoadingSpinner from './components/LoadingSpinner';
import Modale from './components/Modale';

const MESI = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno',
  'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];
const GIORNI = ['domenica', 'lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato'];

// Quanti movimenti si disegnano per volta: la richiesta ne porta fino a diecimila per tipo,
// ma la pagina non deve costruire diecimila righe per mostrarne venti.
const PASSO = 100;

/* ------------------------------------------------------------------ formattazione */

const due = (n) => String(n).padStart(2, '0');

// Data locale in forma AAAA-MM-GG, senza passare da toISOString (che sposta il giorno).
function isoLocale(d) {
  return `${d.getFullYear()}-${due(d.getMonth() + 1)}-${due(d.getDate())}`;
}

function daIso(iso) {
  if (!iso) return null;
  const [a, m, g] = iso.split('-').map(Number);
  if (!a || !m || !g) return null;
  return new Date(a, m - 1, g);
}

function giornoChiave(data) {
  const d = new Date(data);
  if (Number.isNaN(d.getTime())) return 'senza-data';
  return isoLocale(d);
}

function etichettaGiorno(chiave) {
  const d = daIso(chiave);
  if (!d) return 'Senza data';
  const esteso = `${d.getDate()} ${MESI[d.getMonth()]} ${d.getFullYear()}`;
  const oggi = new Date();
  if (chiave === isoLocale(oggi)) return `Oggi · ${esteso}`;
  const ieri = new Date(oggi);
  ieri.setDate(oggi.getDate() - 1);
  if (chiave === isoLocale(ieri)) return `Ieri · ${esteso}`;
  return `${GIORNI[d.getDay()]} ${esteso}`;
}

function etichettaData(chiave) {
  const d = daIso(chiave);
  if (!d) return '—';
  return `${d.getDate()} ${MESI[d.getMonth()].slice(0, 3)} ${d.getFullYear()}`;
}

function importoDi(movimento) {
  return Number(movimento?.importo) || 0;
}

// L'importo si legge sempre con il segno esplicito: senza, una spesa e un'entrata
// sembrano lo stesso numero.
function formattaImporto(valore, conSegno = false) {
  const n = Number(valore) || 0;
  const assoluto = Math.abs(n).toLocaleString('it-IT', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
  if (!conSegno) return `${assoluto} €`;
  return `${n < 0 ? '−' : '+'}${assoluto} €`;
}

function etichettaPeriodo(inizio, fine) {
  if (inizio && fine) return `${etichettaData(inizio)} → ${etichettaData(fine)}`;
  if (inizio) return `dal ${etichettaData(inizio)}`;
  if (fine) return `fino al ${etichettaData(fine)}`;
  return '';
}

/* ------------------------------------------------------------------ periodi rapidi */

const PRESET_DATE = [
  { id: 'ultimi-7', etichetta: 'Ultimi 7 giorni' },
  { id: 'ultimi-14', etichetta: 'Ultimi 14 giorni' },
  { id: 'ultimi-30', etichetta: 'Ultimi 30 giorni' },
  { id: 'questo-mese', etichetta: 'Questo mese' },
  { id: 'mese-scorso', etichetta: 'Mese scorso' },
  { id: 'quest-anno', etichetta: 'Quest\'anno' },
  { id: 'anno-scorso', etichetta: 'Anno scorso' }
];

function intervalloPreset(id) {
  const oggi = new Date();
  const anno = oggi.getFullYear();
  switch (id) {
    case 'ultimi-7': {
      const s = new Date(oggi);
      s.setDate(oggi.getDate() - 6);
      return [isoLocale(s), isoLocale(oggi)];
    }
    case 'ultimi-14': {
      const s = new Date(oggi);
      s.setDate(oggi.getDate() - 13);
      return [isoLocale(s), isoLocale(oggi)];
    }
    case 'ultimi-30': {
      const s = new Date(oggi);
      s.setDate(oggi.getDate() - 29);
      return [isoLocale(s), isoLocale(oggi)];
    }
    case 'questo-mese':
      return [isoLocale(new Date(anno, oggi.getMonth(), 1)), isoLocale(new Date(anno, oggi.getMonth() + 1, 0))];
    case 'mese-scorso':
      return [isoLocale(new Date(anno, oggi.getMonth() - 1, 1)), isoLocale(new Date(anno, oggi.getMonth(), 0))];
    case 'quest-anno':
      return [`${anno}-01-01`, `${anno}-12-31`];
    case 'anno-scorso':
      return [`${anno - 1}-01-01`, `${anno - 1}-12-31`];
    default:
      return ['', ''];
  }
}

/* ------------------------------------------------------------------ tinte e icone */

// La tinta della categoria è un'identità stabile (stessa categoria, stesso colore) presa da
// una tavolozza che non usa rosso e verde: quelli restano il segno dell'importo.
const TINTE = [
  'bg-pink-100 text-pink-700 dark:bg-pink-500/15 dark:text-pink-300',
  'bg-purple-100 text-purple-700 dark:bg-purple-500/15 dark:text-purple-300',
  'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300',
  'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300',
  'bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300',
  'bg-cyan-100 text-cyan-700 dark:bg-cyan-500/15 dark:text-cyan-300',
  'bg-teal-100 text-teal-700 dark:bg-teal-500/15 dark:text-teal-300',
  'bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300',
  'bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-500/15 dark:text-fuchsia-300',
  'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
  'bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300',
  'bg-lime-100 text-lime-700 dark:bg-lime-500/15 dark:text-lime-300'
];

function tintaCategoria(nome) {
  const testo = String(nome || '');
  let hash = 0;
  for (let i = 0; i < testo.length; i += 1) {
    hash = (hash * 31 + testo.charCodeAt(i)) % 9973;
  }
  return TINTE[hash % TINTE.length];
}

function IconaCerca({ className = 'h-4 w-4' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.7-3.7" />
    </svg>
  );
}

function IconaCalendario({ className = 'h-4 w-4' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <rect x="3.5" y="5" width="17" height="15.5" rx="2.5" />
      <path d="M3.5 9.5h17M8 3.5v3M16 3.5v3" />
    </svg>
  );
}

function IconaFiltri({ className = 'h-4 w-4' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M4 7h5m4 0h7M4 12h9m4 0h3M4 17h3m4 0h9" />
      <circle cx="11" cy="7" r="2.1" />
      <circle cx="15" cy="12" r="2.1" />
      <circle cx="9" cy="17" r="2.1" />
    </svg>
  );
}

function IconaX({ className = 'h-3.5 w-3.5' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" className={className} aria-hidden="true">
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

function IconaSpunta({ className = 'h-3 w-3' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3.2} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="m5 13 4.5 4.5L19 7" />
    </svg>
  );
}

function IconaModifica({ className = 'h-4 w-4' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M16.9 4.5a1.9 1.9 0 1 1 2.7 2.6L10.6 16.1a4.5 4.5 0 0 1-1.9 1.1L6 18l.8-2.7a4.5 4.5 0 0 1 1.1-1.9z" />
      <path d="m15.5 6 2.6 2.6M18 14v4.7A2.3 2.3 0 0 1 15.7 21H5.3A2.3 2.3 0 0 1 3 18.7V8.3A2.3 2.3 0 0 1 5.3 6H10" />
    </svg>
  );
}

function IconaCestino({ className = 'h-4 w-4' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M4 7h16M9.5 4h5M6 7l.9 12.1A2 2 0 0 0 8.9 21h6.2a2 2 0 0 0 2-1.9L18 7M10 11v6M14 11v6" />
    </svg>
  );
}

function IconaScarica({ className = 'h-4 w-4' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M12 4v10m0 0-3.5-3.5M12 14l3.5-3.5M4.5 17.5V19a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-1.5" />
    </svg>
  );
}

function IconaPiu({ className = 'h-4 w-4' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" className={className} aria-hidden="true">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function IconaFreccia({ className = 'h-3.5 w-3.5' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M5 12h13m0 0-5-5m5 5-5 5" />
    </svg>
  );
}

/* ------------------------------------------------------------------ classi condivise */

const PILL_BASE = 'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-gray-900';
const PILL_ATTIVA = `${PILL_BASE} border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-500/40 dark:bg-indigo-500/15 dark:text-indigo-200`;
const PILL_SPENTA = `${PILL_BASE} border-gray-200 bg-white text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-white`;

const CAMPO = 'w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/25 dark:border-gray-700 dark:bg-gray-900 dark:text-white dark:placeholder:text-gray-500';

const BOTTONE_PRIMARIO = 'inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-2 text-sm font-semibold text-white transition-colors duration-150 hover:bg-indigo-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white disabled:cursor-not-allowed disabled:opacity-50 dark:focus-visible:ring-offset-gray-900';
const BOTTONE_NEUTRO = 'inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3.5 py-2 text-sm font-medium text-gray-700 transition-colors duration-150 hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800 dark:focus-visible:ring-offset-gray-900';

const PANNELLO = 'overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-900';

// Il pannello ancorato al suo comando: su schermo stretto diventa una finestra a tutta
// larghezza (i tre comandi affiancati non entrerebbero), da md in su torna un menù a tendina.
const ANCORAGGIO = 'fixed inset-x-2 top-20 bottom-4 z-50 md:absolute md:inset-x-auto md:bottom-auto md:top-full md:left-0 md:mt-2 md:max-h-[calc(100vh-8rem)] md:overflow-y-auto';

// Chiude il pannello quando si clicca fuori o si preme Esc. La ref va messa sul contenitore
// che include anche il comando, altrimenti il clic sul comando lo chiude e lo riapre subito.
function useChiudiFuori(aperto, onChiudi) {
  const contenitore = useRef(null);
  const chiudi = useRef(onChiudi);
  chiudi.current = onChiudi;

  useEffect(() => {
    if (!aperto) return undefined;
    const suPressione = (e) => {
      if (contenitore.current && !contenitore.current.contains(e.target)) chiudi.current();
    };
    const suTasto = (e) => {
      if (e.key === 'Escape') chiudi.current();
    };
    document.addEventListener('mousedown', suPressione);
    document.addEventListener('keydown', suTasto);
    return () => {
      document.removeEventListener('mousedown', suPressione);
      document.removeEventListener('keydown', suTasto);
    };
  }, [aperto]);

  return contenitore;
}

function Casella({ attiva, children }) {
  return (
    <span
      className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors duration-150 ${attiva
        ? 'border-indigo-600 bg-indigo-600 text-white dark:border-indigo-500 dark:bg-indigo-500'
        : 'border-gray-300 bg-white text-transparent dark:border-gray-600 dark:bg-gray-800'}`}
    >
      {children}
    </span>
  );
}

/* ------------------------------------------------------------------ pannello Data */

function PannelloData({ dataInizio, dataFine, onApplica, onChiudi }) {
  const [inizio, setInizio] = useState(dataInizio);
  const [fine, setFine] = useState(dataFine);

  const presetAttivo = PRESET_DATE.find((p) => {
    const [a, b] = intervalloPreset(p.id);
    return a === inizio && b === fine;
  });

  const applica = () => {
    let a = inizio;
    let b = fine;
    if (a && b && a > b) {
      a = fine;
      b = inizio;
    }
    onApplica(a, b);
    onChiudi();
  };

  return (
    <div className={`${ANCORAGGIO} ${PANNELLO} md:w-[30rem]`} role="dialog" aria-label="Intervallo di date">
      <div className="flex flex-col md:flex-row">
        <ul className="flex gap-1 overflow-x-auto border-b border-gray-100 p-2 md:block md:w-44 md:shrink-0 md:border-b-0 md:border-r md:py-3 dark:border-gray-800">
          {PRESET_DATE.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => {
                  const [a, b] = intervalloPreset(p.id);
                  setInizio(a);
                  setFine(b);
                }}
                className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-sm transition-colors duration-150 md:w-full md:text-left ${presetAttivo && presetAttivo.id === p.id
                  ? 'bg-indigo-50 font-medium text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-200'
                  : 'text-gray-600 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-800'}`}
              >
                {p.etichetta}
              </button>
            </li>
          ))}
        </ul>

        <div className="flex-1 space-y-4 p-4">
          <div>
            <div className="flex items-baseline justify-between gap-2">
              <label htmlFor="data-inizio" className="text-sm font-medium text-gray-700 dark:text-gray-200">
                Data iniziale
              </label>
              {inizio && (
                <button type="button" onClick={() => setInizio('')} className="text-xs font-medium text-indigo-600 hover:underline dark:text-indigo-300">
                  Azzera
                </button>
              )}
            </div>
            <input id="data-inizio" type="date" value={inizio} onChange={(e) => setInizio(e.target.value)} className={`mt-1.5 ${CAMPO}`} />
          </div>
          <div>
            <div className="flex items-baseline justify-between gap-2">
              <label htmlFor="data-fine" className="text-sm font-medium text-gray-700 dark:text-gray-200">
                Data finale
              </label>
              {fine && (
                <button type="button" onClick={() => setFine('')} className="text-xs font-medium text-indigo-600 hover:underline dark:text-indigo-300">
                  Azzera
                </button>
              )}
            </div>
            <input id="data-fine" type="date" value={fine} onChange={(e) => setFine(e.target.value)} className={`mt-1.5 ${CAMPO}`} />
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Le date sono comprese: il giorno iniziale e quello finale entrano nell'intervallo.
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 border-t border-gray-100 px-4 py-3 dark:border-gray-800">
        <button type="button" onClick={() => { setInizio(''); setFine(''); }} className="text-sm font-medium text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white">
          Azzera
        </button>
        <div className="flex gap-2">
          <button type="button" onClick={onChiudi} className={BOTTONE_NEUTRO}>
            Annulla
          </button>
          <button type="button" onClick={applica} className={BOTTONE_PRIMARIO}>
            Applica
          </button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ pannello Filtri */

const GRUPPI = [
  { id: 'tipo', etichetta: 'Tipo' },
  { id: 'categorie', etichetta: 'Categorie' },
  { id: 'conti', etichetta: 'Conti' },
  { id: 'importo', etichetta: 'Importo' }
];

const FASCIA_IMPORTO = [
  { etichetta: 'Fino a 20 €', min: '', max: '20' },
  { etichetta: 'Da 20 a 100 €', min: '20', max: '100' },
  { etichetta: 'Oltre 100 €', min: '100', max: '' }
];

function RigaCasella({ etichetta, attiva, onCambia, conteggio }) {
  return (
    <label className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm text-gray-700 transition-colors duration-150 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-800">
      <input type="checkbox" className="peer sr-only" checked={attiva} onChange={() => onCambia(!attiva)} />
      <span className="rounded peer-focus-visible:ring-2 peer-focus-visible:ring-indigo-500 peer-focus-visible:ring-offset-1 dark:peer-focus-visible:ring-offset-gray-900">
        <Casella attiva={attiva}>
          <IconaSpunta />
        </Casella>
      </span>
      <span className="truncate">{etichetta}</span>
      {conteggio !== undefined && (
        <span className="ml-auto shrink-0 text-xs tabular-nums text-gray-400 dark:text-gray-500">{conteggio}</span>
      )}
    </label>
  );
}

function PannelloFiltri({ valoriIniziali, opzioni, onApplica, onChiudi }) {
  const [tipi, setTipi] = useState(valoriIniziali.tipi);
  const [categorie, setCategorie] = useState(valoriIniziali.categorie);
  const [conti, setConti] = useState(valoriIniziali.conti);
  const [importoMin, setImportoMin] = useState(valoriIniziali.importoMin);
  const [importoMax, setImportoMax] = useState(valoriIniziali.importoMax);
  const [gruppo, setGruppo] = useState('categorie');
  const [ricerca, setRicerca] = useState('');

  const conteggi = {
    tipo: tipi.length,
    categorie: categorie.length,
    conti: conti.length,
    importo: (importoMin === '' ? 0 : 1) + (importoMax === '' ? 0 : 1)
  };
  const selezionati = conteggi.tipo + conteggi.categorie + conteggi.conti + conteggi.importo;

  const alterna = (elenco, setElenco, voce) => {
    setElenco(elenco.includes(voce) ? elenco.filter((v) => v !== voce) : [...elenco, voce]);
  };

  const testoRicerca = ricerca.trim().toLowerCase();
  const filtraElenco = (elenco) => (testoRicerca ? elenco.filter((v) => v.toLowerCase().includes(testoRicerca)) : elenco);

  const categorieUscite = filtraElenco(opzioni.categorie.uscite);
  const categorieEntrate = filtraElenco(opzioni.categorie.entrate);
  const contiFiltrati = testoRicerca
    ? opzioni.conti.filter((c) => c.nome.toLowerCase().includes(testoRicerca))
    : opzioni.conti;

  const tutteCategorieVisibili = [...categorieUscite, ...categorieEntrate];
  const categorieVisibiliTutteScelte = tutteCategorieVisibili.length > 0
    && tutteCategorieVisibili.every((c) => categorie.includes(c));

  const chipsSelezionati = [
    ...tipi.map((t) => ({ chiave: `tipo-${t}`, gruppo: 'Tipo', testo: t === 'entrata' ? 'Entrate' : 'Uscite', rimuovi: () => setTipi(tipi.filter((x) => x !== t)) })),
    ...categorie.map((c) => ({ chiave: `categoria-${c}`, gruppo: 'Categorie', testo: c, rimuovi: () => setCategorie(categorie.filter((x) => x !== c)) })),
    ...conti.map((id) => ({
      chiave: `conto-${id}`,
      gruppo: 'Conti',
      testo: opzioni.conti.find((c) => c.id === id)?.nome || 'Conto',
      rimuovi: () => setConti(conti.filter((x) => x !== id))
    })),
    ...(importoMin === '' ? [] : [{ chiave: 'importo-min', gruppo: 'Importo', testo: `almeno ${formattaImporto(importoMin)}`, rimuovi: () => setImportoMin('') }]),
    ...(importoMax === '' ? [] : [{ chiave: 'importo-max', gruppo: 'Importo', testo: `fino a ${formattaImporto(importoMax)}`, rimuovi: () => setImportoMax('') }])
  ];

  const azzera = () => {
    setTipi([]);
    setCategorie([]);
    setConti([]);
    setImportoMin('');
    setImportoMax('');
  };

  // Un importo digitato male (virgola, testo) non deve diventare un filtro che non filtra:
  // se non è un numero, il campo si svuota e il filtro semplicemente non si applica.
  const importoValido = (valore) => {
    if (valore === '') return '';
    const n = Number(String(valore).replace(',', '.'));
    return Number.isNaN(n) ? '' : String(Math.abs(n));
  };

  return (
    <div className={`${ANCORAGGIO} ${PANNELLO} md:w-[44rem]`} role="dialog" aria-label="Filtri">
      <div className="flex flex-col md:flex-row md:min-h-[22rem]">
        {/* Colonna 1: i gruppi di filtri */}
        <ul className="flex gap-1 overflow-x-auto border-b border-gray-100 p-2 md:block md:w-36 md:shrink-0 md:border-b-0 md:border-r md:py-2 dark:border-gray-800">
          {GRUPPI.map((g) => (
            <li key={g.id}>
              <button
                type="button"
                onClick={() => { setGruppo(g.id); setRicerca(''); }}
                className={`flex w-full items-center gap-2 whitespace-nowrap rounded-lg px-3 py-1.5 text-sm transition-colors duration-150 md:text-left ${gruppo === g.id
                  ? 'bg-indigo-50 font-medium text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-200'
                  : 'text-gray-600 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-800'}`}
              >
                <span>{g.etichetta}</span>
                {conteggi[g.id] > 0 && (
                  <span className="ml-auto rounded-full bg-indigo-600 px-1.5 text-xs font-semibold tabular-nums text-white dark:bg-indigo-500">
                    {conteggi[g.id]}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>

        {/* Colonna 2: le voci del gruppo scelto */}
        <div className="flex-1 border-b border-gray-100 md:border-b-0 dark:border-gray-800">
          {gruppo !== 'importo' && (
            <div className="p-3">
              <label htmlFor="ricerca-filtri" className="sr-only">Cerca fra le voci del filtro</label>
              <div className="relative">
                <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-gray-400 dark:text-gray-500">
                  <IconaCerca className="h-4 w-4" />
                </span>
                <input
                  id="ricerca-filtri"
                  type="search"
                  value={ricerca}
                  onChange={(e) => setRicerca(e.target.value)}
                  placeholder="Cerca…"
                  className={`${CAMPO} pl-9`}
                />
              </div>
            </div>
          )}

          <div className="max-h-[16rem] overflow-y-auto px-2 pb-3 md:max-h-[18rem]">
            {gruppo === 'tipo' && (
              <>
                <p className="px-2 pb-1 text-xs text-gray-500 dark:text-gray-400">
                  Nessuna scelta significa entrate e uscite insieme.
                </p>
                <RigaCasella etichetta="Entrate" attiva={tipi.includes('entrata')} onCambia={() => alterna(tipi, setTipi, 'entrata')} />
                <RigaCasella etichetta="Uscite" attiva={tipi.includes('uscita')} onCambia={() => alterna(tipi, setTipi, 'uscita')} />
              </>
            )}

            {gruppo === 'categorie' && (
              <>
                {tutteCategorieVisibili.length > 1 && (
                  <RigaCasella
                    etichetta="Seleziona tutte"
                    attiva={categorieVisibiliTutteScelte}
                    onCambia={(scegli) => {
                      if (scegli) {
                        setCategorie([...new Set([...categorie, ...tutteCategorieVisibili])]);
                      } else {
                        setCategorie(categorie.filter((c) => !tutteCategorieVisibili.includes(c)));
                      }
                    }}
                  />
                )}
                {categorieUscite.length > 0 && (
                  <>
                    <p className="mt-2 px-2 pb-1 text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">Uscite</p>
                    {categorieUscite.map((c) => (
                      <RigaCasella key={c} etichetta={c} attiva={categorie.includes(c)} onCambia={() => alterna(categorie, setCategorie, c)} />
                    ))}
                  </>
                )}
                {categorieEntrate.length > 0 && (
                  <>
                    <p className="mt-2 px-2 pb-1 text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">Entrate</p>
                    {categorieEntrate.map((c) => (
                      <RigaCasella key={c} etichetta={c} attiva={categorie.includes(c)} onCambia={() => alterna(categorie, setCategorie, c)} />
                    ))}
                  </>
                )}
                {categorieUscite.length === 0 && categorieEntrate.length === 0 && (
                  <p className="px-2 py-6 text-center text-sm text-gray-500 dark:text-gray-400">Nessuna categoria trovata.</p>
                )}
              </>
            )}

            {gruppo === 'conti' && (
              <>
                {contiFiltrati.length === 0 ? (
                  <p className="px-2 py-6 text-center text-sm text-gray-500 dark:text-gray-400">Nessun conto trovato.</p>
                ) : (
                  <>
                    {contiFiltrati.length > 1 && (
                      <RigaCasella
                        etichetta="Seleziona tutti"
                        attiva={contiFiltrati.every((c) => conti.includes(c.id))}
                        onCambia={(scegli) => {
                          const ids = contiFiltrati.map((c) => c.id);
                          setConti(scegli ? [...new Set([...conti, ...ids])] : conti.filter((id) => !ids.includes(id)));
                        }}
                      />
                    )}
                    {contiFiltrati.map((c) => (
                      <RigaCasella key={c.id} etichetta={c.nome} attiva={conti.includes(c.id)} onCambia={() => alterna(conti, setConti, c.id)} />
                    ))}
                  </>
                )}
              </>
            )}

            {gruppo === 'importo' && (
              <div className="space-y-3 p-1">
                <div className="flex flex-wrap gap-1.5">
                  {FASCIA_IMPORTO.map((f) => (
                    <button
                      key={f.etichetta}
                      type="button"
                      onClick={() => { setImportoMin(f.min); setImportoMax(f.max); }}
                      className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors duration-150 ${importoMin === f.min && importoMax === f.max
                        ? 'border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-500/40 dark:bg-indigo-500/15 dark:text-indigo-200'
                        : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800'}`}
                    >
                      {f.etichetta}
                    </button>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="importo-min" className="text-xs font-medium text-gray-600 dark:text-gray-300">Almeno (€)</label>
                    <input id="importo-min" type="number" min="0" inputMode="decimal" value={importoMin} onChange={(e) => setImportoMin(e.target.value)} className={`mt-1 ${CAMPO}`} />
                  </div>
                  <div>
                    <label htmlFor="importo-max" className="text-xs font-medium text-gray-600 dark:text-gray-300">Al massimo (€)</label>
                    <input id="importo-max" type="number" min="0" inputMode="decimal" value={importoMax} onChange={(e) => setImportoMax(e.target.value)} className={`mt-1 ${CAMPO}`} />
                  </div>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Il confronto è sul valore assoluto: il limite vale sia per le spese sia per le entrate.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Colonna 3: cosa è stato scelto, con la croce per togliere una voce */}
        <div className="hidden w-56 shrink-0 border-l border-gray-100 p-3 md:block dark:border-gray-800">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
            {selezionati === 0 ? 'Nessun filtro' : `${selezionati} ${selezionati === 1 ? 'filtro scelto' : 'filtri scelti'}`}
          </p>
          {selezionati > 0 && (
            <button type="button" onClick={azzera} className="mt-1 text-xs font-medium text-indigo-600 hover:underline dark:text-indigo-300">
              Azzera
            </button>
          )}
          <ul className="mt-3 space-y-1.5">
            {chipsSelezionati.map((chip) => (
              <li key={chip.chiave}>
                <button
                  type="button"
                  onClick={chip.rimuovi}
                  title={`Togli ${chip.testo}`}
                  className="flex w-full items-center gap-2 rounded-lg bg-gray-50 px-2 py-1.5 text-left text-xs text-gray-700 transition-colors duration-150 hover:bg-gray-100 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
                >
                  <span className="truncate">{chip.testo}</span>
                  <span className="ml-auto shrink-0 text-gray-400 dark:text-gray-500"><IconaX /></span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 border-t border-gray-100 px-4 py-3 dark:border-gray-800">
        <button type="button" onClick={azzera} className="text-sm font-medium text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white">
          Azzera
        </button>
        <div className="flex items-center gap-2">
          <span className="mr-1 text-xs text-gray-500 md:hidden dark:text-gray-400">
            {selezionati === 0 ? 'Nessun filtro' : `${selezionati} scelti`}
          </span>
          <button type="button" onClick={onChiudi} className={BOTTONE_NEUTRO}>
            Annulla
          </button>
          <button
            type="button"
            onClick={() => {
              onApplica({
                tipi,
                categorie,
                conti,
                importoMin: importoValido(importoMin),
                importoMax: importoValido(importoMax)
              });
              onChiudi();
            }}
            className={BOTTONE_PRIMARIO}
          >
            Applica
          </button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ riquadro Riepilogo */

function Riga({ etichetta, valore, tono = 'neutro' }) {
  const colore = tono === 'entrata'
    ? 'text-emerald-600 dark:text-emerald-400'
    : tono === 'uscita'
      ? 'text-red-600 dark:text-red-400'
      : 'text-gray-900 dark:text-gray-100';
  return (
    <div className="flex items-baseline justify-between gap-3 py-1.5">
      <dt className="text-sm text-gray-500 dark:text-gray-400">{etichetta}</dt>
      <dd className={`text-sm font-semibold tabular-nums ${colore}`}>{valore}</dd>
    </div>
  );
}

function Riepilogo({ dati, onScarica }) {
  return (
    <aside className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900 lg:sticky lg:top-6">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">Riepilogo</h2>
      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Sui movimenti che i filtri lasciano in vista.</p>

      <dl className="mt-3 divide-y divide-gray-100 dark:divide-gray-800">
        <Riga etichetta="Movimenti" valore={String(dati.numero)} />
        <Riga etichetta="Uscite" valore={formattaImporto(dati.uscite, true)} />
        <Riga etichetta="Entrate" valore={formattaImporto(dati.entrate, true)} tono="entrata" />
        <Riga etichetta="Saldo" valore={formattaImporto(dati.saldo, true)} tono={dati.saldo >= 0 ? 'entrata' : 'uscita'} />
        <Riga etichetta="Spesa più alta" valore={dati.spesaTop ? formattaImporto(importoDi(dati.spesaTop), true) : '—'} />
        <Riga etichetta="Entrata più alta" valore={dati.entrataTop ? formattaImporto(importoDi(dati.entrataTop), true) : '—'} />
        <Riga etichetta="Media delle uscite" valore={dati.mediaUscite ? formattaImporto(dati.mediaUscite) : '—'} />
        <Riga etichetta="Primo movimento" valore={dati.primo ? etichettaData(giornoChiave(dati.primo.data)) : '—'} />
        <Riga etichetta="Ultimo movimento" valore={dati.ultimo ? etichettaData(giornoChiave(dati.ultimo.data)) : '—'} />
      </dl>

      <button type="button" onClick={onScarica} disabled={dati.numero === 0} className={`mt-4 w-full justify-center ${BOTTONE_NEUTRO}`}>
        <IconaScarica />
        <span>Scarica CSV</span>
      </button>
      <p className="mt-2 text-center text-xs text-gray-400 dark:text-gray-500">
        Esporta {dati.numero === 1 ? 'il movimento in vista' : 'i movimenti in vista'}.
      </p>
    </aside>
  );
}

/* ------------------------------------------------------------------ riga dell'elenco */

function RigaMovimento({ movimento, nomeConto, onModifica, onElimina }) {
  const entrata = movimento.tipo === 'entrata';
  const categoria = movimento.categoria || 'Senza categoria';
  const nota = movimento.descrizione || '';
  const iniziale = (categoria.trim().charAt(0) || '?').toUpperCase();

  return (
    <li className="group grid grid-cols-[2rem_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-0.5 px-4 py-3 transition-colors duration-150 hover:bg-gray-50 md:grid-cols-[2rem_minmax(0,9rem)_minmax(0,1fr)_minmax(0,9rem)_8rem_4.5rem] dark:hover:bg-gray-800/50">
      <span
        className={`col-start-1 row-start-1 flex h-8 w-8 items-center justify-center rounded-lg text-xs font-semibold uppercase ${tintaCategoria(categoria)}`}
        aria-hidden="true"
      >
        {iniziale}
      </span>

      <span className="col-start-2 row-start-1 truncate text-sm font-medium text-gray-900 dark:text-gray-100" title={categoria}>
        {categoria}
      </span>

      <span
        className={`col-start-3 row-start-1 justify-self-end text-sm font-semibold tabular-nums md:col-start-5 ${entrata ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-900 dark:text-gray-100'}`}
      >
        {formattaImporto(importoDi(movimento), true)}
      </span>

      <span
        className="col-span-2 col-start-2 row-start-2 truncate text-sm text-gray-500 md:col-span-1 md:col-start-3 md:row-start-1 dark:text-gray-400"
        title={nota}
      >
        {nota || '—'}
      </span>

      {nomeConto ? (
        <Link
          to={`/patrimonio/${movimento.voceId}`}
          title={`Apri il conto ${nomeConto}`}
          className="col-start-2 row-start-3 inline-flex w-fit max-w-full items-center gap-1.5 rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-600 transition-colors duration-150 hover:bg-gray-200 hover:text-gray-900 md:col-start-4 md:row-start-1 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700 dark:hover:text-white"
        >
          <span className="truncate">{nomeConto}</span>
          <IconaFreccia className="shrink-0 text-gray-400 dark:text-gray-500" />
        </Link>
      ) : (
        <span className="hidden md:col-start-4 md:row-start-1 md:block" />
      )}

      <div className="col-start-3 row-start-3 flex justify-end gap-1 md:col-start-6 md:row-start-1 md:opacity-0 md:transition-opacity md:duration-150 md:group-hover:opacity-100 md:group-focus-within:opacity-100">
        <button
          type="button"
          onClick={() => onModifica(movimento)}
          title="Modifica"
          aria-label={`Modifica ${categoria} del ${etichettaData(giornoChiave(movimento.data))}`}
          className="rounded-lg p-2 text-gray-400 transition-colors duration-150 hover:bg-gray-100 hover:text-indigo-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:text-gray-500 dark:hover:bg-gray-800 dark:hover:text-indigo-300"
        >
          <IconaModifica />
        </button>
        <button
          type="button"
          onClick={() => onElimina(movimento)}
          title="Elimina"
          aria-label={`Elimina ${categoria} del ${etichettaData(giornoChiave(movimento.data))}`}
          className="rounded-lg p-2 text-gray-400 transition-colors duration-150 hover:bg-gray-100 hover:text-red-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:text-gray-500 dark:hover:bg-gray-800 dark:hover:text-red-400"
        >
          <IconaCestino />
        </button>
      </div>
    </li>
  );
}

/* ------------------------------------------------------------------ la pagina */

function Filtri() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [transazioni, setTransazioni] = useState([]);
  const [voci, setVoci] = useState([]);
  const [categorieSpese, setCategorieSpese] = useState([]);
  const [categorieEntrate, setCategorieEntrate] = useState([]);
  const [caricamento, setCaricamento] = useState(true);
  const [errore, setErrore] = useState('');

  const [cercaAperta, setCercaAperta] = useState(false);
  const [ricerca, setRicerca] = useState('');
  const [dataAperta, setDataAperta] = useState(false);
  const [filtriAperti, setFiltriAperti] = useState(false);

  const [tipi, setTipi] = useState([]);
  const [categorie, setCategorie] = useState([]);
  const [conti, setConti] = useState([]);
  const [importoMin, setImportoMin] = useState('');
  const [importoMax, setImportoMax] = useState('');
  const [dataInizio, setDataInizio] = useState('');
  const [dataFine, setDataFine] = useState('');
  const [ordinamento, setOrdinamento] = useState('data-desc');
  const [mostrati, setMostrati] = useState(PASSO);

  const [modifica, setModifica] = useState(null);
  const [salvataggio, setSalvataggio] = useState(false);

  const rifCerca = useChiudiFuori(cercaAperta, () => setCercaAperta(false));
  const rifData = useChiudiFuori(dataAperta, () => setDataAperta(false));
  const rifFiltri = useChiudiFuori(filtriAperti, () => setFiltriAperti(false));

  // I parametri dell'indirizzo (dai rimandi interni) diventano filtri all'apertura.
  useEffect(() => {
    const tipo = searchParams.get('tipo');
    const categoria = searchParams.get('categoria');
    const mese = searchParams.get('mese');
    const anno = searchParams.get('anno');

    if (tipo === 'entrata' || tipo === 'uscita') setTipi([tipo]);
    else if (tipo === 'tutte') setTipi([]);
    if (categoria) setCategorie([categoria]);

    if (anno) {
      const a = Number(anno);
      if (mese !== null && mese !== '') {
        setDataInizio(isoLocale(new Date(a, Number(mese), 1)));
        setDataFine(isoLocale(new Date(a, Number(mese) + 1, 0)));
      } else {
        setDataInizio(`${a}-01-01`);
        setDataFine(`${a}-12-31`);
      }
    }
  }, [searchParams]);

  const caricaDati = async () => {
    setCaricamento(true);
    setErrore('');
    try {
      const [speseRes, entrateRes, vociRes] = await Promise.all([
        axios.get(`${BASE_URL}/api/spese`, { params: { page: 1, limit: 10000 } }),
        axios.get(`${BASE_URL}/api/entrate`, { params: { page: 1, limit: 10000 } }),
        axios.get(`${BASE_URL}/api/voci`)
      ]);
      const spese = (speseRes.data.spese || []).map((s) => ({ ...s, tipo: 'uscita' }));
      const entrate = (entrateRes.data.entrate || []).map((e) => ({ ...e, tipo: 'entrata' }));
      setTransazioni([...spese, ...entrate]);
      setVoci(vociRes.data?.data?.voci || []);
    } catch (e) {
      console.error('Errore nel caricamento dei movimenti:', e);
      setErrore('Non riesco a caricare i movimenti. Controlla la connessione e riprova.');
    } finally {
      setCaricamento(false);
    }
  };

  // I movimenti si chiedono una volta sola: i filtri lavorano su quelli già in memoria,
  // senza rifare la richiesta a ogni clic.
  useEffect(() => {
    caricaDati();
  }, []);

  useEffect(() => {
    const caricaCategorie = async () => {
      try {
        const r = await axios.get(`${BASE_URL}/api/categorie`);
        setCategorieSpese(r.data?.categorie?.spese || []);
        setCategorieEntrate(r.data?.categorie?.entrate || []);
      } catch (e) {
        console.error('Errore nel caricamento delle categorie:', e);
      }
    };
    caricaCategorie();
  }, []);

  const nomiConti = useMemo(() => {
    const mappa = new Map();
    voci.forEach((v) => mappa.set(String(v.id), v.nome));
    return mappa;
  }, [voci]);

  const opzioni = useMemo(() => {
    const uscite = new Set(categorieSpese);
    const entrate = new Set(categorieEntrate);
    transazioni.forEach((t) => {
      if (!t.categoria) return;
      if (t.tipo === 'uscita') uscite.add(t.categoria);
      else entrate.add(t.categoria);
    });
    const ordina = (insieme) => [...insieme].sort((a, b) => a.localeCompare(b, 'it', { sensitivity: 'base' }));
    return {
      categorie: { uscite: ordina(uscite), entrate: ordina(entrate) },
      conti: voci
        .filter((v) => transazioni.some((t) => String(t.voceId) === String(v.id)))
        .map((v) => ({ id: String(v.id), nome: v.nome }))
        .sort((a, b) => a.nome.localeCompare(b.nome, 'it', { sensitivity: 'base' }))
    };
  }, [categorieSpese, categorieEntrate, transazioni, voci]);

  const movimentiFiltrati = useMemo(() => {
    const inizio = daIso(dataInizio);
    const fine = daIso(dataFine);
    if (inizio) inizio.setHours(0, 0, 0, 0);
    if (fine) fine.setHours(23, 59, 59, 999);

    const testo = ricerca.trim().toLowerCase();
    const minimo = importoMin === '' ? null : Math.abs(Number(importoMin));
    const massimo = importoMax === '' ? null : Math.abs(Number(importoMax));

    const risultato = transazioni.filter((t) => {
      if (tipi.length > 0 && !tipi.includes(t.tipo)) return false;
      if (categorie.length > 0 && !categorie.includes(t.categoria)) return false;
      if (conti.length > 0 && !conti.includes(String(t.voceId))) return false;
      if (testo && !(t.descrizione || '').toLowerCase().includes(testo)) return false;

      const valore = Math.abs(importoDi(t));
      if (minimo !== null && !Number.isNaN(minimo) && valore < minimo) return false;
      if (massimo !== null && !Number.isNaN(massimo) && valore > massimo) return false;

      if (inizio || fine) {
        const d = new Date(t.data);
        if (Number.isNaN(d.getTime())) return false;
        if (inizio && d < inizio) return false;
        if (fine && d > fine) return false;
      }
      return true;
    });

    const confronti = {
      'data-desc': (a, b) => new Date(b.data) - new Date(a.data),
      'data-asc': (a, b) => new Date(a.data) - new Date(b.data),
      'importo-desc': (a, b) => Math.abs(importoDi(b)) - Math.abs(importoDi(a)),
      'importo-asc': (a, b) => Math.abs(importoDi(a)) - Math.abs(importoDi(b))
    };

    return [...risultato].sort(confronti[ordinamento] || confronti['data-desc']);
  }, [transazioni, tipi, categorie, conti, ricerca, importoMin, importoMax, dataInizio, dataFine, ordinamento]);

  const riepilogo = useMemo(() => {
    let uscite = 0;
    let entrate = 0;
    let numeroUscite = 0;
    let spesaTop = null;
    let entrataTop = null;
    let primo = null;
    let ultimo = null;

    movimentiFiltrati.forEach((t) => {
      const valore = importoDi(t);
      if (t.tipo === 'entrata') {
        entrate += valore;
        if (!entrataTop || valore > importoDi(entrataTop)) entrataTop = t;
      } else {
        uscite += valore;
        numeroUscite += 1;
        if (!spesaTop || Math.abs(valore) > Math.abs(importoDi(spesaTop))) spesaTop = t;
      }
      const d = new Date(t.data);
      if (!Number.isNaN(d.getTime())) {
        if (!primo || d < new Date(primo.data)) primo = t;
        if (!ultimo || d > new Date(ultimo.data)) ultimo = t;
      }
    });

    return {
      numero: movimentiFiltrati.length,
      uscite,
      entrate,
      saldo: uscite + entrate,
      mediaUscite: numeroUscite > 0 ? Math.abs(uscite) / numeroUscite : 0,
      spesaTop,
      entrataTop,
      primo,
      ultimo
    };
  }, [movimentiFiltrati]);

  useEffect(() => {
    setMostrati(PASSO);
  }, [tipi, categorie, conti, ricerca, importoMin, importoMax, dataInizio, dataFine, ordinamento]);

  const filtriAttivi = [
    ...(dataInizio || dataFine
      ? [{ chiave: 'periodo', testo: etichettaPeriodo(dataInizio, dataFine), rimuovi: () => { setDataInizio(''); setDataFine(''); } }]
      : []),
    ...(ricerca ? [{ chiave: 'ricerca', testo: `nota: «${ricerca}»`, rimuovi: () => setRicerca('') }] : []),
    ...tipi.map((t) => ({
      chiave: `tipo-${t}`,
      testo: t === 'entrata' ? 'Entrate' : 'Uscite',
      rimuovi: () => setTipi((prev) => prev.filter((x) => x !== t))
    })),
    ...categorie.map((c) => ({
      chiave: `categoria-${c}`,
      testo: c,
      rimuovi: () => setCategorie((prev) => prev.filter((x) => x !== c))
    })),
    ...conti.map((id) => ({
      chiave: `conto-${id}`,
      testo: nomiConti.get(id) || 'Conto',
      rimuovi: () => setConti((prev) => prev.filter((x) => x !== id))
    })),
    ...(importoMin === '' ? [] : [{ chiave: 'importo-min', testo: `almeno ${formattaImporto(importoMin)}`, rimuovi: () => setImportoMin('') }]),
    ...(importoMax === '' ? [] : [{ chiave: 'importo-max', testo: `fino a ${formattaImporto(importoMax)}`, rimuovi: () => setImportoMax('') }])
  ];
  const numeroFiltri = filtriAttivi.length;

  const azzeraFiltri = () => {
    setRicerca('');
    setTipi([]);
    setCategorie([]);
    setConti([]);
    setImportoMin('');
    setImportoMax('');
    setDataInizio('');
    setDataFine('');
  };

  // I gruppi sono per giorno: si taglia solo fra un giorno e l'altro, così il totale di
  // ciascun giorno è sempre quello vero e non un parziale di comodo.
  const gruppiTutti = useMemo(() => {
    const mappa = new Map();
    movimentiFiltrati.forEach((t) => {
      const chiave = giornoChiave(t.data);
      if (!mappa.has(chiave)) mappa.set(chiave, []);
      mappa.get(chiave).push(t);
    });
    return [...mappa.entries()].map(([chiave, movimenti]) => ({
      chiave,
      movimenti,
      totale: movimenti.reduce((acc, t) => acc + importoDi(t), 0)
    }));
  }, [movimentiFiltrati]);

  // Con l'ordinamento per importo i giorni non sono più in fila: l'elenco resta piatto,
  // senza intestazioni di giorno che separerebbero movimenti dello stesso giorno.
  const perData = ordinamento === 'data-desc' || ordinamento === 'data-asc';

  const gruppiVisibili = useMemo(() => {
    if (!perData) return [];
    const visibili = [];
    let righe = 0;
    for (let i = 0; i < gruppiTutti.length; i += 1) {
      if (righe >= mostrati && visibili.length > 0) break;
      visibili.push(gruppiTutti[i]);
      righe += gruppiTutti[i].movimenti.length;
    }
    return visibili;
  }, [gruppiTutti, mostrati, perData]);

  const righeMostrate = perData
    ? gruppiVisibili.reduce((acc, g) => acc + g.movimenti.length, 0)
    : Math.min(mostrati, movimentiFiltrati.length);

  const apriModifica = (movimento) => {
    setModifica({
      ...movimento,
      // Il campo dell'importo resta una stringa: così si può svuotarlo mentre si scrive.
      importo: String(Math.abs(importoDi(movimento))),
      data: giornoChiave(movimento.data) === 'senza-data' ? isoLocale(new Date()) : giornoChiave(movimento.data)
    });
  };

  const salvaModifica = async () => {
    if (!modifica) return;
    setSalvataggio(true);
    try {
      const percorso = modifica.tipo === 'entrata' ? 'entrate' : 'spese';
      const importo = Math.abs(Number(modifica.importo));
      await axios.put(`${BASE_URL}/api/${percorso}/${modifica._id}`, {
        importo: modifica.tipo === 'uscita' ? -importo : importo,
        descrizione: modifica.descrizione,
        categoria: modifica.categoria,
        data: modifica.data
      });
      setModifica(null);
      await caricaDati();
    } catch (e) {
      console.error('Errore durante il salvataggio:', e);
      setErrore('Non sono riuscito a salvare la modifica. Riprova.');
    } finally {
      setSalvataggio(false);
    }
  };

  const eliminaMovimento = async (movimento) => {
    const testo = `Sei sicuro di voler eliminare ${formattaImporto(importoDi(movimento))} di ${movimento.categoria || 'questa transazione'}${movimento.descrizione ? ` (${movimento.descrizione})` : ''}?`;
    if (!window.confirm(`${testo}\nL'operazione non si può annullare.`)) return;
    try {
      const percorso = movimento.tipo === 'entrata' ? 'entrate' : 'spese';
      await axios.delete(`${BASE_URL}/api/${percorso}/${movimento._id}`);
      await caricaDati();
    } catch (e) {
      console.error('Errore durante l\'eliminazione:', e);
      setErrore('Non sono riuscito a eliminare il movimento. Riprova.');
    }
  };

  const scaricaCsv = () => {
    if (movimentiFiltrati.length === 0) return;

    const intestazioni = ['Data', 'Tipo', 'Categoria', 'Nota', 'Conto', 'Importo'];
    const righe = movimentiFiltrati.map((t) => {
      const data = new Date(t.data);
      const conto = nomiConti.get(String(t.voceId)) || '';
      return [
        Number.isNaN(data.getTime()) ? '' : isoLocale(data),
        t.tipo === 'entrata' ? 'Entrata' : 'Uscita',
        t.categoria || '',
        t.descrizione || '',
        conto,
        importoDi(t).toFixed(2)
      ];
    });

    const csv = [intestazioni, ...righe]
      .map((riga) => riga.map((campo) => `"${String(campo).replace(/"/g, '""')}"`).join(','))
      .join('\n');

    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const collegamento = document.createElement('a');

    let nomeFile = `movimenti_${isoLocale(new Date())}`;
    if (tipi.length === 1) nomeFile += `_${tipi[0]}`;
    if (categorie.length === 1) nomeFile += `_${categorie[0].replace(/[^a-zA-Z0-9]/g, '_')}`;
    if (dataInizio || dataFine) nomeFile += `_${dataInizio || 'inizio'}_${dataFine || 'oggi'}`;

    collegamento.href = url;
    collegamento.download = `${nomeFile}.csv`;
    collegamento.style.visibility = 'hidden';
    document.body.appendChild(collegamento);
    collegamento.click();
    document.body.removeChild(collegamento);
    URL.revokeObjectURL(url);
  };

  const pillFiltri = numeroFiltri > 0 ? PILL_ATTIVA : PILL_SPENTA;
  const pillData = dataInizio || dataFine ? PILL_ATTIVA : PILL_SPENTA;
  const pillCerca = ricerca ? PILL_ATTIVA : PILL_SPENTA;

  return (
    <div className="selection:bg-indigo-100 selection:text-indigo-900 dark:selection:bg-indigo-500/40 dark:selection:text-white">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-gray-900 dark:text-white">Transazioni</h1>
          <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
            {caricamento
              ? 'Carico i movimenti…'
              : `${riepilogo.numero} ${riepilogo.numero === 1 ? 'movimento' : 'movimenti'}${numeroFiltri > 0 ? ' con i filtri attivi' : ' in archivio'}`}
          </p>
        </div>
        <button type="button" onClick={() => navigate('/transazioni')} className={BOTTONE_PRIMARIO}>
          <IconaPiu />
          <span>Nuova transazione</span>
        </button>
      </div>

      {/* I tre comandi: Cerca, Data, Filtri */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <div className="relative" ref={rifCerca}>
          <button
            type="button"
            onClick={() => setCercaAperta((a) => !a)}
            aria-expanded={cercaAperta}
            className={pillCerca}
          >
            <IconaCerca />
            <span>Cerca</span>
          </button>
          {cercaAperta && (
            <div className={`${ANCORAGGIO} ${PANNELLO} p-3 md:w-[22rem]`} role="dialog" aria-label="Cerca nella nota">
              <label htmlFor="campo-ricerca" className="text-sm font-medium text-gray-700 dark:text-gray-200">
                Cerca nella nota del movimento
              </label>
              <input
                id="campo-ricerca"
                type="search"
                autoFocus
                value={ricerca}
                onChange={(e) => setRicerca(e.target.value)}
                placeholder="Es. Esselunga"
                className={`mt-1.5 ${CAMPO}`}
              />
              <div className="mt-2 flex items-center justify-between gap-2">
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Guarda solo il testo della nota, non la categoria.
                </p>
                {ricerca && (
                  <button type="button" onClick={() => setRicerca('')} className="shrink-0 text-xs font-medium text-indigo-600 hover:underline dark:text-indigo-300">
                    Azzera
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="relative" ref={rifData}>
          <button
            type="button"
            onClick={() => setDataAperta((a) => !a)}
            aria-expanded={dataAperta}
            className={pillData}
          >
            <IconaCalendario />
            <span>{dataInizio || dataFine ? etichettaPeriodo(dataInizio, dataFine) : 'Data'}</span>
          </button>
          {dataAperta && (
            <PannelloData
              dataInizio={dataInizio}
              dataFine={dataFine}
              onApplica={(a, b) => { setDataInizio(a); setDataFine(b); }}
              onChiudi={() => setDataAperta(false)}
            />
          )}
        </div>

        <div className="relative" ref={rifFiltri}>
          <button
            type="button"
            onClick={() => setFiltriAperti((a) => !a)}
            aria-expanded={filtriAperti}
            className={pillFiltri}
          >
            <IconaFiltri />
            <span>Filtri</span>
            {numeroFiltri > 0 && (
              <span className="rounded-full bg-indigo-600 px-1.5 text-xs font-semibold tabular-nums text-white dark:bg-indigo-500">
                {numeroFiltri}
              </span>
            )}
          </button>
          {filtriAperti && (
            <PannelloFiltri
              valoriIniziali={{ tipi, categorie, conti, importoMin, importoMax }}
              opzioni={opzioni}
              onApplica={({ tipi: t, categorie: c, conti: k, importoMin: mn, importoMax: mx }) => {
                setTipi(t);
                setCategorie(c);
                setConti(k);
                setImportoMin(mn);
                setImportoMax(mx);
              }}
              onChiudi={() => setFiltriAperti(false)}
            />
          )}
        </div>

        {numeroFiltri > 0 && (
          <button
            type="button"
            onClick={azzeraFiltri}
            className="ml-auto text-sm font-medium text-gray-500 transition-colors duration-150 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
          >
            Azzera i filtri
          </button>
        )}
      </div>

      {/* Cosa è acceso in questo momento, con la croce per spegnere una voce per volta */}
      {numeroFiltri > 0 && (
        <ul className="mt-3 flex flex-wrap items-center gap-1.5">
          {filtriAttivi.map((filtro) => (
            <li key={filtro.chiave}>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 py-1 pl-3 pr-1.5 text-xs font-medium text-gray-700 dark:bg-gray-800 dark:text-gray-200">
                {filtro.testo}
                <button
                  type="button"
                  onClick={filtro.rimuovi}
                  title={`Togli il filtro ${filtro.testo}`}
                  className="rounded-full p-1 text-gray-400 transition-colors duration-150 hover:bg-gray-200 hover:text-gray-900 dark:text-gray-500 dark:hover:bg-gray-700 dark:hover:text-white"
                >
                  <IconaX />
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}

      {errore && movimentiFiltrati.length > 0 && (
        <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300">{errore}</p>
      )}

      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_19rem] lg:items-start">
        <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <header className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 px-4 py-3 dark:border-gray-800">
            <p className="text-sm text-gray-700 dark:text-gray-200">
              <span className="font-medium">
                {riepilogo.numero} {riepilogo.numero === 1 ? 'movimento' : 'movimenti'}
              </span>
              {movimentiFiltrati.length > righeMostrate && (
                <span className="ml-2 text-gray-500 dark:text-gray-400">mostrati {righeMostrate}</span>
              )}
            </p>
            <label className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
              <span className="hidden sm:inline">Ordina</span>
              <select
                value={ordinamento}
                onChange={(e) => setOrdinamento(e.target.value)}
                className="rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-sm font-medium text-gray-700 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/25 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
              >
                <option value="data-desc">Data (più recenti)</option>
                <option value="data-asc">Data (più vecchi)</option>
                <option value="importo-desc">Importo (dal più alto)</option>
                <option value="importo-asc">Importo (dal più basso)</option>
              </select>
            </label>
          </header>

          {caricamento ? (
            <LoadingSpinner size="lg" text="Carico i movimenti…" className="py-16" />
          ) : errore && movimentiFiltrati.length === 0 ? (
            <div className="px-4 py-16 text-center">
              <p className="text-sm text-red-600 dark:text-red-400">{errore}</p>
              <button type="button" onClick={caricaDati} className={`mt-4 ${BOTTONE_NEUTRO}`}>
                Riprova
              </button>
            </div>
          ) : movimentiFiltrati.length === 0 ? (
            <div className="px-4 py-16 text-center">
              <p className="text-sm font-medium text-gray-700 dark:text-gray-200">
                {numeroFiltri > 0 ? 'Nessun movimento con questi filtri' : 'Nessun movimento registrato'}
              </p>
              <p className="mx-auto mt-1 max-w-md text-sm text-gray-500 dark:text-gray-400">
                {numeroFiltri > 0
                  ? 'Prova ad allargare il periodo o a togliere qualche filtro.'
                  : 'Registra la prima spesa o la prima entrata: compariranno qui.'}
              </p>
              {numeroFiltri > 0 ? (
                <button type="button" onClick={azzeraFiltri} className={`mt-4 ${BOTTONE_NEUTRO}`}>
                  Azzera i filtri
                </button>
              ) : (
                <button type="button" onClick={() => navigate('/transazioni')} className={`mt-4 ${BOTTONE_PRIMARIO}`}>
                  <IconaPiu />
                  <span>Nuova transazione</span>
                </button>
              )}
            </div>
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-gray-800">
              {perData ? (
                gruppiVisibili.map((gruppo) => (
                  <div key={gruppo.chiave}>
                    <div className="flex items-baseline justify-between gap-3 bg-gray-50 px-4 py-2 dark:bg-gray-800/60">
                      <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                        {etichettaGiorno(gruppo.chiave)}
                      </h2>
                      <span className={`text-xs font-semibold tabular-nums ${gruppo.totale >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-600 dark:text-gray-300'}`}>
                        {formattaImporto(gruppo.totale, true)}
                      </span>
                    </div>
                    <ul>
                      {gruppo.movimenti.map((movimento) => (
                        <RigaMovimento
                          key={`${movimento.tipo}-${movimento._id}`}
                          movimento={movimento}
                          nomeConto={nomiConti.get(String(movimento.voceId))}
                          onModifica={apriModifica}
                          onElimina={eliminaMovimento}
                        />
                      ))}
                    </ul>
                  </div>
                ))
              ) : (
                <ul>
                  {movimentiFiltrati.slice(0, mostrati).map((movimento) => (
                    <RigaMovimento
                      key={`${movimento.tipo}-${movimento._id}`}
                      movimento={movimento}
                      nomeConto={nomiConti.get(String(movimento.voceId))}
                      onModifica={apriModifica}
                      onElimina={eliminaMovimento}
                    />
                  ))}
                </ul>
              )}
            </div>
          )}

          {!caricamento && movimentiFiltrati.length > righeMostrate && (
            <div className="border-t border-gray-100 px-4 py-3 text-center dark:border-gray-800">
              <button
                type="button"
                onClick={() => setMostrati((n) => n + PASSO)}
                className="text-sm font-medium text-indigo-600 transition-colors duration-150 hover:text-indigo-800 dark:text-indigo-300 dark:hover:text-indigo-200"
              >
                Mostra altri movimenti
              </button>
              <span className="ml-2 text-xs text-gray-400 dark:text-gray-500">
                ne restano {movimentiFiltrati.length - righeMostrate}
              </span>
            </div>
          )}
        </section>

        <Riepilogo dati={riepilogo} onScarica={scaricaCsv} />
      </div>

      {modifica && (
        <Modale
          aperta
          titolo={modifica.tipo === 'entrata' ? 'Modifica entrata' : 'Modifica spesa'}
          sottotitolo={`${etichettaData(giornoChiave(modifica.data))} · ${modifica.categoria || 'Senza categoria'}`}
          onChiudi={() => setModifica(null)}
          larghezza="max-w-lg"
        >
          <div className="space-y-4">
            <div>
              <label htmlFor="mod-importo" className="text-sm font-medium text-gray-700 dark:text-gray-200">Importo (€)</label>
              <input
                id="mod-importo"
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                value={modifica.importo}
                onChange={(e) => setModifica({ ...modifica, importo: e.target.value })}
                className={`mt-1.5 ${CAMPO}`}
              />
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                {modifica.tipo === 'entrata' ? 'Verrà registrata come entrata.' : 'Verrà registrata come uscita.'}
              </p>
            </div>

            <div>
              <label htmlFor="mod-nota" className="text-sm font-medium text-gray-700 dark:text-gray-200">Nota</label>
              <input
                id="mod-nota"
                type="text"
                value={modifica.descrizione || ''}
                onChange={(e) => setModifica({ ...modifica, descrizione: e.target.value })}
                className={`mt-1.5 ${CAMPO}`}
              />
            </div>

            <div>
              <label htmlFor="mod-categoria" className="text-sm font-medium text-gray-700 dark:text-gray-200">Categoria</label>
              <select
                id="mod-categoria"
                value={modifica.categoria || ''}
                onChange={(e) => setModifica({ ...modifica, categoria: e.target.value })}
                className={`mt-1.5 ${CAMPO}`}
              >
                {(modifica.tipo === 'entrata' ? opzioni.categorie.entrate : opzioni.categorie.uscite).map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
                {modifica.categoria && !(modifica.tipo === 'entrata' ? opzioni.categorie.entrate : opzioni.categorie.uscite).includes(modifica.categoria) && (
                  <option value={modifica.categoria}>{modifica.categoria}</option>
                )}
              </select>
            </div>

            <div>
              <label htmlFor="mod-data" className="text-sm font-medium text-gray-700 dark:text-gray-200">Data</label>
              <input
                id="mod-data"
                type="date"
                value={modifica.data}
                onChange={(e) => setModifica({ ...modifica, data: e.target.value })}
                className={`mt-1.5 ${CAMPO}`}
              />
            </div>

            <p className="text-xs text-gray-500 dark:text-gray-400">
              Il conto su cui è registrato il movimento non si cambia da qui: si cambia dalla scheda del conto.
            </p>
          </div>

          <div className="mt-5 flex justify-end gap-2">
            <button type="button" onClick={() => setModifica(null)} className={BOTTONE_NEUTRO}>
              Annulla
            </button>
            <button type="button" onClick={salvaModifica} disabled={salvataggio} className={BOTTONE_PRIMARIO}>
              {salvataggio ? 'Salvo…' : 'Salva'}
            </button>
          </div>
        </Modale>
      )}
    </div>
  );
}

export default Filtri;
