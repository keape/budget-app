import { useState, useEffect, useRef, useCallback } from 'react';
import BASE_URL from '../config';

export const useServerWakeup = () => {
  const [status, setStatus] = useState('checking'); // 'checking' | 'slow' | 'ready'
  const [wasSlow, setWasSlow] = useState(false);
  const pollRef = useRef(null);
  const mountedRef = useRef(true);

  const ping = useCallback(async () => {
    try {
      const res = await fetch(`${BASE_URL}/api/health`, {
        signal: AbortSignal.timeout(8000),
      });
      if (res.ok && mountedRef.current) {
        setStatus('ready');
        clearInterval(pollRef.current);
      }
    } catch {
      // server ancora in standby, continua a fare polling
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;

    // Se dopo 2s non ha risposto, mostra il banner
    const slowTimer = setTimeout(() => {
      if (mountedRef.current) {
        setStatus(prev => {
          if (prev === 'checking') {
            setWasSlow(true);
            return 'slow';
          }
          return prev;
        });
      }
    }, 2000);

    ping();
    pollRef.current = setInterval(ping, 4000);

    return () => {
      mountedRef.current = false;
      clearTimeout(slowTimer);
      clearInterval(pollRef.current);
    };
  }, [ping]);

  return { status, wasSlow };
};
