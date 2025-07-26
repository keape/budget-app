import React from 'react';

const BudgetSummary = ({ totals, tipoTransazione }) => {
  const { totaleBudget, totaleTransazioni, totaleDifferenza } = totals;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
      <div className="p-4 rounded-lg bg-blue-100 dark:bg-blue-900">
        <h3 className="text-lg font-semibold mb-2">Budget Pianificato</h3>
        <p className="text-2xl font-bold text-blue-800 dark:text-blue-200">
          {totaleBudget.toFixed(2)} €
        </p>
      </div>
      
      <div className="p-4 rounded-lg bg-green-100 dark:bg-green-900">
        <h3 className="text-lg font-semibold mb-2">
          {tipoTransazione === 'entrate' ? 'Entrate Effettive' : 
           tipoTransazione === 'tutte' ? 'Transazioni Totali' : 'Spese Effettive'}
        </h3>
        <p className="text-2xl font-bold text-green-800 dark:text-green-200">
          {totaleTransazioni.toFixed(2)} €
        </p>
      </div>
      
      <div className={`p-4 rounded-lg ${
        tipoTransazione === 'entrate'
          ? (totaleDifferenza >= 0
              ? 'bg-green-100 dark:bg-green-900'
              : 'bg-red-100 dark:bg-red-900')
          : (totaleDifferenza <= 0 // Spese: negative diff is good
              ? 'bg-green-100 dark:bg-green-900'
              : 'bg-red-100 dark:bg-red-900')
      }`}>
        <h3 className="text-lg font-semibold mb-2">Differenza</h3>
        <p className={`text-2xl font-bold ${
          tipoTransazione === 'entrate'
            ? (totaleDifferenza >= 0
                ? 'text-green-800 dark:text-green-200'
                : 'text-red-800 dark:text-red-200')
            : (totaleDifferenza <= 0
                ? 'text-green-800 dark:text-green-200'
                : 'text-red-800 dark:text-red-200')
        }`}>
          {totaleDifferenza.toFixed(2)} €
        </p>
      </div>
    </div>
  );
};

export default BudgetSummary;