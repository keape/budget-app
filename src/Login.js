import React, { useCallback, useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import BASE_URL from './config';
import GoogleSignInButton from './components/GoogleSignInButton';

function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [socialLoading, setSocialLoading] = useState(false);
  const navigate = useNavigate();

  // Verifica se l'utente è già autenticato
  useEffect(() => {
    try {
      const token = localStorage.getItem('token');
      if (token) {
        navigate('/');
      }
    } catch (error) {
      console.error('Errore nel controllo del token:', error);
    }
  }, [navigate]);

  // Salva il JWT e entra nell'app: stesso percorso per login con password e social login.
  const finishLogin = useCallback((token) => {
    try {
      localStorage.setItem('token', token);
      if (localStorage.getItem('token') !== token) {
        // Se il token non è stato salvato correttamente nel localStorage
        console.warn('Token non salvato in localStorage, provo a procedere comunque...');
      }
    } catch (storageError) {
      console.error('Errore nel salvataggio del token:', storageError);
      // Anche se c'è un errore nel salvare il token, proviamo a procedere
    }
    navigate('/');
  }, [navigate]);

  // Il token Google viene verificato dal backend (`/api/auth/social-login`), che restituisce
  // il JWT di sessione già usato dal login con password.
  const handleGoogleCredential = useCallback(async (idToken) => {
    setError('');
    setSocialLoading(true);
    try {
      const response = await axios.post(`${BASE_URL}/api/auth/social-login`, {
        provider: 'google',
        idToken
      });

      if (response.data?.token) {
        finishLogin(response.data.token);
      } else {
        setError('Token non ricevuto dal server');
      }
    } catch (googleError) {
      console.error('Errore login Google:', googleError.response?.data || googleError.message);
      if (googleError.response) {
        setError(googleError.response.data.message || 'Accesso con Google non riuscito');
      } else if (googleError.request) {
        setError('Errore di connessione al server');
      } else {
        setError('Accesso con Google non riuscito');
      }
    } finally {
      setSocialLoading(false);
    }
  }, [finishLogin]);

  const handleSocialError = useCallback((message) => setError(message), []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    
    console.log('🔐 LOGIN START per username:', username);
    console.log('🔐 LOGIN URL backend:', BASE_URL);
    
    try {
      console.log('🔐 LOGIN invio richiesta...');
      // Removed { withCredentials: true } from the request
      const response = await axios.post(`${BASE_URL}/api/auth/login`, {
        username,
        password
      });
      
      console.log('🔐 LOGIN risposta ricevuta:', {
        status: response.status,
        hasToken: !!response.data.token,
        tokenLength: response.data.token?.length
      });
      
      if (response.data.token) {
        finishLogin(response.data.token);
      } else {
        setError('Token non ricevuto dal server');
      }
    } catch (error) {
      console.error('🔐 LOGIN ERROR:', {
        message: error.message,
        status: error.response?.status,
        responseData: error.response?.data,
        hasResponse: !!error.response,
        hasRequest: !!error.request,
        isNetworkError: !error.response,
        url: error.config?.url
      });
      
      if (error.response) {
        setError(error.response.data.message || 'Credenziali non valide');
      } else if (error.request) {
        setError('Errore di connessione al server');
      } else {
        setError('Errore durante il login');
      }
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
      <div className="max-w-md w-full space-y-8 p-8 bg-white dark:bg-gray-800 rounded-lg shadow-lg">
        <div>
          <h1 className="mt-6 text-center text-3xl font-extrabold text-gray-900 dark:text-white" id="login-title">
            Accedi al tuo account
          </h1>
        </div>
        {error && (
          <div 
            className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded"
            role="alert"
            aria-live="polite"
          >
            <span className="block sm:inline">{error}</span>
          </div>
        )}
        <form className="mt-8 space-y-6" onSubmit={handleSubmit} aria-labelledby="login-title" noValidate>
          <div className="rounded-md shadow-sm -space-y-px">
            <div>
              <label htmlFor="username" className="sr-only">Username</label>
              <input
                id="username"
                name="username"
                type="text"
                autoComplete="username"
                required
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 placeholder-gray-500 dark:placeholder-gray-400 text-gray-900 dark:text-white rounded-t-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm dark:bg-gray-700"
                placeholder="Username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                aria-describedby="username-help"
                aria-invalid={!!error}
              />
              <div id="username-help" className="sr-only">
                Inserisci il tuo nome utente
              </div>
            </div>
            <div>
              <label htmlFor="password" className="sr-only">Password</label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 placeholder-gray-500 dark:placeholder-gray-400 text-gray-900 dark:text-white rounded-b-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm dark:bg-gray-700"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                aria-describedby="password-help"
                aria-invalid={!!error}
              />
              <div id="password-help" className="sr-only">
                Inserisci la tua password
              </div>
            </div>
          </div>

          {error && (
            <div className="text-red-500 text-sm text-center">{error}</div>
          )}

          <div>
            <button
              type="submit"
              disabled={socialLoading}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              Accedi
            </button>
          </div>

          <div className="relative">
            <div className="absolute inset-0 flex items-center" aria-hidden="true">
              <div className="w-full border-t border-gray-300 dark:border-gray-600" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400">oppure</span>
            </div>
          </div>

          <GoogleSignInButton
            onCredential={handleGoogleCredential}
            onError={handleSocialError}
            disabled={socialLoading}
          />

          {socialLoading && (
            <p className="text-sm text-center text-gray-500 dark:text-gray-400" role="status" aria-live="polite">
              Accesso in corso…
            </p>
          )}

          <div className="text-sm text-center space-y-2">
            <Link to="/register" className="font-medium text-indigo-600 hover:text-indigo-500 block">
              Non hai un account? Registrati
            </Link>
            <Link to="/forgot-password" className="font-medium text-indigo-600 hover:text-indigo-500 block">
              Password dimenticata?
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}

export default Login;