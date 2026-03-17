import React, { useEffect } from 'react';
import { useServerWakeup } from '../hooks/useServerWakeup';

// Variabile a livello di modulo: resettata ad ogni reload di pagina,
// impedisce di schedulare il reload più di una volta.
let reloadScheduled = false;

const ServerWakeupBanner = () => {
  const { status, wasSlow } = useServerWakeup();

  useEffect(() => {
    // Quando il server si sveglia (era lento), ricarica la pagina una volta sola
    // così tutti i componenti riprendono i dati normalmente.
    if (status === 'ready' && wasSlow && !reloadScheduled) {
      reloadScheduled = true;
      setTimeout(() => window.location.reload(), 800);
    }
  }, [status, wasSlow]);

  if (status !== 'slow') return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-amber-500 dark:bg-amber-600 text-white px-4 py-3 flex items-center justify-center gap-3 shadow-lg">
      <div
        className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent flex-shrink-0"
        role="status"
        aria-label="Caricamento"
      />
      <span className="text-sm font-medium text-center">
        Il server è in standby, si sta risvegliando… attendere qualche secondo.
      </span>
    </div>
  );
};

export default ServerWakeupBanner;
