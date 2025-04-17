import React from 'react';
import { useState, useEffect } from 'react';
import axios from 'axios';
import BASE_URL from './config';

function Home() {
  const [descrizione, setDescrizione] = useState('');
  const [importo, setImporto] = useState('');
  const [categoria, setCategoria] = useState('');
  const [speseDelMese, setSpeseDelMese] = useState([]);
  const totaleMeseCorrente = speseDelMese.reduce((acc, spesa) => acc + spesa.importo, 0);

  useEffect(() => {
    axios.get(`${BASE_URL}/api/spese`)
      .then(res => {
        const oggi = new Date();
        const meseCorrente = oggi.getMonth();
        const annoCorrente = oggi.getFullYear();
  
        const speseMese = res.data.filter(spesa => {
          const dataSpesa = new Date(spesa.data);
          return (
            dataSpesa.getMonth() === meseCorrente &&
            dataSpesa.getFullYear() === annoCorrente
          );
        });
  
        setSpeseDelMese(speseMese);
      })
      .catch(err => console.error("Errore nel caricamento delle spese:", err));
  }, []);
  
  const aggiungiSpesa = e => {
    e.preventDefault();
    axios.post(`${BASE_URL}/api/spese`, {
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
      .catch(err => console.error("❌ Errore nell'aggiunta della spesa:", err));
  };

  return (
    <div className="theme-container max-w-2xl mx-auto px-4">
      <h1 className="text-4xl font-bold text-center text-blue-800 dark:text-blue-300 mb-8">
        Aggiungi una spesa
      </h1>

      <div className="bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 p-4 rounded-lg mb-8 shadow-md text-center text-xl font-semibold">
        Totale spese di {new Date().toLocaleString('default', { month: 'long' })}:{' '}
        {totaleMeseCorrente.toFixed(2)} €
      </div>

      <form onSubmit={aggiungiSpesa} className="space-y-6">
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
            <select
              className="w-full px-6 py-4 text-lg bg-white dark:bg-gray-700 border-2 border-blue-300 dark:border-blue-600 rounded-lg shadow-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 hover:border-blue-400"
              value={categoria}
              onChange={e => setCategoria(e.target.value)}
              required
            >
              <option value="">Seleziona categoria</option>
              <option value="Abbigliamento">Abbigliamento</option>
              <option value="Abbonamenti">Abbonamenti</option>
              <option value="Acqua">Acqua</option>
              <option value="Alimentari">Alimentari</option>
              <option value="Altre spese">Altre spese</option>
              <option value="Bar">Bar</option>
              <option value="Cinema Mostre Cultura">Cinema Mostre Cultura</option>
              <option value="Elettricità">Elettricità</option>
              <option value="Giardinaggio/Agricoltura/Falegnameria">Giardinaggio/Agricoltura/Falegnameria</option>
              <option value="Manutenzione/Arredamento casa">Manutenzione/Arredamento casa</option>
              <option value="Mutuo">Mutuo</option>
              <option value="Regali">Regali</option>
              <option value="Ristorante">Ristorante</option>
              <option value="Salute">Salute</option>
              <option value="Sport/Attrezzatura sportiva">Sport/Attrezzatura sportiva</option>
              <option value="Tecnologia">Tecnologia</option>
              <option value="Vacanza">Vacanza</option>
              <option value="Vela">Vela</option>
            </select>
          </div>

          <div className="w-full max-w-md">
            <input
              className="w-full px-6 py-4 text-lg bg-white dark:bg-gray-700 border-2 border-blue-300 dark:border-blue-600 rounded-lg shadow-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 hover:border-blue-400"
              type="text"
              placeholder="Descrizione (facoltativa)"
              value={descrizione}
              onChange={e => setDescrizione(e.target.value)}
            />
          </div>

          <button
            type="submit"
            className="px-8 py-4 text-lg font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-lg transition-colors duration-200 transform hover:scale-105"
          >
            Aggiungi
          </button>
        </div>
      </form>
    </div>
  );
}

export default Home;