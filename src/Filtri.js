// Filtri.js
import { useState, useEffect } from 'react';
import axios from 'axios';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, PieChart, Pie, Cell, ResponsiveContainer, Legend, LabelList
} from 'recharts';
import React from 'react';
import { useTheme } from './ThemeContext';
import BASE_URL from './config';


function Filtri() {
  const [spese, setSpese] = useState([]);
  const [filtroCategoria, setFiltroCategoria] = useState('');
  const [dataInizio, setDataInizio] = useState('');
  const [dataFine, setDataFine] = useState('');
  const { darkMode } = useTheme();

  useEffect(() => {
    axios.get(`${BASE_URL}/api/spese`)
      .then(res => setSpese(res.data))
      .catch(err => console.error("Errore nel caricamento delle spese:", err));
  }, []);

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

  return (
    <div className={`theme-container ${darkMode ? 'dark' : ''}`}>
      <div className="flex justify-between items-center">
        <h2 className="theme-title">Filtra spese</h2>
      </div>

      <div className="theme-form">
  <select
    className="theme-input"
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


  <div className="mb-2 font-semibold text-gray-700 dark:text-gray-400">Intervallo date: Da...A</div>
  <input
    className="theme-input"
    type="date"
    value={dataInizio}
    onChange={e => setDataInizio(e.target.value)}
  />
  <input
    className="theme-input"
    type="date"
    value={dataFine}
    onChange={e => setDataFine(e.target.value)}
  />
  <button
    className="bg-gray-300 hover:bg-gray-400 text-black font-medium py-2 px-4 rounded"
    onClick={() => {
      setFiltroCategoria('');
      setDataInizio('');
      setDataFine('');
    }}
  >
    Pulisci filtri
  </button>
</div>


<ul className="mt-4 space-y-2">
  {speseFiltrate.map(spesa => (
  
<li
  key={spesa._id}
  className={`py-2 px-4 rounded-md shadow-sm max-w-xl mx-auto border ${categoriaClasse(spesa.categoria)}`}
>


 
 
      <div className="flex flex-col space-y-1">
        <span className="font-bold">{spesa.categoria}</span>
        <span className="text-green-600 font-semibold">{spesa.importo.toFixed(2)} €</span>
        {spesa.descrizione && (
          <span className="italic text-red-700 dark:text-red-400">{spesa.descrizione}</span>
        )}
        <span className="text-sm text-gray-900 dark:text-gray-500">
          {new Date(spesa.data).toLocaleDateString()}
        </span>
      </div>
    </li>
  ))}
</ul>



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
