import React, { useState, useEffect } from 'react';
import axios from 'axios';
import BASE_URL from './config';
import { useNavigate } from 'react-router-dom';

function BudgetSettings() {
  const navigate = useNavigate();
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [isYearly, setIsYearly] = useState(false); // State for yearly mode
  const [budgetSettings, setBudgetSettings] = useState({ spese: {}, entrate: {} });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);

  const mesi = [
    "Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno",
    "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre"
  ];

  const categorieSpese = [
    "Abbigliamento", "Abbonamenti", "Acqua", "Alimentari", "Altre spese", "Bar",
    "Cinema Mostre Cultura", "Elettricità", "Giardinaggio/Agricoltura/Falegnameria",
    "Manutenzione/Arredamento casa", "Mutuo", "Regali", "Ristorante", "Salute",
    "Sport/Attrezzatura sportiva", "Tecnologia", "Vacanza", "Vela"
  ];

  const categorieEntrate = [
    "Altra entrata", "Consulenze", "Interessi", "MBO", "Stipendio", "Ticket", "Welfare"
  ];

  // Fetch data when year or yearly mode changes (or month if not yearly)
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      handleAuthError('Token non trovato. Effettua nuovamente il login.');
      return;
    }
    fetchBudgetSettings();
  }, [selectedYear, selectedMonth, isYearly]); // Add isYearly to dependency array

  const handleAuthError = (message) => {
      setError(message);
      localStorage.removeItem('token');
      // Ritardare il reindirizzamento per consentire all'utente di vedere il messaggio
      setTimeout(() => {
         window.location.href = '/login';
      }, 3000);
  };

  const fetchBudgetSettings = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('token');
      if (!token) throw new Error('Token non trovato per recupero');

      // Determine parameters based on isYearly state
      // Il backend ora si aspetta 'anno' sempre, e 'mese' opzionalmente
      const params = { anno: selectedYear }; 
      if (!isYearly) {
        // Aggiunge il mese solo se siamo in modalità mensile
        params.mese = selectedMonth; 
      } else {
        // Non inviamo 'mese' per la richiesta annuale, il backend cercherà mese: null
      }

      console.log('[FETCH] Recupero impostazioni:', {
        url: `${BASE_URL}/api/budget-settings`,
        params: params,
        mode: isYearly ? 'Yearly' : 'Monthly',
        token: 'presente'
      });

      const response = await axios.get(`${BASE_URL}/api/budget-settings`, {
        params: params, // Invia anno, e mese solo se !isYearly
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      console.log('[FETCH] Risposta ricevuta:', response.data);
      // Inizializza sempre con la struttura corretta, anche se i dati sono vuoti
      setBudgetSettings({
        spese: response.data.spese || {},
        entrate: response.data.entrate || {}
      });

    } catch (error) {
      console.error('[FETCH] Dettagli errore:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status
      });
      
      if (error.response?.status === 401 || error.response?.status === 403) {
        handleAuthError('Sessione scaduta o non valida. Effettua nuovamente il login.');
      } else {
        // Mostra un messaggio più generico ma informativo
        setError(`Errore caricamento: ${error.response?.data?.message || error.message}. Riprova più tardi.`);
      }
       // Assicura che le impostazioni siano vuote in caso di errore
       setBudgetSettings({ spese: {}, entrate: {} });
    } finally {
      setIsLoading(false);
      console.log('[FETCH] Caricamento completato.');
    }
  };

  const handleBudgetChange = (categoria, tipo, valore) => {
    // Permette di svuotare l'input, ma salva 0 se vuoto
    const valoreNumerico = valore === '' ? '' : parseFloat(valore);
    if (valore === '' || !isNaN(valoreNumerico)) { // Accetta stringa vuota o numeri validi
        setBudgetSettings(prev => ({
          ...prev,
          [tipo]: {
            ...prev[tipo],
            [categoria]: valoreNumerico // Salva stringa vuota o numero
          }
        }));
    }
  };

  const salvaBudget = async () => {
    setIsSaving(true);
    setError(null);
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        handleAuthError('Token non trovato per salvataggio. Effettua nuovamente il login.');
        return;
      }

      // Pulisci i dati prima di inviare: converti input vuoti in 0, assicurati che siano numeri
      const cleanSettings = { spese: {}, entrate: {} };
      for (const cat in budgetSettings.spese) {
          const value = parseFloat(budgetSettings.spese[cat]);
          if (!isNaN(value)) {
              cleanSettings.spese[cat] = value;
          } else {
              cleanSettings.spese[cat] = 0; // Imposta a 0 se non è un numero valido o è vuoto
          }
      }
      for (const cat in budgetSettings.entrate) {
          const value = parseFloat(budgetSettings.entrate[cat]);
          if (!isNaN(value)) {
              cleanSettings.entrate[cat] = value;
          } else {
              cleanSettings.entrate[cat] = 0; // Imposta a 0 se non è un numero valido o è vuoto
          }
      }

      // *** CORREZIONE CHIAVE QUI ***
      // Costruisci il payload per il backend
      const dataToSend = {
        anno: selectedYear,
        // Imposta 'mese' a null se isYearly è true, altrimenti usa selectedMonth
        mese: isYearly ? null : selectedMonth, 
        settings: cleanSettings // Usa i dati puliti
      };
      // Rimosso isYearly dal payload, non più necessario

      console.log('[SAVE] Invio dati:', {
        url: `${BASE_URL}/api/budget-settings`,
        data: dataToSend,
        mode: isYearly ? 'Yearly (mese: null)' : `Monthly (mese: ${selectedMonth})`,
        token: 'presente'
      });

      const response = await axios.post(`${BASE_URL}/api/budget-settings`, dataToSend, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      console.log('[SAVE] Risposta salvataggio:', response.data);
      alert('Impostazioni salvate con successo!');
      // Aggiorna lo stato con i dati salvati (potrebbero essere stati puliti/convertiti)
      setBudgetSettings({
        spese: response.data.spese || {},
        entrate: response.data.entrate || {}
      });

    } catch (error) {
      console.error('[SAVE] Dettagli errore salvataggio:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status
      });

      if (error.response?.status === 401 || error.response?.status === 403) {
         handleAuthError('Sessione scaduta o non valida durante il salvataggio. Effettua nuovamente il login.');
      } else {
        // Mostra un messaggio più dettagliato possibile dall'errore del backend
        const backendError = error.response?.data;
        let errorMsg = 'Errore nel salvataggio delle impostazioni. ';
        if (backendError?.message) {
            errorMsg += backendError.message;
        } else {
            errorMsg += error.message;
        }
        if (backendError?.errors) {
            errorMsg += ` Dettagli: ${JSON.stringify(backendError.errors)}`;
        }
        setError(errorMsg + ' Riprova più tardi.');
      }
    } finally {
      setIsSaving(false);
      console.log('[SAVE] Processo di salvataggio terminato.');
    }
  };

  // Funzione per popolare le categorie mancanti con 0 quando si visualizza
  const getDisplayValue = (tipo, categoria) => {
      const value = budgetSettings[tipo]?.[categoria];
      // Mostra stringa vuota se il valore è 0 o non definito, altrimenti il numero
      // Questo permette all'utente di cancellare l'input
      return (value === undefined || value === null || value === 0) ? '' : String(value);
  };

  return (
    <div className="theme-container p-6">
      <h1 className="text-4xl font-bold text-center mb-4 text-indigo-700 dark:text-indigo-300">
        Impostazioni Budget {isYearly ? `Annuale ${selectedYear}` : `${mesi[selectedMonth]} ${selectedYear}`}
      </h1>

      {error && (
        <div className="mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded text-center">
          <p className="font-bold">Errore:</p>
          <p>{error}</p>
        </div>
      )}

      {/* Selettori periodo & Yearly Toggle */}
      <div className="flex justify-center items-center mb-8 gap-4 flex-wrap">
         {/* Yearly Toggle Switch */}
         <div className="flex items-center bg-gray-200 dark:bg-gray-700 rounded-lg p-2 shadow-md">
            <label htmlFor="yearlyToggle" className="mr-2 cursor-pointer text-gray-700 dark:text-gray-300">Budget Mensile</label>
            <button
                id="yearlyToggle"
                onClick={() => setIsYearly(!isYearly)}
                className={`relative inline-flex items-center h-6 rounded-full w-11 transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed ${
                isYearly ? 'bg-indigo-600' : 'bg-gray-400'
                }`}
                disabled={isLoading || isSaving}
            >
                <span
                className={`inline-block w-4 h-4 transform bg-white rounded-full transition-transform duration-200 ease-in-out ${
                    isYearly ? 'translate-x-6' : 'translate-x-1'
                }`}
                />
            </button>
            <label htmlFor="yearlyToggle" className="ml-2 cursor-pointer text-gray-700 dark:text-gray-300">Budget Annuale</label>
         </div>
         
         {/* Month Selector (conditionally rendered) */}
         {!isYearly && (
            <select
            className="px-4 py-2 text-lg bg-white dark:bg-gray-800 border-2 border-blue-300 dark:border-blue-600 rounded-lg shadow-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 hover:border-blue-400 text-gray-800 dark:text-white disabled:opacity-50 disabled:cursor-not-allowed"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
            disabled={isYearly || isLoading || isSaving}
            >
            {mesi.map((mese, index) => (
                <option key={index} value={index}>{mese}</option>
            ))}
            </select>
         )}

        {/* Year Selector */}
        <select
          className="px-4 py-2 text-lg bg-white dark:bg-gray-800 border-2 border-blue-300 dark:border-blue-600 rounded-lg shadow-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 hover:border-blue-400 text-gray-800 dark:text-white disabled:opacity-50 disabled:cursor-not-allowed"
          value={selectedYear}
          onChange={(e) => setSelectedYear(parseInt(e.target.value))}
          disabled={isLoading || isSaving}
        >
          {Array.from({ length: 12 }, (_, i) => new Date().getFullYear() - 5 + i).map(year => (
            <option key={year} value={year}>{year}</option>
          ))}
        </select>
      </div>

      {isLoading ? (
        <div className="flex justify-center items-center py-8">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
          <p className="ml-3 text-gray-600 dark:text-gray-400">Caricamento impostazioni...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Sezione Spese */}
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-lg">
            <h2 className="text-2xl font-bold mb-6 text-red-600 dark:text-red-400">Budget Spese {isYearly ? '(Annuale)' : ''}</h2>
            <div className="space-y-4">
              {categorieSpese.map(categoria => (
                <div key={categoria} className="flex items-center justify-between">
                  <label className="text-gray-700 dark:text-gray-300 flex-1 pr-4">{categoria}</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    value={getDisplayValue('spese', categoria)} // Usa la funzione per visualizzare
                    onChange={(e) => handleBudgetChange(categoria, 'spese', e.target.value)}
                    className="w-32 px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-right"
                    disabled={isSaving}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Sezione Entrate */}
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-lg">
            <h2 className="text-2xl font-bold mb-6 text-green-600 dark:text-green-400">Budget Entrate {isYearly ? '(Annuale)' : ''}</h2>
            <div className="space-y-4">
              {categorieEntrate.map(categoria => (
                <div key={categoria} className="flex items-center justify-between">
                  <label className="text-gray-700 dark:text-gray-300 flex-1 pr-4">{categoria}</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    value={getDisplayValue('entrate', categoria)} // Usa la funzione per visualizzare
                    onChange={(e) => handleBudgetChange(categoria, 'entrate', e.target.value)}
                    className="w-32 px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-right"
                    disabled={isSaving}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Pulsante Salva */}
      {!isLoading && (
          <div className="flex justify-center mt-8">
            <button
              onClick={salvaBudget}
              disabled={isSaving || isLoading}
              className={`px-8 py-4 text-lg font-semibold text-white rounded-lg shadow-lg transition-all duration-200 transform hover:scale-105 ${
                isSaving || isLoading
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              {isSaving ? (
                <>
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white inline" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Salvataggio...
                </>
              ) : (
                `Salva impostazioni ${isYearly ? 'annuali' : 'mensili'}`
              )}
            </button>
          </div>
      )}
    </div>
  );
}

export default BudgetSettings;
