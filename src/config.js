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
    // Only redirect if token is missing and we are not on auth pages
    if (!window.location.pathname.includes('/login') && !window.location.pathname.includes('/register')) {
      console.log('Token mancante, reindirizzamento al login');
      window.location.href = '/login';
    }
    return null;
  } catch (error) {
    console.error('Errore nel recupero del token:', error);
    // Redirect on error only if not on auth pages
    if (!window.location.pathname.includes('/login') && !window.location.pathname.includes('/register')) {
       window.location.href = '/login';
    }
    return null;
  }
};

// Axios Request Interceptor
axios.interceptors.request.use(
  (config) => {
    // Do not add token for login/register endpoints
    const isAuthEndpoint = config.url?.endsWith('/api/auth/login') || config.url?.endsWith('/api/auth/register');
    if (isAuthEndpoint) {
      return config;
    }

    // Try adding the token for other requests
    try {
      const token = getAuthToken();
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    } catch (error) {
      console.error('Errore nell'aggiungere il token alla richiesta:', error);
      return Promise.reject(error);
    }
  },
  (error) => {
    // Handle errors setting up the request
    console.error('Errore nell'impostazione dell'interceptor della richiesta:', error);
    return Promise.reject(error);
  }
);

// Axios Response Interceptor
axios.interceptors.response.use(
  (response) => {
    // Any status code within the range of 2xx cause this function to trigger
    // Simply return the response for successful requests
    return response;
  },
  (error) => {
    // Any status codes outside the range of 2xx cause this function to trigger
    console.error('Errore nella risposta Axios:', {
      status: error.response?.status,
      url: error.config?.url,
      message: error.message,
      response: error.response?.data
    });

    const isAuthError = error.response?.status === 401 || error.response?.status === 403;
    const isOnAuthPage = window.location.pathname.includes('/login') || window.location.pathname.includes('/register');

    // If it's an auth error (401/403) and we're not on an auth page, redirect to login
    if (isAuthError && !isOnAuthPage) {
      console.log(`Errore di autenticazione (${error.response.status}), reindirizzamento al login`);
      localStorage.removeItem('token');
      window.location.href = '/login';
    } else if (isAuthError && isOnAuthPage) {
      // Log if auth error happens on login/register page, but don't redirect
      console.log(`Errore di autenticazione (${error.response.status}) sulla pagina di login/registrazione, non reindirizzo.`);
    }

    // It's important to reject the promise so subsequent catch blocks can handle the error
    return Promise.reject(error);
  }
);

console.log('Configurazione Axios attiva - BASE_URL:', BASE_URL);

export default BASE_URL;
