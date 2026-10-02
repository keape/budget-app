import React from 'react';
import { PERIODI } from '../utils/patrimonioFormat';

// Il periodo del grafico. Un solo controllo, applicato alla serie già in memoria: cambiare
// periodo non fa una richiesta, quindi non c'è stato di caricamento da mostrare.
function SelettorePeriodo({ valore, onChange, periodi = PERIODI }) {
  return (
    <div role="group" aria-label="Periodo del grafico" className="inline-flex rounded-lg border border-gray-200 dark:border-gray-700 p-0.5">
      {periodi.map((p) => {
        const attivo = p.id === valore;
        return (
          <button
            key={p.id}
            type="button"
            onClick={() => onChange(p.id)}
            aria-pressed={attivo}
            className={`px-2.5 py-1 text-xs font-medium rounded-[6px] transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
              attivo
                ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
            }`}
          >
            {p.etichetta}
          </button>
        );
      })}
    </div>
  );
}

export default SelettorePeriodo;
