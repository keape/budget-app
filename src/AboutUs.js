import React, { useState } from 'react';
import axios from 'axios';
import BASE_URL from './config';

function AboutUs() {
  const [formData, setFormData] = useState({
    nome: '',
    email: '',
    messaggio: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitMessage, setSubmitMessage] = useState('');
  const [submitError, setSubmitError] = useState('');

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.nome || !formData.email || !formData.messaggio) {
      setSubmitError('Per favore compila tutti i campi');
      return;
    }

    setIsSubmitting(true);
    setSubmitError('');
    setSubmitMessage('');

    try {
      const token = localStorage.getItem('token');
      
      // Simula invio messaggio (sostituire con endpoint reale se necessario)
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      setSubmitMessage('Messaggio inviato con successo! Ti risponderemo al più presto.');
      setFormData({ nome: '', email: '', messaggio: '' });
    } catch (error) {
      console.error('Errore nell\'invio del messaggio:', error);
      setSubmitError('Errore nell\'invio del messaggio. Riprova più tardi.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-4xl font-bold text-center mb-8 text-gray-800 dark:text-white">
        📋 About Us
      </h1>

      {/* Sezione Descrizione App */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8 mb-8">
        <h2 className="text-2xl font-bold mb-6 text-indigo-600 dark:text-indigo-400 flex items-center">
          <span className="mr-3">💰</span>
          Cos'è Budget App?
        </h2>
        
        <div className="prose dark:prose-invert max-w-none">
          <p className="text-lg text-gray-700 dark:text-gray-300 mb-6 leading-relaxed">
            Budget App è la tua soluzione completa per la gestione delle finanze personali. 
            Progettata per essere semplice ma potente, ti aiuta a tenere traccia delle tue 
            entrate e spese in modo intuitivo e organizzato.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <div className="bg-green-50 dark:bg-green-900/20 p-6 rounded-lg border-l-4 border-green-500">
              <h3 className="text-lg font-semibold text-green-800 dark:text-green-200 mb-3 flex items-center">
                <span className="mr-2">📊</span>
                Dashboard Completa
              </h3>
              <p className="text-gray-700 dark:text-gray-300">
                Visualizza immediatamente il tuo bilancio giornaliero, settimanale e mensile. 
                Analizza le tue categorie di spesa più utilizzate e monitora le ultime transazioni.
              </p>
            </div>

            <div className="bg-blue-50 dark:bg-blue-900/20 p-6 rounded-lg border-l-4 border-blue-500">
              <h3 className="text-lg font-semibold text-blue-800 dark:text-blue-200 mb-3 flex items-center">
                <span className="mr-2">💸</span>
                Gestione Transazioni
              </h3>
              <p className="text-gray-700 dark:text-gray-300">
                Inserisci facilmente spese ed entrate con categorie personalizzabili. 
                Crea transazioni ricorrenti per abbonamenti e pagamenti periodici.
              </p>
            </div>

            <div className="bg-purple-50 dark:bg-purple-900/20 p-6 rounded-lg border-l-4 border-purple-500">
              <h3 className="text-lg font-semibold text-purple-800 dark:text-purple-200 mb-3 flex items-center">
                <span className="mr-2">🔍</span>
                Filtri e Ricerche
              </h3>
              <p className="text-gray-700 dark:text-gray-300">
                Trova rapidamente le transazioni che cerchi con filtri avanzati per data, 
                categoria, importo e descrizione. Esporta i dati per ulteriori analisi.
              </p>
            </div>

            <div className="bg-orange-50 dark:bg-orange-900/20 p-6 rounded-lg border-l-4 border-orange-500">
              <h3 className="text-lg font-semibold text-orange-800 dark:text-orange-200 mb-3 flex items-center">
                <span className="mr-2">⚙️</span>
                Budget e Categorie
              </h3>
              <p className="text-gray-700 dark:text-gray-300">
                Imposta budget mensili per ogni categoria di spesa. Crea e personalizza 
                le tue categorie per adattarle al tuo stile di vita.
              </p>
            </div>
          </div>

          <div className="bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 p-6 rounded-lg">
            <h3 className="text-xl font-semibold text-indigo-800 dark:text-indigo-200 mb-4 flex items-center">
              <span className="mr-2">🎯</span>
              I Nostri Obiettivi
            </h3>
            <ul className="space-y-2 text-gray-700 dark:text-gray-300">
              <li className="flex items-start">
                <span className="text-green-500 mr-2 mt-1">✓</span>
                Rendere la gestione finanziaria semplice e accessibile a tutti
              </li>
              <li className="flex items-start">
                <span className="text-green-500 mr-2 mt-1">✓</span>
                Fornire strumenti potenti senza complessità inutili
              </li>
              <li className="flex items-start">
                <span className="text-green-500 mr-2 mt-1">✓</span>
                Aiutare gli utenti a raggiungere i loro obiettivi finanziari
              </li>
              <li className="flex items-start">
                <span className="text-green-500 mr-2 mt-1">✓</span>
                Garantire sicurezza e privacy dei dati personali
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Sezione Form Contatti */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8">
        <h2 className="text-2xl font-bold mb-6 text-indigo-600 dark:text-indigo-400 flex items-center">
          <span className="mr-3">✉️</span>
          Contattaci
        </h2>
        
        <p className="text-gray-700 dark:text-gray-300 mb-6">
          Hai domande, suggerimenti o hai riscontrato problemi? Scrivici! 
          Il tuo feedback è prezioso per migliorare continuamente Budget App.
        </p>

        {submitMessage && (
          <div className="mb-6 p-4 bg-green-100 dark:bg-green-900/20 border border-green-400 dark:border-green-600 text-green-700 dark:text-green-300 rounded-lg">
            {submitMessage}
          </div>
        )}

        {submitError && (
          <div className="mb-6 p-4 bg-red-100 dark:bg-red-900/20 border border-red-400 dark:border-red-600 text-red-700 dark:text-red-300 rounded-lg">
            {submitError}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label htmlFor="nome" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Nome *
              </label>
              <input
                type="text"
                id="nome"
                name="nome"
                value={formData.nome}
                onChange={handleInputChange}
                required
                className="w-full px-4 py-3 bg-white dark:bg-gray-700 border-2 border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200 text-gray-800 dark:text-white"
                placeholder="Il tuo nome"
              />
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Email *
              </label>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                required
                className="w-full px-4 py-3 bg-white dark:bg-gray-700 border-2 border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200 text-gray-800 dark:text-white"
                placeholder="la-tua-email@example.com"
              />
            </div>
          </div>

          <div>
            <label htmlFor="messaggio" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Messaggio *
            </label>
            <textarea
              id="messaggio"
              name="messaggio"
              value={formData.messaggio}
              onChange={handleInputChange}
              required
              rows={6}
              className="w-full px-4 py-3 bg-white dark:bg-gray-700 border-2 border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200 text-gray-800 dark:text-white resize-vertical"
              placeholder="Scrivi qui il tuo messaggio, feedback o domanda..."
            />
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={isSubmitting}
              className={`px-8 py-3 text-lg font-semibold text-white rounded-lg shadow-lg transition-all duration-200 transform hover:scale-105 ${
                isSubmitting 
                  ? 'bg-gray-400 cursor-not-allowed' 
                  : 'bg-indigo-600 hover:bg-indigo-700'
              }`}
            >
              {isSubmitting ? (
                <span className="flex items-center">
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Invio in corso...
                </span>
              ) : (
                '📤 Invia Messaggio'
              )}
            </button>
          </div>
        </form>

        <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-center">
            <div className="flex flex-col items-center">
              <div className="text-2xl mb-2">⚡</div>
              <h4 className="font-semibold text-gray-800 dark:text-white">Risposta Rapida</h4>
              <p className="text-sm text-gray-600 dark:text-gray-400">Ti risponderemo entro 24 ore</p>
            </div>
            <div className="flex flex-col items-center">
              <div className="text-2xl mb-2">🔒</div>
              <h4 className="font-semibold text-gray-800 dark:text-white">Privacy Garantita</h4>
              <p className="text-sm text-gray-600 dark:text-gray-400">I tuoi dati sono al sicuro</p>
            </div>
            <div className="flex flex-col items-center">
              <div className="text-2xl mb-2">💡</div>
              <h4 className="font-semibold text-gray-800 dark:text-white">Feedback Prezioso</h4>
              <p className="text-sm text-gray-600 dark:text-gray-400">Ogni suggerimento conta</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AboutUs;