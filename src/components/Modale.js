import React, { useEffect, useRef } from 'react';

// Una finestra sopra la pagina. Il contenuto non entra nel flusso del documento: si chiude
// con Esc, con il bottone in alto a destra o cliccando fuori. Il fuoco entra nella finestra
// all'apertura e torna dov'era alla chiusura, così la tastiera non si perde dietro l'overlay.

function Modale({ aperta, titolo, sottotitolo, onChiudi, larghezza = 'max-w-2xl', children }) {
  const pannello = useRef(null);
  const primaDelFuoco = useRef(null);
  // Il chiamante di solito passa una funzione nuova a ogni render: tenerla in una ref
  // evita che la finestra si riapra (e riprenda il fuoco) a ogni digitazione.
  const chiudi = useRef(onChiudi);
  chiudi.current = onChiudi;

  useEffect(() => {
    if (!aperta) return undefined;

    primaDelFuoco.current = document.activeElement;

    const suTasto = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        chiudi.current();
      }
    };
    document.addEventListener('keydown', suTasto);

    const overflowPrecedente = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const primo = pannello.current?.querySelector('input, select, textarea, button, [href]');
    if (primo) primo.focus();

    return () => {
      document.removeEventListener('keydown', suTasto);
      document.body.style.overflow = overflowPrecedente;
      if (primaDelFuoco.current && typeof primaDelFuoco.current.focus === 'function') {
        primaDelFuoco.current.focus();
      }
    };
  }, [aperta]);

  if (!aperta) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto p-4 sm:p-6">
      <div
        className="fixed inset-0 bg-gray-900/50 dark:bg-black/60"
        onClick={() => chiudi.current()}
        aria-hidden="true"
      />
      <div
        ref={pannello}
        role="dialog"
        aria-modal="true"
        aria-label={titolo}
        className={`relative z-10 mx-auto my-4 w-full ${larghezza} rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-xl`}
      >
        <div className="flex items-start justify-between gap-3 border-b border-gray-100 dark:border-gray-800 px-5 py-4">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">{titolo}</h2>
            {sottotitolo && <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{sottotitolo}</p>}
          </div>
          <button
            type="button"
            onClick={() => chiudi.current()}
            aria-label="Chiudi"
            title="Chiudi"
            className="-mr-1 -mt-1 shrink-0 rounded-lg p-1.5 text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-700 dark:hover:text-gray-200 transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
          >
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
      </div>
    </div>
  );
}

export default Modale;
