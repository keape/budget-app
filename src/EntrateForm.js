import React from 'react';
import { useState, useEffect } from 'react';
import axios from 'axios';
import BASE_URL from './config';

function EntrateForm() {
  const [descrizione, setDescrizione] = useState('');
  const [importo, setImporto] = useState('');
  const [categoria, setCategoria] = useState('');
  const [entrateDelMese, setEntrateDelMese] = useState([]);
  const totaleMeseCorrente = entrateDelMese.reduce((acc, entrata) => acc + entrata.importo, 0);

  useEffect(() => {
    axios.get(`${BASE_URL}/api/entrate`)
      .then(res => {
        const oggi = new Date();
        const meseCorrente = oggi.getMonth();
        const annoCorrente = oggi.getFullYear();
  
        const entrateMese = res.data.filter(entrata => {
          const dataEntrata = new Date(entrata.data);
          return (
            dataEntrata.getMonth() === meseCorrente &&
            dataEntrata.getFullYear() === annoCorrente
          );
        });
  
        setEntrateDelMese(entrateMese);
      })
      .catch(err => console.error("Errore nel caricamento delle entrate:", err));
  }, []);
  
  const aggiungiEntrata = e => {
    e.preventDefault();
    axios.post(`${BASE_URL}/api/entrate`, {
      descrizione,
      importo: Number(importo),
      categoria
    })
      .then(() => {
        setDescrizione('');
        setImporto('');
        setCategoria('');
        window.location.reload();
      })
      .catch(err => console.error("❌ Errore nell'aggiunta dell'entrata:", err));
  };

  return (
    <div className="theme-container max-w-2xl mx-auto px-4">
      <h1 className="text-4xl font-bold text-center text-blue-800 dark:text-blue-300 mb-8">
        Aggiungi un'entrata
      </h1>

      <div className="bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 p-4 rounded-lg mb-8 shadow-md text-center text-xl font-semibold">
        Totale entrate di {new Date().toLocaleString('default', { month: 'long' })}:{' '}
        {totaleMeseCorrente.toFixed(2)} €
      </div>

      <form onSubmit={aggiungiEntrata} className="space-y-6">
        <div className="flex flex-col items-center space-y-4">
          <div className="w-full max-w-md">
            <input
              className="w-full px-6 py-4 text-lg bg-white dark:bg-gray-700 border-2 border-blue-300 dark:border-blue-600 rounded-lg shadow-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 hover:border-blue-400"
              type="number"
              step="0.01"
              placeholder="Importo"
              value={importo}
              onChange={e => setImporto(e.target.value)}
              required
            />
          </div>

          <div className="w-full max-w-md">
            <input
              className="w-full px-6 py-4 text-lg bg-white dark:bg-gray-700 border-2 border-blue-300 dark:border-blue-600 rounded-lg shadow-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 hover:border-blue-400"
              type="text"
              placeholder="Descrizione (opzionale)"
              value={descrizione}
              onChange={e => setDescrizione(e.target.value)}
            />
          </div>

          <div className="w-full max-w-md">
            <select
              className="w-full px-6 py-4 text-lg bg-white dark:bg-gray-700 border-2 border-blue-300 dark:border-blue-600 rounded-lg shadow-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 hover:border-blue-400"
              value={categoria}
              onChange={e => setCategoria(e.target.value)}
              required
            >
              <option value="">Seleziona categoria</option>
              <option value="Stipendio">Stipendio</option>
              <option value="Investimenti">Investimenti</option>
              <option value="Vendite">Vendite</option>
              <option value="Rimborsi">Rimborsi</option>
              <option value="Regalo">Regalo</option>
              <option value="Altro">Altro</option>
            </select>
          </div>

          <div className="w-full max-w-md">
            <button
              type="submit"
              className="w-full px-6 py-4 text-lg font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-md transition-colors duration-200"
            >
              Aggiungi
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

export default EntrateForm; 