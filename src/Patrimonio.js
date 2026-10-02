import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import PatrimonioChart from './components/PatrimonioChart';
import { fetchWithRetry } from './utils/fetchWithRetry';

// Gestione del Patrimonio: le Voci (i conti), i Trasferimenti, le Rettifiche e il catalogo
// dei Tipi. La vista di sintesi sta nella Home; qui si amministra.

const euro = (valore) =>
  `€${Number(valore || 0).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const oggi = () => new Date().toISOString().split('T')[0];

function Patrimonio() {
  const navigate = useNavigate();
  const [caricamento, setCaricamento] = useState(true);
  const [errore, setErrore] = useState(null);
  const [avviso, setAvviso] = useState(null);

  const [voci, setVoci] = useState([]);
  const [gruppi, setGruppi] = useState(null);
  const [patrimonio, setPatrimonio] = useState(0);
  const [tipi, setTipi] = useState([]);
  const [fotografie, setFotografie] = useState([]);
  const [trasferimenti, setTrasferimenti] = useState([]);

  const [nuovaVoce, setNuovaVoce] = useState({ nome: '', tipoId: '' });
  const [nuovoTrasferimento, setNuovoTrasferimento] = useState({ daVoceId: '', aVoceId: '', importo: '', data: oggi(), descrizione: '' });
  const [nuovaRettifica, setNuovaRettifica] = useState({ voceId: '', importo: '', descrizione: '' });
  const [nuovoTipo, setNuovoTipo] = useState({ nome: '', specie: 'attivita', denaro: true });

  const token = localStorage.getItem('token');
  const intestazioni = { Authorization: `Bearer ${token}` };

  const carica = useCallback(async () => {
    setCaricamento(true);
    try {
      const [vociRes, patrimonioRes, trasferimentiRes] = await Promise.all([
        fetchWithRetry('/api/voci', { headers: intestazioni }),
        fetchWithRetry('/api/patrimonio', { headers: intestazioni }),
        fetchWithRetry('/api/trasferimenti', { headers: intestazioni })
      ]);

      setVoci(vociRes.data.data.voci || []);
      setGruppi(vociRes.data.data.gruppi || null);
      setPatrimonio(vociRes.data.data.patrimonio || 0);
      setTipi(vociRes.data.data.tipi || []);
      setFotografie(patrimonioRes.data.data.fotografie || []);
      setTrasferimenti(trasferimentiRes.data.data || []);
      setErrore(null);
    } catch (err) {
      console.error('Errore nel caricamento del patrimonio:', err);
      setErrore('Impossibile caricare il patrimonio. Riprova.');
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
      const messaggio = err?.response?.data?.message || err?.response?.data?.error || 'Operazione non riuscita';
      setErrore(messaggio);
      return false;
    }
  };

  const creaVoce = async (e) => {
    e.preventDefault();
    if (await chiama('POST', '/api/voci', nuovaVoce)) {
      setNuovaVoce({ nome: '', tipoId: '' });
      setAvviso('Voce creata.');
    }
  };

  const creaTrasferimento = async (e) => {
    e.preventDefault();
    if (!nuovoTrasferimento.daVoceId || !nuovoTrasferimento.aVoceId) {
      setErrore('Indica la voce di origine e quella di destinazione.');
      return;
    }
    if (await chiama('POST', '/api/trasferimenti', nuovoTrasferimento)) {
      setNuovoTrasferimento({ daVoceId: '', aVoceId: '', importo: '', data: oggi(), descrizione: '' });
      setAvviso('Trasferimento registrato: il valore si è spostato tra le due voci, il budget non cambia.');
    }
  };

  const creaRettifica = async (e) => {
    e.preventDefault();
    if (!nuovaRettifica.voceId) {
      setErrore('Indica la voce da rettificare.');
      return;
    }
    if (await chiama('POST', '/api/rettifiche', nuovaRettifica)) {
      setNuovaRettifica({ voceId: '', importo: '', descrizione: '' });
      setAvviso('Rettifica registrata.');
    }
  };

  const creaTipo = async (e) => {
    e.preventDefault();
    if (await chiama('POST', '/api/tipi-voce', nuovoTipo)) {
      setNuovoTipo({ nome: '', specie: 'attivita', denaro: true });
      setAvviso('Tipo creato.');
    }
  };

  const tipiAttivi = tipi.filter((t) => !t.archiviato && t.specie === 'attivita');

  return (
    <div className="max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold mb-2 text-gray-800 dark:text-white">💼 Patrimonio</h1>
      <p className="text-gray-600 dark:text-gray-400 mb-6">
        I conti, il valore di ogni voce, i trasferimenti fra conti e le rettifiche. Il patrimonio
        complessivo è {euro(patrimonio)}.
      </p>

      {errore && (
        <div className="mb-4 p-4 bg-red-100 dark:bg-red-900/30 border border-red-400 text-red-700 dark:text-red-300 rounded-lg">
          {errore}
        </div>
      )}
      {avviso && (
        <div className="mb-4 p-4 bg-green-100 dark:bg-green-900/30 border border-green-400 text-green-700 dark:text-green-300 rounded-lg">
          {avviso}
        </div>
      )}

      {caricamento ? (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
        </div>
      ) : (
        <div className="space-y-8">
          <PatrimonioChart fotografie={fotografie} />

          {/* Voci patrimoniali */}
          <section className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6">
            <h2 className="text-xl font-bold mb-4 text-gray-800 dark:text-white">Conti e voci patrimoniali</h2>

            {voci.length === 0 ? (
              <p className="text-gray-500 dark:text-gray-400 italic mb-4">
                Non hai ancora una voce patrimoniale. Crea il primo conto qui sotto.
              </p>
            ) : (
              <div className="space-y-3 mb-6">
                {voci.map((voce) => (
                  <div key={String(voce.id)} className="p-4 rounded-lg bg-gray-50 dark:bg-gray-700/40">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-semibold text-gray-800 dark:text-white">{voce.nome}</span>
                        <span className="ml-2 text-sm text-gray-500 dark:text-gray-400">
                          {voce.tipo ? voce.tipo.nome : 'senza tipo'} · {voce.gruppo}
                        </span>
                      </div>
                      <span className="font-bold text-gray-800 dark:text-white">{euro(voce.valore)}</span>
                    </div>
                    <ul className="mt-2 space-y-1">
                      {voce.componenti.map((c) => (
                        <li key={String(c.id)} className="flex justify-between text-sm text-gray-600 dark:text-gray-300">
                          <span>
                            {c.nome}
                            <span className="text-gray-400 dark:text-gray-500"> · {c.valorizzazione}</span>
                          </span>
                          <span>{euro(c.valore)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}

            <form onSubmit={creaVoce} className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <input
                className="px-4 py-3 rounded-lg border-2 border-blue-300 dark:border-blue-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-white"
                type="text"
                placeholder="Nome della voce (es. Conto Fineco, Contanti)"
                value={nuovaVoce.nome}
                onChange={(e) => setNuovaVoce({ ...nuovaVoce, nome: e.target.value })}
                required
              />
              <select
                className="px-4 py-3 rounded-lg border-2 border-blue-300 dark:border-blue-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-white"
                value={nuovaVoce.tipoId}
                onChange={(e) => setNuovaVoce({ ...nuovaVoce, tipoId: e.target.value })}
                required
              >
                <option value="">Tipo di voce</option>
                {tipiAttivi.map((t) => (
                  <option key={String(t.id)} value={t.id}>
                    {t.nome} {t.denaro ? '(denaro)' : '(bene)'}
                  </option>
                ))}
              </select>
              <button
                type="submit"
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg"
              >
                Aggiungi voce
              </button>
            </form>
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              Le voci con tipo Investimenti, Immobili, Veicoli e Beni di valore si useranno nelle prossime
              fette: oggi il patrimonio si regge sui conti di denaro.
            </p>
          </section>

          {/* Trasferimenti */}
          <section className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6">
            <h2 className="text-xl font-bold mb-1 text-gray-800 dark:text-white">Trasferimenti</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Spostano valore tra due conti (bonifico al broker, prelievo, giroconto). Non entrano nel
              budget: non sono né una spesa né un'entrata.
            </p>

            <form onSubmit={creaTrasferimento} className="grid grid-cols-1 md:grid-cols-5 gap-3 mb-6">
              <select
                className="px-4 py-3 rounded-lg border-2 border-indigo-300 dark:border-indigo-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-white"
                value={nuovoTrasferimento.daVoceId}
                onChange={(e) => setNuovoTrasferimento({ ...nuovoTrasferimento, daVoceId: e.target.value })}
              >
                <option value="">Da (Conto principale)</option>
                {voci.map((v) => (
                  <option key={String(v.id)} value={v.id}>{v.nome}</option>
                ))}
              </select>
              <select
                className="px-4 py-3 rounded-lg border-2 border-indigo-300 dark:border-indigo-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-white"
                value={nuovoTrasferimento.aVoceId}
                onChange={(e) => setNuovoTrasferimento({ ...nuovoTrasferimento, aVoceId: e.target.value })}
              >
                <option value="">A (obbligatorio)</option>
                {voci.map((v) => (
                  <option key={String(v.id)} value={v.id}>{v.nome}</option>
                ))}
              </select>
              <input
                className="px-4 py-3 rounded-lg border-2 border-indigo-300 dark:border-indigo-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-white"
                type="number"
                step="0.01"
                placeholder="Importo"
                value={nuovoTrasferimento.importo}
                onChange={(e) => setNuovoTrasferimento({ ...nuovoTrasferimento, importo: e.target.value })}
                required
              />
              <input
                className="px-4 py-3 rounded-lg border-2 border-indigo-300 dark:border-indigo-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-white"
                type="date"
                value={nuovoTrasferimento.data}
                onChange={(e) => setNuovoTrasferimento({ ...nuovoTrasferimento, data: e.target.value })}
              />
              <button
                type="submit"
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-6 rounded-lg"
              >
                Trasferisci
              </button>
            </form>

            {trasferimenti.length > 0 && (
              <ul className="space-y-2">
                {trasferimenti.slice(0, 20).map((t) => (
                  <li key={String(t._id)} className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-700/40">
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      {new Date(t.data).toLocaleDateString('it-IT')} · {t.daNome} → {t.aNome}
                      {t.descrizione ? ` · ${t.descrizione}` : ''}
                      {t.origine === 'sistema' ? ' · generato' : ''}
                    </span>
                    <span className="flex items-center gap-3">
                      <span className="font-semibold text-gray-800 dark:text-white">{euro(t.importo)}</span>
                      <button
                        onClick={() => chiama('DELETE', `/api/trasferimenti/${t._id}`)}
                        className="text-red-600 dark:text-red-400 text-sm hover:underline"
                      >
                        elimina
                      </button>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Rettifiche */}
          <section className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6">
            <h2 className="text-xl font-bold mb-1 text-gray-800 dark:text-white">Rettifica di una voce</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Cambia il valore di una sola voce, senza controparte: il saldo vero del conto corrente,
              un interesse addebitato, una stima corretta. Anche questa non entra nel budget.
            </p>
            <form onSubmit={creaRettifica} className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <select
                className="px-4 py-3 rounded-lg border-2 border-amber-300 dark:border-amber-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-white"
                value={nuovaRettifica.voceId}
                onChange={(e) => setNuovaRettifica({ ...nuovaRettifica, voceId: e.target.value })}
                required
              >
                <option value="">Voce da rettificare</option>
                {voci.map((v) => (
                  <option key={String(v.id)} value={v.id}>{v.nome}</option>
                ))}
              </select>
              <input
                className="px-4 py-3 rounded-lg border-2 border-amber-300 dark:border-amber-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-white"
                type="number"
                step="0.01"
                placeholder="Differenza (+ o −)"
                value={nuovaRettifica.importo}
                onChange={(e) => setNuovaRettifica({ ...nuovaRettifica, importo: e.target.value })}
                required
              />
              <input
                className="px-4 py-3 rounded-lg border-2 border-amber-300 dark:border-amber-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-white"
                type="text"
                placeholder="Motivo (facoltativo)"
                value={nuovaRettifica.descrizione}
                onChange={(e) => setNuovaRettifica({ ...nuovaRettifica, descrizione: e.target.value })}
              />
              <button
                type="submit"
                className="bg-amber-600 hover:bg-amber-700 text-white font-bold py-3 px-6 rounded-lg"
              >
                Rettifica
              </button>
            </form>
          </section>

          {/* Catalogo dei Tipi */}
          <section className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6">
            <h2 className="text-xl font-bold mb-1 text-gray-800 dark:text-white">Tipi di voce</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Il tipo dice se una voce è denaro o un bene, e per i debiti se ha un piano di ammortamento.
              Aggiungere un tipo è un dato, non una modifica al programma.
            </p>

            <div className="flex flex-wrap gap-2 mb-6">
              {tipi.map((t) => (
                <span
                  key={String(t.id)}
                  className={`px-3 py-1 rounded-full text-sm ${
                    t.specie === 'debito'
                      ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                      : t.denaro
                        ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                        : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                  }`}
                >
                  {t.nome}
                  {t.specie === 'debito' ? ' · debito' : t.denaro ? ' · denaro' : ' · bene'}
                </span>
              ))}
            </div>

            <form onSubmit={creaTipo} className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <input
                className="px-4 py-3 rounded-lg border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-white"
                type="text"
                placeholder="Nome del tipo (es. Cripto, Barca)"
                value={nuovoTipo.nome}
                onChange={(e) => setNuovoTipo({ ...nuovoTipo, nome: e.target.value })}
                required
              />
              <select
                className="px-4 py-3 rounded-lg border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-white"
                value={nuovoTipo.specie}
                onChange={(e) => setNuovoTipo({ ...nuovoTipo, specie: e.target.value })}
              >
                <option value="attivita">Attività</option>
                <option value="debito">Debito (prossima fetta)</option>
              </select>
              <select
                className="px-4 py-3 rounded-lg border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-white"
                value={nuovoTipo.denaro ? 'denaro' : 'bene'}
                onChange={(e) => setNuovoTipo({ ...nuovoTipo, denaro: e.target.value === 'denaro' })}
                disabled={nuovoTipo.specie === 'debito'}
              >
                <option value="denaro">È denaro</option>
                <option value="bene">È un bene materiale</option>
              </select>
              <button
                type="submit"
                className="bg-gray-700 hover:bg-gray-800 text-white font-bold py-3 px-6 rounded-lg"
              >
                Aggiungi tipo
              </button>
            </form>
          </section>

          <p className="text-xs text-gray-500 dark:text-gray-400">
            {gruppi ? `Denaro ${euro(gruppi.denaro.totale)} · Beni ${euro(gruppi.beni.totale)} · Debiti ${euro(gruppi.debiti.totale)}` : ''}
          </p>
        </div>
      )}
    </div>
  );
}

export default Patrimonio;
