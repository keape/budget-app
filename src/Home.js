import React, { useState, useEffect } from 'react';
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
  const [categorieSpese, setCategorieSpese] = useState([]);
  const [categorieEntrate, setCategorieEntrate] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/login');
      return;
    }

    // Carica le categorie
    const fetchCategorie = async () => {
      try {
        const response = await axios.get(`${BASE_URL}/api/categorie`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (response.data && response.data.categorie) {
          setCategorieSpese(response.data.categorie.spese || []);
          setCategorieEntrate(response.data.categorie.entrate || []);
          
          // Imposta la categoria predefinita
          if (tipo === 'spesa' && response.data.categorie.spese && response.data.categorie.spese.length > 0) {
            setCategoria(response.data.categorie.spese[0]);
          } else if (tipo === 'entrata' && response.data.categorie.entrate && response.data.categorie.entrate.length > 0) {
            setCategoria(response.data.categorie.entrate[0]);
          }
        }
      } catch (error) {
        console.error('Errore nel caricamento delle categorie:', error);
        setError('Impossibile caricare le categorie. Riprova più tardi.');
      }
    };

    fetchCategorie();
  }, [navigate, tipo]);

  const handleTipoChange = (nuovoTipo) => {
    setTipo(nuovoTipo);
    setCategoria(''); // Reset categoria quando cambia il tipo
  };
  
  const aggiungiTransazione = e => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

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
        alert(`${tipo === 'spesa' ? 'Spesa' : 'Entrata'} inserita con successo!`);
        window.location.reload();
      })
      .catch(err => {
        console.error(`Errore nell'inserimento della ${tipo}:`, err);
        setError(`Impossibile inserire la ${tipo}. Riprova più tardi.`);
      })
      .finally(() => {
        setIsLoading(false);
      });
  };

  return (
    <div className="theme-container p-6">
      <h1 className="text-4xl font-bold text-center mb-8 text-indigo-700 dark:text-indigo-300">
        Inserisci transazione
      </h1>

      {error && (
        <div className="mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded max-w-md mx-auto">
          {error}
        </div>
      )}

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
              onClick={() => handleTipoChange('spesa')}
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
              onClick={() => handleTipoChange('entrata')}
            >
              Entrata
            </button>
          </div>
        </div>

        <div className="w-full max-w-md">
          <input
            className="w-full px-6 py-4 text-lg bg-white dark:bg-gray-700 border-2 border-blue-300 dark:border-blue-600 rounded-lg shadow-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 hover:border-blue-400 text-gray-800 dark:text-white"
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
            className="w-full px-6 py-4 text-lg bg-white dark:bg-gray-700 border-2 border-blue-300 dark:border-blue-600 rounded-lg shadow-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 hover:border-blue-400 text-gray-800 dark:text-white"
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
            className="w-full px-6 py-4 text-lg bg-white dark:bg-gray-700 border-2 border-blue-300 dark:border-blue-600 rounded-lg shadow-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 hover:border-blue-400 text-gray-800 dark:text-white"
            type="text"
            placeholder="Descrizione (facoltativa)"
            value={descrizione}
            onChange={e => setDescrizione(e.target.value)}
          />
        </div>

        <div className="w-full max-w-md">
          <input
            className="w-full px-6 py-4 text-lg bg-white dark:bg-gray-700 border-2 border-blue-300 dark:border-blue-600 rounded-lg shadow-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 hover:border-blue-400 text-gray-800 dark:text-white"
            type="date"
            placeholder="Data (facoltativa)"
            value={data}
            onChange={e => setData(e.target.value)}
          />
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className={`px-8 py-4 text-lg font-semibold text-white rounded-lg shadow-lg transition-colors duration-200 transform hover:scale-105 ${
            isLoading ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'
          }`}
        >
          {isLoading ? 'Inserimento in corso...' : 'Aggiungi'}
        </button>
      </form>
    </div>
  );
}

export default Home;