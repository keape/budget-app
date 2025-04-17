// Filtri.js
import { useState, useEffect } from 'react';
import axios from 'axios';
import { useSearchParams } from 'react-router-dom';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, PieChart, Pie, Cell, ResponsiveContainer, Legend, LabelList
} from 'recharts';
import React from 'react';
import { useTheme } from './ThemeContext';
import BASE_URL from './config';


function Filtri() {
  const [searchParams] = useSearchParams();
  const [spese, setSpese] = useState([]);
  const [filtroCategoria, setFiltroCategoria] = useState('');
  const [dataInizio, setDataInizio] = useState('');
  const [dataFine, setDataFine] = useState('');
  const { darkMode } = useTheme();
  const [spesaDaModificare, setSpesaDaModificare] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const fileInputRef = React.useRef();

  // Legge i parametri dall'URL all'avvio
  useEffect(() => {
    const categoria = searchParams.get('categoria');
    const mese = searchParams.get('mese');
    const anno = searchParams.get('anno');

    // Imposta la categoria se presente nell'URL
    if (categoria) {
      setFiltroCategoria(categoria);
    }

    // Imposta le date in base al mese e anno se presenti nell'URL
    if (anno) {
      if (mese) {
        // Se abbiamo sia mese che anno, impostiamo l'intervallo per quel mese specifico
        const primoDelMese = new Date(anno, parseInt(mese), 1);
        const ultimoDelMese = new Date(anno, parseInt(mese) + 1, 0);
        setDataInizio(primoDelMese.toISOString().split('T')[0]);
        setDataFine(ultimoDelMese.toISOString().split('T')[0]);
      } else {
        // Se abbiamo solo l'anno, impostiamo l'intervallo per l'intero anno
        const primoGiornoAnno = new Date(anno, 0, 1);
        const ultimoGiornoAnno = new Date(anno, 11, 31);
        setDataInizio(primoGiornoAnno.toISOString().split('T')[0]);
        setDataFine(ultimoGiornoAnno.toISOString().split('T')[0]);
      }
    }
  }, [searchParams]);

  const caricaSpese = () => {
    axios.get(`${BASE_URL}/api/spese`)
      .then(res => setSpese(res.data))
      .catch(err => console.error("Errore nel caricamento delle spese:", err));
  };

  useEffect(() => {
    caricaSpese();
  }, []);

  const eliminaSpesa = (id) => {
    if (window.confirm('Sei sicuro di voler eliminare questa spesa?')) {
      axios.delete(`${BASE_URL}/api/spese/${id}`)
        .then(() => {
          caricaSpese(); // Ricarica le spese dopo l'eliminazione
        })
        .catch(err => console.error("Errore nell'eliminazione della spesa:", err));
    }
  };

  const speseFiltrate = spese.filter(spesa => {
    if (filtroCategoria && spesa.categoria !== filtroCategoria) return false;
  
    const dataSpesa = new Date(spesa.data).setHours(0, 0, 0, 0);
    const inizio = dataInizio ? new Date(dataInizio).setHours(0, 0, 0, 0) : null;
    const fine = dataFine ? new Date(dataFine).setHours(0, 0, 0, 0) : null;
  
    if (inizio && dataSpesa < inizio) return false;
    if (fine && dataSpesa > fine) return false;
  
    return true;
  });
  

  const spesePerMese = filtroCategoria
    ? speseFiltrate.reduce((acc, spesa) => {
        const data = new Date(spesa.data);
        const mese = `${data.toLocaleString('default', { month: 'short' })} ${data.getFullYear()}`;
        acc[mese] = (acc[mese] || 0) + spesa.importo;
        return acc;
      }, {})
    : {};

  const spesePerCategoria = dataInizio || dataFine
    ? speseFiltrate.reduce((acc, spesa) => {
        acc[spesa.categoria] = (acc[spesa.categoria] || 0) + spesa.importo;
        return acc;
      }, {})
    : {};

  const colors = ['#60a5fa', '#818cf8', '#34d399', '#f472b6', '#fcd34d', '#f87171'];

  const getCategoriaColor = (categoria) => {
    const colori = {
      'Abbigliamento': 'border-pink-400',
      'Abbonamenti': 'border-purple-400',
      'Acqua': 'border-blue-400',
      'Alimentari': 'border-yellow-400',
      'Altre spese': 'border-gray-400',
      'Bar': 'border-rose-400',
      'Cinema Mostre Cultura': 'border-indigo-400',
      'Elettricità': 'border-amber-400',
      'Giardinaggio/Agricoltura/Falegnameria': 'border-green-400',
      'Manutenzione/Arredamento casa': 'border-orange-400',
      'Mutuo': 'border-red-400',
      'Regali': 'border-fuchsia-400',
      'Ristorante': 'border-emerald-400',
      'Salute': 'border-lime-400',
      'Sport/Attrezzatura sportiva': 'border-cyan-400',
      'Tecnologia': 'border-teal-400',
      'Vacanza': 'border-sky-400',
      'Vela': 'border-violet-400'
    };
  

    


    return colori[categoria] || 'border-slate-300'; // default se la categoria non è mappata
  };
  
    function categoriaClasse(categoria) {
      switch (categoria) {
        case 'Abbigliamento': return 'border-pink-400';
        case 'Abbonamenti': return 'border-purple-400';
        case 'Acqua': return 'border-blue-400';
        case 'Alimentari': return 'border-yellow-400';
        case 'Altre spese': return 'border-gray-400';
        case 'Bar': return 'border-rose-400';
        case 'Cinema Mostre Cultura': return 'border-indigo-400';
        case 'Elettricità': return 'border-amber-400';
        case 'Giardinaggio/Agricoltura/Falegnameria': return 'border-green-400';
        case 'Manutenzione/Arredamento casa': return 'border-orange-400';
        case 'Mutuo': return 'border-red-400';
        case 'Regali': return 'border-fuchsia-400';
        case 'Ristorante': return 'border-emerald-400';
        case 'Salute': return 'border-lime-400';
        case 'Sport/Attrezzatura sportiva': return 'border-cyan-400';
        case 'Tecnologia': return 'border-teal-400';
        case 'Vacanza': return 'border-sky-400';
        case 'Vela': return 'border-violet-400';
        default: return 'border-slate-300';
      }
    }

  // Funzione per aprire il modal di modifica
  const apriModifica = (spesa) => {
    setSpesaDaModificare(spesa);
    setIsModalOpen(true);
  };

  // Funzione per salvare le modifiche
  const salvaModifiche = () => {
    if (!spesaDaModificare) return;

    axios.put(`${BASE_URL}/api/spese/${spesaDaModificare._id}`, {
      descrizione: spesaDaModificare.descrizione,
      importo: Number(spesaDaModificare.importo),
      categoria: spesaDaModificare.categoria,
      data: spesaDaModificare.data
    })
      .then(() => {
        setIsModalOpen(false);
        setSpesaDaModificare(null);
        caricaSpese(); // Ricarica le spese dopo la modifica
      })
      .catch(err => console.error("Errore nella modifica della spesa:", err));
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setImporting(true);
    setImportResult(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await axios.post(`${BASE_URL}/api/spese/import`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      setImportResult({
        success: true,
        message: `Importate con successo ${response.data.totaleImportate} spese`
      });
      caricaSpese(); // Ricarica le spese dopo l'importazione
    } catch (error) {
      setImportResult({
        success: false,
        message: error.response?.data?.error || 'Errore durante l\'importazione'
      });
    } finally {
      setImporting(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = ''; // Reset input file
      }
    }
  };

  return (
    <div className={`theme-container ${darkMode ? 'dark' : ''}`}>
      <h2 className="text-3xl font-bold text-center mb-8 text-blue-800 dark:text-blue-200">
        Filtra spese
      </h2>

      {/* Sezione importazione */}
      <div className="max-w-4xl mx-auto mb-8 p-4 bg-white dark:bg-gray-800 rounded-lg shadow">
        <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">
          Importa spese da Excel
        </h3>
        <div className="flex items-center gap-4">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            accept=".xlsx,.xls"
            className="block w-full text-sm text-gray-500 dark:text-gray-400
              file:mr-4 file:py-2 file:px-4
              file:rounded-md file:border-0
              file:text-sm file:font-semibold
              file:bg-blue-50 file:text-blue-700
              dark:file:bg-blue-900 dark:file:text-blue-200
              hover:file:bg-blue-100 dark:hover:file:bg-blue-800"
            disabled={importing}
          />
          {importing && (
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-700 dark:border-blue-300"></div>
          )}
        </div>
        {importResult && (
          <div className={`mt-4 p-3 rounded ${
            importResult.success 
              ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-200' 
              : 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-200'
          }`}>
            {importResult.message}
          </div>
        )}
        <div className="mt-4 text-sm text-gray-600 dark:text-gray-400">
          <p>Il file Excel deve contenere le seguenti colonne:</p>
          <ul className="list-disc list-inside mt-2">
            <li>descrizione (opzionale)</li>
            <li>importo (obbligatorio, numerico)</li>
            <li>categoria (obbligatoria, deve corrispondere a una categoria esistente)</li>
            <li>data (opzionale, formato data)</li>
          </ul>
        </div>
      </div>

      <div className="max-w-4xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          {/* Filtro Categoria */}
          <div>
            <label className="block font-bold mb-2 text-orange-700 dark:text-orange-300">
              Filtra per categoria
            </label>
            <select
              className="theme-input w-full"
              value={filtroCategoria}
              onChange={e => setFiltroCategoria(e.target.value)}
            >
              <option value="">Tutte le categorie</option>
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

          {/* Filtro Date */}
          <div>
            <label className="block font-bold mb-2 text-orange-700 dark:text-orange-300">
              Intervallo date: Da...A
            </label>
            <div className="flex gap-2">
              <input
                className="theme-input flex-1"
                type="date"
                value={dataInizio}
                onChange={e => setDataInizio(e.target.value)}
              />
              <input
                className="theme-input flex-1"
                type="date"
                value={dataFine}
                onChange={e => setDataFine(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Pulsante Pulisci Filtri */}
        <div className="flex justify-center mb-8">
          <button
            className="bg-gray-300 hover:bg-gray-400 text-black font-medium py-2 px-6 rounded transition-colors duration-200"
            onClick={() => {
              setFiltroCategoria('');
              setDataInizio('');
              setDataFine('');
            }}
          >
            Pulisci filtri
          </button>
        </div>
      </div>

      {/* Lista delle spese */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
        {speseFiltrate.map(spesa => (
          <div
            key={spesa._id}
            className={`p-2 rounded-md shadow-sm border ${categoriaClasse(spesa.categoria)} hover:shadow-md transition-shadow duration-200`}
          >
            <div className="flex justify-between items-start">
              <div>
                <div className="font-bold text-sm">{spesa.categoria}</div>
                <div className="text-green-600 font-semibold text-lg">{spesa.importo.toFixed(2)} €</div>
                {spesa.descrizione && (
                  <div className="italic text-red-700 dark:text-red-400 text-sm">{spesa.descrizione}</div>
                )}
                <div className="text-xs text-gray-600 dark:text-gray-400">
                  {new Date(spesa.data).toLocaleDateString()}
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <button
                  onClick={() => apriModifica(spesa)}
                  className="text-blue-500 hover:text-blue-700 p-1 rounded hover:bg-blue-100 transition-colors duration-200"
                  title="Modifica spesa"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </button>
                <button
                  onClick={() => eliminaSpesa(spesa._id)}
                  className="text-red-500 hover:text-red-700 p-1 rounded hover:bg-red-100 transition-colors duration-200"
                  title="Elimina spesa"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Modal di modifica */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-bold mb-4 text-gray-900 dark:text-white">
              Modifica spesa
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Importo
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={spesaDaModificare?.importo || ''}
                  onChange={e => setSpesaDaModificare({
                    ...spesaDaModificare,
                    importo: e.target.value
                  })}
                  className="theme-input w-full"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Categoria
                </label>
                <select
                  value={spesaDaModificare?.categoria || ''}
                  onChange={e => setSpesaDaModificare({
                    ...spesaDaModificare,
                    categoria: e.target.value
                  })}
                  className="theme-input w-full"
                >
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
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Descrizione
                </label>
                <input
                  type="text"
                  value={spesaDaModificare?.descrizione || ''}
                  onChange={e => setSpesaDaModificare({
                    ...spesaDaModificare,
                    descrizione: e.target.value
                  })}
                  className="theme-input w-full"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Data
                </label>
                <input
                  type="date"
                  value={spesaDaModificare?.data ? new Date(spesaDaModificare.data).toISOString().split('T')[0] : ''}
                  onChange={e => setSpesaDaModificare({
                    ...spesaDaModificare,
                    data: e.target.value
                  })}
                  className="theme-input w-full"
                />
              </div>
            </div>
            <div className="mt-6 flex justify-end space-x-3">
              <button
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors duration-200"
              >
                Annulla
              </button>
              <button
                onClick={salvaModifiche}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors duration-200"
              >
                Salva
              </button>
            </div>
          </div>
        </div>
      )}

      {filtroCategoria && Object.keys(spesePerMese).length > 0 && (
        <div className="mt-8">
          <h3 className="theme-title">Andamento mensile per {filtroCategoria}</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={Object.entries(spesePerMese).map(([mese, valore]) => ({ mese, valore }))}>
              <XAxis dataKey="mese" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="valore" fill="#60a5fa">
                <LabelList dataKey="valore" position="top" />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {(dataInizio || dataFine) && Object.keys(spesePerCategoria).length > 0 && (
        <div className="mt-8">
          <h3 className="theme-title">Distribuzione per categoria</h3>
          <ResponsiveContainer width="100%" height={700}>
            <PieChart>
            <Pie
          data={(() => {
            // Trasforma l'oggetto in array e ordina dal valore più alto al più basso
            return Object.entries(spesePerCategoria)
              .map(([categoria, valore]) => ({ categoria, valore }))
              .sort((a, b) => b.valore - a.valore);
          })()}
          dataKey="valore"
          nameKey="categoria"
          cx="50%"
          cy="50%"
          outerRadius={250}
          fill="#8884d8"
          label={({ categoria, percent }) => `${categoria}: ${(percent * 100).toFixed(0)}%`}
        >
          {Object.entries(spesePerCategoria).map((_, index) => (
            <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
          ))}
              </Pie>
              <Tooltip />
              <Legend layout="vertical" align="right" verticalAlign="middle" />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

{/* Tailwind safelist helper - NON RIMUOVERE */}
<div className="hidden">
  <div className="border-pink-400 border-purple-400 border-blue-400 border-yellow-400 border-gray-400 border-rose-400 border-indigo-400 border-amber-400 border-green-400 border-orange-400 border-red-400 border-fuchsia-400 border-emerald-400 border-lime-400 border-cyan-400 border-teal-400 border-sky-400 border-violet-400 border-slate-300" />
</div>



export default Filtri;
