import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import BASE_URL from './config';

function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    
    try {
      // Removed { withCredentials: true } from the request
      const response = await axios.post(`${BASE_URL}/api/auth/login`, {
        username,
        password
      });
      
      if (response.data.token) {
        try {
          localStorage.setItem('token', response.data.token);
          
          // Verifica che il token sia stato effettivamente salvato
          const savedToken = localStorage.getItem('token');
          if (savedToken === response.data.token) {
            navigate('/');
          } else {
            // Se il token non è stato salvato correttamente nel localStorage
            console.warn('Token non salvato in localStorage, provo a procedere comunque...');
            navigate('/');
          }
        } catch (storageError) {
          console.error('Errore nel salvataggio del token:', storageError);
          // Anche se c'è un errore nel salvare il token, proviamo a procedere
          navigate('/');
        }
      } else {
        setError('Token non ricevuto dal server');
      }
    } catch (error) {
      console.error('Errore di login:', error);
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
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900 dark:text-white">
            Accedi al tuo account
          </h2>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="rounded-md shadow-sm -space-y-px">
            <div>
              <label htmlFor="username" className="sr-only">Username</label>
              <input
                id="username"
                name="username"
                type="text"
                required
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 placeholder-gray-500 dark:placeholder-gray-400 text-gray-900 dark:text-white rounded-t-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm dark:bg-gray-700"
                placeholder="Username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="password" className="sr-only">Password</label>
              <input
                id="password"
                name="password"
                type="password"
                required
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 placeholder-gray-500 dark:placeholder-gray-400 text-gray-900 dark:text-white rounded-b-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm dark:bg-gray-700"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          {error && (
            <div className="text-red-500 text-sm text-center">{error}</div>
          )}

          <div>
            <button
              type="submit"
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              Accedi
            </button>
          </div>

          <div className="text-sm text-center">
            <Link to="/register" className="font-medium text-indigo-600 hover:text-indigo-500">
              Non hai un account? Registrati
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}

export default Login;