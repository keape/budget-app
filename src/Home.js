import React from 'react';
import { useState, useEffect } from 'react';
import axios from 'axios';


function Home() {
  const [descrizione, setDescrizione] = useState('');
  const [importo, setImporto] = useState('');
  const [categoria, setCategoria] = useState('');
  const [speseDelMese, setSpeseDelMese] = useState([]);
  const totaleMeseCorrente = speseDelMese.reduce((acc, spesa) => acc + spesa.importo, 0);

  useEffect(() => {
    axios.get('http://localhost:5001/api/spese')
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
      .catch(err => console.error('Errore nel caricamento delle spese:', err));
  }, []);
  
  const aggiungiSpesa = e => {
    e.preventDefault();
    axios.post('http://localhost:5001/api/spese', {
      descrizione,
      importo,
      categoria
    })
      .then(() => {
        setDescrizione('');
        setImporto('');
        setCategoria('');
        // alert('Spesa aggiunta con successo!');
      })
      .catch(err => console.error('❌ Errore nell’aggiunta della spesa:', err));
  };

  return (
    <div className="theme-container">
      <h2 className="theme-title">Aggiungi una spesa</h2>
      <div className="bg-blue-100 text-blue-800 p-3 rounded mb-4 shadow">
  <strong>Totale spese di {new Date().toLocaleString('default', { month: 'long' })}:</strong>{' '}
  {totaleMeseCorrente.toFixed(2)} €
</div>

      <form onSubmit={aggiungiSpesa} className="theme-form">
        <input
          className="theme-input"
          type="number"
          step="0.01"
          placeholder="Importo"
          value={importo}
          onChange={e => setImporto(e.target.value)}
          required
        />
        <select
          className="theme-input"
          value={categoria}
          onChange={e => setCategoria(e.target.value)}
          required
        >
          <option value="">Categoria</option>
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
        <input
          className="theme-input"
          type="text"
          placeholder="Descrizione (facoltativa)"
          value={descrizione}
          onChange={e => setDescrizione(e.target.value)}
        />
        <button className="theme-button" type="submit">
          Aggiungi
        </button>
      </form>
    </div>
  );
}

export default Home;