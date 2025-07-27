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
import LoadingSpinner from './components/LoadingSpinner';

function Filtri() {
  const [searchParams] = useSearchParams();
  const [transazioni, setTransazioni] = useState([]);
  const [filtroCategoria, setFiltroCategoria] = useState('');
  const [filtroTipo, setFiltroTipo] = useState('tutte'); // 'entrate', 'uscite', 'tutte'
  const [dataInizio, setDataInizio] = useState('');
  const [dataFine, setDataFine] = useState('');
  const [ricercaDescrizione, setRicercaDescrizione] = useState('');
  const { darkMode } = useTheme();
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const categorieEntrate = [
    "Stipendio",
    "Investimenti",
    "Vendite",
    "Rimborsi",
    "Regalo",
    "MBO",
    "Welfare",
    "Consulenze",
    "Interessi",
    "Ticket",
    "Altro"
  ];

  // Legge i parametri dall'URL all'avvio
  useEffect(() => {
    const categoria = searchParams.get('categoria');
    const mese = searchParams.get('mese');
    const anno = searchParams.get('anno');
    const tipo = searchParams.get('tipo');

    if (categoria) {
      setFiltroCategoria(categoria);
      console.log('Filtri.js: Categoria da URL:', categoria);
    }
    if (tipo) {
      setFiltroTipo(tipo);
      console.log('Filtri.js: Tipo da URL:', tipo);
    }

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
    console.log('Filtri.js: Mese da URL:', mese);
    console.log('Filtri.js: Anno da URL:', anno);
  }, [searchParams]);

  const caricaTransazioni = async () => {
    setIsLoading(true);
    try {
      const [speseResponse, entrateResponse] = await Promise.all([
        axios.get(`${BASE_URL}/api/spese`, {
          params: {
            page: 1,
            limit: 10000 // Carica tutte le transazioni
          }
        }),
        axios.get(`${BASE_URL}/api/entrate`, {
          params: {
            page: 1,
            limit: 10000 // Carica tutte le transazioni
          }
        })
      ]);

      // Estrai le spese e le entrate direttamente dalla risposta
      const spese = (speseResponse.data.spese || []).map(spesa => ({ ...spesa, tipo: 'uscita' }));
      const entrate = (entrateResponse.data.entrate || []).map(entrata => ({ ...entrata, tipo: 'entrata' }));

      setTransazioni([...spese, ...entrate]);
    } catch (error) {
      console.error('Errore nel caricamento delle transazioni:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    caricaTransazioni();
  }, [filtroTipo, filtroCategoria, dataInizio, dataFine]);

  const eliminaTransazione = async (id, tipo) => {
    if (window.confirm('Sei sicuro di voler eliminare questa transazione?')) {
      try {
        const endpoint = tipo === 'entrata' ? 'entrate' : 'spese';
        await axios.delete(`${BASE_URL}/api/${endpoint}/${id}`);
        caricaTransazioni();
      } catch (error) {
        console.error('Errore durante l\'eliminazione:', error);
      }
    }
  };

  const transazioniFiltrate = transazioni.filter(t => {
    // Se il tipo non è 'tutte', filtra per tipo specifico (uscita/entrata)
    if (filtroTipo === 'uscita' && t.tipo !== 'uscita') return false;
    if (filtroTipo === 'entrata' && t.tipo !== 'entrata') return false;
    
    // Se c'è una categoria selezionata, filtra per categoria
    if (filtroCategoria && t.categoria !== filtroCategoria) return false;

    // Se c'è una ricerca testuale, filtra per descrizione (case-insensitive)
    if (ricercaDescrizione) {
      const descrizione = t.descrizione || '';
      const ricerca = ricercaDescrizione.toLowerCase();
      if (!descrizione.toLowerCase().includes(ricerca)) return false;
    }
  
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

  const handleEdit = (transaction) => {
    // Formatta la data per l'input type="date"
    const formattedDate = transaction.data 
      ? new Date(transaction.data).toISOString().split('T')[0]
      : new Date().toISOString().split('T')[0];
    
    setEditingTransaction({
      ...transaction,
      data: formattedDate
    });
    setShowEditModal(true);
  };

  const handleSaveEdit = async () => {
    if (!editingTransaction) return;
    
    try {
      const endpoint = editingTransaction.tipo === 'entrata' ? 'entrate' : 'spese';
      await axios.put(`${BASE_URL}/api/${endpoint}/${editingTransaction._id}`, {
        importo: editingTransaction.tipo === 'uscita' ? -Math.abs(Number(editingTransaction.importo)) : Number(editingTransaction.importo),
        descrizione: editingTransaction.descrizione,
        categoria: editingTransaction.categoria,
        data: editingTransaction.data
      });
      
      setShowEditModal(false);
      setEditingTransaction(null);
      caricaTransazioni();
    } catch (error) {
      console.error('Errore durante il salvataggio:', error);
    }
  };


  return (
    <div className={`theme-container ${darkMode ? 'dark' : ''}`}>
      <div className="max-w-7xl mx-auto px-4">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-4 text-indigo-600 dark:text-indigo-300">
            Filtra Transazioni
          </h1>
          <p className="text-gray-600 dark:text-gray-400 text-lg">
            Trova e analizza le tue transazioni con filtri avanzati
          </p>
        </div>

        {/* Filtri Principali */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 mb-8">
          <h2 className="text-xl font-bold mb-6 text-gray-800 dark:text-gray-200 flex items-center">
            <svg className="w-6 h-6 mr-2 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.707A1 1 0 013 7V4z" />
            </svg>
            Filtri Principali
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Filtro Tipo */}
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                Tipo di Transazione
              </label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  className={`px-4 py-3 rounded-lg font-medium transition-all duration-200 ${
                    filtroTipo === 'tutte' 
                      ? 'bg-indigo-600 text-white shadow-lg transform scale-105' 
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                  onClick={() => setFiltroTipo('tutte')}
                >
                  Tutte
                </button>
                <button
                  className={`px-4 py-3 rounded-lg font-medium transition-all duration-200 ${
                    filtroTipo === 'entrata' 
                      ? 'bg-green-600 text-white shadow-lg transform scale-105' 
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-green-100 dark:hover:bg-gray-600'
                  }`}
                  onClick={() => setFiltroTipo('entrata')}
                >
                  Entrate
                </button>
                <button
                  className={`px-4 py-3 rounded-lg font-medium transition-all duration-200 ${
                    filtroTipo === 'uscita' 
                      ? 'bg-red-600 text-white shadow-lg transform scale-105' 
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-red-100 dark:hover:bg-gray-600'
                  }`}
                  onClick={() => setFiltroTipo('uscita')}
                >
                  Uscite
                </button>
              </div>
            </div>

            {/* Filtro Categoria */}
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                Categoria
              </label>
              <select
                className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200 text-gray-900 dark:text-white"
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
                  <option value="MBO">MBO</option>
                  <option value="Welfare">Welfare</option>
                  <option value="Consulenze">Consulenze</option>
                  <option value="Interessi">Interessi</option>
                  <option value="Ticket">Ticket</option>
                  <option value="Altro">Altro</option>
                </>}
              </select>
            </div>
          </div>
        </div>

        {/* Filtri Avanzati */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 mb-8">
          <h2 className="text-xl font-bold mb-6 text-gray-800 dark:text-gray-200 flex items-center">
            <svg className="w-6 h-6 mr-2 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4" />
            </svg>
            Filtri Avanzati
          </h2>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Filtro Date */}
            <div className="space-y-3">
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">
                Intervallo Date
              </label>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Data inizio</label>
                  <input
                    className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-200 text-gray-900 dark:text-white"
                    type="date"
                    value={dataInizio}
                    onChange={e => setDataInizio(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Data fine</label>
                  <input
                    className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-200 text-gray-900 dark:text-white"
                    type="date"
                    value={dataFine}
                    onChange={e => setDataFine(e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* Ricerca Descrizione */}
            <div className="space-y-3">
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">
                Ricerca nel Testo
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <input
                  className="w-full pl-10 pr-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-200 text-gray-900 dark:text-white"
                  type="text"
                  placeholder="Cerca nelle descrizioni..."
                  value={ricercaDescrizione}
                  onChange={e => setRicercaDescrizione(e.target.value)}
                />
              </div>
              {ricercaDescrizione && (
                <p className="text-sm text-purple-600 dark:text-purple-400">
                  Cercando: "{ricercaDescrizione}"
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Barra Risultati */}
        <div className="bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-gray-800 dark:to-gray-700 rounded-2xl p-6 mb-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0">
            {/* Contatore risultati */}
            <div className="flex items-center space-x-3">
              <div className="bg-indigo-600 text-white rounded-full w-8 h-8 flex items-center justify-center font-bold text-sm">
                {transazioniFiltrate.length}
              </div>
              <div>
                <p className="text-lg font-semibold text-gray-800 dark:text-gray-200">
                  {transazioniFiltrate.length} transazione{transazioniFiltrate.length !== 1 ? 'i' : ''} trovata{transazioniFiltrate.length !== 1 ? 'e' : ''}
                </p>
                {(filtroCategoria || ricercaDescrizione || dataInizio || dataFine || filtroTipo !== 'tutte') && (
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Filtri attivi: 
                    {filtroTipo !== 'tutte' && <span className="inline-block bg-indigo-100 dark:bg-indigo-900 text-indigo-800 dark:text-indigo-200 px-2 py-1 rounded mr-1 text-xs">{filtroTipo}</span>}
                    {filtroCategoria && <span className="inline-block bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 px-2 py-1 rounded mr-1 text-xs">{filtroCategoria}</span>}
                    {ricercaDescrizione && <span className="inline-block bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200 px-2 py-1 rounded mr-1 text-xs">testo: {ricercaDescrizione}</span>}
                    {(dataInizio || dataFine) && <span className="inline-block bg-orange-100 dark:bg-orange-900 text-orange-800 dark:text-orange-200 px-2 py-1 rounded mr-1 text-xs">periodo</span>}
                  </p>
                )}
              </div>
            </div>
            
            {/* Pulsante reset */}
            <button
              className="px-6 py-3 bg-white dark:bg-gray-700 border-2 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-semibold rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-all duration-200 flex items-center space-x-2"
              onClick={() => {
                setFiltroCategoria('');
                setFiltroTipo('tutte');
                setDataInizio('');
                setDataFine('');
                setRicercaDescrizione('');
              }}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <span>Reset Filtri</span>
            </button>
          </div>
        </div>
      </div>

      {/* Grafici statistici */}
      {transazioniFiltrate.length > 0 && filtroTipo !== 'tutte' && (
        <>
          {/* Grafico a torta per distribuzione per categoria */}
          {!filtroCategoria && (
            <div className="mt-8 mb-8">
              <ResponsiveContainer width="100%" height={400}>
                <PieChart>
                  <Pie
                    data={Object.entries(
                      transazioniFiltrate.reduce((acc, t) => {
                        acc[t.categoria] = (acc[t.categoria] || 0) + Math.abs(t.importo);
                        return acc;
                      }, {})
                    )
                      .map(([categoria, valore]) => ({ categoria, valore }))
                      .sort((a, b) => b.valore - a.valore)}
                    dataKey="valore"
                    nameKey="categoria"
                    cx="50%"
                    cy="50%"
                    outerRadius={150}
                    fill="#8884d8"
                    label={({ categoria, percent }) => `${categoria}: ${(percent * 100).toFixed(0)}%`}
                  >
                    {Object.entries(transazioniFiltrate.reduce((acc, t) => {
                      acc[t.categoria] = (acc[t.categoria] || 0) + Math.abs(t.importo);
                      return acc;
                    }, {})).map((_, index) => (
                      <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend 
                    layout="horizontal" 
                    align="center" 
                    verticalAlign="bottom"
                    wrapperStyle={{
                      paddingTop: "20px",
                      width: "100%",
                      display: "flex",
                      flexWrap: "wrap",
                      justifyContent: "center",
                      gap: "10px"
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Grafico a barre per andamento temporale quando si filtra per categoria */}
          {filtroCategoria && (
            <div className="mt-8 mb-8">
              <h3 className="text-2xl font-bold text-center mb-6 text-indigo-700 dark:text-indigo-300">
                {filtroCategoria}
              </h3>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart
                  data={Object.entries(
                    transazioniFiltrate.reduce((acc, t) => {
                      // Estrai anno e mese dalla data
                      const data = new Date(t.data);
                      const chiave = `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}`;
                      acc[chiave] = (acc[chiave] || 0) + Math.abs(t.importo);
                      return acc;
                    }, {})
                  )
                    .map(([data, importo]) => ({
                      data: new Date(data + '-01').toLocaleDateString('it-IT', { 
                        year: 'numeric',
                        month: 'long'
                      }),
                      importo
                    }))
                    .sort((a, b) => b.importo - a.importo)}
                >
                  <XAxis 
                    dataKey="data" 
                    angle={-45} 
                    textAnchor="end" 
                    height={100}
                    tick={{ fill: darkMode ? '#e5e7eb' : '#374151' }}
                  />
                  <YAxis
                    tick={{ fill: darkMode ? '#e5e7eb' : '#374151' }}
                  />
                  <Tooltip />
                  <Bar
                    dataKey="importo"
                    fill={filtroTipo === 'entrata' ? '#48bb78' : '#ef4444'}
                    name={filtroTipo === 'entrata' ? 'Entrata' : 'Spesa'}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </>
      )}

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
                    {new Date(transazione.data).toLocaleDateString('it-IT', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })}
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  {/* Pulsante modifica (per tutte le transazioni) */}
                  <button
                    onClick={() => handleEdit(transazione)}
                    className="px-4 py-2 text-lg font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-lg transition-colors duration-200 transform hover:scale-105"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                    </svg>
                  </button>
                  <button
                    onClick={() => eliminaTransazione(transazione._id, transazione.tipo)}
                    className="px-4 py-2 text-lg font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-lg transition-colors duration-200 transform hover:scale-105"
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
                  value={Math.abs(editingTransaction.importo)}
                  onChange={(e) => setEditingTransaction({
                    ...editingTransaction,
                    importo: e.target.value
                  })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
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
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Data
                </label>
                <input
                  type="date"
                  value={editingTransaction.data ? new Date(editingTransaction.data).toISOString().split('T')[0] : ''}
                  onChange={(e) => setEditingTransaction({
                    ...editingTransaction,
                    data: e.target.value
                  })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
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
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                >
                  {editingTransaction.tipo === 'entrata' ? (
                    <>
                      <option value="Stipendio">Stipendio</option>
                      <option value="Investimenti">Investimenti</option>
                      <option value="Vendite">Vendite</option>
                      <option value="Rimborsi">Rimborsi</option>
                      <option value="Regalo">Regalo</option>
                      <option value="MBO">MBO</option>
                      <option value="Welfare">Welfare</option>
                      <option value="Consulenze">Consulenze</option>
                      <option value="Interessi">Interessi</option>
                      <option value="Ticket">Ticket</option>
                      <option value="Altro">Altro</option>
                    </>
                  ) : (
                    <>
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
                    </>
                  )}
                </select>
              </div>
            </div>

            <div className="mt-6 flex justify-end space-x-3">
              <button
                onClick={() => setShowEditModal(false)}
                className="px-4 py-2 text-lg font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-lg transition-colors duration-200 transform hover:scale-105 mr-2"
              >
                Annulla
              </button>
              <button
                onClick={handleSaveEdit}
                className="px-4 py-2 text-lg font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-lg transition-colors duration-200 transform hover:scale-105"
              >
                Salva
              </button>
            </div>
          </div>
        </div>
      )}

        {isLoading && (
          <LoadingSpinner 
            size="lg" 
            text="Caricamento transazioni..." 
            className="py-8"
          />
        )}
      </div>
    </div>
  );
}

export default Filtri;
