import React, { useState } from 'react';
import { useLocation } from 'react-router-dom';
import LoadingSpinner from './components/LoadingSpinner';
import BudgetHeader from './components/BudgetHeader';
import BudgetSummary from './components/BudgetSummary';
import BudgetChart from './components/BudgetChart';
import BudgetTable from './components/BudgetTable';
import { useBudgetData } from './hooks/useBudgetData';
import { useBudgetCalculations } from './hooks/useBudgetCalculations';

function Budget() {
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  
  // Local state for UI controls
  const [meseCorrente, setMeseCorrente] = useState(
    () => params.has('mese') ? parseInt(params.get('mese')) : new Date().getMonth()
  );
  const [annoCorrente, setAnnoCorrente] = useState(
    () => params.has('anno') ? parseInt(params.get('anno')) : new Date().getFullYear()
  );
  const [tipoTransazione, setTipoTransazione] = useState('uscite');
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });

  // Custom hooks for data and calculations
  const { 
    speseMensili, 
    entrateMensili, 
    budgetSettings, 
    isLoading, 
    error, 
    mesi 
  } = useBudgetData(meseCorrente, annoCorrente);

  const {
    sortedData,
    totals
  } = useBudgetCalculations(
    speseMensili,
    entrateMensili, 
    budgetSettings,
    tipoTransazione,
    sortConfig
  );


  // Sorting Logic
  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };
  return (
    <div className="theme-container p-6">
      <BudgetHeader
        meseCorrente={meseCorrente}
        annoCorrente={annoCorrente}
        tipoTransazione={tipoTransazione}
        mesi={mesi}
        isLoading={isLoading}
        onMeseChange={setMeseCorrente}
        onAnnoChange={setAnnoCorrente}
        onTipoChange={setTipoTransazione}
      />

      {/* Loading / Error Indicator */}
      {isLoading && (
        <LoadingSpinner 
          size="lg" 
          text="Caricamento dati budget..." 
          className="py-8"
        />
      )}
      
      {error && !isLoading && (
        <div 
          className="mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded text-center"
          role="alert"
          aria-live="polite"
        >
          <p className="font-bold">Si è verificato un errore:</p>
          <p>{error}</p>
        </div>
      )}

      {/* Content Area: Totals, Chart, Table - Render only when not loading AND no error */}
      {!isLoading && !error && (
        <>
          <BudgetSummary totals={totals} tipoTransazione={tipoTransazione} />

          {/* Chart & Table Container */}
          {sortedData && sortedData.length > 0 ? (
            <>
              <BudgetChart 
                sortedData={sortedData}
                tipoTransazione={tipoTransazione}
                meseCorrente={meseCorrente}
                annoCorrente={annoCorrente}
              />

              <BudgetTable 
                sortedData={sortedData}
                totals={totals}
                tipoTransazione={tipoTransazione}
                sortConfig={sortConfig}
                onSort={handleSort}
              />
            </>
          ) : (
            // Message when there's no data to display for the period
            <div className="text-center py-10 px-6 bg-gray-50 dark:bg-gray-700 rounded-lg shadow">
              <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h10l4 4v10a2 2 0 01-2 2H4a2 2 0 01-2-2zm12-8v4h4M9 17h.01" />
              </svg>
              <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-gray-100">Nessun dato disponibile</h3>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Non ci sono transazioni o budget impostati per {mesi[meseCorrente]} {annoCorrente}.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default Budget;