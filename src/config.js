import axios from 'axios';

// URL del backend su Render
const BASE_URL = 'https://budget-app-ao5r.onrender.com';

// Debug log per il token
const getAuthToken = () => {
  try {
    const token = localStorage.getItem('token');
    // console.log('Token recuperato:', token ? 'presente' : 'mancante'); // Less noisy
    if (token) return token;

    // Only redirect if not already on login/register page
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

// Request interceptor: Add auth token
axios.interceptors.request.use(
  (config) => {
    const isAuthEndpoint = config.url?.endsWith('/api/auth/login') || config.url?.endsWith('/api/auth/register');
    if (isAuthEndpoint) {
      return config; // Don't add token to login/register requests
    }
    try {
      const token = getAuthToken();
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      } 
      return config;
    } catch (error) {
      console.error('Errore nella configurazione della richiesta (token retrieval):', error);
      return Promise.reject(error); 
    }
  },
  (error) => {
    console.error('Errore nell'interceptor della richiesta (setup):', error);
    return Promise.reject(error);
  }
);

// Response interceptor: Handle auth errors
axios.interceptors.response.use(
  (response) => {
    // Success: just return the response
    return response;
  },
  (error) => {
    // Error: Check for auth errors (401/403) and redirect if needed
    console.error('Errore nella risposta:', {
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
    
    // Always reject the promise for other code to handle the error if necessary
    return Promise.reject(error);
  }
);

console.log('Configurazione attiva - BASE_URL:', BASE_URL);

export default BASE_URL;