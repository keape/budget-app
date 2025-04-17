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

function Budget() {
  const [speseMensili, setSpeseMensili] = useState([]);
  const [meseCorrente, setMeseCorrente] = useState(new Date().getMonth());
  const [annoCorrente, setAnnoCorrente] = useState(new Date().getFullYear());
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
  const navigate = useNavigate();

  const mesi = [
    "Intero anno",
    "Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno",
    "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre"
  ];

  const getBudgetPeriodo = (mese) => {
    // Se mese è 0 (Intero anno), calcola il budget annuale
    if (mese === 0) {
      const budgetAnnuale = {};
      // Somma i budget di tutti i mesi
      for (let m = 1; m <= 12; m++) {
        const budgetMese = getBudgetMensile(m - 1);
        Object.keys(budgetMese).forEach(categoria => {
          budgetAnnuale[categoria] = (budgetAnnuale[categoria] || 0) + budgetMese[categoria];
        });
      }
      return budgetAnnuale;
    }
    // Altrimenti restituisce il budget del mese selezionato
    return getBudgetMensile(mese - 1);
  };

  useEffect(() => {
    axios.get(`${BASE_URL}/api/spese`)
      .then(res => {
        let speseFiltrate;
        if (meseCorrente === 0) {
          // Per l'intero anno, filtra solo per anno
          speseFiltrate = res.data.filter(spesa => {
            const dataSpesa = new Date(spesa.data);
            return dataSpesa.getFullYear() === annoCorrente;
          });
        } else {
          // Per un mese specifico, filtra per mese e anno
          speseFiltrate = res.data.filter(spesa => {
            const dataSpesa = new Date(spesa.data);
            return dataSpesa.getMonth() === meseCorrente - 1 && 
                   dataSpesa.getFullYear() === annoCorrente;
          });
        }

        // Raggruppa le spese per categoria
        const spesePerCategoria = speseFiltrate.reduce((acc, spesa) => {
          acc[spesa.categoria] = (acc[spesa.categoria] || 0) + spesa.importo;
          return acc;
        }, {});

        setSpeseMensili(spesePerCategoria);
      })
      .catch(err => console.error("Errore nel caricamento delle spese:", err));
  }, [meseCorrente, annoCorrente]);

  // Prepara i dati per il grafico usando il budget del periodo selezionato
  const budgetPeriodoCorrente = getBudgetPeriodo(meseCorrente);
  const datiGrafico = Object.keys(budgetPeriodoCorrente).map(categoria => ({
    categoria,
    budget: budgetPeriodoCorrente[categoria],
    spese: speseMensili[categoria] || 0,
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
  const totaleSpese = sortedData.reduce((acc, item) => acc + item.spese, 0);
  const totaleDifferenza = totaleSpese - totaleBudget;

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
      <h2 className="text-3xl font-bold text-center mb-8 text-blue-800 dark:text-blue-200">
        Budget {meseCorrente === 0 ? 'annuale' : 'mensile'} {annoCorrente}
      </h2>

      {/* Selettore periodo */}
      <div className="flex justify-center mb-8">
        <select
          className="theme-input mr-4"
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
          <h3 className="text-lg font-semibold mb-2">Spese Effettive</h3>
          <p className="text-2xl font-bold text-green-800 dark:text-green-200">
            {totaleSpese.toFixed(2)} €
          </p>
        </div>
        <div className={`p-4 rounded-lg ${totaleDifferenza > 0 ? 'bg-red-100 dark:bg-red-900' : 'bg-green-100 dark:bg-green-900'}`}>
          <h3 className="text-lg font-semibold mb-2">Differenza</h3>
          <p className={`text-2xl font-bold ${totaleDifferenza > 0 ? 'text-red-800 dark:text-red-200' : 'text-green-800 dark:text-green-200'}`}>
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
            <Bar 
              dataKey="budget" 
              name="Budget" 
              fill="#3b82f6" 
              onClick={handleBarClick}
              cursor="pointer"
            />
            <Bar 
              dataKey="spese" 
              name="Spese" 
              fill="#22c55e" 
              onClick={handleBarClick}
              cursor="pointer"
            />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Tabella dettagli */}
      <div className="overflow-x-auto">
        <table className="min-w-full bg-white dark:bg-gray-800 rounded-lg overflow-hidden">
          <thead className="bg-gray-100 dark:bg-gray-700">
            <tr>
              <th 
                className={`px-4 py-2 text-left text-gray-900 dark:text-white cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-600 ${getSortClass('categoria')}`}
                onClick={() => handleSort('categoria')}
              >
                Categoria
              </th>
              <th 
                className={`px-4 py-2 text-right text-gray-900 dark:text-white cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-600 ${getSortClass('budget')}`}
                onClick={() => handleSort('budget')}
              >
                Budget
              </th>
              <th 
                className={`px-4 py-2 text-right text-gray-900 dark:text-white cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-600 ${getSortClass('spese')}`}
                onClick={() => handleSort('spese')}
              >
                Spese
              </th>
              <th 
                className={`px-4 py-2 text-right text-gray-900 dark:text-white cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-600 ${getSortClass('differenza')}`}
                onClick={() => handleSort('differenza')}
              >
                Differenza
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedData.map((item, index) => (
              <tr key={index} className="hover:bg-gray-100 dark:hover:bg-gray-700">
                <td className="px-4 py-2">{item.categoria}</td>
                <td className="px-4 py-2 text-right">{item.budget.toFixed(2)} €</td>
                <td className="px-4 py-2 text-right">{item.spese.toFixed(2)} €</td>
                <td className={`px-4 py-2 text-right ${item.differenza > 0 ? 'text-red-600' : 'text-green-600'}`}>
                  {item.differenza.toFixed(2)} €
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default Budget;