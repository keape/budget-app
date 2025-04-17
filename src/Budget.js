import React, { useState, useEffect } from 'react';
import axios from 'axios';
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

  useEffect(() => {
    axios.get(`${BASE_URL}/api/spese`)
      .then(res => {
        // Filtra le spese per il mese corrente
        const speseMese = res.data.filter(spesa => {
          const dataSpesa = new Date(spesa.data);
          return dataSpesa.getMonth() === meseCorrente && 
                 dataSpesa.getFullYear() === annoCorrente;
        });

        // Raggruppa le spese per categoria
        const spesePerCategoria = speseMese.reduce((acc, spesa) => {
          acc[spesa.categoria] = (acc[spesa.categoria] || 0) + spesa.importo;
          return acc;
        }, {});

        setSpeseMensili(spesePerCategoria);
      })
      .catch(err => console.error("Errore nel caricamento delle spese:", err));
  }, [meseCorrente, annoCorrente]);

  // Prepara i dati per il grafico usando il budget del mese corrente
  const budgetMensileCorrente = getBudgetMensile(meseCorrente);
  const datiGrafico = Object.keys(budgetMensileCorrente).map(categoria => ({
    categoria,
    budget: budgetMensileCorrente[categoria],
    spese: speseMensili[categoria] || 0,
    differenza: (speseMensili[categoria] || 0) - budgetMensileCorrente[categoria]
  }));

  // Calcola i totali usando il budget del mese corrente
  const totaleBudget = Object.values(budgetMensileCorrente).reduce((a, b) => a + b, 0);
  const totaleSpese = Object.values(speseMensili).reduce((a, b) => a + b, 0);
  const totaleDifferenza = totaleSpese - totaleBudget;

  const mesi = [
    "Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno",
    "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre"
  ];

  return (
    <div className="theme-container p-6">
      <h2 className="text-3xl font-bold text-center mb-8 text-blue-800 dark:text-blue-200">
        Budget mensile 2025
      </h2>

      {/* Selettore mese */}
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
          <option value={2024}>2024</option>
          <option value={2025}>2025</option>
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

      {/* Grafico */}
      <div className="mb-8">
        <ResponsiveContainer width="100%" height={400}>
          <BarChart data={datiGrafico}>
            <XAxis dataKey="categoria" angle={-45} textAnchor="end" height={100} />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar dataKey="budget" name="Budget" fill="#3b82f6" />
            <Bar dataKey="spese" name="Spese" fill="#22c55e" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Tabella dettagli */}
      <div className="overflow-x-auto">
        <table className="min-w-full bg-white dark:bg-gray-800 rounded-lg overflow-hidden">
          <thead className="bg-gray-100 dark:bg-gray-700">
            <tr>
              <th className="px-4 py-2 text-left text-gray-900 dark:text-white">Categoria</th>
              <th className="px-4 py-2 text-right text-gray-900 dark:text-white">Budget</th>
              <th className="px-4 py-2 text-right text-gray-900 dark:text-white">Spese</th>
              <th className="px-4 py-2 text-right text-gray-900 dark:text-white">Differenza</th>
            </tr>
          </thead>
          <tbody>
            {datiGrafico.map(({ categoria, budget, spese, differenza }) => (
              <tr key={categoria} className="border-t border-gray-200 dark:border-gray-700">
                <td className="px-4 py-2 text-gray-900 dark:text-white">{categoria}</td>
                <td className="px-4 py-2 text-right text-gray-900 dark:text-white">{budget.toFixed(2)} €</td>
                <td className="px-4 py-2 text-right text-gray-900 dark:text-white">{spese.toFixed(2)} €</td>
                <td className={`px-4 py-2 text-right ${differenza > 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                  {differenza.toFixed(2)} €
                </td>
              </tr>
            ))}
            <tr className="border-t-2 border-gray-300 dark:border-gray-600 font-bold">
              <td className="px-4 py-2 text-gray-900 dark:text-white">TOTALE</td>
              <td className="px-4 py-2 text-right text-gray-900 dark:text-white">{totaleBudget.toFixed(2)} €</td>
              <td className="px-4 py-2 text-right text-gray-900 dark:text-white">{totaleSpese.toFixed(2)} €</td>
              <td className={`px-4 py-2 text-right ${totaleDifferenza > 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                {totaleDifferenza.toFixed(2)} €
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default Budget;
