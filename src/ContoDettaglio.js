import React, { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import SerieChart from './components/SerieChart';
import SelettorePeriodo from './components/SelettorePeriodo';
import { fetchWithRetry } from './utils/fetchWithRetry';
import {
  chiaveMese,
  conSegno,
  etichettaMeseLungo,
  etichettaVariazione,
  euro,
  filtraPeriodo,
  puntiDaSerie,
  variazione
} from './utils/patrimonioFormat';

// La scheda di un conto: la sua storia mese per mese in alto, i suoi Movimenti in basso.
// È il posto dove si corregge il valore di un conto (Rettifica) e da cui si registra un
// movimento già indirizzato su questo conto.

const ETICHETTA_TIPO = {
  spesa: 'Spesa',
  entrata: 'Entrata',
  trasferimento: 'Trasferimento',
  rettifica: 'Rettifica'
};

const COLORE_ETICHETTA = {
  spesa: 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300',
  entrata: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300',
  trasferimento: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300',
  rettifica: 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300'
};

const titoloMovimento = (m) => {
  if (m.descrizione) return m.descrizione;
  if (m.tipo === 'trasferimento') return m.uscente ? `Verso ${m.controparte}` : `Da ${m.controparte}`;
  return m.categoria || ETICHETTA_TIPO[m.tipo] || 'Movimento';
};

const sottotitoloMovimento = (m) => {
  if (m.tipo === 'trasferimento') {
    return `${m.uscente ? 'a' : 'da'} ${m.controparte}${m.origine === 'sistema' ? ' · generato' : ''}`;
  }
  if (m.tipo === 'rettifica') return m.importo >= 0 ? 'il valore è stato alzato' : 'il valore è stato abbassato';
  // La categoria si ripete identica alla descrizione in molti movimenti importati: mostrarla
  // due volte affolla la riga senza aggiungere nulla.
  if (m.categoria && m.categoria.toLowerCase() !== String(m.descrizione || '').toLowerCase()) return m.categoria;
  return '';
};

function ContoDettaglio() {
  const { voceId } = useParams();
  const navigate = useNavigate();
  const [dati, setDati] = useState(null);
  const [caricamento, setCaricamento] = useState(true);
  const [errore, setErrore] = useState(null);
  const [avviso, setAvviso] = useState(null);
  const [periodo, setPeriodo] = useState('1a');
  const [pannello, setPannello] = useState(null);
  const [rettifica, setRettifica] = useState({ importo: '', descrizione: '' });

  const token = localStorage.getItem('token');
  const intestazioni = { Authorization: `Bearer ${token}` };

  const carica = async () => {
    try {
      const res = await fetchWithRetry(`/api/voci/${voceId}`, { headers: intestazioni });
      setDati(res.data.data);
      setErrore(null);
    } catch (err) {
      console.error('Errore nel caricamento del conto:', err);
      setErrore(
        err?.response?.status === 404
          ? 'Questo conto non esiste più.'
          : 'Impossibile caricare il conto. Riprova.'
      );
    } finally {
      setCaricamento(false);
    }
  };

  useEffect(() => {
    if (!token) {
      navigate('/login');
      return;
    }
    setCaricamento(true);
    carica();
  }, [voceId]);

  const puntiTotali = useMemo(
    () => (dati ? puntiDaSerie(dati.asse, dati.voce.serie) : []),
    [dati]
  );
  const puntiVisibili = useMemo(() => filtraPeriodo(puntiTotali, periodo), [puntiTotali, periodo]);
  const deltaP = variazione(puntiVisibili);

  const mesi = useMemo(() => {
    const gruppi = [];
    (dati?.movimenti || []).forEach((m) => {
      const chiave = chiaveMese(m.data);
      let gruppo = gruppi[gruppi.length - 1];
      if (!gruppo || gruppo.chiave !== chiave) {
        gruppo = { chiave, movimenti: [] };
        gruppi.push(gruppo);
      }
      gruppo.movimenti.push(m);
    });
    return gruppi;
  }, [dati]);

  const inviaRettifica = async (e) => {
    e.preventDefault();
    setErrore(null);
    setAvviso(null);
    try {
      await fetchWithRetry('/api/rettifiche', {
        method: 'POST',
        headers: intestazioni,
        data: { voceId, importo: rettifica.importo, descrizione: rettifica.descrizione }
      });
      setRettifica({ importo: '', descrizione: '' });
      setPannello(null);
      setAvviso('Rettifica registrata: il valore del conto è cambiato, il budget non si tocca.');
      await carica();
    } catch (err) {
      setErrore(err?.response?.data?.error || 'Rettifica non riuscita');
    }
  };

  const registraMovimento = () => {
    localStorage.setItem('b365.ultimaVoce', String(voceId));
    navigate('/transazioni');
  };

  const campi = 'w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500';
  const bottoneSecondario = 'px-3 py-2 text-sm font-medium rounded-lg border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500';
  const bottonePrimario = 'px-3 py-2 text-sm font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500';

  if (caricamento) {
    return (
      <div className="max-w-4xl mx-auto space-y-4">
        <div className="h-5 w-32 rounded bg-gray-200 dark:bg-gray-800 animate-pulse" />
        <div className="h-56 rounded-xl bg-gray-100 dark:bg-gray-800/60 animate-pulse" />
        <div className="h-64 rounded-xl bg-gray-100 dark:bg-gray-800/60 animate-pulse" />
      </div>
    );
  }

  if (!dati) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6">
          <p className="text-sm text-gray-700 dark:text-gray-300">{errore || 'Conto non trovato.'}</p>
          <Link to="/patrimonio" className={`${bottoneSecondario} mt-4 inline-block`}>Torna ai conti</Link>
        </div>
      </div>
    );
  }

  const { voce, movimenti } = dati;

  return (
    <div className="max-w-4xl mx-auto">
      <Link
        to="/patrimonio"
        className="inline-flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors duration-150 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
      >
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M15 18l-6-6 6-6" />
        </svg>
        Tutti i conti
      </Link>

      <div className="mt-3 mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{voce.nome}</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">{voce.tipo ? voce.tipo.nome : 'Senza tipo'}</p>
          <p className="mt-2 text-4xl font-bold tabular-nums text-gray-900 dark:text-white">{euro(voce.valore)}</p>
          {deltaP !== null && (
            <p className={`mt-1 text-sm tabular-nums ${deltaP >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-700 dark:text-red-400'}`}>
              {conSegno(deltaP)} {etichettaVariazione(periodo)}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button type="button" className={bottoneSecondario} onClick={() => setPannello(pannello === 'rettifica' ? null : 'rettifica')}>
            Rettifica
          </button>
          <button type="button" className={bottonePrimario} onClick={registraMovimento}>
            Registra un movimento
          </button>
        </div>
      </div>

      {errore && (
        <div className="mb-4 rounded-lg border border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/40 px-4 py-3 text-sm text-red-800 dark:text-red-200">{errore}</div>
      )}
      {avviso && (
        <div className="mb-4 rounded-lg border border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 px-4 py-3 text-sm text-emerald-800 dark:text-emerald-200">{avviso}</div>
      )}

      {pannello === 'rettifica' && (
        <form onSubmit={inviaRettifica} className="mb-5 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Rettifica del valore</h2>
          <p className="mt-1 mb-3 text-xs text-gray-500 dark:text-gray-400">
            Per allineare il conto al saldo vero della banca, o per correggere una stima. La differenza può
            essere positiva o negativa e non entra nel budget.
          </p>
          <div className="grid gap-3 sm:grid-cols-3">
            <input className={campi} type="number" step="0.01" placeholder="Differenza (+ o −)" value={rettifica.importo} onChange={(e) => setRettifica({ ...rettifica, importo: e.target.value })} required />
            <input className={campi} type="text" placeholder="Motivo (facoltativo)" value={rettifica.descrizione} onChange={(e) => setRettifica({ ...rettifica, descrizione: e.target.value })} />
            <button type="submit" className={bottonePrimario}>Registra rettifica</button>
          </div>
        </form>
      )}

      <section className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400">Andamento del conto</h2>
          <SelettorePeriodo valore={periodo} onChange={setPeriodo} />
        </div>
        <div className="mt-3">
          {puntiVisibili.length >= 2 ? (
            <SerieChart punti={puntiVisibili} colore={voce.valore < 0 ? '#e11d48' : '#6366f1'} altezza={220} />
          ) : (
            <p className="py-8 text-center text-sm text-gray-500 dark:text-gray-400">
              Servono almeno due mesi di movimenti per disegnare l'andamento di questo conto.
            </p>
          )}
        </div>
        <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
          Valore di fine mese, ricostruito dai movimenti registrati su questo conto.
        </p>
      </section>

      {voce.componenti.length > 1 && (
        <section className="mt-5 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5">
          <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400">Componenti del conto</h2>
          <ul className="mt-3 divide-y divide-gray-100 dark:divide-gray-800">
            {voce.componenti.map((c) => (
              <li key={String(c.id)} className="flex items-center justify-between py-2 text-sm">
                <span className="text-gray-700 dark:text-gray-300">
                  {c.nome} <span className="text-gray-400 dark:text-gray-500">· {c.valorizzazione}</span>
                </span>
                <span className="tabular-nums text-gray-900 dark:text-white">{euro(c.valore)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-5 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5">
        <div className="flex items-baseline justify-between">
          <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400">Movimenti</h2>
          <span className="text-xs text-gray-500 dark:text-gray-400 tabular-nums">{movimenti.length}</span>
        </div>

        {movimenti.length === 0 ? (
          <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">
            Su questo conto non ci sono ancora movimenti. Le spese e le entrate che registri scegliendolo
            come conto, i trasferimenti e le rettifiche compaiono qui.
          </p>
        ) : (
          mesi.map((gruppo) => (
            <div key={gruppo.chiave} className="mt-4 first:mt-3">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">{etichettaMeseLungo(gruppo.chiave)}</h3>
              <ul className="mt-1 divide-y divide-gray-100 dark:divide-gray-800">
                {gruppo.movimenti.map((m) => (
                  <li key={String(m.id)} className="flex items-center gap-3 py-2.5">
                    <span className="w-6 shrink-0 text-right text-xs tabular-nums text-gray-500 dark:text-gray-400">{new Date(m.data).getDate()}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm text-gray-900 dark:text-white">{titoloMovimento(m)}</span>
                      <span className="mt-0.5 flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                        <span className={`rounded-full px-1.5 py-0.5 text-[11px] ${COLORE_ETICHETTA[m.tipo] || ''}`}>{ETICHETTA_TIPO[m.tipo] || m.tipo}</span>
                        <span className="truncate">{sottotitoloMovimento(m)}</span>                      </span>
                    </span>
                    <span className={`shrink-0 text-sm font-semibold tabular-nums ${m.importo >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                      {m.importo >= 0 ? '+' : ''}{euro(m.importo)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))
        )}
        {movimenti.length >= 300 && (
          <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">Sono mostrati i 300 movimenti più recenti.</p>
        )}
      </section>
    </div>
  );
}

export default ContoDettaglio;
