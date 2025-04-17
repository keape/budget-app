import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { useTheme } from './ThemeContext';
import BASE_URL from './config';

const BudgetEntrate = () => {
  const { darkMode } = useTheme();
  const [searchParams, setSearchParams] = useSearchParams();
  const [data, setData] = useState([]);
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'ascending' });
  const [selectedYear, setSelectedYear] = useState(searchParams.get('anno') || new Date().getFullYear().toString());
  const [selectedMonth, setSelectedMonth] = useState(searchParams.get('mese') || new Date().getMonth());

  useEffect(() => {
    fetchData();
  }, [selectedYear, selectedMonth]);

  const fetchData = async () => {
    try {
      console.log('Fetching data with:', { selectedYear, selectedMonth });
      const response = await fetch(`${BASE_URL}/api/entrate`);
      const entrate = await response.json();
      console.log('Received entrate:', entrate);
      
      // Filtra per anno e mese selezionati
      const filtered = entrate.filter(entrata => {
        const data = new Date(entrata.data);
        const match = (
          data.getFullYear().toString() === selectedYear &&
          data.getMonth() === parseInt(selectedMonth)
        );
        return match;
      });

      // Raggruppa per categoria
      const grouped = filtered.reduce((acc, entrata) => {
        const { categoria, importo } = entrata;
        if (!acc[categoria]) {
          acc[categoria] = { categoria, entrate: 0 };
        }
        acc[categoria].entrate += importo;
        return acc;
      }, {});

      console.log('Grouped data:', grouped);
      setData(Object.values(grouped));
    } catch (error) {
      console.error('Errore nel recupero delle entrate:', error);
    }
  };

  const handleSort = (key) => {
    let direction = 'ascending';
    if (sortConfig.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setSortConfig({ key, direction });
  };

  const sortedData = React.useMemo(() => {
    if (!sortConfig.key) return data;

    return [...data].sort((a, b) => {
      if (a[sortConfig.key] < b[sortConfig.key]) {
        return sortConfig.direction === 'ascending' ? -1 : 1;
      }
      if (a[sortConfig.key] > b[sortConfig.key]) {
        return sortConfig.direction === 'ascending' ? 1 : -1;
      }
      return 0;
    });
  }, [data, sortConfig]);

  const handleYearChange = (e) => {
    const year = e.target.value;
    setSelectedYear(year);
    searchParams.set('anno', year);
    setSearchParams(searchParams);
  };

  const handleMonthChange = (e) => {
    const monthIndex = parseInt(e.target.value);
    setSelectedMonth(monthIndex);
    searchParams.set('mese', monthIndex.toString());
    setSearchParams(searchParams);
  };

  const getSortIndicator = (key) => {
    if (sortConfig.key === key) {
      return sortConfig.direction === 'ascending' ? ' ↑' : ' ↓';
    }
    return '';
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('it-IT', {
      style: 'currency',
      currency: 'EUR'
    }).format(amount);
  };

  const months = [
    'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
    'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'
  ];

  const totaleEntrate = sortedData.reduce((sum, item) => sum + item.entrate, 0);

  return (
    <div className="theme-container p-6">
      <h2 className="text-3xl font-bold text-center mb-8 text-blue-800 dark:text-blue-200">
        Entrate {months[parseInt(selectedMonth)]} {selectedYear}
      </h2>
      
      <div className="flex justify-center gap-4 mb-8">
        <select
          className="theme-input"
          value={selectedYear}
          onChange={handleYearChange}
        >
          {Array.from({ length: 12 }, (_, i) => 2014 + i).map(year => (
            <option key={year} value={year}>{year}</option>
          ))}
        </select>

        <select
          className="theme-input"
          value={selectedMonth}
          onChange={handleMonthChange}
        >
          {months.map((month, index) => (
            <option key={index} value={index}>{month}</option>
          ))}
        </select>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full bg-white dark:bg-gray-800 rounded-lg overflow-hidden">
          <thead>
            <tr className="bg-gray-100 dark:bg-gray-700">
              <th 
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer"
                onClick={() => handleSort('categoria')}
              >
                Categoria{getSortIndicator('categoria')}
              </th>
              <th 
                className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer"
                onClick={() => handleSort('entrate')}
              >
                Entrate{getSortIndicator('entrate')}
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
                  {formatCurrency(item.entrate)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-gray-50 dark:bg-gray-700">
              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">
                Totale
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-right text-gray-900 dark:text-gray-100">
                {formatCurrency(totaleEntrate)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
};

export default BudgetEntrate; 