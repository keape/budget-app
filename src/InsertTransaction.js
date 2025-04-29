import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import BASE_URL from './config';

function InsertTransaction() {
  const navigate = useNavigate();
  const [tipo, setTipo] = useState('spesa');
  const [importo, setImporto] = useState('');
  const [categoria, setCategoria] = useState('');
  const [descrizione, setDescrizione] = useState('');
  const [data, setData] = useState(new Date().toISOString().split('T')[0]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [categorieSpese, setCategorieSpese] = useState([]);
  const [categorieEntrate, setCategorieEntrate] = useState([]);
  const [totaleSpeseMese, setTotaleSpeseMese] = useState(0);

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

    // Carica il totale delle spese del mese corrente
    const fetchTotaleSpese = async () => {
      try {
        const meseCorrente = new Date().getMonth();
        const annoCorrente = new Date().getFullYear();
        
        const response = await axios.get(`${BASE_URL}/api/spese`, {
          params: { page: 1, limit: 1000000 },
          headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (response.data && response.data.spese) {
          const speseMese = response.data.spese.filter(spesa => {
            const dataSpesa = new Date(spesa.data);
            return dataSpesa.getMonth() === meseCorrente && dataSpesa.getFullYear() === annoCorrente;
          });
          
          const totale = speseMese.reduce((acc, spesa) => acc + Math.abs(spesa.importo), 0);
          setTotaleSpeseMese(totale);
        }
      } catch (error) {
        console.error('Errore nel calcolo del totale spese:', error);
      }
    };

    fetchCategorie();
    fetchTotaleSpese();
  }, [navigate, tipo]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        navigate('/login');
        return;
      }

      const endpoint = tipo === 'spesa' ? 'spese' : 'entrate';
      const importoNumerico = parseFloat(importo);
      
      // Per le spese, rendi l'importo negativo
      const importoFinale = tipo === 'spesa' ? -Math.abs(importoNumerico) : Math.abs(importoNumerico);

      const response = await axios.post(`${BASE_URL}/api/${endpoint}`, {
        importo: importoFinale,
        categoria,
        descrizione,
        data
      }, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      console.log(`${tipo} inserita con successo:`, response.data);
      
      // Reset form
      setImporto('');
      setDescrizione('');
      
      // Aggiorna il totale delle spese se è stata inserita una spesa
      if (tipo === 'spesa') {
        setTotaleSpeseMese(prev => prev + Math.abs(importoNumerico));
      }
      
      // Mostra conferma
      alert(`${tipo === 'spesa' ? 'Spesa' : 'Entrata'} inserita con successo!`);
      
    } catch (error) {
      console.error(`Errore nell'inserimento della ${tipo}:`, error);
      setError(`Impossibile inserire la ${tipo}. Riprova più tardi.`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleTipoChange = (nuovoTipo) => {
    setTipo(nuovoTipo);
    setCategoria(''); // Reset categoria quando cambia il tipo
  };

  return (
    <div className="theme-container p-6">
      <h1 className="text-4xl font-bold text-center mb-8 text-indigo-700 dark:text-indigo-300">
        Inserisci transazione
      </h1>

      {error && (
        <div className="mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="max-w-md mx-auto">
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

        {/* Importo */}
        <div className="mb-6">
          <label htmlFor="importo" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Importo
          </label>
          <input
            type="number"
            id="importo"
            min="0"
            step="0.01"
            value={importo}
            onChange={(e) => setImporto(e.target.value)}
            required
            className="w-full px-4 py-3 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="0.00"
          />
        </div>

        {/* Categoria */}
        <div className="mb-6">
          <label htmlFor="categoria" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Seleziona categoria
          </label>
          <select
            id="categoria"
            value={categoria}
            onChange={(e) => setCategoria(e.target.value)}
            required
            className="w-full px-4 py-3 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">Seleziona categoria</option>
            {tipo === 'spesa'
              ? categorieSpese.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))
              : categorieEntrate.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
          </select>
        </div>

        {/* Descrizione */}
        <div className="mb-6">
          <label htmlFor="descrizione" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Descrizione (facoltativa)
          </label>
          <input
            type="text"
            id="descrizione"
            value={descrizione}
            onChange={(e) => setDescrizione(e.target.value)}
            className="w-full px-4 py-3 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Descrizione"
          />
        </div>

        {/* Data */}
        <div className="mb-6">
          <label htmlFor="data" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Data
          </label>
          <input
            type="date"
            id="data"
            value={data}
            onChange={(e) => setData(e.target.value)}
            required
            className="w-full px-4 py-3 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* Submit Button */}
        <div className="mt-8">
          <button
            type="submit"
            disabled={isLoading}
            className={`w-full px-6 py-4 text-lg font-medium text-white bg-indigo-600 rounded-md shadow-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${
              isLoading ? 'opacity-70 cursor-not-allowed' : ''
            }`}
          >
            {isLoading ? 'Inserimento in corso...' : 'Aggiungi'}
          </button>
        </div>
      </form>
    </div>
  );
}

export default InsertTransaction;