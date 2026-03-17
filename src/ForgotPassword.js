import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import BASE_URL from './config';

function ForgotPassword() {
  const [username, setUsername] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [resetToken, setResetToken] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setIsLoading(true);
    
    try {
      const response = await axios.post(`${BASE_URL}/api/auth/forgot-password`, {
        username
      });
      
      setMessage(response.data.message);
      // Solo per sviluppo - rimuovi in produzione
      if (response.data.resetToken) {
        setResetToken(response.data.resetToken);
      }
    } catch (error) {
      setError(error.response?.data?.message || 'Errore durante la richiesta di reset');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
      <div className="max-w-md w-full space-y-8 p-8 bg-white dark:bg-gray-800 rounded-lg shadow-lg">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900 dark:text-white">
            Recupera Password
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600 dark:text-gray-400">
            Inserisci il tuo username per ricevere le istruzioni di reset
          </p>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div>
            <label htmlFor="username" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Username
            </label>
            <input
              id="username"
              name="username"
              type="text"
              required
              className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 placeholder-gray-500 dark:placeholder-gray-400 text-gray-900 dark:text-white rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm dark:bg-gray-700"
              placeholder="Il tuo username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>

          {error && (
            <div className="text-red-500 text-sm text-center">{error}</div>
          )}
          
          {message && (
            <div className="text-green-500 text-sm text-center">{message}</div>
          )}
          
          {resetToken && (
            <div className="bg-yellow-100 dark:bg-yellow-900 border border-yellow-400 text-yellow-700 dark:text-yellow-300 px-4 py-3 rounded text-sm">
              <strong>Token di reset (solo per sviluppo):</strong><br/>
              <code className="break-all">{resetToken}</code><br/>
              <Link to={`/reset-password?token=${resetToken}`} className="text-indigo-600 hover:text-indigo-500">
                Clicca qui per reimpostare la password
              </Link>
            </div>
          )}

          <div className="flex space-x-4">
            <Link
              to="/login"
              className="flex-1 text-center py-2 px-4 border border-gray-300 rounded-md text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              Torna al Login
            </Link>
            <button
              type="submit"
              disabled={isLoading}
              className="flex-1 py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
            >
              {isLoading ? 'Inviando...' : 'Invia Richiesta'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default ForgotPassword;