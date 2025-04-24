import axios from 'axios';

// Forza l'uso del server locale
const BASE_URL = 'http://localhost:5001';

// Debug log per il token
const getAuthToken = () => {
  try {
    const token = localStorage.getItem('token');
    console.log('Token recuperato:', token ? 'presente' : 'mancante');
    if (token) return token;

    console.log('Token mancante, reindirizzamento al login');
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
        console.log('Request headers:', config.headers);
        console.log('Request URL:', config.url);
      }
      // Non abilitiamo withCredentials quando usiamo il server locale
      // config.withCredentials = true;
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
  (response) => {
    console.log('Risposta ricevuta:', {
      status: response.status,
      url: response.config.url,
      data: response.data
    });
    return response;
  },
  (error) => {
    console.error('Errore nella risposta:', {
      status: error.response?.status,
      url: error.config?.url,
      message: error.message,
      response: error.response?.data
    });
    
    if (error.response?.status === 401) {
      console.log('Errore di autenticazione, reindirizzamento al login');
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

console.log('Configurazione attiva - BASE_URL:', BASE_URL);

export default BASE_URL;
