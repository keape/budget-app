import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import BASE_URL from './config';
import { useNotifications } from './contexts/NotificationContext';
import NotificationBar from './components/NotificationBar';

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
  
  // Stati per transazioni periodiche
  const [modalitaTransazione, setModalitaTransazione] = useState('una_tantum'); // 'una_tantum' | 'periodica'
  const [tipoRipetizione, setTipoRipetizione] = useState('mensile');
  const [configurazione, setConfigurazione] = useState({
    giorno: 1,
    gestione_giorno_mancante: 'ultimo_disponibile',
    ogni_n_mesi: 1,
    mese: 1,
    giorni_settimana: [],
    giorno_settimana: 1,
    ogni_n_giorni: 30
  });
  const [dataInizio, setDataInizio] = useState(new Date().toISOString().split('T')[0]);
  const [dataFine, setDataFine] = useState('');
  const [infinito, setInfinito] = useState(true);
  const [abbonamentiAttivi, setAbbonamentiAttivi] = useState([]);
  const [anteprimaDate, setAnteprimaDate] = useState([]);
  
  const { addMultipleNotifications } = useNotifications();

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
    caricaAbbonamentiAttivi();
    generaTransazioniPeriodiche();
  }, [navigate, tipo]);
  
  // Carica abbonamenti attivi
  const caricaAbbonamentiAttivi = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;
      
      const response = await axios.get(`${BASE_URL}/api/transazioni-periodiche`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      setAbbonamentiAttivi(response.data || []);
    } catch (error) {
      console.error('Errore nel caricamento abbonamenti:', error);
    }
  };
  
  // Genera transazioni periodiche mancanti
  const generaTransazioniPeriodiche = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;
      
      const response = await axios.post(`${BASE_URL}/api/transazioni-periodiche/genera`, {}, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.data.notifiche && response.data.notifiche.length > 0) {
        addMultipleNotifications(response.data.notifiche);
      }
    } catch (error) {
      console.error('Errore nella generazione transazioni periodiche:', error);
    }
  };

  const handleTipoChange = (nuovoTipo) => {
    setTipo(nuovoTipo);
    setCategoria(''); // Reset categoria quando cambia il tipo
  };
  
  // Calcola anteprima date per transazioni periodiche
  useEffect(() => {
    if (modalitaTransazione === 'periodica') {
      calcolaAnteprimaDate();
    }
  }, [modalitaTransazione, tipoRipetizione, configurazione, dataInizio]);
  
  const calcolaAnteprimaDate = () => {
    const date = [];
    let dataCorrente = new Date(dataInizio);
    
    // Genera 6 date di esempio
    for (let i = 0; i < 6; i++) {
      if (i > 0) {
        dataCorrente = calcolaProximaData(dataCorrente);
      }
      date.push(new Date(dataCorrente));
    }
    
    setAnteprimaDate(date);
  };
  
  const calcolaProximaData = (dataBase) => {
    const data = new Date(dataBase);
    
    switch (tipoRipetizione) {
      case 'giornaliera':
        data.setDate(data.getDate() + 1);
        break;
      case 'settimanale':
        data.setDate(data.getDate() + 7);
        break;
      case 'quindicinale':
        data.setDate(data.getDate() + 14);
        break;
      case 'mensile':
      case 'bimestrale':
      case 'trimestrale':
      case 'semestrale':
        const mesi = configurazione.ogni_n_mesi || 1;
        let nuovoMese = data.getMonth() + mesi;
        let nuovoAnno = data.getFullYear();
        
        while (nuovoMese > 11) {
          nuovoMese -= 12;
          nuovoAnno++;
        }
        
        let nuovoGiorno = configurazione.giorno;
        const ultimoGiornoMese = new Date(nuovoAnno, nuovoMese + 1, 0).getDate();
        
        if (nuovoGiorno > ultimoGiornoMese) {
          nuovoGiorno = configurazione.gestione_giorno_mancante === 'ultimo_disponibile' 
            ? ultimoGiornoMese : 1;
          if (configurazione.gestione_giorno_mancante === 'primo_disponibile') {
            nuovoMese = nuovoMese === 11 ? 0 : nuovoMese + 1;
            if (nuovoMese === 0) nuovoAnno++;
          }
        }
        
        data.setFullYear(nuovoAnno, nuovoMese, nuovoGiorno);
        break;
      case 'annuale':
        data.setFullYear(data.getFullYear() + 1);
        break;
      case 'personalizzata':
        data.setDate(data.getDate() + (configurazione.ogni_n_giorni || 30));
        break;
    }
    
    return data;
  };
  
  const aggiungiTransazione = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        navigate('/login');
        return;
      }

      if (modalitaTransazione === 'una_tantum') {
        // Transazione normale
        const endpoint = tipo === 'spesa' ? 'spese' : 'entrate';
        const dataTransazione = data || new Date().toISOString().split('T')[0];

        await axios.post(`${BASE_URL}/api/${endpoint}`, {
          descrizione,
          importo: tipo === 'spesa' ? -Math.abs(Number(importo)) : Math.abs(Number(importo)),
          categoria,
          data: dataTransazione
        }, {
          headers: { 'Authorization': `Bearer ${token}` }
        });

        alert(`${tipo === 'spesa' ? 'Spesa' : 'Entrata'} inserita con successo!`);
        
        // Reset form
        setDescrizione('');
        setImporto('');
        setCategoria('');
        setData('');
        
      } else {
        // Transazione periodica
        const configurazioneCompleta = { ...configurazione };
        
        // Adatta configurazione in base al tipo ripetizione
        switch (tipoRipetizione) {
          case 'mensile':
            configurazioneCompleta.ogni_n_mesi = 1;
            break;
          case 'bimestrale':
            configurazioneCompleta.ogni_n_mesi = 2;
            break;
          case 'trimestrale':
            configurazioneCompleta.ogni_n_mesi = 3;
            break;
          case 'semestrale':
            configurazioneCompleta.ogni_n_mesi = 6;
            break;
        }
        
        const abbonamento = {
          importo: tipo === 'spesa' ? -Math.abs(Number(importo)) : Math.abs(Number(importo)),
          categoria,
          descrizione,
          tipo_ripetizione: tipoRipetizione,
          configurazione: configurazioneCompleta,
          data_inizio: dataInizio,
          data_fine: infinito ? null : dataFine,
          attiva: true
        };
        
        await axios.post(`${BASE_URL}/api/transazioni-periodiche`, abbonamento, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        
        alert('Ricorrenza creata con successo!');
        
        // Reset form
        setDescrizione('');
        setImporto('');
        setCategoria('');
        setDataInizio(new Date().toISOString().split('T')[0]);
        setDataFine('');
        setInfinito(true);
        
        // Ricarica abbonamenti
        await caricaAbbonamentiAttivi();
        await generaTransazioniPeriodiche();
      }
      
    } catch (err) {
      console.error(`Errore nell'inserimento:`, err);
      setError(`Impossibile inserire la ${modalitaTransazione === 'una_tantum' ? 'transazione' : 'ricorrenza'}. Riprova più tardi.`);
    } finally {
      setIsLoading(false);
    }
  };
  
  const eliminaAbbonamento = async (id) => {
    if (!window.confirm('Sei sicuro di voler eliminare questo abbonamento?')) return;
    
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`${BASE_URL}/api/transazioni-periodiche/${id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      await caricaAbbonamentiAttivi();
      alert('Abbonamento eliminato con successo!');
    } catch (error) {
      console.error('Errore nell\'eliminazione abbonamento:', error);
      alert('Errore nell\'eliminazione dell\'abbonamento');
    }
  };

  const tipiRipetizioneOptions = [
    { value: 'giornaliera', label: 'Ogni giorno' },
    { value: 'settimanale', label: 'Ogni settimana' },
    { value: 'quindicinale', label: 'Ogni 2 settimane' },
    { value: 'mensile', label: 'Ogni mese' },
    { value: 'bimestrale', label: 'Ogni 2 mesi' },
    { value: 'trimestrale', label: 'Ogni 3 mesi' },
    { value: 'semestrale', label: 'Ogni 6 mesi' },
    { value: 'annuale', label: 'Ogni anno' },
    { value: 'personalizzata', label: 'Personalizzata' }
  ];

  return (
    <div className="theme-container p-6 max-w-4xl mx-auto">
      <h1 className="text-4xl font-bold text-center mb-8 text-indigo-700 dark:text-indigo-300">
        Gestione Transazioni
      </h1>

      {/* Barra Notifiche */}
      <NotificationBar />

      {error && (
        <div className="mb-6 p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg">
          {error}
        </div>
      )}

      {/* Selettore Modalità */}
      <div className="mb-8">
        <div className="flex justify-center mb-6">
          <div className="bg-gray-100 dark:bg-gray-800 p-1 rounded-lg flex">
            <button
              type="button"
              className={`px-6 py-3 rounded-md font-semibold transition-all duration-200 flex items-center space-x-2 ${
                modalitaTransazione === 'una_tantum'
                  ? 'bg-blue-600 text-white shadow-lg transform scale-105'
                  : 'text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
              }`}
              onClick={() => setModalitaTransazione('una_tantum')}
            >
              <span>📅</span>
              <span>Una tantum</span>
            </button>
            <button
              type="button"
              className={`px-6 py-3 rounded-md font-semibold transition-all duration-200 flex items-center space-x-2 ${
                modalitaTransazione === 'periodica'
                  ? 'bg-green-600 text-white shadow-lg transform scale-105'
                  : 'text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
              }`}
              onClick={() => setModalitaTransazione('periodica')}
            >
              <span>🔄</span>
              <span>Periodica</span>
            </button>
          </div>
        </div>
      </div>

      <form onSubmit={aggiungiTransazione} className="space-y-6">
        {/* Tipo Transazione */}
        <div className="mb-6 flex justify-center">
          <div className="flex rounded-md shadow-sm max-w-md w-full">
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

        {/* Form centrato */}
        <div className="flex flex-col items-center space-y-6">
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

          {modalitaTransazione === 'una_tantum' ? (
            <div className="w-full max-w-md">
              <input
                className="w-full px-6 py-4 text-lg bg-white dark:bg-gray-700 border-2 border-blue-300 dark:border-blue-600 rounded-lg shadow-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 hover:border-blue-400 text-gray-800 dark:text-white"
                type="date"
                placeholder="Data (facoltativa)"
                value={data}
                onChange={e => setData(e.target.value)}
              />
            </div>
          ) : (
            /* Configurazione Periodica */
            <div className="w-full max-w-2xl space-y-6 bg-green-50 dark:bg-green-900/20 p-6 rounded-lg border-2 border-green-300 dark:border-green-600">
              <h3 className="text-xl font-semibold text-green-800 dark:text-green-200 text-center mb-4">
                ⚙️ Configurazione Periodicità
              </h3>
              
              {/* Tipo Ripetizione */}
              <div className="w-full">
                <label className="block text-sm font-medium text-green-700 dark:text-green-300 mb-2">
                  Tipo di ripetizione
                </label>
                <select
                  className="w-full px-4 py-3 bg-white dark:bg-gray-700 border-2 border-green-300 dark:border-green-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-gray-800 dark:text-white"
                  value={tipoRipetizione}
                  onChange={e => setTipoRipetizione(e.target.value)}
                >
                  {tipiRipetizioneOptions.map(option => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>

              {/* Configurazioni specifiche per tipo */}
              {['mensile', 'bimestrale', 'trimestrale', 'semestrale'].includes(tipoRipetizione) && (
                <div className="w-full">
                  <label className="block text-sm font-medium text-green-700 dark:text-green-300 mb-2">
                    Giorno del mese
                  </label>
                  <div className="flex space-x-4">
                    <input
                      type="number"
                      min="1"
                      max="31"
                      className="flex-1 px-4 py-3 bg-white dark:bg-gray-700 border-2 border-green-300 dark:border-green-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-gray-800 dark:text-white"
                      value={configurazione.giorno}
                      onChange={e => setConfigurazione({...configurazione, giorno: parseInt(e.target.value)})}
                    />
                    <select
                      className="flex-1 px-4 py-3 bg-white dark:bg-gray-700 border-2 border-green-300 dark:border-green-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-gray-800 dark:text-white"
                      value={configurazione.gestione_giorno_mancante}
                      onChange={e => setConfigurazione({...configurazione, gestione_giorno_mancante: e.target.value})}
                    >
                      <option value="ultimo_disponibile">Ultimo giorno disponibile</option>
                      <option value="primo_disponibile">Primo giorno del mese successivo</option>
                    </select>
                  </div>
                </div>
              )}

              {tipoRipetizione === 'settimanale' && (
                <div className="w-full">
                  <label className="block text-sm font-medium text-green-700 dark:text-green-300 mb-2">
                    Giorno della settimana
                  </label>
                  <select
                    className="w-full px-4 py-3 bg-white dark:bg-gray-700 border-2 border-green-300 dark:border-green-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-gray-800 dark:text-white"
                    value={configurazione.giorno_settimana}
                    onChange={e => setConfigurazione({...configurazione, giorno_settimana: parseInt(e.target.value)})}
                  >
                    <option value={1}>Lunedì</option>
                    <option value={2}>Martedì</option>
                    <option value={3}>Mercoledì</option>
                    <option value={4}>Giovedì</option>
                    <option value={5}>Venerdì</option>
                    <option value={6}>Sabato</option>
                    <option value={0}>Domenica</option>
                  </select>
                </div>
              )}

              {tipoRipetizione === 'personalizzata' && (
                <div className="w-full">
                  <label className="block text-sm font-medium text-green-700 dark:text-green-300 mb-2">
                    Ogni quanti giorni
                  </label>
                  <input
                    type="number"
                    min="1"
                    className="w-full px-4 py-3 bg-white dark:bg-gray-700 border-2 border-green-300 dark:border-green-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-gray-800 dark:text-white"
                    value={configurazione.ogni_n_giorni}
                    onChange={e => setConfigurazione({...configurazione, ogni_n_giorni: parseInt(e.target.value)})}
                  />
                </div>
              )}

              {tipoRipetizione === 'annuale' && (
                <div className="w-full">
                  <label className="block text-sm font-medium text-green-700 dark:text-green-300 mb-2">
                    Mese
                  </label>
                  <select
                    className="w-full px-4 py-3 bg-white dark:bg-gray-700 border-2 border-green-300 dark:border-green-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-gray-800 dark:text-white"
                    value={configurazione.mese}
                    onChange={e => setConfigurazione({...configurazione, mese: parseInt(e.target.value)})}
                  >
                    <option value={1}>Gennaio</option>
                    <option value={2}>Febbraio</option>
                    <option value={3}>Marzo</option>
                    <option value={4}>Aprile</option>
                    <option value={5}>Maggio</option>
                    <option value={6}>Giugno</option>
                    <option value={7}>Luglio</option>
                    <option value={8}>Agosto</option>
                    <option value={9}>Settembre</option>
                    <option value={10}>Ottobre</option>
                    <option value={11}>Novembre</option>
                    <option value={12}>Dicembre</option>
                  </select>
                </div>
              )}

              {/* Date di inizio e fine */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-green-700 dark:text-green-300 mb-2">
                    Data inizio
                  </label>
                  <input
                    type="date"
                    className="w-full px-4 py-3 bg-white dark:bg-gray-700 border-2 border-green-300 dark:border-green-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-gray-800 dark:text-white"
                    value={dataInizio}
                    onChange={e => setDataInizio(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <div className="flex items-center space-x-2 mb-2">
                    <input
                      type="checkbox"
                      id="infinito"
                      checked={infinito}
                      onChange={e => setInfinito(e.target.checked)}
                      className="rounded border-green-300 text-green-600 focus:ring-green-500"
                    />
                    <label htmlFor="infinito" className="text-sm font-medium text-green-700 dark:text-green-300">
                      Senza fine
                    </label>
                  </div>
                  {!infinito && (
                    <input
                      type="date"
                      className="w-full px-4 py-3 bg-white dark:bg-gray-700 border-2 border-green-300 dark:border-green-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-gray-800 dark:text-white"
                      value={dataFine}
                      onChange={e => setDataFine(e.target.value)}
                      min={dataInizio}
                    />
                  )}
                </div>
              </div>

              {/* Anteprima date */}
              {anteprimaDate.length > 0 && (
                <div className="w-full bg-white dark:bg-gray-800 p-4 rounded-lg border border-green-200 dark:border-green-700">
                  <h4 className="text-sm font-medium text-green-700 dark:text-green-300 mb-2">
                    📅 Anteprima prossime date:
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {anteprimaDate.slice(0, 6).map((data, index) => (
                      <span
                        key={index}
                        className="px-2 py-1 bg-green-100 dark:bg-green-800 text-green-800 dark:text-green-200 text-xs rounded-full"
                      >
                        {data.toLocaleDateString('it-IT')}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className={`px-8 py-4 text-lg font-semibold text-white rounded-lg shadow-lg transition-colors duration-200 transform hover:scale-105 ${
              isLoading ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {isLoading ? 'Inserimento in corso...' : modalitaTransazione === 'periodica' ? 'Crea ricorrenza periodica' : 'Aggiungi'}
          </button>
        </div>
      </form>
    </div>
  );
}

export default Home;