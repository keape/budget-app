import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import SerieChart from './SerieChart';
import SelettorePeriodo from './SelettorePeriodo';
import {
  conSegno,
  etichettaVariazione,
  euro,
  filtraPeriodo,
  puntiDaFotografie,
  puntiDaSerie,
  variazione
} from '../utils/patrimonioFormat';

// Il blocco del patrimonio nella Home: il totale, la sua curva e i tre gruppi (Denaro,
// Beni, Debiti). Le righe sono conti: cliccandone uno si apre la sua scheda.
function PatrimonioRiepilogo({ dati, onApri }) {
  const [periodo, setPeriodo] = useState('anno');

  const curvaMisurata = (dati?.fotografie || []).length >= 2;
  const punti = useMemo(() => {
    if (!dati) return [];
    const serie = curvaMisurata
      ? puntiDaFotografie(dati.fotografie)
      : puntiDaSerie(dati.asse, dati.serieRicostruita);
    return filtraPeriodo(serie, periodo);
  }, [dati, curvaMisurata, periodo]);

  const delta = variazione(punti);
  const gruppi = dati?.gruppi || {
    denaro: { totale: 0, voci: [] },
    beni: { totale: 0, voci: [] },
    debiti: { totale: 0, voci: [] }
  };

  const sezioni = [
    { chiave: 'denaro', titolo: 'Denaro', vuoto: 'Nessun conto di denaro.' },
    { chiave: 'beni', titolo: 'Beni', vuoto: 'Nessun bene: immobili, veicoli e beni di valore si registrano dalla pagina Patrimonio.' },
    { chiave: 'debiti', titolo: 'Debiti', vuoto: 'Nessun debito: mutui, finanziamenti e carte si registrano dalla pagina Patrimonio.' }
  ];

  return (
    <section className="mb-8 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400">Patrimonio</h2>
          <p className="mt-1 text-4xl font-bold tabular-nums text-gray-900 dark:text-white">
            {euro(dati?.patrimonio || 0)}
          </p>
          {delta !== null && (
            <p className={`mt-1 text-sm tabular-nums ${delta >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-700 dark:text-red-400'}`}>
              {conSegno(delta)} {etichettaVariazione(periodo)}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {punti.length >= 2 && <SelettorePeriodo valore={periodo} onChange={setPeriodo} />}
          <button
            type="button"
            onClick={onApri}
            className="rounded-lg border border-gray-300 dark:border-gray-700 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
          >
            Conti e trasferimenti
          </button>
        </div>
      </div>

      {punti.length >= 2 && (
        <div className="mt-4">
          <SerieChart punti={punti} altezza={200} colore={(dati?.patrimonio || 0) < 0 ? '#e11d48' : '#6366f1'} />
        </div>
      )}
      {!curvaMisurata && (
        <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
          Curva ricostruita dai movimenti dei conti che esistono oggi: dal prossimo mese la Fotografia
          mensile la sostituisce con il valore misurato.
        </p>
      )}

      <div className="mt-5 grid gap-4 md:grid-cols-3">
        {sezioni.map((sezione) => {
          const gruppo = gruppi[sezione.chiave] || { totale: 0, voci: [] };
          return (
            <div key={sezione.chiave}>
              <div className="flex items-baseline justify-between border-b border-gray-200 dark:border-gray-800 pb-2">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{sezione.titolo}</h3>
                <span className="text-sm font-semibold tabular-nums text-gray-900 dark:text-white">{euro(gruppo.totale)}</span>
              </div>
              {gruppo.voci.length > 0 ? (
                <ul className="mt-2 space-y-0.5">
                  {gruppo.voci.map((voce) => (
                    <li key={String(voce.id)}>
                      <Link
                        to={`/patrimonio/${voce.id}`}
                        className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 -mx-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-800/60 transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                      >
                        <span className="min-w-0 truncate text-gray-700 dark:text-gray-300">{voce.nome}</span>
                        <span className="shrink-0 tabular-nums text-gray-900 dark:text-white">{euro(voce.valore)}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">{sezione.vuoto}</p>
              )}
            </div>
          );
        })}
      </div>

      <p className="mt-4 text-xs text-gray-500 dark:text-gray-400">
        Il patrimonio è la somma delle Attività meno i Debiti. Spese ed Entrate cambiano il denaro;
        i Trasferimenti spostano valore fra conti senza entrare nel budget.
      </p>
    </section>
  );
}

export default PatrimonioRiepilogo;
