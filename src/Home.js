import React from 'react';
import { useState, useEffect } from 'react';
import axios from 'axios';
import BASE_URL from './config';

function Home() {
  const [descrizione, setDescrizione] = useState('');
  const [importo, setImporto] = useState('');
  const [categoria, setCategoria] = useState('');
  const [tipo, setTipo] = useState('spesa'); // 'spesa' or 'entrata'
  const [data, setData] = useState(''); // nuovo state per la data
  const [transazioniDelMese, setTransazioniDelMese] = useState([]);

  const categorieSpese = [
    "Abbigliamento", "Abbonamenti", "Acqua", "Alimentari", "Altre spese",
    "Bar", "Cinema Mostre Cultura", "Elettricità",
    "Giardinaggio/Agricoltura/Falegnameria", "Manutenzione/Arredamento casa",
    "Mutuo", "Regali", "Ristorante", "Salute", "Sport/Attrezzatura sportiva",
    "Tecnologia", "Vacanza", "Vela"
  ];

  const categorieEntrate = [
    "Stipendio", "Investimenti", "Vendite", "Rimborsi", "Regalo", "MBO", "Welfare", 
    "Consulenze", "Interessi", "Ticket", "Altro"
  ];

  useEffect(() => {
    const endpoint = tipo === 'spesa' ? 'spese' : 'entrate';
    axios.get(`${BASE_URL}/api/${endpoint}`)
      .then(res => {
        const oggi = new Date();
        const meseCorrente = oggi.getMonth();
        const annoCorrente = oggi.getFullYear();
  
        const transazioniMese = res.data.filter(t => {
          const dataTransazione = new Date(t.data);
          return (
            dataTransazione.getMonth() === meseCorrente &&
            dataTransazione.getFullYear() === annoCorrente
          );
        });
  
        setTransazioniDelMese(transazioniMese);
      })
      .catch(err => console.error(`Errore nel caricamento delle ${tipo === 'spesa' ? 'spese' : 'entrate'}:`, err));
  }, [tipo]);
  
  const aggiungiTransazione = e => {
    e.preventDefault();
    const endpoint = tipo === 'spesa' ? 'spese' : 'entrate';
    
    // Gestione della data con timezone
    let dataTransazione;
    if (data) {
      // Se è stata selezionata una data, la impostiamo a mezzanotte UTC di quel giorno
      const selectedDate = new Date(data);
      selectedDate.setUTCHours(0, 0, 0, 0);
      dataTransazione = selectedDate.toISOString();
    } else {
      // Se non è stata selezionata una data, usiamo la data corrente a mezzanotte UTC
      const today = new Date();
      today.setUTCHours(0, 0, 0, 0);
      dataTransazione = today.toISOString();
    }

    axios.post(`${BASE_URL}/api/${endpoint}`, {
      descrizione,
      importo: Number(importo),
      categoria,
      data: dataTransazione
    })
      .then(() => {
        setDescrizione('');
        setImporto('');
        setCategoria('');
        setData(''); // reset del campo data
        window.location.reload();
      })
      .catch(err => console.error(`❌ Errore nell'aggiunta della ${tipo}:`, err));
  };

  const totaleMeseCorrente = transazioniDelMese.reduce((acc, t) => acc + t.importo, 0);

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-4xl font-bold text-center mb-8 text-indigo-600 dark:text-indigo-300">
        Inserisci transazione
      </h1>

      <div className="bg-indigo-100 dark:bg-indigo-900 text-white p-4 rounded-lg mb-8 shadow-md text-center">
        <h2 className="text-2xl font-bold">
          Totale {tipo === 'spesa' ? 'spese' : 'entrate'} di {new Date().toLocaleString('default', { month: 'long' })}:{' '}
          {totaleMeseCorrente.toFixed(2)} €
        </h2>
      </div>

      <form onSubmit={aggiungiTransazione} className="space-y-6">
        <div className="flex flex-col items-center space-y-4">
          {/* Tipo di transazione */}
          <div className="w-full max-w-md">
            <select
              className="w-full px-6 py-4 text-lg bg-white dark:bg-gray-700 border-2 border-blue-300 dark:border-blue-600 rounded-lg shadow-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 hover:border-blue-400 text-white dark:text-white"
              value={tipo}
              onChange={e => {
                setTipo(e.target.value);
                setCategoria(''); // Reset categoria when type changes
              }}
              required
            >
              <option value="spesa">Spesa</option>
              <option value="entrata">Entrata</option>
            </select>
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
        </div>
      </form>
    </div>
  );
}

export default Home;