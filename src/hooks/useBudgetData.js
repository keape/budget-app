import { useState, useEffect } from 'react';
import axios from 'axios';
import BASE_URL from '../config';

export const useBudgetData = (meseCorrente, annoCorrente) => {
  const [speseMensili, setSpeseMensili] = useState({});
  const [entrateMensili, setEntrateMensili] = useState({});
  const [budgetSettings, setBudgetSettings] = useState({ spese: {}, entrate: {} });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const mesi = [
    "Intero anno", "Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno",
    "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre"
  ];

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      setError(null);
      setSpeseMensili({});
      setEntrateMensili({});
      setBudgetSettings({ spese: {}, entrate: {} });

      try {
        const token = localStorage.getItem('token');
        if (!token) throw new Error('Token non trovato');

        // Fetch Budget Settings
        if (meseCorrente === 0) {
          // Per "Intero anno", recupera tutti i budget mensili e sommali
          console.log('Recupero budget di tutti i mesi per l\'intero anno', annoCorrente);
          
          // Array per memorizzare le promesse di tutte le richieste mensili
          const budgetPromises = [];
          
          // Crea una richiesta per ogni mese dell'anno (1-12 per mantenere coerenza con il backend)
          for (let mese = 1; mese <= 12; mese++) {
            budgetPromises.push(
              axios.get(`${BASE_URL}/api/budget-settings`, {
                params: { 
                  anno: annoCorrente,
                  mese: mese - 1  // Converte a indice 0-based per il backend
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
          budgetResponses.forEach((response, index) => {
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
          const settingsResponse = await axios.get(`${BASE_URL}/api/budget-settings`, {
            params: { 
              anno: annoCorrente,
              mese: meseCorrente - 1
            },
            headers: { 'Authorization': `Bearer ${token}` }
          });
          
          console.log('Risposta impostazioni mensili:', settingsResponse.data);
          setBudgetSettings(settingsResponse.data || { spese: {}, entrate: {} });
        }

        // Fetch Transactions
        const [speseResponse, entrateResponse] = await Promise.all([
          axios.get(`${BASE_URL}/api/spese`, {
              params: { page: 1, limit: 10000 },
              headers: { 'Authorization': `Bearer ${token}` }
           }),
          axios.get(`${BASE_URL}/api/entrate`, {
              params: { page: 1, limit: 10000 },
              headers: { 'Authorization': `Bearer ${token}` }
           })
        ]);

        const allSpese = speseResponse.data.spese || [];
        const allEntrate = entrateResponse.data.entrate || [];
        console.log(`Recuperate ${allSpese.length} spese e ${allEntrate.length} entrate.`);

        // Filter Transactions by Selected Month or Year
        const filterByPeriod = (t) => {
          const data = new Date(t.data);
          const transactionMonth = data.getMonth();
          const transactionYear = data.getFullYear();
          
          // Se "Intero anno" è selezionato, filtra solo per anno
          if (meseCorrente === 0) {
            return transactionYear === annoCorrente;
          }
          
          // Altrimenti filtra per mese e anno specifici
          return transactionMonth === (meseCorrente - 1) && transactionYear === annoCorrente;
        };

        const speseFiltrate = allSpese.filter(filterByPeriod);
        const entrateFiltrate = allEntrate.filter(filterByPeriod);
        console.log(`Filtrate a ${speseFiltrate.length} spese e ${entrateFiltrate.length} entrate per il periodo.`);
        
        // 🔍 DEBUG: Log dettagliato per febbraio
        if (meseCorrente === 2) { // Febbraio
          console.log('🔍 DEBUG FEBBRAIO - Tutte le entrate:', allEntrate.length);
          console.log('🔍 DEBUG FEBBRAIO - Entrate febbraio filtrate:', entrateFiltrate.length);
          console.log('🔍 DEBUG FEBBRAIO - Campione entrate non filtrate:', allEntrate.slice(0, 3).map(e => ({
            categoria: e.categoria,
            importo: e.importo,
            data: e.data,
            parsedMonth: new Date(e.data).getMonth(),
            parsedYear: new Date(e.data).getFullYear()
          })));
          if (entrateFiltrate.length > 0) {
            console.log('🔍 DEBUG FEBBRAIO - Campione entrate filtrate:', entrateFiltrate.slice(0, 3));
          }
        }

        // Aggregate Filtered Transactions
        const aggregateByCategory = (transactions) =>
            transactions.reduce((acc, t) => {
                // Per le spese, usiamo il valore assoluto per visualizzarle correttamente nel grafico
                acc[t.categoria] = (acc[t.categoria] || 0) + Math.abs(t.importo);
                return acc;
            }, {});

        const speseAggregated = aggregateByCategory(speseFiltrate);
        const entrateAggregated = aggregateByCategory(entrateFiltrate);
        
        setSpeseMensili(speseAggregated);
        setEntrateMensili(entrateAggregated);
        
        // 🔍 DEBUG: Log aggregazione per febbraio
        if (meseCorrente === 2) {
          console.log('🔍 DEBUG FEBBRAIO - Spese aggregate:', speseAggregated);
          console.log('🔍 DEBUG FEBBRAIO - Entrate aggregate:', entrateAggregated);
        }
        
        console.log('Aggregazione completata.');

      } catch (error) {
        console.error('Errore durante il caricamento dei dati del budget:', error);
        if (error.response?.status === 401 || error.response?.status === 403) {
             localStorage.removeItem('token');
             window.location.href = '/login';
        }
        if (Object.keys(budgetSettings.spese).length === 0 && Object.keys(budgetSettings.entrate).length === 0) {
            setError('Errore caricamento impostazioni budget.');
        } else {
            setError('Errore caricamento transazioni.');
        }
        setSpeseMensili({});
        setEntrateMensili({});
        setBudgetSettings({ spese: {}, entrate: {} });
      } finally {
        setIsLoading(false);
        console.log('Processo di recupero dati terminato. Caricamento impostato a false.');
      }
    };

    fetchData();
  }, [meseCorrente, annoCorrente]);

  return {
    speseMensili,
    entrateMensili,
    budgetSettings,
    isLoading,
    error,
    mesi
  };
};