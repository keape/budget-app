import { useMemo } from 'react';

export const useBudgetCalculations = (
  speseMensili,
  entrateMensili,
  budgetSettings,
  tipoTransazione,
  sortConfig
) => {
  // Helper to get budget for the selected period
  const getBudgetPeriodo = (isEntrate = false) => {
    const tipo = isEntrate ? 'entrate' : 'spese';
    return budgetSettings[tipo] || {};
  };

  // Data Preparation for Chart and Table
  const budgetCorrente = useMemo(() => {
    return tipoTransazione === 'tutte' 
      ? { ...getBudgetPeriodo(false), ...getBudgetPeriodo(true) } // Combina spese ed entrate
      : getBudgetPeriodo(tipoTransazione === 'entrate');
  }, [budgetSettings, tipoTransazione]);
  
  // Gestione transazioni correnti per tutte le opzioni
  const transazioniCorrenti = useMemo(() => {
    return tipoTransazione === 'tutte' 
      ? { ...speseMensili, ...entrateMensili } // Combina spese ed entrate
      : tipoTransazione === 'entrate' ? entrateMensili : speseMensili;
  }, [speseMensili, entrateMensili, tipoTransazione]);

  // Combine budget categories and transaction categories for a full list
  const tutteCategorie = useMemo(() => {
    return [
      ...new Set([
          ...Object.keys(budgetCorrente),
          ...Object.keys(transazioniCorrenti)
      ].map(cat => cat.trim())) // Aggiunto trim() per normalizzare i nomi
    ].filter(Boolean); // Rimuove eventuali valori vuoti
  }, [budgetCorrente, transazioniCorrenti]);

  const datiTabella = useMemo(() => {
    return tutteCategorie.map(categoria => {
        const budget = budgetCorrente[categoria] || 0;
        
        if (tipoTransazione === 'tutte') {
            // Per "tutte le transazioni", mostriamo spese ed entrate separate
            const importoSpese = speseMensili[categoria] || 0;
            const importoEntrate = entrateMensili[categoria] || 0;
            
            return {
                categoria,
                budget,
                importo: importoSpese + importoEntrate, // Totale per la tabella
                importoSpese,
                importoEntrate,
                differenza: (importoSpese + importoEntrate) - budget
            };
        } else {
            // Per singolo tipo, logica esistente
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
        }
    });
  }, [tutteCategorie, budgetCorrente, tipoTransazione, speseMensili, entrateMensili, transazioniCorrenti]);

  // Sorting Data
  const sortedData = useMemo(() => {
    if (!sortConfig.key) return datiTabella;
    return [...datiTabella].sort((a, b) => {
      if (a[sortConfig.key] < b[sortConfig.key]) return sortConfig.direction === 'asc' ? -1 : 1;
      if (a[sortConfig.key] > b[sortConfig.key]) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }, [datiTabella, sortConfig]);

  // Totals Calculation
  const totals = useMemo(() => {
    const totaleBudget = Object.values(budgetCorrente).reduce((a, b) => a + b, 0);
    const totaleTransazioni = Object.values(transazioniCorrenti).reduce((a, b) => a + b, 0);
    const totaleDifferenza = totaleTransazioni - totaleBudget;

    return {
      totaleBudget,
      totaleTransazioni,
      totaleDifferenza
    };
  }, [budgetCorrente, transazioniCorrenti]);

  return {
    budgetCorrente,
    transazioniCorrenti,
    tutteCategorie,
    datiTabella,
    sortedData,
    totals,
    getBudgetPeriodo
  };
};