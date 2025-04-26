import axios from 'axios';

// URL del backend su Render
const BASE_URL = 'https://budget-app-ao5r.onrender.com';

// Function to get the auth token
const getAuthToken = () => {
  try {
    const token = localStorage.getItem('token');
    if (token) {
      return token;
    }
    if (!window.location.pathname.includes('/login') && !window.location.pathname.includes('/register')) {
      console.log('Token mancante, reindirizzamento al login');
      window.location.href = '/login';
    }
    return null;
  } catch (error) {
    console.error('Errore nel recupero del token:', error);
    if (!window.location.pathname.includes('/login') && !window.location.pathname.includes('/register')) {
       window.location.href = '/login';
    }
    return null;
  }
};

// Axios Request Interceptor - Retyped carefully
axios.interceptors.request.use(
  (config) => {
    const isAuthEndpoint = config.url?.endsWith('/api/auth/login') || config.url?.endsWith('/api/auth/register');
    if (isAuthEndpoint) {
      return config;
    }
    try {
      const token = getAuthToken();
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    } catch (error) {
      console.error("Errore nell'aggiungere il token alla richiesta:", error);
      return Promise.reject(error);
    }
  },
  (error) => {
    console.error("Errore nell'impostazione dell'interceptor della richiesta:", error);
    return Promise.reject(error);
  }
);

// Axios Response Interceptor
axios.interceptors.response.use(
  (response) => {
    return response;
  }
).then(
  (response) => response,
  (error) => {
    console.error('Errore nella risposta Axios:', {
      status: error.response?.status,
      url: error.config?.url,
      message: error.message,
      response: error.response?.data
    });

    const isAuthError = error.response?.status === 401 || error.response?.status === 403;
    const isOnAuthPage = window.location.pathname.includes('/login') || window.location.pathname.includes('/register');

    if (isAuthError && !isOnAuthPage) {
      console.log(`Errore di autenticazione (${error.response.status}), reindirizzamento al login`);
      localStorage.removeItem('token');
      window.location.href = '/login';
    } else if (isAuthError && isOnAuthPage) {
      console.log(`Errore di autenticazione (${error.response.status}) sulla pagina di login/registrazione, non reindirizzo.`);
    }

    return Promise.reject(error);
  }
);

console.log('Configurazione Axios attiva - BASE_URL:', BASE_URL);

export default BASE_URL;
