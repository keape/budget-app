import axios from 'axios';

const BASE_URL = process.env.REACT_APP_BASE_URL || 'https://budget-app-ao5r.onrender.com';

// Configurazione di axios per includere il token in tutte le richieste
axios.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Interceptor per gestire gli errori di autenticazione
axios.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Aggiungi log per debug
console.log('BASE_URL:', BASE_URL);

export default BASE_URL;
