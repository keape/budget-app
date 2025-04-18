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
  const [transazioni, setTransazioni] = useState([]);
  const [filtroCategoria, setFiltroCategoria] = useState('');
  const [filtroTipo, setFiltroTipo] = useState('tutte'); // 'entrate', 'uscite', 'tutte'
  const [dataInizio, setDataInizio] = useState('');
  const [dataFine, setDataFine] = useState('');
  const { darkMode } = useTheme();
  const [transazioneDaModificare, setTransazioneDaModificare] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState(null);

  // Legge i parametri dall'URL all'avvio
  useEffect(() => {
    const categoria = searchParams.get('categoria');
    const mese = searchParams.get('mese');
    const anno = searchParams.get('anno');
    const tipo = searchParams.get('tipo');

    if (categoria) setFiltroCategoria(categoria);
    if (tipo) setFiltroTipo(tipo);

    // Imposta le date in base al mese e anno se presenti nell'URL
    if (anno) {
      if (mese) {
        const primoDelMese = new Date(anno, parseInt(mese), 1);
        const ultimoDelMese = new Date(anno, parseInt(mese) + 1, 0);
        setDataInizio(primoDelMese.toISOString().split('T')[0]);
        setDataFine(ultimoDelMese.toISOString().split('T')[0]);
      } else {
        const primoGiornoAnno = new Date(anno, 0, 1);
        const ultimoGiornoAnno = new Date(anno, 11, 31);
        setDataInizio(primoGiornoAnno.toISOString().split('T')[0]);
        setDataFine(ultimoGiornoAnno.toISOString().split('T')[0]);
      }
    }
  }, [searchParams]);

  const caricaTransazioni = async () => {
    try {
      const [speseRes, entrateRes] = await Promise.all([
        axios.get(`${BASE_URL}/api/spese`),
        axios.get(`${BASE_URL}/api/entrate`)
      ]);

      // Log per debug
      console.log('Spese raw:', speseRes.data);
      console.log('Entrate raw:', entrateRes.data);

      // Gestiamo le spese come valori negativi
      const spese = speseRes.data.map(s => ({
        ...s,
        tipo: 'uscita',
        importo: s.importo > 0 ? -s.importo : s.importo // Se positivo, rendiamolo negativo
      }));

      // Gestiamo le entrate come valori positivi
      const entrate = entrateRes.data.map(e => ({
        ...e,
        tipo: 'entrata',
        importo: Math.abs(e.importo) // Assicuriamoci che sia positivo
      }));

      console.log('Spese processate:', spese);
      console.log('Entrate processate:', entrate);
      
      setTransazioni([...spese, ...entrate]);
    } catch (err) {
      console.error("Errore nel caricamento delle transazioni:", err);
    }
  };

  useEffect(() => {
    caricaTransazioni();
  }, []);

  const eliminaTransazione = async (id, tipo) => {
    if (window.confirm('Sei sicuro di voler eliminare questa transazione?')) {
      try {
        const endpoint = tipo === 'entrata' ? 'entrate' : 'spese';
        await axios.delete(`${BASE_URL}/api/${endpoint}/${id}`);
        caricaTransazioni();
      } catch (err) {
        console.error("Errore nell'eliminazione della transazione:", err);
      }
    }
  };

  const transazioniFiltrate = transazioni.filter(t => {
    // Se il tipo non è 'tutte', filtra per tipo specifico (uscita/entrata)
    if (filtroTipo === 'uscita' && t.tipo !== 'uscita') return false;
    if (filtroTipo === 'entrata' && t.tipo !== 'entrata') return false;
    
    // Se c'è una categoria selezionata, filtra per categoria
    if (filtroCategoria && t.categoria !== filtroCategoria) return false;
  
    // Se ci sono date impostate, filtra per date
    if (dataInizio || dataFine) {
      const dataTransazione = new Date(t.data).setHours(0, 0, 0, 0);
      
      if (dataInizio) {
        const inizio = new Date(dataInizio).setHours(0, 0, 0, 0);
        if (dataTransazione < inizio) return false;
      }
      
      if (dataFine) {
        const fine = new Date(dataFine).setHours(0, 0, 0, 0);
        if (dataTransazione > fine) return false;
      }
    }
  
    return true;
  });

  // Aggiungi log per debug
  console.log('Filtro tipo:', filtroTipo);
  console.log('Transazioni filtrate:', transazioniFiltrate.length);
  console.log('Dettaglio transazioni filtrate:', transazioniFiltrate);

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
  const apriModifica = (transazione) => {
    setTransazioneDaModificare(transazione);
    setIsModalOpen(true);
  };

  // Funzione per salvare le modifiche
  const salvaModifiche = () => {
    if (!transazioneDaModificare) return;

    axios.put(`${BASE_URL}/api/spese/${transazioneDaModificare._id}`, {
      descrizione: transazioneDaModificare.descrizione,
      importo: Number(transazioneDaModificare.importo),
      categoria: transazioneDaModificare.categoria,
      data: transazioneDaModificare.data
    })
      .then(() => {
        setIsModalOpen(false);
        setTransazioneDaModificare(null);
        caricaTransazioni(); // Ricarica le transazioni dopo la modifica
      })
      .catch(err => console.error("Errore nella modifica della transazione:", err));
  };

  const handleEdit = (transaction) => {
    setEditingTransaction(transaction);
    setShowEditModal(true);
  };

  const handleSaveEdit = async () => {
    try {
      const endpoint = editingTransaction.tipo === 'entrata' 
        ? 'entrate'
        : 'spese';

      const response = await axios.put(`${BASE_URL}/api/${endpoint}/${editingTransaction._id}`, {
        importo: editingTransaction.tipo === 'entrata' ? Math.abs(editingTransaction.importo) : -Math.abs(editingTransaction.importo),
        descrizione: editingTransaction.descrizione || '',
        categoria: editingTransaction.categoria
      });

      if (response.data) {
        setShowEditModal(false);
        setEditingTransaction(null);
        await caricaTransazioni(); // Ricarica le transazioni dopo la modifica
      }
    } catch (error) {
      console.error('Errore durante il salvataggio:', error);
      alert('Si è verificato un errore durante il salvataggio. Riprova.');
    }
  };

  return (
    <div className={`theme-container ${darkMode ? 'dark' : ''}`}>
      <h2 className="text-3xl font-bold text-center mb-8 text-blue-800 dark:text-blue-200">
        Filtra transazioni
      </h2>

      <div className="max-w-4xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          {/* Filtro Tipo */}
          <div>
            <label className="block font-bold mb-2 text-orange-700 dark:text-orange-300">
              Tipo di transazione
            </label>
            <select
              className="theme-input w-full"
              value={filtroTipo}
              onChange={e => setFiltroTipo(e.target.value)}
            >
              <option value="tutte">Tutte le transazioni</option>
              <option value="entrata">Solo entrate</option>
              <option value="uscita">Solo uscite</option>
            </select>
          </div>

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
              {/* Categorie per le spese */}
              {filtroTipo !== 'entrata' && <>
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
              </>}
              {/* Categorie per le entrate */}
              {filtroTipo !== 'uscita' && <>
                <option value="Stipendio">Stipendio</option>
                <option value="Investimenti">Investimenti</option>
                <option value="Vendite">Vendite</option>
                <option value="Rimborsi">Rimborsi</option>
                <option value="Regalo">Regalo</option>
                <option value="Altro">Altro</option>
              </>}
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
              setFiltroTipo('tutte');
              setDataInizio('');
              setDataFine('');
            }}
          >
            Pulisci filtri
          </button>
        </div>
      </div>

      {/* Lista delle transazioni */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
        {transazioniFiltrate.map(transazione => {
          const isEntrata = transazione.tipo === 'entrata';
          const importo = Number(transazione.importo);
          const displayImporto = Math.abs(importo);
          const segno = isEntrata ? '+' : '-';

          return (
            <div
              key={transazione._id}
              className={`p-4 rounded-md shadow-sm border ${categoriaClasse(transazione.categoria)} hover:shadow-md transition-shadow duration-200 bg-white dark:bg-gray-800`}
            >
              <div className="flex justify-between items-start">
                <div>
                  <div className="flex items-center gap-2">
                    <div className="font-bold text-sm text-gray-900 dark:text-gray-100">{transazione.categoria}</div>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      isEntrata
                        ? 'bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-100' 
                        : 'bg-red-100 text-red-800 dark:bg-red-800 dark:text-red-100'
                    }`}>
                      {isEntrata ? 'Entrata' : 'Uscita'}
                    </span>
                  </div>
                  <div className={`font-semibold text-lg ${
                    isEntrata
                      ? 'text-green-600 dark:text-green-400' 
                      : 'text-red-600 dark:text-red-400'
                  }`}>
                    {segno}{displayImporto.toFixed(2)} €
                  </div>
                  {transazione.descrizione && (
                    <div className="italic text-gray-600 dark:text-gray-400 text-sm mt-1">{transazione.descrizione}</div>
                  )}
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {new Date(transazione.data).toLocaleDateString()}
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  {/* Pulsante modifica (per tutte le transazioni) */}
                  <button
                    onClick={() => handleEdit(transazione)}
                    className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                    </svg>
                  </button>
                  <button
                    onClick={() => eliminaTransazione(transazione._id, transazione.tipo)}
                    className="text-red-500 hover:text-red-700 p-1 rounded hover:bg-red-100 transition-colors duration-200"
                    title="Elimina transazione"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Grafici statistici */}
      {transazioniFiltrate.length > 0 && (
        <>
          <div className="mt-8">
            <h3 className="theme-title">Distribuzione per categoria</h3>
            <ResponsiveContainer width="100%" height={700}>
              <PieChart>
                <Pie
                  data={Object.entries(
                    transazioniFiltrate.reduce((acc, t) => {
                      acc[t.categoria] = (acc[t.categoria] || 0) + t.importo;
                      return acc;
                    }, {})
                  )
                    .map(([categoria, valore]) => ({ categoria, valore }))
                    .sort((a, b) => b.valore - a.valore)}
                  dataKey="valore"
                  nameKey="categoria"
                  cx="50%"
                  cy="50%"
                  outerRadius={250}
                  fill="#8884d8"
                  label={({ categoria, percent }) => `${categoria}: ${(percent * 100).toFixed(0)}%`}
                >
                  {Object.entries(transazioniFiltrate.reduce((acc, t) => {
                    acc[t.categoria] = (acc[t.categoria] || 0) + t.importo;
                    return acc;
                  }, {})).map((_, index) => (
                    <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend layout="vertical" align="right" verticalAlign="middle" />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </>
      )}

      {/* Modal di modifica */}
      {showEditModal && editingTransaction && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full flex items-center justify-center">
          <div className="bg-white dark:bg-gray-800 p-8 rounded-lg shadow-xl max-w-md w-full">
            <h3 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">
              Modifica {editingTransaction.tipo === 'entrata' ? 'Entrata' : 'Spesa'}
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Importo
                </label>
                <input
                  type="number"
                  value={editingTransaction.importo}
                  onChange={(e) => setEditingTransaction({
                    ...editingTransaction,
                    importo: e.target.value
                  })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Descrizione
                </label>
                <input
                  type="text"
                  value={editingTransaction.descrizione || ''}
                  onChange={(e) => setEditingTransaction({
                    ...editingTransaction,
                    descrizione: e.target.value
                  })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Categoria
                </label>
                <select
                  value={editingTransaction.categoria}
                  onChange={(e) => setEditingTransaction({
                    ...editingTransaction,
                    categoria: e.target.value
                  })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                >
                  {editingTransaction.tipo === 'entrata' ? (
                    <>
                      <option value="Stipendio">Stipendio</option>
                      <option value="Investimenti">Investimenti</option>
                      <option value="Bonus">Bonus</option>
                      <option value="Altro">Altro</option>
                    </>
                  ) : (
                    <>
                      <option value="Cibo">Cibo</option>
                      <option value="Trasporti">Trasporti</option>
                      <option value="Casa">Casa</option>
                      <option value="Svago">Svago</option>
                      <option value="Altro">Altro</option>
                    </>
                  )}
                </select>
              </div>
            </div>

            <div className="mt-6 flex justify-end space-x-3">
              <button
                onClick={() => setShowEditModal(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
              >
                Annulla
              </button>
              <button
                onClick={handleSaveEdit}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Salva
              </button>
            </div>
          </div>
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
