import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import BASE_URL from './config';

function Home() {
  const navigate = useNavigate();
  const [tipo, setTipo] = useState('spesa');
  const [importo, setImporto] = useState('');
  const [categoria, setCategoria] = useState('');
  const [descrizione, setDescrizione] = useState('');
  const [data, setData] = useState('');

  const categorieSpese = [
    "Abbigliamento", "Abbonamenti", "Acqua", "Alimentari", "Altre spese",
    "Bar", "Cinema Mostre Cultura", "Elettricità",
    "Giardinaggio/Agricoltura/Falegnameria", "Manutenzione/Arredamento casa",
    "Mutuo", "Regali", "Ristorante", "Salute", "Sport/Attrezzatura sportiva",
    "Tecnologia", "Vacanza", "Vela"
  ];

  const categorieEntrate = [
    "Stipendio", "Investimenti", "Vendite", "Rimborsi", "Regalo", "MBO", "Welfare", "Altro"
  ];
  
  const aggiungiTransazione = e => {
    e.preventDefault();
    const endpoint = tipo === 'spesa' ? 'spese' : 'entrate';
    const dataTransazione = data || new Date().toISOString().split('T')[0];

    axios.post(`${BASE_URL}/api/${endpoint}`, {
      descrizione,
      importo: tipo === 'spesa' ? -Math.abs(Number(importo)) : Math.abs(Number(importo)),
      categoria,
      data: dataTransazione
    })
      .then(() => {
        setDescrizione('');
        setImporto('');
        setCategoria('');
        setData('');
        window.location.reload();
      })
      .catch(err => console.error(`Errore nell'inserimento della ${tipo}:`, err));
  };

  return (
    <div className="theme-container p-6">
      <h1 className="text-4xl font-bold text-center mb-8 text-indigo-700 dark:text-indigo-300">
        Inserisci transazione
      </h1>

      <form onSubmit={aggiungiTransazione} className="max-w-md mx-auto">
        {/* Tipo Transazione */}
        <div className="mb-6">
          <div className="flex rounded-md shadow-sm">
            <button
              type="button"
              className={`w-1/2 py-3 px-4 text-center text-sm font-medium rounded-l-lg focus:outline-none ${
                tipo === 'spesa'
                  ? 'bg-red-600 text-white'
                  : 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
              }`}
              onClick={() => {
                setTipo('spesa');
                setCategoria('');
              }}
            >
              Spesa
            </button>
            <button
              type="button" 
              className={`w-1/2 py-3 px-4 text-center text-sm font-medium rounded-r-lg focus:outline-none ${
                tipo === 'entrata'
                  ? 'bg-green-600 text-white' 
                  : 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
              }`}
              onClick={() => {
                setTipo('entrata');
                setCategoria('');
              }}
            >
              Entrata
            </button>
          </div>
        </div>

        <div className="w-full max-w-md">
          <input
            className="w-full px-6 py-4 text-lg bg-white dark:bg-gray-700 border-2 border-blue-300 dark:border-blue-600 rounded-lg shadow-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 hover:border-blue-400 text-white dark:text-white"
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
            className="w-full px-6 py-4 text-lg bg-white dark:bg-gray-700 border-2 border-blue-300 dark:border-blue-600 rounded-lg shadow-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 hover:border-blue-400 text-white dark:text-white"
            value={categoria}
            onChange={e => setCategoria(e.target.value)}
            required
          >
            <option value="">Seleziona categoria</option>
            {(tipo === 'spesa' ? categorieSpese : categorieEntrate).map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>

        <div className="w-full max-w-md">
          <input
            className="w-full px-6 py-4 text-lg bg-white dark:bg-gray-700 border-2 border-blue-300 dark:border-blue-600 rounded-lg shadow-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 hover:border-blue-400 text-white dark:text-white"
            type="text"
            placeholder="Descrizione (facoltativa)"
            value={descrizione}
            onChange={e => setDescrizione(e.target.value)}
          />
        </div>

        <div className="w-full max-w-md">
          <input
            className="w-full px-6 py-4 text-lg bg-white dark:bg-gray-700 border-2 border-blue-300 dark:border-blue-600 rounded-lg shadow-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 hover:border-blue-400 text-white dark:text-white"
            type="date"
            placeholder="Data (facoltativa)"
            value={data}
            onChange={e => setData(e.target.value)}
          />
        </div>

        <button
          type="submit"
          className="px-8 py-4 text-lg font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-lg transition-colors duration-200 transform hover:scale-105"
        >
          Aggiungi
        </button>
      </form>
    </div>
  );
}

export default Home;