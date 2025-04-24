import axios from 'axios';

const BASE_URL = process.env.REACT_APP_BASE_URL || 'http://localhost:5001';

// Funzione per ottenere il token da diverse fonti
const getAuthToken = () => {
  try {
    // Prova prima localStorage
    const token = localStorage.getItem('token');
    if (token) return token;

    // Se non trova il token, reindirizza al login
    window.location.href = '/login';
    return null;
  } catch (error) {
    console.error('Errore nel recupero del token:', error);
    window.location.href = '/login';
    return null;
  }
};

// Configurazione di axios per includere il token in tutte le richieste
axios.interceptors.request.use(
  (config) => {
    try {
      const token = getAuthToken();
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      // Abilita le credenziali per tutte le richieste
      config.withCredentials = true;
      return config;
    } catch (error) {
      console.error('Errore nella configurazione della richiesta:', error);
      return config;
    }
  },
  (error) => {
    console.error('Errore nell\'interceptor della richiesta:', error);
    return Promise.reject(error);
  }
);

// Interceptor per gestire gli errori di autenticazione
axios.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('Errore nella risposta:', error);
    if (error.response && error.response.status === 401) {
      try {
        localStorage.removeItem('token');
        window.location.href = '/login';
      } catch (e) {
        console.error('Errore nella gestione del logout:', e);
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// Aggiungi log per debug
console.log('BASE_URL:', BASE_URL);

export default BASE_URL;
