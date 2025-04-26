import axios from 'axios';

// URL del backend su Render
const BASE_URL = 'https://budget-app-ao5r.onrender.com';

// Debug log per il token
const getAuthToken = () => {
  try {
    const token = localStorage.getItem('token');
    console.log('Token recuperato:', token ? 'presente' : 'mancante');
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

// Configurazione di axios per includere il token in tutte le richieste
// TEMPORARILY COMMENTED OUT FOR DEBUGGING VERCEL BUILD ERROR
/*
axios.interceptors.request.use(
  (config) => {
    // Skip auth token check for login and register endpoints
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
      console.error('Errore nella configurazione della richiesta:', error);
      return Promise.reject(error); 
    }
  }, 
  (error) => {
    console.error('Errore nell'interceptor della richiesta:', error);
    return Promise.reject(error);
  }
);
*/

// Define the success handler for the response interceptor
const handleResponseSuccess = (response) => {
  // console.log('Risposta ricevuta:', { // Less noisy logging
  //   status: response.status,
  //   url: response.config.url,
  //   data: response.data
  // });
  return response;
};

// Define the error handler for the response interceptor
const handleResponseError = (error) => {
  console.error('Errore nella risposta:', {
    status: error.response?.status,
    url: error.config?.url,
    message: error.message,
    response: error.response?.data
  });
  
  // Check for both 401 (Unauthorized) and 403 (Forbidden) as auth errors
  const isAuthError = error.response?.status === 401 || error.response?.status === 403;
  // Avoid redirect loop if already on login/register
  const isOnAuthPage = window.location.pathname.includes('/login') || window.location.pathname.includes('/register');

  if (isAuthError && !isOnAuthPage) {
    console.log(`Errore di autenticazione (${error.response.status}), reindirizzamento al login`);
    localStorage.removeItem('token');
    window.location.href = '/login'; 
  } else if (isAuthError && isOnAuthPage) {
     console.log(`Errore di autenticazione (${error.response.status}) sulla pagina di login/registrazione, non reindirizzo.`);
     // Optionally display an error message to the user on the login page itself
  }
  
  return Promise.reject(error);
};

// Apply the interceptor using the defined handlers
axios.interceptors.response.use(handleResponseSuccess, handleResponseError);


console.log('Configurazione attiva - BASE_URL:', BASE_URL);

export default BASE_URL;