import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import BASE_URL from './config';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend
} from 'recharts';

function Budget() {
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const [speseMensili, setSpeseMensili] = useState({}); 
  const [entrateMensili, setEntrateMensili] = useState({});
  const [meseCorrente, setMeseCorrente] = useState(
    () => params.has('mese') ? parseInt(params.get('mese')) : new Date().getMonth()
  );
  const [annoCorrente, setAnnoCorrente] = useState(
    () => params.has('anno') ? parseInt(params.get('anno')) : new Date().getFullYear()
  );
  const [tipoTransazione, setTipoTransazione] = useState('uscite');
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
  const [budgetSettings, setBudgetSettings] = useState({ spese: {}, entrate: {} });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const navigate = useNavigate();

  const mesi = [
    "Intero anno", "Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno",
    "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre"
  ];

  // Helper to get budget for the selected period
  const getBudgetPeriodo = (isEntrate = false) => {
    const tipo = isEntrate ? 'entrate' : 'spese';
    return budgetSettings[tipo] || {};
  };
  
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
          
          // Crea una richiesta per ogni mese dell'anno
          for (let mese = 0; mese < 12; mese++) {
            budgetPromises.push(
              axios.get(`${BASE_URL}/api/budget-settings`, {
                params: { 
                  anno: annoCorrente,
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
              params: { page: 1, limit: 1000000 },
              headers: { 'Authorization': `Bearer ${token}` }
           }),
          axios.get(`${BASE_URL}/api/entrate`, {
              params: { page: 1, limit: 1000000 },
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

        // Aggregate Filtered Transactions
        const aggregateByCategory = (transactions) =>
            transactions.reduce((acc, t) => {
                // Per le spese, usiamo il valore assoluto per visualizzarle correttamente nel grafico
                acc[t.categoria] = (acc[t.categoria] || 0) + Math.abs(t.importo);
                return acc;
            }, {});

        setSpeseMensili(aggregateByCategory(speseFiltrate));
        setEntrateMensili(aggregateByCategory(entrateFiltrate));
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

    // --- Sorting Logic (remains the same) ---
    const handleSort = (key) => {
      let direction = 'asc';
      if (sortConfig.key === key && sortConfig.direction === 'asc') {
        direction = 'desc';
      }
      setSortConfig({ key, direction });
    };

    const getSortClass = (key) => {
      if (sortConfig.key === key) {
        return sortConfig.direction === 'asc'
          ? 'after:content-["↑"] after:ml-1'
          : 'after:content-["↓"] after:ml-1';
      }
      return '';
    };

    // --- Data Preparation for Chart and Table ---
    const budgetCorrente = getBudgetPeriodo(tipoTransazione === 'entrate');
    const transazioniCorrenti = tipoTransazione === 'entrate' ? entrateMensili : speseMensili;

    // Combine budget categories and transaction categories for a full list
    const tutteCategorie = [
      ...new Set([
          ...Object.keys(budgetCorrente),
          ...Object.keys(transazioniCorrenti)
      ].map(cat => cat.trim())) // Aggiunto trim() per normalizzare i nomi
    ].filter(Boolean); // Rimuove eventuali valori vuoti

    const datiTabella = tutteCategorie.map(categoria => {
        const budget = budgetCorrente[categoria] || 0;
        const importo = transazioniCorrenti[categoria] || 0;
        
        // Debug logging migliorato
        console.log(`Processing categoria: "${categoria}"`, {
            budget,
            importo,
            existsInBudget: budgetCorrente.hasOwnProperty(categoria),
            existsInTrans: transazioniCorrenti.hasOwnProperty(categoria),
            normalized: categoria.trim()
        });
        
        return {
            categoria,
            budget,
            importo,
            differenza: importo - budget
        };
    });

    // --- Sorting Data (using datiTabella) ---
    const sortedData = React.useMemo(() => {
      if (!sortConfig.key) return datiTabella;
      return [...datiTabella].sort((a, b) => {
        if (a[sortConfig.key] < b[sortConfig.key]) return sortConfig.direction === 'asc' ? -1 : 1;
        if (a[sortConfig.key] > b[sortConfig.key]) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }, [datiTabella, sortConfig]);

    // --- Totals Calculation ---
    const totaleBudget = Object.values(budgetCorrente).reduce((a, b) => a + b, 0);
    const totaleTransazioni = Object.values(transazioniCorrenti).reduce((a, b) => a + b, 0);
    const totaleDifferenza = totaleTransazioni - totaleBudget;

    // --- Navigation Handler ---
    const handleBarClick = (data) => {
      // Check if data and data.categoria exist before navigating
      if (data && data.categoria) {
          const params = new URLSearchParams();
          params.append('categoria', data.categoria);
          if (meseCorrente === 0) {
            params.append('anno', annoCorrente.toString());
          } else {
            params.append('mese', (meseCorrente - 1).toString());
            params.append('anno', annoCorrente.toString());
          }
          navigate(`/filtri?${params.toString()}`);
      } else {
          console.warn('Tentativo di navigazione senza dati validi dalla barra del grafico:', data);
      }
    };

    // --- Render Logic ---
    return (
      <div className="theme-container p-6">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-4xl font-bold text-indigo-700 dark:text-indigo-300">
            Budget {meseCorrente === 0 ? 'Intero anno' : mesi[meseCorrente]} {annoCorrente}
          </h1>
          <Link 
            to="/budget/settings"
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors duration-200 flex items-center gap-2"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
362 |             </svg>
363 |             Impostazioni Budget
364 |           </Link>
365 |         </div>
366 |         {/* Period Selectors */}
367 |          <div className="flex justify-center mb-8 gap-4">
368 |           <select
369 |             className="w-full px-6 py-4 text-lg bg-white dark:bg-gray-700 border-2 border-blue-300 dark:border-blue-600 rounded-lg shadow-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 hover:border-blue-400 text-gray-800 dark:text-white"
370 |             value={meseCorrente}
371 |             onChange={(e) => setMeseCorrente(parseInt(e.target.value))}
372 |             disabled={isLoading} // Disable while loading
373 |           >
374 |             {mesi.map((mese, index) => (
375 |               <option key={index} value={index}>{mese}</option>
376 |             ))}
377 |           </select>
378 |           <select
379 |             className="w-full px-6 py-4 text-lg bg-white dark:bg-gray-700 border-2 border-blue-300 dark:border-blue-600 rounded-lg shadow-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 hover:border-blue-400 text-gray-800 dark:text-white"
380 |             value={annoCorrente}
381 |             onChange={(e) => setAnnoCorrente(parseInt(e.target.value))}
382 |             disabled={isLoading} // Disable while loading
383 |           >
384 |             {/* Dynamically generate year options */}
385 |             {Array.from({ length: 12 }, (_, i) => new Date().getFullYear() - 5 + i).map(year => (
386 |               <option key={year} value={year}>{year}</option>
387 |             ))}
388 |           </select>
389 |           <select
390 |             className="w-full px-6 py-4 text-lg bg-white dark:bg-gray-700 border-2 border-blue-300 dark:border-blue-600 rounded-lg shadow-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 hover:border-blue-400 text-gray-800 dark:text-white"
391 |             value={tipoTransazione}
392 |             onChange={(e) => setTipoTransazione(e.target.value)}
393 |             disabled={isLoading} // Disable while loading
394 |           >
395 |             <option value="uscite">Uscite</option>
396 |             <option value="entrate">Entrate</option>
397 |           </select>
398 |         </div>
399 | 
400 |         {/* Loading / Error Indicator */}
401 |         {isLoading && (
402 |           <div className="flex justify-center items-center py-8">
403 |             <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
404 |             <p className="ml-3 text-gray-600 dark:text-gray-400">Caricamento dati...</p>
405 |           </div>
406 |         )}
407 |          {error && !isLoading && (
408 |           <div className="mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded text-center">
409 |             <p className="font-bold">Si è verificato un errore:</p>
410 |             <p>{error}</p>
411 |           </div>
412 |         )}
413 | 
414 |         {/* Content Area: Totals, Chart, Table - Render only when not loading AND no error */}
415 |         {!isLoading && !error && (
416 |           <>
417 |             {/* Totals */}
418 |             <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
419 |                 <div className="p-4 rounded-lg bg-blue-100 dark:bg-blue-900">
420 |                 <h3 className="text-lg font-semibold mb-2">Budget Pianificato</h3>
421 |                 <p className="text-2xl font-bold text-blue-800 dark:text-blue-200">
422 |                     {totaleBudget.toFixed(2)} €
423 |                 </p>
424 |                 </div>
425 |                 <div className="p-4 rounded-lg bg-green-100 dark:bg-green-900">
426 |                 <h3 className="text-lg font-semibold mb-2">
427 |                     {tipoTransazione === 'entrate' ? 'Entrate Effettive' : 'Spese Effettive'}
428 |                 </h3>
429 |                 <p className="text-2xl font-bold text-green-800 dark:text-green-200">
430 |                     {totaleTransazioni.toFixed(2)} €
431 |                 </p>
432 |                 </div>
433 |                 <div className={`p-4 rounded-lg ${
434 |                 tipoTransazione === 'entrate'
435 |                     ? (totaleDifferenza >= 0
436 |                         ? 'bg-green-100 dark:bg-green-900'
437 |                         : 'bg-red-100 dark:bg-red-900')
438 |                     : (totaleDifferenza <= 0 // Spese: negative diff is good
439 |                         ? 'bg-green-100 dark:bg-green-900'
440 |                         : 'bg-red-100 dark:bg-red-900')
441 |                 }`}>
442 |                 <h3 className="text-lg font-semibold mb-2">Differenza</h3>
443 |                 <p className={`text-2xl font-bold ${
444 |                     tipoTransazione === 'entrate'
445 |                     ? (totaleDifferenza >= 0
446 |                         ? 'text-green-800 dark:text-green-200'
447 |                         : 'text-red-800 dark:text-red-200')
448 |                     : (totaleDifferenza <= 0
449 |                         ? 'text-green-800 dark:text-green-200'
450 |                         : 'text-red-800 dark:text-red-200')
451 |                 }`}>
452 |                     {totaleDifferenza.toFixed(2)} €
453 |                 </p>
454 |                 </div>
455 |             </div>
456 | 
457 |             {/* Chart & Table Container */}
458 |             {tutteCategorie.length > 0 ? (
459 |               <>
460 |                 {/* Chart */}
461 |                 <div className="mb-8">
462 |                   <ResponsiveContainer width="100%" height={400}>
463 |                   <BarChart data={sortedData}> {/* Use sortedData */}
464 |                       <XAxis dataKey="categoria" angle={-45} textAnchor="end" height={100} interval={0} />
465 |                       <YAxis />
466 |                       <Tooltip formatter={(value) => `${value.toFixed(2)} €`} />
467 |                       <Legend />
468 |                       <Bar dataKey="budget" fill="#3182ce" name="Budget" onClick={handleBarClick} cursor="pointer" />
469 |                       <Bar
470 |                       dataKey="importo"
471 |                       fill={tipoTransazione === 'entrate' ? '#48bb78' : '#ef4444'}
472 |                       name={tipoTransazione === 'entrate' ? 'Entrate' : 'Spese'}
473 |                       onClick={handleBarClick}
474 |                       cursor="pointer"
475 |                       />
476 |                   </BarChart>
477 |                   </ResponsiveContainer>
478 |                 </div>
479 | 
480 |                 {/* Table */}
481 |                 <div className="overflow-x-auto shadow-md rounded-lg">
482 |                   <table className="min-w-full bg-white dark:bg-gray-800">
483 |                   <caption className="caption-bottom p-4 text-sm text-gray-600 dark:text-gray-400">
484 |                       Clicca su una categoria nel grafico o sulle intestazioni della tabella per interagire.
485 |                   </caption>
486 |                   <thead>
487 |                       <tr className="bg-gray-100 dark:bg-gray-700">
488 |                       <th
489 |                           className={`px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer ${getSortClass('categoria')}`}
490 |                           onClick={() => handleSort('categoria')}
491 |                       >
492 |                           Categoria
493 |                       </th>
494 |                       <th
495 |                           className={`px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer ${getSortClass('budget')}`}
496 |                           onClick={() => handleSort('budget')}
497 |                       >
498 |                           Budget
499 |                       </th>
500 |                       <th
501 |                           className={`px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer ${getSortClass('importo')}`}
502 |                           onClick={() => handleSort('importo')}
503 |                       >
504 |                           {tipoTransazione === 'entrate' ? 'Entrate' : 'Spese'}
505 |                       </th>
506 |                       <th
507 |                           className={`px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer ${getSortClass('differenza')}`}
508 |                           onClick={() => handleSort('differenza')}
509 |                       >
510 |                           Differenza
511 |                       </th>
512 |                       </tr>
513 |                   </thead>
514 |                   <tbody className="divide-y divide-gray-200 dark:divide-gray-600">
515 |                       {sortedData.map((item, index) => (
516 |                       <tr key={index} className="hover:bg-gray-50 dark:hover:bg-gray-700">
517 |                           <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
518 |                           {item.categoria}
519 |                           </td>
520 |                           <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900 dark:text-gray-100">
521 |                           {item.budget.toFixed(2)} €
522 |                           </td>
523 |                           <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900 dark:text-gray-100">
524 |                           {item.importo.toFixed(2)} €
525 |                           </td>
526 |                           <td className={`px-6 py-4 whitespace-nowrap text-sm text-right font-medium ${
527 |                               item.differenza > 0
528 |                                   ? (tipoTransazione === 'entrate'
529 |                                       ? 'text-green-600 dark:text-green-400'
530 |                                       : 'text-red-600 dark:text-red-400')
531 |                                   : item.differenza < 0
532 |                                   ? (tipoTransazione === 'entrate'
533 |                                       ? 'text-red-600 dark:text-red-400')
534 |                                       : 'text-green-600 dark:text-green-400')
535 |                                   : 'text-gray-900 dark:text-gray-100'
536 |                           }`}>
537 |                           {item.differenza.toFixed(2)} €
538 |                           </td>
539 |                       </tr>
540 |                       ))}
541 |                   </tbody>
542 |                    <tfoot>
543 |                       <tr className="bg-gray-50 dark:bg-gray-700 font-bold text-gray-700 dark:text-gray-200">
544 |                       <td className="px-6 py-4 whitespace-nowrap text-sm uppercase tracking-wider">
545 |                           Totale
546 |                       </td>
547 |                       <td className="px-6 py-4 whitespace-nowrap text-sm text-right">
548 |                           {totaleBudget.toFixed(2)} €
549 |                       </td>
550 |                       <td className="px-6 py-4 whitespace-nowrap text-sm text-right">
551 |                           {totaleTransazioni.toFixed(2)} €
552 |                       </td>
553 |                       <td className={`px-6 py-4 whitespace-nowrap text-sm text-right ${
554 |                           tipoTransazione === 'entrate'
555 |                           ? (totaleDifferenza >= 0
556 |                               ? 'text-green-700 dark:text-green-300'
557 |                               : 'text-red-700 dark:text-red-300')
558 |                           : (totaleDifferenza <= 0
559 |                               ? 'text-green-700 dark:text-green-300'
560 |                               : 'text-red-700 dark:text-red-300')
561 |                       }`}>
562 |                           {totaleDifferenza.toFixed(2)} €
563 |                       </td>
564 |                       </tr>
565 |                   </tfoot>
566 |                   </table>
567 |                 </div>
568 |               </>
569 |             ) : (
570 |                // Message when there's no data to display for the period
571 |                <div className="text-center py-10 px-6 bg-gray-50 dark:bg-gray-700 rounded-lg shadow">
572 |                    <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
573 |                        <path vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h10l4 4v10a2 2 0 01-2 2H4a2 2 0 01-2-2zm12-8v4h4M9 17h.01" />
574 |                    </svg>
575 |                    <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-gray-100">Nessun dato disponibile</h3>
576 |                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
577 |                        Non ci sono transazioni o budget impostati per {mesi[meseCorrente]} {annoCorrente}.
578 |                    </p>
579 |                </div>
580 |             )}
581 |           </>
582 |         )}
583 |       </div>
584 |     );
585 |   };
586 | 
587 |   export default Budget;
