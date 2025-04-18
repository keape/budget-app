import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import BASE_URL from './config';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend
} from 'recharts';

const getBudgetMensile = (mese) => {
  const baseBudget = {
    "Mutuo": 278.50,
    "Elettricità": 50.00,
    "Acqua": 26.00,
    "Manutenzione/Arredamento casa": 70.00,
    "Alimentari": 150.00,
    "Tecnologia": 60.00,
    "Abbigliamento": 100.00,
    "Ristorante": 150.00,
    "Giardinaggio/Agricoltura/Falegnameria": 120.00,
    "Abbonamenti": 45.00,
    "Vacanza": 50.00,
    "Vela": 20.00,
    "Sport/Attrezzatura sportiva": 25.00,
    "Bar": 25.00,
    "Salute": 20.00,
    "Cinema Mostre Cultura": 5.00,
    "Regali": 20.00,
    "Altre spese": 50.00
  };

  // Crea una copia del budget base
  const budgetMese = { ...baseBudget };

  // Gestisce i casi speciali per mese
  switch (mese) {
    case 1: // Febbraio
      budgetMese["Vela"] = 750.00;
      break;
    case 5: // Giugno
      budgetMese["Vacanza"] = 750.00;
      break;
    case 6: // Luglio
      budgetMese["Vacanza"] = 750.00;
      budgetMese["Abbigliamento"] = 0.00;
      budgetMese["Regali"] = 400.00;
      break;
    case 11: // Dicembre
      budgetMese["Altre spese"] = 150.00;
      break;
  }

  return budgetMese;
};

const getBudgetEntrateMensile = (mese) => {
  const baseBudget = {
    "Stipendio": 2000.00,
    "Ticket": 100.00,
    "Welfare": 0.00,
    "MBO": 0.00,
    "Interessi": 5.00,
    "Altra entrata": 2.00,
    "Consulenze": 5.00
  };

  // Crea una copia del budget base
  const budgetMese = { ...baseBudget };

  // Gestisce i casi speciali per mese
  switch (mese) {
    case 0: // Gennaio
      budgetMese["Welfare"] = 3400.00;
      break;
    case 2: // Marzo
      budgetMese["MBO"] = 750.00;
      break;
    case 11: // Dicembre
      budgetMese["Stipendio"] = 4000.00;
      budgetMese["Ticket"] = 1200.00;
      budgetMese["Welfare"] = 3400.00;
      budgetMese["MBO"] = 750.00;
      budgetMese["Altra entrata"] = 24.00;
      budgetMese["Consulenze"] = 205.00;
      break;
  }

  return budgetMese;
};

function Budget() {
  const [speseMensili, setSpeseMensili] = useState([]);
  const [meseCorrente, setMeseCorrente] = useState(new Date().getMonth());
  const [annoCorrente, setAnnoCorrente] = useState(new Date().getFullYear());
  const [tipoTransazione, setTipoTransazione] = useState('uscite');
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
  const navigate = useNavigate();

  const mesi = [
    "Intero anno",
    "Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno",
    "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre"
  ];

  const getBudgetPeriodo = (mese, isEntrate = false) => {
    const budgetFunction = isEntrate ? getBudgetEntrateMensile : getBudgetMensile;
    
    // Se mese è 0 (Intero anno), calcola il budget annuale
    if (mese === 0) {
      const budgetAnnuale = {};
      // Somma i budget di tutti i mesi
      for (let m = 1; m <= 12; m++) {
        const budgetMese = budgetFunction(m - 1);
        Object.keys(budgetMese).forEach(categoria => {
          budgetAnnuale[categoria] = (budgetAnnuale[categoria] || 0) + budgetMese[categoria];
        });
      }
      return budgetAnnuale;
    }
    // Altrimenti restituisce il budget del mese selezionato
    return budgetFunction(mese - 1);
  };

  useEffect(() => {
    const endpoint = tipoTransazione === 'entrate' ? '/api/entrate' : '/api/spese';
    
    axios.get(`${BASE_URL}${endpoint}`)
      .then(res => {
        let transazioniFiltrate;
        if (meseCorrente === 0) {
          // Per l'intero anno, filtra solo per anno
          transazioniFiltrate = res.data.filter(transazione => {
            const dataTransazione = new Date(transazione.data);
            return dataTransazione.getFullYear() === annoCorrente;
          });
        } else {
          // Per un mese specifico, filtra per mese e anno
          transazioniFiltrate = res.data.filter(transazione => {
            const dataTransazione = new Date(transazione.data);
            return dataTransazione.getMonth() === meseCorrente - 1 && 
                   dataTransazione.getFullYear() === annoCorrente;
          });
        }

        // Raggruppa le transazioni per categoria
        const transazioniPerCategoria = transazioniFiltrate.reduce((acc, transazione) => {
          acc[transazione.categoria] = (acc[transazione.categoria] || 0) + transazione.importo;
          return acc;
        }, {});

        setSpeseMensili(transazioniPerCategoria);
      })
      .catch(err => console.error("Errore nel caricamento delle transazioni:", err));
  }, [meseCorrente, annoCorrente, tipoTransazione]);

  // Prepara i dati per il grafico usando il budget del periodo selezionato
  const budgetPeriodoCorrente = getBudgetPeriodo(meseCorrente, tipoTransazione === 'entrate');
  const datiGrafico = Object.keys(budgetPeriodoCorrente).map(categoria => ({
    categoria,
    budget: budgetPeriodoCorrente[categoria],
    importo: speseMensili[categoria] || 0,
    differenza: (speseMensili[categoria] || 0) - budgetPeriodoCorrente[categoria]
  }));

  // Funzione per gestire l'ordinamento
  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  // Funzione per ordinare i dati
  const sortedData = React.useMemo(() => {
    if (!sortConfig.key) return datiGrafico;

    return [...datiGrafico].sort((a, b) => {
      if (a[sortConfig.key] < b[sortConfig.key]) {
        return sortConfig.direction === 'asc' ? -1 : 1;
      }
      if (a[sortConfig.key] > b[sortConfig.key]) {
        return sortConfig.direction === 'asc' ? 1 : -1;
      }
      return 0;
    });
  }, [datiGrafico, sortConfig]);

  // Funzione per ottenere la classe di stile per l'header della colonna
  const getSortClass = (key) => {
    if (sortConfig.key === key) {
      return sortConfig.direction === 'asc' 
        ? 'after:content-["↑"] after:ml-1'
        : 'after:content-["↓"] after:ml-1';
    }
    return '';
  };

  // Calcola i totali usando il budget del periodo
  const totaleBudget = Object.values(budgetPeriodoCorrente).reduce((a, b) => a + b, 0);
  const totaleTransazioni = sortedData.reduce((acc, item) => acc + item.importo, 0);
  const totaleDifferenza = totaleTransazioni - totaleBudget;

  const handleBarClick = (data) => {
    // Costruisce i parametri per i filtri
    const params = new URLSearchParams();
    
    // Aggiunge la categoria
    params.append('categoria', data.categoria);
    
    // Aggiunge il periodo
    if (meseCorrente === 0) {
      // Se è selezionato l'intero anno, passa solo l'anno
      params.append('anno', annoCorrente.toString());
    } else {
      // Se è selezionato un mese specifico, passa sia mese che anno
      params.append('mese', (meseCorrente - 1).toString());
      params.append('anno', annoCorrente.toString());
    }

    // Naviga alla pagina dei filtri con i parametri
    navigate(`/filtri?${params.toString()}`);
  };

  return (
    <div className="theme-container p-6">
      <h1 className="text-4xl font-bold text-center mb-8 text-indigo-700 dark:text-indigo-300">
        Budget
      </h1>

      {/* Selettori periodo e tipo */}
      <div className="flex justify-center mb-8 gap-4">
        <select
          className="theme-input"
          value={meseCorrente}
          onChange={(e) => setMeseCorrente(parseInt(e.target.value))}
        >
          {mesi.map((mese, index) => (
            <option key={index} value={index}>{mese}</option>
          ))}
        </select>
        <select
          className="theme-input"
          value={annoCorrente}
          onChange={(e) => setAnnoCorrente(parseInt(e.target.value))}
        >
          <option value="2025">2025</option>
          <option value="2024">2024</option>
          <option value="2023">2023</option>
          <option value="2022">2022</option>
          <option value="2021">2021</option>
          <option value="2020">2020</option>
          <option value="2019">2019</option>
          <option value="2018">2018</option>
          <option value="2017">2017</option>
          <option value="2016">2016</option>
          <option value="2015">2015</option>
          <option value="2014">2014</option>
        </select>
        <select
          className="theme-input"
          value={tipoTransazione}
          onChange={(e) => setTipoTransazione(e.target.value)}
        >
          <option value="uscite">Uscite</option>
          <option value="entrate">Entrate</option>
        </select>
      </div>

      {/* Totali */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="p-4 rounded-lg bg-blue-100 dark:bg-blue-900">
          <h3 className="text-lg font-semibold mb-2">Budget Pianificato</h3>
          <p className="text-2xl font-bold text-blue-800 dark:text-blue-200">
            {totaleBudget.toFixed(2)} €
          </p>
        </div>
        <div className="p-4 rounded-lg bg-green-100 dark:bg-green-900">
          <h3 className="text-lg font-semibold mb-2">
            {tipoTransazione === 'entrate' ? 'Entrate Effettive' : 'Spese Effettive'}
          </h3>
          <p className="text-2xl font-bold text-green-800 dark:text-green-200">
            {totaleTransazioni.toFixed(2)} €
          </p>
        </div>
        <div className={`p-4 rounded-lg ${totaleDifferenza > 0 ? 
          (tipoTransazione === 'entrate' ? 'bg-green-100 dark:bg-green-900' : 'bg-red-100 dark:bg-red-900') : 
          'bg-green-100 dark:bg-green-900'}`}>
          <h3 className="text-lg font-semibold mb-2">Differenza</h3>
          <p className={`text-2xl font-bold ${
            totaleDifferenza > 0 
              ? (tipoTransazione === 'entrate' 
                  ? 'text-green-800 dark:text-green-200' 
                  : 'text-red-800 dark:text-red-200')
              : 'text-green-800 dark:text-green-200'
          }`}>
            {totaleDifferenza.toFixed(2)} €
          </p>
        </div>
      </div>

      {/* Grafico con onClick */}
      <div className="mb-8">
        <ResponsiveContainer width="100%" height={400}>
          <BarChart data={datiGrafico}>
            <XAxis dataKey="categoria" angle={-45} textAnchor="end" height={100} />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar dataKey="budget" fill="#3182ce" name="Budget" onClick={handleBarClick} />
            <Bar 
              dataKey="importo" 
              fill={tipoTransazione === 'entrate' ? '#48bb78' : '#ef4444'} 
              name={tipoTransazione === 'entrate' ? 'Entrate' : 'Spese'} 
              onClick={handleBarClick} 
            />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Tabella */}
      <div className="overflow-x-auto">
        <table className="min-w-full bg-white dark:bg-gray-800 rounded-lg overflow-hidden">
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
                {tipoTransazione === 'entrate' ? 'Entrate' : 'Spese'}
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
                <td className={`px-6 py-4 whitespace-nowrap text-sm text-right ${
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
            <tr className="bg-gray-50 dark:bg-gray-700">
              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">
                Totale
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-right text-gray-900 dark:text-gray-100">
                {totaleBudget.toFixed(2)} €
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-right text-gray-900 dark:text-gray-100">
                {totaleTransazioni.toFixed(2)} €
              </td>
              <td className={`px-6 py-4 whitespace-nowrap text-sm font-medium text-right ${
                totaleDifferenza > 0 
                  ? (tipoTransazione === 'entrate'
                      ? 'text-green-600 dark:text-green-400'
                      : 'text-red-600 dark:text-red-400')
                  : totaleDifferenza < 0 
                    ? (tipoTransazione === 'entrate'
                        ? 'text-red-600 dark:text-red-400'
                        : 'text-green-600 dark:text-green-400')
                    : 'text-gray-900 dark:text-gray-100'
              }`}>
                {totaleDifferenza.toFixed(2)} €
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

export default Budget;