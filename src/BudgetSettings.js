import React, { useState, useEffect } from 'react';
import axios from 'axios';
import BASE_URL from './config';
import { useNavigate } from 'react-router-dom';

function BudgetSettings() {
  const navigate = useNavigate();
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [budgetSettings, setBudgetSettings] = useState({ spese: {}, entrate: {} });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isCopying, setIsCopying] = useState(false);
  const [error, setError] = useState(null);

  const mesi = [
    "Intero anno", "Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno",
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

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      handleAuthError('Token non trovato. Effettua nuovamente il login.');
      return;
    }
    fetchBudgetSettings();
  }, [selectedYear, selectedMonth]);

  const handleAuthError = (message) => {
      setError(message);
      localStorage.removeItem('token');
      window.location.href = '/login';
  };

  const fetchBudgetSettings = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('token');
      if (!token) throw new Error('Token non trovato');

      // Per "Intero anno", recupera tutti i budget mensili e sommali
      if (selectedMonth === 0) {
        console.log('Recupero budget di tutti i mesi per l\'intero anno', selectedYear);
        
        // Array per memorizzare le promesse di tutte le richieste mensili
        const budgetPromises = [];
        
        // Crea una richiesta per ogni mese dell'anno
        for (let mese = 0; mese < 12; mese++) {
          budgetPromises.push(
            axios.get(`${BASE_URL}/api/budget-settings`, {
              params: { 
                anno: selectedYear,
                mese: mese
              },
              headers: { 'Authorization': `Bearer ${token}` }
            })
          );
        }
        
        // Esegui tutte le richieste in parallelo
        const budgetResponses = await Promise.all(budgetPromises);
        
        // Inizializza oggetti per accumulare i budget
        const budgetAnnuale = {
          spese: {},
          entrate: {}
        };
        
        // Somma i budget di tutti i mesi
        budgetResponses.forEach((response) => {
          const budgetMensile = response.data || { spese: {}, entrate: {} };
          
          // Somma le spese
          Object.entries(budgetMensile.spese || {}).forEach(([categoria, importo]) => {
            budgetAnnuale.spese[categoria] = (budgetAnnuale.spese[categoria] || 0) + importo;
          });
          
          // Somma le entrate
          Object.entries(budgetMensile.entrate || {}).forEach(([categoria, importo]) => {
            budgetAnnuale.entrate[categoria] = (budgetAnnuale.entrate[categoria] || 0) + importo;
          });
        });
        
        console.log('Budget annuale calcolato:', budgetAnnuale);
        setBudgetSettings(budgetAnnuale);
      } else {
        // Per un mese specifico, recupera solo il budget di quel mese
        const params = { 
          anno: selectedYear,
          mese: selectedMonth - 1 // Invia null per "Intero anno"
        };

        console.log('Recupero impostazioni:', {
          url: `${BASE_URL}/api/budget-settings`,
          params: params,
          token: 'presente'
        });

        const response = await axios.get(`${BASE_URL}/api/budget-settings`, {
          params: params,
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });

        console.log('Risposta ricevuta:', response.data);
        setBudgetSettings({
          spese: response.data.spese || {},
          entrate: response.data.entrate || {}
        });
      }
    } catch (error) {
      console.error('Dettagli errore:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status
      });
      
      if (error.response?.status === 401 || error.response?.status === 403) {
        handleAuthError('Sessione scaduta o non valida. Effettua nuovamente il login.');
      } else {
        setError('Errore nel caricamento delle impostazioni del budget. Riprova più tardi.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleBudgetChange = (categoria, tipo, valore) => {
    setBudgetSettings(prev => ({
      ...prev,
      [tipo]: {
        ...prev[tipo],
        [categoria]: valore === '' ? 0 : parseFloat(valore)
      }
    }));
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

      // Se è selezionato "Intero anno", salva le impostazioni per tutti i mesi
      if (selectedMonth === 0) {
        // Salva le stesse impostazioni per ogni mese
        for (let mese = 0; mese < 12; mese++) {
          const dataToSend = {
            anno: selectedYear,
            mese: mese,
            settings: {
              spese: budgetSettings.spese || {},
              entrate: budgetSettings.entrate || {}
            }
          };

          await axios.post(`${BASE_URL}/api/budget-settings`, dataToSend, {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          });
        }

        alert('Impostazioni salvate con successo per tutti i mesi!');
      } else {
        // Salva le impostazioni solo per il mese selezionato
        const dataToSend = {
          anno: selectedYear,
          mese: selectedMonth - 1,
          settings: {
            spese: budgetSettings.spese || {},
            entrate: budgetSettings.entrate || {}
          }
        };

        console.log('Invio dati:', {
          url: `${BASE_URL}/api/budget-settings`,
          data: dataToSend,
          token: 'presente'
        });

        const response = await axios.post(`${BASE_URL}/api/budget-settings`, dataToSend, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });

        console.log('Risposta salvataggio:', response.data);
        alert('Impostazioni salvate con successo!');
        setBudgetSettings({
          spese: response.data.spese || {},
          entrate: response.data.entrate || {}
        });
      }
    } catch (error) {
      console.error('Dettagli errore salvataggio:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status
      });

      if (error.response?.status === 401 || error.response?.status === 403) {
         handleAuthError('Sessione scaduta o non valida durante il salvataggio. Effettua nuovamente il login.');
      } else {
        setError('Errore nel salvataggio delle impostazioni. Riprova più tardi.');
      }
    } finally {
      setIsSaving(false);
    }
  };

  const copiaDaMesePrecedente = async () => {
    // Non fare nulla se è selezionato "Intero anno" o se è Gennaio (non c'è mese precedente nello stesso anno)
    if (selectedMonth === 0 || selectedMonth === 1) {
      alert('Non è possibile copiare i valori per questa selezione');
      return;
    }

    setIsCopying(true);
    setError(null);
    
    try {
      const token = localStorage.getItem('token');
      if (!token) throw new Error('Token non trovato');

      // Calcola il mese precedente
      const mesePrecedente = selectedMonth - 1;
      
      // Recupera le impostazioni del mese precedente
      const response = await axios.get(`${BASE_URL}/api/budget-settings`, {
        params: { 
          anno: selectedYear,
          mese: mesePrecedente - 1 // Indice 0-based per l'API
        },
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      // Imposta i valori del mese precedente nel mese corrente
      setBudgetSettings({
        spese: response.data.spese || {},
        entrate: response.data.entrate || {}
      });

      alert(`Valori copiati con successo da ${mesi[mesePrecedente]} a ${mesi[selectedMonth]}!`);
    } catch (error) {
      console.error('Errore durante la copia dei valori:', error);
      
      if (error.response?.status === 401 || error.response?.status === 403) {
        handleAuthError('Sessione scaduta o non valida. Effettua nuovamente il login.');
      } else {
        setError('Errore durante la copia dei valori. Riprova più tardi.');
      }
    } finally {
      setIsCopying(false);
    }
  };

  return (
    <div className="theme-container p-6">
      <h1 className="text-4xl font-bold text-center mb-4 text-indigo-700 dark:text-indigo-300">
        Impostazioni Budget {selectedMonth === 0 ? 'Intero anno' : mesi[selectedMonth]} {selectedYear}
      </h1>

      {error && (
        <div className="mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded">
          {error}
        </div>
      )}

      {/* Selettori periodo */}
      <div className="flex justify-center items-center mb-8 gap-4 flex-wrap">
        <select
          className="w-full px-6 py-4 text-lg bg-white dark:bg-gray-700 border-2 border-blue-300 dark:border-blue-600 rounded-lg shadow-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 hover:border-blue-400 text-gray-800 dark:text-white"
          value={selectedMonth}
          onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
        >
          {mesi.map((mese, index) => (
            <option key={index} value={index}>{mese}</option>
          ))}
        </select>
        <select
          className="w-full px-6 py-4 text-lg bg-white dark:bg-gray-700 border-2 border-blue-300 dark:border-blue-600 rounded-lg shadow-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 hover:border-blue-400 text-gray-800 dark:text-white"
          value={selectedYear}
          onChange={(e) => setSelectedYear(parseInt(e.target.value))}
        >
          {Array.from({ length: 12 }, (_, i) => new Date().getFullYear() - 5 + i).map(year => (
            <option key={year} value={year}>{year}</option>
          ))}
        </select>
        
        {/* Nuovo bottone per copiare dal mese precedente */}
        {selectedMonth > 0 && selectedMonth !== 1 && (
          <button
            onClick={copiaDaMesePrecedente}
            disabled={isCopying || isLoading}
            className={`w-full px-6 py-4 text-lg font-semibold text-white rounded-lg shadow-md transition-all duration-200 ${isCopying || isLoading
              ? 'bg-gray-400 cursor-not-allowed'
              : 'bg-purple-600 hover:bg-purple-700 hover:scale-105'
            }`}
          >
            {isCopying ? 'Copia in corso...' : `Copia valori da ${mesi[selectedMonth-1]}`}
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="flex justify-center items-center py-8">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Sezione Spese */}
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-lg">
            <h2 className="text-2xl font-bold mb-6 text-red-600 dark:text-red-400">Budget Spese</h2>
            <div className="space-y-4">
              {categorieSpese.map(categoria => (
                <div key={categoria} className="flex items-center justify-between">
                  <label className="text-gray-700 dark:text-gray-300">{categoria}</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={budgetSettings.spese?.[categoria] ?? ''}
                    onChange={(e) => handleBudgetChange(categoria, 'spese', e.target.value)}
                    className="w-32 px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Sezione Entrate */}
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-lg">
            <h2 className="text-2xl font-bold mb-6 text-green-600 dark:text-green-400">Budget Entrate</h2>
            <div className="space-y-4">
              {categorieEntrate.map(categoria => (
                <div key={categoria} className="flex items-center justify-between">
                  <label className="text-gray-700 dark:text-gray-300">{categoria}</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={budgetSettings.entrate?.[categoria] ?? ''}
                    onChange={(e) => handleBudgetChange(categoria, 'entrate', e.target.value)}
                    className="w-32 px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Pulsante Salva */}
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
          {isSaving ? 'Salvataggio in corso...' : 'Salva impostazioni'}
        </button>
      </div>
    </div>
  );
}

export default BudgetSettings;