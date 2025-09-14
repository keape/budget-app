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
          
          // Esegui tutte le richieste in parallelo con gestione errori
          const budgetResponses = await Promise.allSettled(budgetPromises);
          
          // Inizializza oggetti per accumulare i budget
          const budgetAnnuale = {
            spese: {},
            entrate: {}
          };
          
          // Variabili per diagnostica
          let mesiConBudget = 0;
          let dettagliBudgetMensili = [];
          
          // Somma i budget di tutti i mesi (gestendo errori individuali)
          budgetResponses.forEach((result, index) => {
            if (result.status === 'fulfilled') {
              const budgetMensile = result.value?.data || { spese: {}, entrate: {} };
              
              // Diagnostica: conta mesi con budget e salva dettagli
              if (Object.keys(budgetMensile.spese || {}).length > 0 || Object.keys(budgetMensile.entrate || {}).length > 0) {
                mesiConBudget++;
                dettagliBudgetMensili.push({
                  mese: index + 1,
                  spese: budgetMensile.spese || {},
                  entrate: budgetMensile.entrate || {}
                });
              }
              
              // Somma le spese
              Object.entries(budgetMensile.spese || {}).forEach(([categoria, importo]) => {
                budgetAnnuale.spese[categoria] = (budgetAnnuale.spese[categoria] || 0) + importo;
              });
              
              // Somma le entrate
              Object.entries(budgetMensile.entrate || {}).forEach(([categoria, importo]) => {
                budgetAnnuale.entrate[categoria] = (budgetAnnuale.entrate[categoria] || 0) + importo;
              });
            } else {
              console.warn(`Errore caricamento budget mese ${index + 1}:`, result.reason);
            }
          });
          
          // 📊 DIAGNOSTICA INTERO ANNO
          console.log('=== DIAGNOSTICA BUDGET INTERO ANNO ===');
          console.log(`Anno: ${annoCorrente}`);
          console.log(`Mesi con budget configurato: ${mesiConBudget}/12`);
          console.log('Dettagli budget mensili:', dettagliBudgetMensili);
          console.log('Budget annuale SOMMATO:', budgetAnnuale);
          
          // Calcola anche budget medio mensile per confronto
          const budgetMedioMensile = {
            spese: {},
            entrate: {}
          };
          if (mesiConBudget > 0) {
            Object.entries(budgetAnnuale.spese).forEach(([categoria, totale]) => {
              budgetMedioMensile.spese[categoria] = totale / mesiConBudget;
            });
            Object.entries(budgetAnnuale.entrate).forEach(([categoria, totale]) => {
              budgetMedioMensile.entrate[categoria] = totale / mesiConBudget;
            });
          }
          console.log('Budget medio mensile (per confronto):', budgetMedioMensile);
          
          // 🔧 STRATEGIA BUDGET ANNUALE: Proviamo diverse logiche
          // Strategia 1: Somma (logica attuale)
          const budgetSommato = budgetAnnuale;
          
          // Strategia 2: Media mensile * 12 (logica alternativa)
          const budgetMediato = {
            spese: {},
            entrate: {}
          };
          
          if (mesiConBudget > 0) {
            Object.entries(budgetMedioMensile.spese).forEach(([categoria, media]) => {
              budgetMediato.spese[categoria] = media * 12;
            });
            Object.entries(budgetMedioMensile.entrate).forEach(([categoria, media]) => {
              budgetMediato.entrate[categoria] = media * 12;
            });
          }
          
          console.log('STRATEGIA 1 - Budget sommato:', budgetSommato);
          console.log('STRATEGIA 2 - Budget mediato x12:', budgetMediato);
          
          // 🔧 CORREZIONE: L'utente ha confermato che deve essere SOMMA di tutti i 12 mesi
          // Se alcuni mesi non hanno budget, usiamo la strategia 2 (media x 12)
          // Se tutti i mesi hanno budget, usiamo la strategia 1 (somma diretta)
          
          let budgetFinale;
          if (mesiConBudget === 12) {
            // Tutti i mesi hanno budget → usa somma diretta
            budgetFinale = budgetSommato;
            console.log('✅ USANDO STRATEGIA 1: Tutti i 12 mesi hanno budget - somma diretta');
          } else if (mesiConBudget > 0) {
            // Solo alcuni mesi hanno budget → usa media x 12 per stimare l'anno
            budgetFinale = budgetMediato;
            console.log(`✅ USANDO STRATEGIA 2: Solo ${mesiConBudget}/12 mesi hanno budget - usando media x 12`);
          } else {
            // Nessun mese ha budget → usa oggetto vuoto
            budgetFinale = { spese: {}, entrate: {} };
            console.log('⚠️ NESSUN BUDGET CONFIGURATO per l\'anno');
          }
          
          console.log('Budget finale per intero anno:', budgetFinale);
          console.log('=== FINE DIAGNOSTICA ===');
          
          setBudgetSettings(budgetFinale);
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
          // Validazione data
          if (!t.data) {
            console.warn('Transazione senza data:', t);
            return false;
          }
          
          const data = new Date(t.data);
          
          // Verifica che la data sia valida
          if (isNaN(data.getTime())) {
            console.warn('Data invalida nella transazione:', t.data, t);
            return false;
          }
          
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
        
        // 📊 DIAGNOSTICA TRANSAZIONI INTERO ANNO
        if (meseCorrente === 0) {
          console.log('=== DIAGNOSTICA TRANSAZIONI INTERO ANNO ===');
          console.log(`Totale spese nell'anno ${annoCorrente}: ${speseFiltrate.length}`);
          console.log(`Totale entrate nell'anno ${annoCorrente}: ${entrateFiltrate.length}`);
          
          // Campione transazioni per verifica filtro
          if (speseFiltrate.length > 0) {
            console.log('Campione spese filtrate:', speseFiltrate.slice(0, 3).map(s => ({
              categoria: s.categoria,
              importo: s.importo,
              data: s.data,
              anno: new Date(s.data).getFullYear()
            })));
          }
          
          if (entrateFiltrate.length > 0) {
            console.log('Campione entrate filtrate:', entrateFiltrate.slice(0, 3).map(e => ({
              categoria: e.categoria,
              importo: e.importo,
              data: e.data,
              anno: new Date(e.data).getFullYear()
            })));
          }
        }
        
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
        
        // 📊 DIAGNOSTICA AGGREGAZIONE INTERO ANNO
        if (meseCorrente === 0) {
          console.log('=== DIAGNOSTICA AGGREGAZIONE INTERO ANNO ===');
          console.log('Spese aggregate per categoria:', speseAggregated);
          console.log('Entrate aggregate per categoria:', entrateAggregated);
          
          // Totali per verifica
          const totaleSpese = Object.values(speseAggregated).reduce((a, b) => a + b, 0);
          const totaleEntrate = Object.values(entrateAggregated).reduce((a, b) => a + b, 0);
          console.log(`Totale spese anno ${annoCorrente}: €${totaleSpese.toFixed(2)}`);
          console.log(`Totale entrate anno ${annoCorrente}: €${totaleEntrate.toFixed(2)}`);
          console.log(`Bilancio anno ${annoCorrente}: €${(totaleEntrate - totaleSpese).toFixed(2)}`);
          console.log('=== FINE DIAGNOSTICA AGGREGAZIONE ===');
        }
        
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