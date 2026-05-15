import axios from 'axios';
import BASE_URL from '../config';

/**
 * Wrapper around axios che ritenta su errori di rete (timeout/cold start).
 * Non ritenta su errori HTTP (4xx/5xx) — quelle vanno gestite dal chiamante.
 *
 * @param {string} path  - percorso API (es. '/api/spese')
 * @param {object} opts  - { method='GET', params, headers, retries=3, delay=2000 }
 * @returns {Promise<object>} response di axios
 */
export const fetchWithRetry = async (path, opts = {}) => {
  const { method = 'GET', params, headers, retries = 3, delay = 2000 } = opts;
  let lastError;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await axios({
        method,
        url: `${BASE_URL}${path}`,
        params,
        headers,
        timeout: 15000,        // 15s per request — abbastanza per cold start
      });
      return response;
    } catch (err) {
      lastError = err;

      // Se è un errore HTTP (4xx/5xx con risposta) — non ritentare
      if (err.response) {
        throw err;
      }

      // Se è l'ultimo tentativo — lascia fallire
      if (attempt >= retries) {
        throw err;
      }

      // Aspetta con backoff (2s, 4s, 8s…)
      const wait = delay * Math.pow(2, attempt - 1);
      console.warn(
        `[fetchWithRetry] Tentativo ${attempt}/${retries} fallito per ${path}, ` +
        `riprovo tra ${wait}ms:`, err.message
      );
      await new Promise(r => setTimeout(r, wait));
    }
  }

  throw lastError;
};
