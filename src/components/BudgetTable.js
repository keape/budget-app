import React from 'react';

const BudgetTable = ({ 
  sortedData, 
  totals, 
  tipoTransazione, 
  sortConfig, 
  onSort 
}) => {
  const { totaleBudget, totaleTransazioni, totaleDifferenza } = totals;

  const getSortClass = (key) => {
    if (sortConfig.key === key) {
      return sortConfig.direction === 'asc'
        ? 'after:content-["↑"] after:ml-1'
        : 'after:content-["↓"] after:ml-1';
    }
    return '';
  };

  const handleSort = (key) => {
    onSort(key);
  };

  if (!sortedData || sortedData.length === 0) {
    return null;
  }

  return (
    <div className="overflow-x-auto shadow-md rounded-lg">
      <table className="min-w-full bg-white dark:bg-gray-800">
        <caption className="caption-bottom p-4 text-sm text-gray-600 dark:text-gray-400">
          Clicca su una categoria nel grafico o sulle intestazioni della tabella per interagire.
        </caption>
        <thead>
          <tr className="bg-gray-100 dark:bg-gray-700">
            <th
              className={`px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer ${getSortClass('categoria')}`}
              onClick={() => handleSort('categoria')}
            >
              Categoria
            </th>
            <th
              className={`px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer ${getSortClass('budget')}`}
              onClick={() => handleSort('budget')}
            >
              Budget
            </th>
            <th
              className={`px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer ${getSortClass('importo')}`}
              onClick={() => handleSort('importo')}
            >
              {tipoTransazione === 'entrate' ? 'Entrate' : 
               tipoTransazione === 'tutte' ? 'Transazioni' : 'Spese'}
            </th>
            <th
              className={`px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer ${getSortClass('differenza')}`}
              onClick={() => handleSort('differenza')}
            >
              Differenza
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 dark:divide-gray-600">
          {sortedData.map((item, index) => (
            <tr key={index} className="hover:bg-gray-50 dark:hover:bg-gray-700">
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                {item.categoria}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900 dark:text-gray-100">
                {item.budget.toFixed(2)} €
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900 dark:text-gray-100">
                {item.importo.toFixed(2)} €
              </td>
              <td className={`px-6 py-4 whitespace-nowrap text-sm text-right font-medium ${
                  item.differenza > 0
                      ? (tipoTransazione === 'entrate'
                          ? 'text-green-600 dark:text-green-400'
                          : 'text-red-600 dark:text-red-400')
                      : item.differenza < 0
                      ? (tipoTransazione === 'entrate'
                          ? 'text-red-600 dark:text-red-400'
                          : 'text-green-600 dark:text-green-400')
                      : 'text-gray-900 dark:text-gray-100'
              }`}>
                {item.differenza.toFixed(2)} €
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="bg-gray-50 dark:bg-gray-700 font-bold text-gray-700 dark:text-gray-200">
            <td className="px-6 py-4 whitespace-nowrap text-sm uppercase tracking-wider">
              Totale
            </td>
            <td className="px-6 py-4 whitespace-nowrap text-sm text-right">
              {totaleBudget.toFixed(2)} €
            </td>
            <td className="px-6 py-4 whitespace-nowrap text-sm text-right">
              {totaleTransazioni.toFixed(2)} €
            </td>
            <td className={`px-6 py-4 whitespace-nowrap text-sm text-right ${
                tipoTransazione === 'entrate'
                ? (totaleDifferenza >= 0
                    ? 'text-green-700 dark:text-green-300'
                    : 'text-red-700 dark:text-red-300')
                : (totaleDifferenza <= 0
                    ? 'text-green-700 dark:text-green-300'
                    : 'text-red-700 dark:text-red-300')
            }`}>
              {totaleDifferenza.toFixed(2)} €
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
};

export default BudgetTable;