import React from 'react';

// Come si guarda il patrimonio: la curva del suo valore nel tempo, oppure la ripartizione
// per Tipo. È una scelta di lettura, non di dato: le due viste mostrano gli stessi mesi.
export const VISTE = [
  { id: 'curva', etichetta: 'Curva' },
  { id: 'ripartizione', etichetta: 'Ripartizione' }
];

function SelettoreVista({ valore, onChange, viste = VISTE }) {
  return (
    <div role="group" aria-label="Vista del grafico" className="inline-flex rounded-lg border border-gray-200 dark:border-gray-700 p-0.5">
      {viste.map((v) => {
        const attiva = v.id === valore;
        return (
          <button
            key={v.id}
            type="button"
            onClick={() => onChange(v.id)}
            aria-pressed={attiva}
            className={`px-2.5 py-1 text-xs font-medium whitespace-nowrap rounded-[6px] transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
              attiva
                ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
            }`}
          >
            {v.etichetta}
          </button>
        );
      })}
    </div>
  );
}

export default SelettoreVista;
