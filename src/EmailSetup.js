import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import BASE_URL from './config';

function EmailSetup() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setError('Sessione scaduta. Effettua nuovamente il login.');
        return;
      }

      const response = await axios.post(`${BASE_URL}/api/auth/configure-email`, {
        email
      }, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      setSuccess(response.data.message);
      setEmail('');
    } catch (error) {
      console.error('Errore configurazione email:', error);
      if (error.response?.data?.message) {
        setError(error.response.data.message);
      } else {
        setError('Errore durante la configurazione email');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
      <div className="max-w-md w-full space-y-8 p-8 bg-white dark:bg-gray-800 rounded-lg shadow-lg">
        <div className="text-center">
          <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white">
            🔐 Configura 2FA
          </h1>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            Aggiungi la tua email per abilitare l'autenticazione a due fattori
          </p>
        </div>

        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-blue-700 dark:text-blue-300">
                <strong>Perché il 2FA?</strong> Aumenta significativamente la sicurezza del tuo account richiedendo un codice via email oltre alla password.
              </p>
            </div>
          </div>
        </div>

        {success && (
          <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded" role="alert">
            <span className="block sm:inline">{success}</span>
            <div className="mt-2">
              <Link 
                to="/" 
                className="text-green-800 hover:text-green-900 underline font-medium"
              >
                Torna alla dashboard
              </Link>
            </div>
          </div>
        )}

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded" role="alert">
            <span className="block sm:inline">{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-8 space-y-6">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Indirizzo Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 placeholder-gray-500 dark:placeholder-gray-400 text-gray-900 dark:text-white rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm dark:bg-gray-700"
              placeholder="la-tua-email@esempio.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
            />
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              Riceverai i codici di verifica a questo indirizzo
            </p>
          </div>

          <div>
            <button
              type="submit"
              disabled={loading || !email}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Configurazione...' : 'Configura 2FA'}
            </button>
          </div>

          <div className="text-center">
            <Link 
              to="/" 
              className="text-sm text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 dark:hover:text-indigo-300"
            >
              ← Salta per ora (meno sicuro)
            </Link>
          </div>
        </form>

        <div className="text-xs text-center text-gray-500 dark:text-gray-400 space-y-1">
          <p>🔒 La tua email sarà utilizzata solo per l'invio dei codici OTP</p>
          <p>📧 Potrai cambiarla in qualsiasi momento dalle impostazioni</p>
        </div>
      </div>
    </div>
  );
}

export default EmailSetup;