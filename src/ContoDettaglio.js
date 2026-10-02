import React, { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import SerieChart from './components/SerieChart';
import SelettorePeriodo from './components/SelettorePeriodo';
import Modale from './components/Modale';
import { fetchWithRetry } from './utils/fetchWithRetry';
import {
  chiaveMese,
  conSegno,
  dataBreve,
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
//
// Per un Debito la stessa scheda diventa la scheda del debito: il valore grande è il
// residuo (quanto devi), sopra ai Movimenti c'è il piano (rata, rate che restano, quanto
// costa ancora) con il pulsante che registra la rata, e la correzione non è più una
// differenza ma il residuo vero della banca (ADR-0004).

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

// Dove vive ciascun Movimento nel backend: modifica ed eliminazione usano la sua rotta.
const ROTTE_MOVIMENTO = {
  spesa: 'spese',
  entrata: 'entrate',
  trasferimento: 'trasferimenti',
  rettifica: 'rettifiche'
};

const titoloMovimento = (m) => {
  if (m.descrizione) return m.descrizione;
  if (m.tipo === 'trasferimento') return m.uscente ? `Verso ${m.controparte}` : `Da ${m.controparte}`;
  return m.categoria || ETICHETTA_TIPO[m.tipo] || 'Movimento';
};

// Su un Debito l'importo di un Movimento si legge al contrario: è l'effetto sul RESIDUO, non
// sul saldo. «Alzato» significa che il debito è cresciuto.
const sottotitoloMovimento = (m, debito = false) => {
  if (m.tipo === 'trasferimento') {
    return `${m.uscente ? 'a' : 'da'} ${m.controparte}${m.origine === 'sistema' ? ' · generato' : ''}`;
  }
  if (m.tipo === 'rettifica') {
    if (debito) return m.importo >= 0 ? 'il debito è cresciuto' : 'il debito è sceso';
    return m.importo >= 0 ? 'il valore è stato alzato' : 'il valore è stato abbassato';
  }
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
  // Il Movimento in corso di modifica: { id, tipo, importo, categoria, descrizione, data }.
  const [movimentoInModifica, setMovimentoInModifica] = useState(null);
  // Le categorie sono solo un suggerimento per il campo: se non arrivano si scrive a mano.
  const [categorie, setCategorie] = useState({ spese: [], entrate: [] });
  // Le impostazioni del conto: nome, tipo, chiusura, eliminazione.
  const [impostazioni, setImpostazioni] = useState({ nome: '', tipoId: '' });
  const [confermaNome, setConfermaNome] = useState('');
  // Il Debito: le rate registrate, la rata in corso di registrazione e il residuo vero.
  const [rate, setRate] = useState([]);
  const [rata, setRata] = useState({ interessi: '', capitale: '', contoId: '', data: '', categoria: '' });
  const [nuovoResiduo, setNuovoResiduo] = useState('');
  // I conti che possono pagare una rata: le Attività di denaro. Servono solo ai Debiti.
  const [conti, setConti] = useState([]);

  const token = localStorage.getItem('token');
  const intestazioni = { Authorization: `Bearer ${token}` };

  const carica = async () => {
    try {
      const res = await fetchWithRetry(`/api/voci/${voceId}`, { headers: intestazioni });
      setDati(res.data.data);
      // Le impostazioni sono una cosa sola: nome, tipo e — per un Debito — il piano. Il
      // tasso dichiarato qui vince su quello ricavato, e svuotarlo lo fa ricavare di nuovo.
      const voce = res.data.data.voce;
      const piano = res.data.data.piano;
      setImpostazioni({
        nome: voce.nome,
        tipoId: voce.tipo ? String(voce.tipo.id) : '',
        ...(voce.specie === 'debito' && piano
          ? {
              rata: piano.rata ? String(piano.rata) : '',
              tasso: piano.tasso ? String(piano.tasso) : '',
              scadenza: piano.scadenza || '',
              categoriaRata: piano.categoriaRata || ''
            }
          : {})
      });
      // Le rate sono una lettura in più solo per i Debiti: per un conto non esistono.
      if (voce.specie === 'debito') {
        const risposta = await fetchWithRetry(`/api/debiti/${voceId}/rate`, { headers: intestazioni });
        setRate(risposta.data.data || []);
      } else {
        setRate([]);
      }
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

  // Le categorie si caricano una volta sola: sono un suggerimento, non una dipendenza. Con
  // loro arrivano i conti di denaro, che servono a scegliere chi paga la rata di un Debito.
  useEffect(() => {
    if (!token) return;
    fetchWithRetry('/api/categorie', { headers: intestazioni })
      .then((res) => setCategorie(res.data.categorie || { spese: [], entrate: [] }))
      .catch(() => {});
    fetchWithRetry('/api/voci', { headers: intestazioni })
      .then((res) => {
        const elenco = res.data?.data?.voci || [];
        setConti(elenco.filter((v) => v.specie === 'attivita' && v.tipo && v.tipo.denaro && !v.archiviata));
      })
      .catch(() => {});
  }, [token]);

  const puntiTotali = useMemo(
    () => (dati ? puntiDaSerie(dati.asse, dati.voce.serie) : []),
    [dati]
  );
  const puntiVisibili = useMemo(() => filtraPeriodo(puntiTotali, periodo), [puntiTotali, periodo]);
  const deltaP = variazione(puntiVisibili);

  // Il Tipo scelto non deve sparire dal menù se qualcuno lo archivia: resterebbe un menù
  // che mostra un altro Tipo mentre il conto ne ha ancora uno suo. La specie è dell'entità
  // (ADR-0006), quindi il menù mostra i Tipi della specie giusta: Attività o Debiti.
  const tipiPerImpostazioni = useMemo(() => {
    const tutti = dati?.tipi || [];
    const specie = dati?.voce?.specie === 'debito' ? 'debito' : 'attivita';
    const elenco = tutti.filter((t) => t.specie === specie && !t.archiviato).sort((a, b) => (a.ordine ?? 1000) - (b.ordine ?? 1000) || a.nome.localeCompare(b.nome));
    const corrente = tutti.find((t) => String(t.id) === String(impostazioni.tipoId));
    if (corrente && !elenco.some((t) => String(t.id) === String(corrente.id))) {
      return [...elenco, corrente];
    }
    return elenco;
  }, [dati, impostazioni.tipoId]);

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

  // --- Il Debito: la rata e il residuo (ADR-0004) ---

  // Gli importi proposti sono quelli calcolati dal residuo, dalla rata e dal tasso, e si
  // possono correggere: la banca può aver applicato un tasso diverso, e il numero vero è
  // il suo. La rata scrive due Movimenti — la Spesa degli interessi sul conto e il
  // Trasferimento della quota capitale al Debito — e il Patrimonio scende dei soli interessi.
  const apriRata = () => {
    setErrore(null);
    setAvviso(null);
    const piano = (dati && dati.piano) || {};
    const ultimo = localStorage.getItem('b365.ultimaVoce');
    setRata({
      interessi: piano.interessi ? String(piano.interessi) : '',
      capitale: piano.capitale ? String(piano.capitale) : '',
      contoId: ultimo && conti.some((c) => String(c.id) === ultimo) ? ultimo : (conti[0] ? String(conti[0].id) : ''),
      data: new Date().toISOString().split('T')[0],
      categoria: piano.categoriaRata || ''
    });
    setPannello('rata');
  };

  const registraRata = async (e) => {
    e.preventDefault();
    setErrore(null);
    setAvviso(null);
    const interessi = Number(rata.interessi || 0);
    const capitale = Number(rata.capitale || 0);
    if (!(interessi > 0) && !(capitale > 0)) {
      setErrore('Indica almeno una delle due quote: senza, la rata non cambia nulla.');
      return;
    }
    try {
      const res = await fetchWithRetry(`/api/debiti/${voceId}/rate`, {
        method: 'POST',
        headers: intestazioni,
        data: {
          interessi,
          capitale,
          contoId: rata.contoId || undefined,
          data: rata.data || undefined,
          categoria: rata.categoria || undefined
        }
      });
      const esito = res.data.data;
      setPannello(null);
      setAvviso(
        `Rata registrata: ${euro(esito.interessi)} di interessi (che è il costo) e ${euro(esito.capitale)} di capitale. ` +
        `Il residuo è sceso a ${euro(esito.residuo)}.`
      );
      await carica();
    } catch (err) {
      setErrore(err?.response?.data?.message || err?.response?.data?.error || 'Rata non registrata');
    }
  };

  const annullaRata = async (r) => {
    const domanda = `Annullare la rata del ${dataBreve(r.data)}? Cancella i due movimenti che l'hanno scritta` +
      `${r.interessi ? ` (${euro(r.interessi)} di interessi` : ' ('}${r.capitale ? ` e ${euro(r.capitale)} di capitale)` : ')'}` +
      ` e il residuo risale di ${euro(r.capitale)}.`;
    if (!window.confirm(domanda)) return;
    setErrore(null);
    setAvviso(null);
    try {
      await fetchWithRetry(`/api/debiti/${voceId}/rate/${r.rataId}`, { method: 'DELETE', headers: intestazioni });
      setAvviso('Rata annullata: il residuo è tornato a quello di prima di quella rata.');
      await carica();
    } catch (err) {
      setErrore(err?.response?.data?.error || 'Annullamento non riuscito');
    }
  };

  // Il residuo vero, quello scritto dalla banca: non è una differenza da calcolare a mente,
  // è il numero che si legge sull'estratto conto. Il backend scrive la Rettifica che serve.
  const inviaResiduo = async (e) => {
    e.preventDefault();
    setErrore(null);
    setAvviso(null);
    const valore = Number(nuovoResiduo);
    if (nuovoResiduo === '' || Number.isNaN(valore) || valore < 0) {
      setErrore('Indica il residuo che vedi: deve essere un numero, anche zero se hai finito di pagare.');
      return;
    }
    try {
      const res = await fetchWithRetry(`/api/debiti/${voceId}/residuo`, {
        method: 'POST',
        headers: intestazioni,
        data: { residuo: valore, descrizione: rettifica.descrizione || undefined }
      });
      setPannello(null);
      setNuovoResiduo('');
      setRettifica({ importo: '', descrizione: '' });
      setAvviso(
        res.data.data.differenza === 0
          ? 'Il residuo era già quello: non ho scritto nulla.'
          : `Residuo aggiornato a ${euro(res.data.data.residuo)}.`
      );
      await carica();
    } catch (err) {
      setErrore(err?.response?.data?.error || 'Aggiornamento non riuscito');
    }
  };

  // Salva nome e tipo insieme: sono la stessa cosa, "come si chiama questo conto e che cosa è".
  // Su un Debito salva anche il piano: rata, scadenza, tasso e categoria della rata.
  const salvaImpostazioni = async (e) => {
    e.preventDefault();
    setErrore(null);
    setAvviso(null);
    const corpo = { nome: impostazioni.nome, tipoId: impostazioni.tipoId };
    const eDebito = dati && dati.voce && dati.voce.specie === 'debito';
    if (eDebito) {
      corpo.rata = Number(impostazioni.rata) > 0 ? Number(impostazioni.rata) : 0;
      corpo.tasso = Number(impostazioni.tasso) > 0 ? Number(impostazioni.tasso) : 0;
      corpo.scadenza = impostazioni.scadenza || '';
      corpo.categoriaRata = impostazioni.categoriaRata || '';
    }
    try {
      await fetchWithRetry(`/api/voci/${voceId}`, {
        method: 'PATCH',
        headers: intestazioni,
        data: corpo
      });
      setAvviso(eDebito ? 'Debito aggiornato: il piano nuovo vale dalle rate successive.' : 'Impostazioni salvate.');
      await carica();
    } catch (err) {
      setErrore(err?.response?.data?.error || 'Impostazioni non salvate');
    }
  };

  const cambiaStatoConto = async (archiviata) => {
    setErrore(null);
    setAvviso(null);
    try {
      await fetchWithRetry(`/api/voci/${voceId}`, {
        method: 'PATCH',
        headers: intestazioni,
        data: { archiviata }
      });
      setAvviso(
        archiviata
          ? 'Conto chiuso: non entra più nel patrimonio e i suoi movimenti restano leggibili.'
          : 'Conto riaperto: torna nel patrimonio con la sua storia.'
      );
      await carica();
    } catch (err) {
      setErrore(err?.response?.data?.error || 'Operazione non riuscita');
    }
  };

  // Cancellare un conto porta via la sua storia: si fa solo scrivendo il suo nome.
  const eliminaConto = async () => {
    setErrore(null);
    setAvviso(null);
    try {
      await fetchWithRetry(`/api/voci/${voceId}?conMovimenti=true`, {
        method: 'DELETE',
        headers: intestazioni
      });
      navigate('/patrimonio');
    } catch (err) {
      setErrore(err?.response?.data?.message || 'Eliminazione non riuscita');
    }
  };

  const registraMovimento = () => {
    localStorage.setItem('b365.ultimaVoce', String(voceId));
    navigate('/transazioni');
  };

  const apriModifica = (m) => {
    setErrore(null);
    setAvviso(null);
    setMovimentoInModifica({
      id: m.id,
      tipo: m.tipo,
      // Una Rettifica è un delta con segno; Spese, Entrate e Trasferimenti si correggono
      // sempre in positivo: il verso lo decide il tipo di Movimento.
      importo: m.tipo === 'rettifica' ? String(m.importo) : String(Math.abs(m.importo)),
      categoria: m.categoria || '',
      descrizione: m.descrizione || '',
      data: m.data ? new Date(m.data).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]
    });
  };

  const salvaModifica = async (e) => {
    e.preventDefault();
    if (!movimentoInModifica) return;
    const { id, tipo, importo, categoria, descrizione, data } = movimentoInModifica;
    const numerico = Number(importo);
    if (importo === '' || Number.isNaN(numerico) || numerico === 0) {
      setErrore('Inserisci un importo valido e diverso da zero.');
      return;
    }
    if ((tipo === 'spesa' || tipo === 'entrata') && !String(categoria).trim()) {
      setErrore('Indica la categoria.');
      return;
    }

    setErrore(null);
    setAvviso(null);
    try {
      if (tipo === 'spesa') {
        await fetchWithRetry(`/api/spese/${id}`, { method: 'PUT', headers: intestazioni, data: { importo: Math.abs(numerico), categoria, descrizione, data } });
      } else if (tipo === 'entrata') {
        await fetchWithRetry(`/api/entrate/${id}`, { method: 'PUT', headers: intestazioni, data: { importo: Math.abs(numerico), categoria, descrizione, data } });
      } else if (tipo === 'trasferimento') {
        await fetchWithRetry(`/api/trasferimenti/${id}`, { method: 'PUT', headers: intestazioni, data: { importo: Math.abs(numerico), descrizione, data } });
      } else {
        await fetchWithRetry(`/api/rettifiche/${id}`, { method: 'PATCH', headers: intestazioni, data: { importo: numerico, descrizione, data } });
      }
      setMovimentoInModifica(null);
      setAvviso('Movimento aggiornato.');
      await carica();
    } catch (err) {
      setErrore(err?.response?.data?.error || err?.response?.data?.message || 'Modifica non riuscita');
    }
  };

  // L'eliminazione è l'unica operazione che non si annulla: la conferma dice che cosa
  // sparisce davvero, cioè anche la controparte di un Trasferimento.
  const eliminaMovimento = async (m) => {
    const nome = titoloMovimento(m);
    let domanda = `Eliminare "${nome}"?`;
    if (m.tipo === 'trasferimento') domanda = `Eliminare il trasferimento "${nome}"? Sparisce anche dall'altro conto.`;
    if (m.tipo === 'rettifica') domanda = `Eliminare la rettifica "${nome}"? Il valore del conto cambia.`;
    if (m.origine === 'sistema') domanda += ' È stato generato dal sistema.';
    if (!window.confirm(domanda)) return;

    setErrore(null);
    setAvviso(null);
    try {
      await fetchWithRetry(`/api/${ROTTE_MOVIMENTO[m.tipo]}/${m.id}`, { method: 'DELETE', headers: intestazioni });
      setAvviso('Movimento eliminato.');
      await carica();
    } catch (err) {
      setErrore(err?.response?.data?.error || 'Eliminazione non riuscita');
    }
  };

  const campi = 'w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500';
  const bottoneSecondario = 'px-3 py-2 text-sm font-medium rounded-lg border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500';
  const bottonePrimario = 'px-3 py-2 text-sm font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500';
  const azione = 'rounded-lg p-1.5 text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500';
  const azioneRossa = 'rounded-lg p-1.5 text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-red-600 dark:hover:text-red-400 transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500';

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
  // Un Debito si legge al contrario di un conto: il valore grande è il residuo, cioè quanto
  // si deve, e i movimenti vanno mostrati come effetto sul residuo.
  const eDebito = voce.specie === 'debito';
  const piano = dati.piano;
  const residuoAperto = voce.valore > 0.005;

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
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{voce.nome}</h1>
            {voce.archiviata && (
              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                chiuso
              </span>
            )}
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400">{voce.tipo ? voce.tipo.nome : 'Senza tipo'}</p>
          <p className="mt-2 text-4xl font-bold tabular-nums text-gray-900 dark:text-white">
            {euro(voce.valore)}
            {eDebito && <span className="ml-2 align-middle text-sm font-medium text-gray-500 dark:text-gray-400">di residuo</span>}
          </p>
          {deltaP !== null && (
            <p className={`mt-1 text-sm tabular-nums ${
              // Su un Debito il residuo che scende è una buona notizia: il colore si ribalta.
              (eDebito ? deltaP <= 0 : deltaP >= 0) ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-700 dark:text-red-400'
            }`}>
              {conSegno(deltaP)} {etichettaVariazione(periodo)}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {eDebito ? (
            <>
              <button type="button" className={bottoneSecondario} onClick={() => setPannello(pannello === 'rettifica' ? null : 'rettifica')}>
                Aggiorna il residuo
              </button>
              <button type="button" className={bottoneSecondario} onClick={() => setPannello(pannello === 'impostazioni' ? null : 'impostazioni')}>
                Impostazioni
              </button>
              <button type="button" className={bottonePrimario} onClick={apriRata} disabled={!residuoAperto}>
                Registra la rata
              </button>
            </>
          ) : (
            <>
              <button type="button" className={bottoneSecondario} onClick={() => setPannello(pannello === 'rettifica' ? null : 'rettifica')}>
                Rettifica
              </button>
              <button type="button" className={bottoneSecondario} onClick={() => setPannello(pannello === 'impostazioni' ? null : 'impostazioni')}>
                Impostazioni
              </button>
              <button type="button" className={bottonePrimario} onClick={registraMovimento}>
                Registra un movimento
              </button>
            </>
          )}
        </div>
      </div>

      {errore && (
        <div className="mb-4 rounded-lg border border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/40 px-4 py-3 text-sm text-red-800 dark:text-red-200">{errore}</div>
      )}
      {avviso && (
        <div className="mb-4 rounded-lg border border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 px-4 py-3 text-sm text-emerald-800 dark:text-emerald-200">{avviso}</div>
      )}

      {/* Il piano di un Debito: quanto manca, quanto costa ancora e quando finisce. È quello
          che l'ADR-0004 chiede al Debito di saper dire: il residuo non è un numero che
          l'utente deve ricalcolare a mano. */}
      {eDebito && piano && (
        <section className="mb-5 rounded-xl border border-rose-200 dark:border-rose-900/60 bg-white dark:bg-gray-900 p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Il piano del debito</h2>
            {piano.tasso !== null && piano.tasso !== undefined && (
              <span className="text-xs tabular-nums text-gray-500 dark:text-gray-400">
                tasso {piano.tasso.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}% annuo
                {piano.tassoRicavato ? ' · ricavato da residuo, rata e scadenza' : ''}
              </span>
            )}
          </div>

          {piano.completo ? (
            <>
              <dl className="mt-3 grid gap-3 sm:grid-cols-3">
                {[
                  { etichetta: 'Rata', valore: euro(piano.rata) },
                  { etichetta: 'Rate che restano', valore: String(piano.rate) },
                  { etichetta: 'Prossima rata', valore: dataBreve(piano.prossimaRata) },
                  { etichetta: 'Di cui interessi', valore: euro(piano.interessi) },
                  { etichetta: 'Di cui capitale', valore: euro(piano.capitale) },
                  { etichetta: 'Interessi che restano', valore: piano.interessiResidui === null ? '—' : euro(piano.interessiResidui) }
                ].map((voce) => (
                  <div key={voce.etichetta}>
                    <dt className="text-xs text-gray-500 dark:text-gray-400">{voce.etichetta}</dt>
                    <dd className="text-sm font-semibold tabular-nums text-gray-900 dark:text-white">{voce.valore}</dd>
                  </div>
                ))}
              </dl>
              <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
                Ultima rata {piano.ultimaRataIl ? dataBreve(piano.ultimaRataIl) : '—'}. Della rata, solo gli
                interessi sono un costo: il capitale è denaro che si sposta dal conto al debito, e per questo
                il patrimonio scende di {euro(piano.interessi)} e non di {euro(piano.rata)}.
              </p>
            </>
          ) : (
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
              Questo debito non ha un piano di ammortamento (una carta di credito non ce l'ha): il residuo si
              muove con i movimenti — una spesa fatta con la carta lo alza, un versamento lo abbassa. Per
              versare, registra un trasferimento da questo debito verso il conto, o dal conto verso il debito.
            </p>
          )}

          {!residuoAperto && (
            <p className="mt-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 px-3 py-2 text-xs text-emerald-800 dark:text-emerald-200">
              Il residuo è a zero: questo debito è finito. Puoi chiuderlo dalle impostazioni, così esce
              dall'elenco ma la sua storia resta leggibile.
            </p>
          )}
        </section>
      )}

      {/* Le rate registrate: ogni riga è una rata, cioè i due Movimenti che l'hanno scritta.
          Sono l'unica cosa che si annulla in blocco senza toccare il resto della storia. */}
      {eDebito && rate.length > 0 && (
        <section className="mb-5 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5">
          <div className="flex items-baseline justify-between">
            <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400">Rate registrate</h2>
            <span className="text-xs tabular-nums text-gray-500 dark:text-gray-400">{rate.length}</span>
          </div>
          <ul className="mt-3 divide-y divide-gray-100 dark:divide-gray-800">
            {rate.map((r) => (
              <li key={r.rataId} className="flex items-center gap-3 py-2.5">
                <span className="min-w-0 flex-1">
                  <span className="block text-sm text-gray-900 dark:text-white">{dataBreve(r.data)}</span>
                  <span className="mt-0.5 block text-xs text-gray-500 dark:text-gray-400">
                    {euro(r.interessi)} di interessi + {euro(r.capitale)} di capitale
                  </span>
                </span>
                <span className="shrink-0 text-sm font-semibold tabular-nums text-gray-900 dark:text-white">{euro(r.totale)}</span>
                <button type="button" onClick={() => annullaRata(r)} className={bottoneLinkRosso}>
                  annulla
                </button>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
            Annullare una rata cancella i due movimenti che l'hanno scritta: il residuo risale della quota capitale
            e la spesa degli interessi sparisce dal budget di quel mese.
          </p>
        </section>
      )}

      {pannello === 'impostazioni' && (
        <div className="mb-5 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Impostazioni del conto</h2>

          {/* Nome e tipo: la stessa domanda — come si chiama e che cosa è. */}
          <form onSubmit={salvaImpostazioni} className="mt-3 grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
            <label className="text-xs text-gray-500 dark:text-gray-400 sm:col-span-3">
              Nome e tipo
            </label>
            <input
              className={campi}
              type="text"
              value={impostazioni.nome}
              onChange={(e) => setImpostazioni({ ...impostazioni, nome: e.target.value })}
              required
            />
            <select
              className={campi}
              value={impostazioni.tipoId}
              onChange={(e) => setImpostazioni({ ...impostazioni, tipoId: e.target.value })}
            >
              {tipiPerImpostazioni.map((t) => (
                <option key={String(t.id)} value={String(t.id)}>
                  {t.nome} — {t.denaro ? 'denaro' : 'bene materiale'}{t.archiviato ? ' (archiviato)' : ''}
                </option>
              ))}
            </select>
            <button type="submit" className={bottonePrimario}>Salva</button>
          </form>

          {/* Il piano di un Debito: il tasso cambia (tasso variabile) e il residuo no. Il
              residuo si aggiorna dall'altra finestra, con il numero della banca. */}
          {eDebito && (
            <form onSubmit={salvaImpostazioni} className="mt-4 grid gap-3 sm:grid-cols-4">
              <label className="text-xs text-gray-500 dark:text-gray-400 sm:col-span-4">
                Piano del debito
              </label>
              <label className="block text-xs text-gray-500 dark:text-gray-400">
                Rata (€)
                <input
                  className={`${campi} mt-1`}
                  type="number"
                  step="0.01"
                  min="0"
                  value={impostazioni.rata || ''}
                  onChange={(e) => setImpostazioni({ ...impostazioni, rata: e.target.value })}
                />
              </label>
              <label className="block text-xs text-gray-500 dark:text-gray-400">
                Scadenza
                <input
                  className={`${campi} mt-1`}
                  type="date"
                  value={impostazioni.scadenza || ''}
                  onChange={(e) => setImpostazioni({ ...impostazioni, scadenza: e.target.value })}
                />
              </label>
              <label className="block text-xs text-gray-500 dark:text-gray-400">
                Tasso annuo %
                <input
                  className={`${campi} mt-1`}
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="vuoto = ricavato"
                  value={impostazioni.tasso || ''}
                  onChange={(e) => setImpostazioni({ ...impostazioni, tasso: e.target.value })}
                />
              </label>
              <label className="block text-xs text-gray-500 dark:text-gray-400">
                Categoria della rata
                <input
                  className={`${campi} mt-1`}
                  type="text"
                  list="categorie-rata"
                  value={impostazioni.categoriaRata || ''}
                  onChange={(e) => setImpostazioni({ ...impostazioni, categoriaRata: e.target.value })}
                />
                <datalist id="categorie-rata">
                  {categorie.spese.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              </label>
              <p className="text-xs text-gray-500 dark:text-gray-400 sm:col-span-4">
                Svuotare il tasso lo fa ricavare di nuovo da residuo, rata e scadenza. Il residuo non si
                tocca qui: si aggiorna con «Aggiorna il residuo», scrivendo il numero della banca.
              </p>
              <button type="submit" className={`${bottonePrimario} sm:col-span-4 sm:justify-self-start`}>
                Salva il piano
              </button>
            </form>
          )}

          {/* Chiudere conserva i movimenti: è l'alternativa all'eliminazione. */}
          <div className="mt-6 border-t border-gray-100 dark:border-gray-800 pt-4">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Chiudi il conto</h3>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Il conto esce dal patrimonio e non compare più nell'elenco, ma <strong className="font-semibold text-gray-700 dark:text-gray-200">tutte
              le transazioni registrate restano</strong> nella sua scheda e nello storico. Si può riaprire
              quando vuoi.
            </p>
            {!voce.archiviata && Math.abs(voce.valore) > 0.005 && (
              <p className="mt-2 rounded-lg bg-amber-50 dark:bg-amber-950/30 px-3 py-2 text-xs text-amber-800 dark:text-amber-200">
                Questo conto ha ancora {euro(voce.valore)}: chiudendolo quel valore esce dal patrimonio.
                Se è denaro che hai spostato, registra prima il trasferimento sul conto dove si trova adesso.
              </p>
            )}
            <div className="mt-3 flex items-center gap-2">
              {voce.archiviata ? (
                <button type="button" className={bottoneSecondario} onClick={() => cambiaStatoConto(false)}>
                  Riapri il conto
                </button>
              ) : (
                <button type="button" className={bottoneSecondario} onClick={() => cambiaStatoConto(true)}>
                  Chiudi il conto
                </button>
              )}
            </div>
          </div>

          {/* Eliminare distrugge la storia: si conferma scrivendo il nome del conto. */}
          <div className="mt-6 border-t border-red-100 dark:border-red-900/40 pt-4">
            <h3 className="text-sm font-semibold text-red-700 dark:text-red-400">Elimina il conto</h3>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Cancella il conto <strong className="font-semibold text-gray-700 dark:text-gray-200">e tutte le sue transazioni</strong>
              {dati.conteggi && dati.conteggi.totale > 0
                ? ` (${dati.conteggi.totale}: ${[
                    dati.conteggi.spese ? `${dati.conteggi.spese} spese` : null,
                    dati.conteggi.entrate ? `${dati.conteggi.entrate} entrate` : null,
                    dati.conteggi.trasferimenti ? `${dati.conteggi.trasferimenti} trasferimenti` : null,
                    dati.conteggi.rettifiche ? `${dati.conteggi.rettifiche} rettifiche` : null
                  ].filter(Boolean).join(', ')})`
                : ''}.
              {' '}Un trasferimento cancella anche la sua controparte sull'altro conto, e le Fotografie
              mensili già scritte restano come misurate. <strong className="font-semibold text-gray-700 dark:text-gray-200">Non si annulla.</strong>
            </p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <input
                className={campi}
                type="text"
                placeholder={`Scrivi "${voce.nome}" per confermare`}
                value={confermaNome}
                onChange={(e) => setConfermaNome(e.target.value)}
              />
              <button
                type="button"
                disabled={confermaNome.trim() !== voce.nome}
                onClick={eliminaConto}
                className={`px-3 py-2 text-sm font-semibold rounded-lg transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 ${
                  confermaNome.trim() === voce.nome
                    ? 'bg-red-600 hover:bg-red-700 text-white'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500 cursor-not-allowed'
                }`}
              >
                Elimina il conto e le sue transazioni
              </button>
            </div>
          </div>
        </div>
      )}

      {pannello === 'rettifica' && !eDebito && (
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

      {/* Su un Debito non si corregge una differenza: si dichiara il residuo vero. La
          differenza la calcola il sistema, e la scrive come Movimento (ADR-0004). */}
      {pannello === 'rettifica' && eDebito && (
        <form onSubmit={inviaResiduo} className="mb-5 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Aggiorna il residuo</h2>
          <p className="mt-1 mb-3 text-xs text-gray-500 dark:text-gray-400">
            Scrivi il residuo che vedi sull'estratto conto della banca: il sistema registra da sé la differenza
            fra {euro(voce.valore)} e quel numero. Serve quando il debito si muove senza di noi (un tasso
            cambiato, una rata addebitata direttamente) e non entra nel budget.
          </p>
          <div className="grid gap-3 sm:grid-cols-3">
            <input
              className={campi}
              type="number"
              step="0.01"
              min="0"
              placeholder={`Residuo vero (adesso ${euro(voce.valore)})`}
              value={nuovoResiduo}
              onChange={(e) => setNuovoResiduo(e.target.value)}
              required
            />
            <input className={campi} type="text" placeholder="Motivo (facoltativo)" value={rettifica.descrizione} onChange={(e) => setRettifica({ ...rettifica, descrizione: e.target.value })} />
            <button type="submit" className={bottonePrimario}>Aggiorna il residuo</button>
          </div>
        </form>
      )}

      <section className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400">{eDebito ? 'Andamento del debito' : 'Andamento del conto'}</h2>
          <SelettorePeriodo valore={periodo} onChange={setPeriodo} />
        </div>
        <div className="mt-3">
          {puntiVisibili.length >= 2 ? (
            <SerieChart punti={puntiVisibili} colore={eDebito || voce.valore < 0 ? '#e11d48' : '#6366f1'} altezza={220} />
          ) : (
            <p className="py-8 text-center text-sm text-gray-500 dark:text-gray-400">
              Servono almeno due mesi di movimenti per disegnare l'andamento di questo conto.
            </p>
          )}
        </div>
        <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
          {eDebito
            ? 'Residuo di fine mese, ricostruito dai movimenti registrati su questo debito: scende con le rate e sale con quello che si aggiunge al debito.'
            : 'Valore di fine mese, ricostruito dai movimenti registrati su questo conto.'}
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
            {eDebito
              ? 'Su questo debito non ci sono ancora movimenti: le rate che registri, le spese fatte con la carta e i versamenti compaiono qui.'
              : 'Su questo conto non ci sono ancora movimenti. Le spese e le entrate che registri scegliendolo come conto, i trasferimenti e le rettifiche compaiono qui.'}
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
                        <span className="truncate">{sottotitoloMovimento(m, eDebito)}</span>                      </span>
                    </span>
                    <span className={`shrink-0 text-sm font-semibold tabular-nums ${m.importo >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                      {m.importo >= 0 ? '+' : ''}{euro(m.importo)}
                    </span>
                    <span className="flex shrink-0 items-center gap-0.5">
                      <button
                        type="button"
                        onClick={() => apriModifica(m)}
                        className={azione}
                        title="Modifica"
                        aria-label={`Modifica ${titoloMovimento(m)}`}
                      >
                        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <path d="M12 20h9" />
                          <path d="M16.5 3.5a2.12 2.12 0 013 3L7 19l-4 1 1-4z" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        onClick={() => eliminaMovimento(m)}
                        className={azioneRossa}
                        title="Elimina"
                        aria-label={`Elimina ${titoloMovimento(m)}`}
                      >
                        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <path d="M3 6h18" />
                          <path d="M8 6V4h8v2" />
                          <path d="M19 6l-1 14H6L5 6" />
                          <path d="M10 11v6M14 11v6" />
                        </svg>
                      </button>
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

      {/* La rata: due quote che si possono correggere prima di registrare, perché il numero
          vero è quello dell'estratto conto della banca. Il conto che paga si sceglie qui. */}
      <Modale
        aperta={pannello === 'rata'}
        titolo="Registra la rata"
        sottotitolo={voce.nome}
        onChiudi={() => setPannello(null)}
        larghezza="max-w-lg"
      >
        <form onSubmit={registraRata} className="space-y-3">
          {errore && (
            <div className="rounded-lg border border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/40 px-3 py-2 text-xs text-red-800 dark:text-red-200">
              {errore}
            </div>
          )}

          <p className="text-xs text-gray-500 dark:text-gray-400">
            {piano && piano.completo
              ? `Dal residuo di ${euro(voce.valore)}, con ${piano.rate} rate che restano, la rata si divide in ${euro(piano.interessi)} di interessi e ${euro(piano.capitale)} di capitale. Correggila se la banca ha applicato altro.`
              : 'Scrivi le due quote della rata: gli interessi sono il costo, il capitale abbassa il residuo.'}
          </p>

          <div className="grid gap-3 sm:grid-cols-3">
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400">
              Quota interessi (€)
              <input className={`${campi} mt-1`} type="number" step="0.01" min="0" value={rata.interessi} onChange={(e) => setRata({ ...rata, interessi: e.target.value })} />
            </label>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400">
              Quota capitale (€)
              <input className={`${campi} mt-1`} type="number" step="0.01" min="0" value={rata.capitale} onChange={(e) => setRata({ ...rata, capitale: e.target.value })} />
            </label>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400">
              Data
              <input className={`${campi} mt-1`} type="date" value={rata.data} onChange={(e) => setRata({ ...rata, data: e.target.value })} />
            </label>
          </div>

          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400">
            Conto che paga la rata
            <select className={`${campi} mt-1`} value={rata.contoId} onChange={(e) => setRata({ ...rata, contoId: e.target.value })}>
              <option value="">Conto principale</option>
              {conti.map((c) => (
                <option key={String(c.id)} value={String(c.id)}>{c.nome} — {euro(c.valore)}</option>
              ))}
            </select>
          </label>

          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400">
            Categoria della spesa degli interessi
            <input
              className={`${campi} mt-1`}
              type="text"
              list="categorie-rata"
              placeholder="es. Mutuo"
              value={rata.categoria}
              onChange={(e) => setRata({ ...rata, categoria: e.target.value })}
            />
            <datalist id="categorie-rata">
              {categorie.spese.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </label>

          <p className="rounded-lg bg-gray-50 dark:bg-gray-800/60 px-3 py-2 text-xs text-gray-600 dark:text-gray-300">
            Esce dal conto {euro(Number(rata.interessi || 0) + Number(rata.capitale || 0))}. Nel budget di questo
            mese entrano solo gli interessi ({euro(Number(rata.interessi || 0))}), perché il capitale non è una
            spesa: è denaro che si sposta dal conto al debito.
          </p>

          <div className="flex items-center gap-2">
            <button type="submit" className={bottonePrimario}>Registra la rata</button>
            <button type="button" className={bottoneSecondario} onClick={() => setPannello(null)}>Annulla</button>
          </div>
        </form>
      </Modale>

      <Modale
        aperta={!!movimentoInModifica}
        titolo={movimentoInModifica ? `Modifica ${(ETICHETTA_TIPO[movimentoInModifica.tipo] || 'movimento').toLowerCase()}` : ''}
        sottotitolo={movimentoInModifica ? voce.nome : ''}
        onChiudi={() => setMovimentoInModifica(null)}
        larghezza="max-w-lg"
      >
        {movimentoInModifica && (
          <form onSubmit={salvaModifica} className="space-y-3">
            {errore && (
              <div className="rounded-lg border border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/40 px-3 py-2 text-xs text-red-800 dark:text-red-200">
                {errore}
              </div>
            )}
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400">
              Importo{movimentoInModifica.tipo === 'rettifica' ? ' (differenza: + alza il valore, − lo abbassa)' : ''}
              <input
                className={`${campi} mt-1`}
                type="number"
                step="0.01"
                value={movimentoInModifica.importo}
                onChange={(e) => setMovimentoInModifica({ ...movimentoInModifica, importo: e.target.value })}
                required
              />
            </label>

            {(movimentoInModifica.tipo === 'spesa' || movimentoInModifica.tipo === 'entrata') && (
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400">
                Categoria
                <input
                  className={`${campi} mt-1`}
                  type="text"
                  list={`categorie-${movimentoInModifica.tipo}`}
                  value={movimentoInModifica.categoria}
                  onChange={(e) => setMovimentoInModifica({ ...movimentoInModifica, categoria: e.target.value })}
                  required
                />
                <datalist id={`categorie-${movimentoInModifica.tipo}`}>
                  {(movimentoInModifica.tipo === 'spesa' ? categorie.spese : categorie.entrate).map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              </label>
            )}

            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400">
              Descrizione
              <input
                className={`${campi} mt-1`}
                type="text"
                value={movimentoInModifica.descrizione}
                onChange={(e) => setMovimentoInModifica({ ...movimentoInModifica, descrizione: e.target.value })}
              />
            </label>

            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400">
              Data
              <input
                className={`${campi} mt-1`}
                type="date"
                value={movimentoInModifica.data}
                onChange={(e) => setMovimentoInModifica({ ...movimentoInModifica, data: e.target.value })}
              />
            </label>

            <div className="flex justify-end gap-2 pt-1">
              <button type="button" className={bottoneSecondario} onClick={() => setMovimentoInModifica(null)}>Annulla</button>
              <button type="submit" className={bottonePrimario}>Salva</button>
            </div>
          </form>
        )}
      </Modale>
    </div>
  );
}

export default ContoDettaglio;
