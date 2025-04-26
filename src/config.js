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

// Configurazione di axios per includere il token in tutte le richieste
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
      // If token is null (meaning getAuthToken handled potential redirect),
      // let the request proceed. The server will likely reject it, 
      // and the response interceptor will handle the final redirect if needed.
      return config;
    } catch (error) {
      // Catch potential errors during token retrieval itself
      console.error('Errore nella configurazione della richiesta (token retrieval):', error);
      // Reject the promise to prevent the request from being sent without proper auth attempt
      return Promise.reject(error); 
    }
  },
  (error) => {
    // Handle errors in setting up the request interceptor
    console.error('Errore nell'interceptor della richiesta (setup):', error);
    return Promise.reject(error);
  }
);


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