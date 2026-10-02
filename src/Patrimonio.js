import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import SerieChart from './components/SerieChart';
import Sparkline from './components/Sparkline';
import SelettorePeriodo from './components/SelettorePeriodo';
import { fetchWithRetry } from './utils/fetchWithRetry';
import {
  COLORE_TIPO,
  conSegno,
  dataBreve,
  dataRelativa,
  etichettaVariazione,
  euro,
  filtraPeriodo,
  percentuale,
  puntiDaFotografie,
  puntiDaSerie,
  raggruppaPerTipo,
  variazione
} from './utils/patrimonioFormat';

// Il Patrimonio: ogni riga è un conto (un'Attività o, quando ci saranno, un Debito),
// raggruppata per Tipo. In alto il totale e la sua curva; a destra la sintesi per Tipo e
// gli ultimi trasferimenti. Cliccando un conto si apre la sua scheda.

const IconaFreccia = ({ giu = false, destra = false }) => (
  <svg
    viewBox="0 0 24 24"
    width="16"
    height="16"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    className={`shrink-0 transition-transform duration-150 ${destra ? '' : giu ? '-rotate-90' : ''}`}
  >
    {destra ? <path d="M9 6l6 6-6 6" /> : <path d="M6 9l6 6 6-6" />}
  </svg>
);

const Variazione = ({ valore, className = '' }) => {
  if (valore === null || valore === undefined) return null;
  const su = valore >= 0;
  return (
    <span className={`inline-flex items-center gap-1 tabular-nums ${className}`}>
      <svg
        viewBox="0 0 24 24"
        width="12"
        height="12"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        className={su ? '' : 'rotate-180'}
      >
        <path d="M12 19V5M5 12l7-7 7 7" />
      </svg>
      {conSegno(valore)}
    </span>
  );
};

function Patrimonio() {
  const navigate = useNavigate();
  const [caricamento, setCaricamento] = useState(true);
  const [errore, setErrore] = useState(null);
  const [avviso, setAvviso] = useState(null);

  const [dati, setDati] = useState(null);
  const [trasferimenti, setTrasferimenti] = useState([]);
  const [periodo, setPeriodo] = useState('1a');
  const [gruppiChiusi, setGruppiChiusi] = useState({});
  const [pannello, setPannello] = useState(null);

  const [nuovaVoce, setNuovaVoce] = useState({ nome: '', tipoId: '' });
  const [nuovoTrasferimento, setNuovoTrasferimento] = useState({
    daVoceId: '',
    aVoceId: '',
    importo: '',
    data: new Date().toISOString().split('T')[0],
    descrizione: ''
  });
  const [nuovoTipo, setNuovoTipo] = useState({ nome: '', denaro: true });

  const token = localStorage.getItem('token');
  const intestazioni = { Authorization: `Bearer ${token}` };

  const carica = useCallback(async () => {
    try {
      const [patrimonioRes, trasferimentiRes] = await Promise.all([
        fetchWithRetry('/api/patrimonio', { headers: intestazioni }),
        fetchWithRetry('/api/trasferimenti', { headers: intestazioni, params: { limit: 50 } })
      ]);
      setDati(patrimonioRes.data.data);
      setTrasferimenti(trasferimentiRes.data.data || []);
      setErrore(null);
    } catch (err) {
      console.error('Errore nel caricamento del patrimonio:', err);
      setErrore('Impossibile caricare il patrimonio. Controlla la connessione e riprova.');
    } finally {
      setCaricamento(false);
    }
  }, []);

  useEffect(() => {
    if (!token) {
      navigate('/login');
      return;
    }
    carica();
  }, [navigate, carica, token]);

  const chiama = async (metodo, percorso, corpo) => {
    setAvviso(null);
    setErrore(null);
    try {
      await fetchWithRetry(percorso, { method: metodo, headers: intestazioni, data: corpo });
      await carica();
      return true;
    } catch (err) {
      setErrore(err?.response?.data?.message || err?.response?.data?.error || 'Operazione non riuscita');
      return false;
    }
  };

  // La curva d'insieme: le Fotografie quando ce ne sono almeno due (è la misura ufficiale),
  // altrimenti quella ricostruita dai movimenti dei conti che esistono oggi.
  const curvaMisurata = (dati?.fotografie || []).length >= 2;
  const puntiTotali = useMemo(() => {
    if (!dati) return [];
    return curvaMisurata
      ? puntiDaFotografie(dati.fotografie)
      : puntiDaSerie(dati.asse, dati.serieRicostruita);
  }, [dati, curvaMisurata]);

  const puntiVisibili = useMemo(() => filtraPeriodo(puntiTotali, periodo), [puntiTotali, periodo]);
  const deltaP = variazione(puntiVisibili);

  const gruppi = useMemo(() => raggruppaPerTipo(dati?.voci || []), [dati]);

  const sintesi = useMemo(() => {
    const voci = dati?.voci || [];
    const perTipo = (elenco) => {
      const mappa = new Map();
      elenco.forEach((v) => {
        const nome = v.tipo ? v.tipo.nome : 'Senza tipo';
        if (!mappa.has(nome)) mappa.set(nome, { nome, totale: 0 });
        mappa.get(nome).totale += v.valore;
      });
      return [...mappa.values()].sort((a, b) => b.totale - a.totale);
    };
    return {
      attivita: perTipo(voci.filter((v) => v.specie === 'attivita')),
      debiti: perTipo(voci.filter((v) => v.specie === 'debito'))
    };
  }, [dati]);

  const tipiAttivi = (dati?.tipi || []).filter((t) => !t.archiviato && t.specie === 'attivita');

  const creaVoce = async (e) => {
    e.preventDefault();
    if (await chiama('POST', '/api/voci', nuovaVoce)) {
      setNuovaVoce({ nome: '', tipoId: '' });
      setPannello(null);
      setAvviso('Conto creato. Registra un movimento o trasferiscici del denaro.');
    }
  };

  const creaTrasferimento = async (e) => {
    e.preventDefault();
    if (!nuovoTrasferimento.aVoceId) {
      setErrore('Indica il conto di destinazione.');
      return;
    }
    if (await chiama('POST', '/api/trasferimenti', nuovoTrasferimento)) {
      setNuovoTrasferimento({ daVoceId: '', aVoceId: '', importo: '', data: new Date().toISOString().split('T')[0], descrizione: '' });
      setPannello(null);
      setAvviso('Trasferimento registrato: il valore si è spostato fra i due conti, il budget non cambia.');
    }
  };

  const creaTipo = async (e) => {
    e.preventDefault();
    if (await chiama('POST', '/api/tipi-voce', { ...nuovoTipo, specie: 'attivita' })) {
      setNuovoTipo({ nome: '', denaro: true });
      setAvviso('Tipo creato.');
    }
  };

  const campi = 'w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500';
  const bottoneSecondario = 'px-3 py-2 text-sm font-medium rounded-lg border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500';
  const bottonePrimario = 'px-3 py-2 text-sm font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500';

  if (caricamento) {
    return (
      <div className="max-w-6xl mx-auto space-y-4">
        <div className="h-7 w-40 rounded bg-gray-200 dark:bg-gray-800 animate-pulse" />
        <div className="h-64 rounded-xl bg-gray-100 dark:bg-gray-800/60 animate-pulse" />
        <div className="h-40 rounded-xl bg-gray-100 dark:bg-gray-800/60 animate-pulse" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Patrimonio</h1>
        <div className="flex items-center gap-2">
          <button type="button" className={bottoneSecondario} onClick={() => setPannello(pannello === 'trasferimento' ? null : 'trasferimento')}>
            Trasferimento
          </button>
          <button type="button" className={bottonePrimario} onClick={() => setPannello(pannello === 'conto' ? null : 'conto')}>
            Nuovo conto
          </button>
        </div>
      </div>

      {errore && (
        <div className="mb-4 rounded-lg border border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/40 px-4 py-3 text-sm text-red-800 dark:text-red-200">
          {errore}
        </div>
      )}
      {avviso && (
        <div className="mb-4 rounded-lg border border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 px-4 py-3 text-sm text-emerald-800 dark:text-emerald-200">
          {avviso}
        </div>
      )}

      {pannello === 'conto' && (
        <form onSubmit={creaVoce} className="mb-5 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Nuovo conto</h2>
          <div className="grid gap-3 sm:grid-cols-3">
            <input
              className={campi}
              type="text"
              placeholder="Nome (es. Conto Fineco, Contanti in casa)"
              value={nuovaVoce.nome}
              onChange={(e) => setNuovaVoce({ ...nuovaVoce, nome: e.target.value })}
              required
            />
            <select
              className={campi}
              value={nuovaVoce.tipoId}
              onChange={(e) => setNuovaVoce({ ...nuovaVoce, tipoId: e.target.value })}
              required
            >
              <option value="">Tipo di voce</option>
              {tipiAttivi.map((t) => (
                <option key={String(t.id)} value={t.id}>
                  {t.nome} {t.denaro ? '· denaro' : '· bene materiale'}
                </option>
              ))}
            </select>
            <button type="submit" className={bottonePrimario}>Crea conto</button>
          </div>
        </form>
      )}

      {pannello === 'trasferimento' && (
        <div className="mb-5 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Trasferimento fra conti</h2>
          <p className="mt-1 mb-3 text-xs text-gray-500 dark:text-gray-400">
            Sposta valore da un conto all'altro: non è una spesa né un'entrata e non entra nel budget.
          </p>
          <form onSubmit={creaTrasferimento} className="grid gap-3 sm:grid-cols-5">
            <select className={campi} value={nuovoTrasferimento.daVoceId} onChange={(e) => setNuovoTrasferimento({ ...nuovoTrasferimento, daVoceId: e.target.value })}>
              <option value="">Da (Conto principale)</option>
              {(dati?.voci || []).map((v) => (
                <option key={String(v.id)} value={v.id}>{v.nome}</option>
              ))}
            </select>
            <select className={campi} value={nuovoTrasferimento.aVoceId} onChange={(e) => setNuovoTrasferimento({ ...nuovoTrasferimento, aVoceId: e.target.value })} required>
              <option value="">A quale conto</option>
              {(dati?.voci || []).map((v) => (
                <option key={String(v.id)} value={v.id}>{v.nome}</option>
              ))}
            </select>
            <input className={campi} type="number" step="0.01" min="0.01" placeholder="Importo" value={nuovoTrasferimento.importo} onChange={(e) => setNuovoTrasferimento({ ...nuovoTrasferimento, importo: e.target.value })} required />
            <input className={campi} type="date" value={nuovoTrasferimento.data} onChange={(e) => setNuovoTrasferimento({ ...nuovoTrasferimento, data: e.target.value })} />
            <button type="submit" className={bottonePrimario}>Trasferisci</button>
          </form>

          {trasferimenti.length > 0 && (
            <ul className="mt-4 divide-y divide-gray-100 dark:divide-gray-800 border-t border-gray-100 dark:border-gray-800">
              {trasferimenti.map((t) => (
                <li key={String(t._id)} className="flex items-center gap-3 py-2 text-sm">
                  <span className="text-gray-500 dark:text-gray-400 tabular-nums w-20 shrink-0">{dataBreve(t.data)}</span>
                  <span className="min-w-0 flex-1 truncate text-gray-700 dark:text-gray-300">
                    {t.daNome} → {t.aNome}
                    {t.descrizione ? <span className="text-gray-400 dark:text-gray-500"> · {t.descrizione}</span> : null}
                    {t.origine === 'sistema' ? <span className="text-gray-400 dark:text-gray-500"> · generato</span> : null}
                  </span>
                  <span className="font-medium tabular-nums text-gray-900 dark:text-white">{euro(t.importo)}</span>
                  <button
                    type="button"
                    onClick={() => chiama('DELETE', `/api/trasferimenti/${t._id}`)}
                    className="text-xs text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 rounded"
                  >
                    elimina
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {(dati?.voci || []).length === 0 ? (
        <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-8 text-center">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Qui ogni riga sarà un conto</h2>
          <p className="mx-auto mt-2 max-w-xl text-sm text-gray-600 dark:text-gray-400">
            Un conto è una <strong className="font-semibold text-gray-900 dark:text-white">voce patrimoniale</strong>: il conto in banca, la carta,
            i contanti in casa. Il patrimonio è la somma delle Attività meno i Debiti, e ogni spesa o
            entrata che registri finisce su uno di questi conti.
          </p>
          <button type="button" className={`${bottonePrimario} mt-4`} onClick={() => setPannello('conto')}>
            Crea il primo conto
          </button>
        </div>
      ) : (
        <div className="grid gap-5 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-5">
            <section className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Patrimonio complessivo</p>
                  <p className="text-4xl font-bold tabular-nums text-gray-900 dark:text-white">{euro(dati.patrimonio)}</p>
                  {deltaP !== null && (
                    <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                      <Variazione valore={deltaP} className={deltaP >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-700 dark:text-red-400'} />
                      <span className="ml-1.5">{etichettaVariazione(periodo)}</span>
                    </p>
                  )}
                </div>
                <SelettorePeriodo valore={periodo} onChange={setPeriodo} />
              </div>

              <div className="mt-4">
                {puntiVisibili.length >= 2 ? (
                  <SerieChart punti={puntiVisibili} colore={dati.patrimonio < 0 ? '#e11d48' : '#6366f1'} />
                ) : (
                  <p className="py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                    La curva comincia da questo mese: la prima Fotografia misurata è {dati.fotografie[0]
                      ? `${dati.fotografie[0].mese + 1}/${dati.fotografie[0].anno}`
                      : 'di questo mese'}, e il secondo punto arriva il mese prossimo.
                  </p>
                )}
              </div>

              {!curvaMisurata && puntiVisibili.length >= 2 && (
                <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                  Curva ricostruita dai movimenti dei conti che esistono oggi: da questo mese la Fotografia
                  mensile la sostituisce con il valore misurato.
                </p>
              )}
            </section>

            <section className="overflow-hidden rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
              {gruppi.map((gruppo) => {
                const chiuso = gruppiChiusi[gruppo.nome];
                return (
                  <div key={gruppo.nome} className="border-b border-gray-100 dark:border-gray-800 last:border-b-0">
                    <button
                      type="button"
                      onClick={() => setGruppiChiusi({ ...gruppiChiusi, [gruppo.nome]: !chiuso })}
                      aria-expanded={!chiuso}
                      className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500"
                    >
                      <span className="text-gray-400 dark:text-gray-500">
                        <IconaFreccia giu={!!chiuso} />
                      </span>
                      <span className="font-semibold text-gray-900 dark:text-white">{gruppo.nome}</span>
                      {gruppo.delta !== 0 && (
                        <Variazione valore={gruppo.delta} className={`text-xs ${gruppo.delta >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-700 dark:text-red-400'}`} />
                      )}
                      <span className="ml-auto font-semibold tabular-nums text-gray-900 dark:text-white">{euro(gruppo.totale)}</span>
                    </button>

                    {!chiuso && gruppo.voci.map((voce) => (
                      <Link
                        key={String(voce.id)}
                        to={`/patrimonio/${voce.id}`}
                        className="group flex items-center gap-3 pl-11 pr-4 py-3 border-t border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500"
                      >
                        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gray-100 dark:bg-gray-800 text-base" aria-hidden="true">
                          {gruppo.emoji}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-medium text-gray-900 dark:text-white">{voce.nome}</span>
                          <span className="block truncate text-xs text-gray-500 dark:text-gray-400">
                            {voce.ultimoMovimento ? `ultimo movimento ${dataRelativa(voce.ultimoMovimento)}` : 'nessun movimento'}
                            {voce.componenti.length > 1 ? ` · ${voce.componenti.length} componenti` : ''}
                          </span>
                        </span>
                        <span className="hidden sm:block text-gray-400 dark:text-gray-500">
                          <Sparkline valori={voce.sparkline} />
                        </span>
                        <span className="text-right">
                          <span className="block font-semibold tabular-nums text-gray-900 dark:text-white">{euro(voce.valore)}</span>
                          {voce.deltaMese !== 0 && (
                            <span className="block text-xs tabular-nums text-gray-500 dark:text-gray-400">{conSegno(voce.deltaMese)}</span>
                          )}
                        </span>
                        <span className="text-gray-300 dark:text-gray-600 group-hover:text-gray-400 dark:group-hover:text-gray-500">
                          <IconaFreccia destra />
                        </span>
                      </Link>
                    ))}
                  </div>
                );
              })}
            </section>
          </div>

          <aside className="space-y-5">
            {[{ titolo: 'Attività', totale: dati.attivita, voci: sintesi.attivita, base: '#6366f1' },
              { titolo: 'Debiti', totale: dati.debiti, voci: sintesi.debiti, base: '#e11d48' }].map((sezione, indiceSezione) => (
              <section key={sezione.titolo} className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5">
                <div className="flex items-baseline justify-between">
                  <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400">{sezione.titolo}</h2>
                  <span className="text-lg font-bold tabular-nums text-gray-900 dark:text-white">{euro(sezione.totale)}</span>
                </div>

                {sezione.voci.length > 0 ? (
                  <>
                    <div className="mt-3 flex h-2 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800" role="presentation">
                      {sezione.voci.map((tipo, i) => (
                        <span
                          key={tipo.nome}
                          style={{
                            width: `${Math.max(percentuale(tipo.totale, sezione.totale), 2)}%`,
                            background: COLORE_TIPO[(i + indiceSezione * 3) % COLORE_TIPO.length]
                          }}
                        />
                      ))}
                    </div>
                    <ul className="mt-3 space-y-1.5">
                      {sezione.voci.map((tipo, i) => (
                        <li key={tipo.nome} className="flex items-center gap-2 text-sm">
                          <span
                            className="h-2 w-2 shrink-0 rounded-full"
                            style={{ background: COLORE_TIPO[(i + indiceSezione * 3) % COLORE_TIPO.length] }}
                            aria-hidden="true"
                          />
                          <span className="min-w-0 flex-1 truncate text-gray-700 dark:text-gray-300">{tipo.nome}</span>
                          <span className="tabular-nums text-gray-900 dark:text-white">{euro(tipo.totale)}</span>
                        </li>
                      ))}
                    </ul>
                  </>
                ) : (
                  <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                    {sezione.titolo === 'Debiti'
                      ? 'Mutui, finanziamenti e carte arrivano con la prossima fetta.'
                      : 'Nessuna voce in questo gruppo.'}
                  </p>
                )}
              </section>
            ))}

            {trasferimenti.length > 0 && (
              <section className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5">
                <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400">Ultimi trasferimenti</h2>
                <ul className="mt-3 space-y-2">
                  {trasferimenti.slice(0, 5).map((t) => (
                    <li key={String(t._id)} className="text-sm">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="truncate text-gray-700 dark:text-gray-300">{t.daNome} → {t.aNome}</span>
                        <span className="shrink-0 tabular-nums text-gray-900 dark:text-white">{euro(t.importo)}</span>
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{dataBreve(t.data)}</p>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </aside>
        </div>
      )}

      <section className="mt-5 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Tipi di voce</h2>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          Il tipo dice se una voce è denaro o un bene materiale e in quale gruppo compare. Aggiungerne
          uno è un dato, non una modifica al programma.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {(dati?.tipi || []).map((t) => (
            <span
              key={String(t.id)}
              className={`rounded-full px-2.5 py-1 text-xs ${
                t.specie === 'debito'
                  ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300'
                  : t.denaro
                    ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                    : 'bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300'
              }`}
            >
              {t.nome}
            </span>
          ))}
        </div>
        <form onSubmit={creaTipo} className="mt-4 grid gap-3 sm:grid-cols-4">
          <input className={campi} type="text" placeholder="Nome del tipo (es. Cripto, Barca)" value={nuovoTipo.nome} onChange={(e) => setNuovoTipo({ ...nuovoTipo, nome: e.target.value })} required />
          <select className={campi} value={nuovoTipo.denaro ? 'denaro' : 'bene'} onChange={(e) => setNuovoTipo({ ...nuovoTipo, denaro: e.target.value === 'denaro' })}>
            <option value="denaro">È denaro</option>
            <option value="bene">È un bene materiale</option>
          </select>
          <button type="submit" className={bottoneSecondario}>Aggiungi tipo</button>
        </form>
      </section>
    </div>
  );
}

export default Patrimonio;
