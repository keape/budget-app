import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import './Budget.css';

const BudgetEntrate = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [data, setData] = useState([]);
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'ascending' });
  const [selectedYear, setSelectedYear] = useState(searchParams.get('anno') || new Date().getFullYear().toString());
  const [selectedMonth, setSelectedMonth] = useState(searchParams.get('mese') || format(new Date(), 'MMMM', { locale: it }));

  useEffect(() => {
    fetchData();
  }, [selectedYear, selectedMonth]);

  const fetchData = async () => {
    try {
      const response = await fetch('http://localhost:5001/api/entrate');
      const entrate = await response.json();
      
      // Filtra per anno e mese selezionati
      const filtered = entrate.filter(entrata => {
        const data = new Date(entrata.data);
        return (
          data.getFullYear().toString() === selectedYear &&
          format(data, 'MMMM', { locale: it }) === selectedMonth
        );
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
    const month = e.target.value;
    setSelectedMonth(month);
    searchParams.set('mese', month);
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
    'gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno',
    'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'
  ];

  return (
    <div className="budget-container">
      <h1>Budget Entrate {selectedYear}</h1>
      
      <div className="filters">
        <select value={selectedYear} onChange={handleYearChange}>
          {Array.from({ length: 12 }, (_, i) => 2014 + i).map(year => (
            <option key={year} value={year}>{year}</option>
          ))}
        </select>

        <select value={selectedMonth} onChange={handleMonthChange}>
          {months.map(month => (
            <option key={month} value={month}>{month}</option>
          ))}
        </select>
      </div>

      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th onClick={() => handleSort('categoria')}>
                Categoria{getSortIndicator('categoria')}
              </th>
              <th onClick={() => handleSort('entrate')}>
                Entrate{getSortIndicator('entrate')}
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedData.map((item, index) => (
              <tr key={index}>
                <td>{item.categoria}</td>
                <td className="amount">{formatCurrency(item.entrate)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td>Totale</td>
              <td className="amount">
                {formatCurrency(sortedData.reduce((sum, item) => sum + item.entrate, 0))}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
};

export default BudgetEntrate; 