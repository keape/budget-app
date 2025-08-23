import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import BASE_URL from './config';
import { useNotifications } from './contexts/NotificationContext';
import NotificationBar from './components/NotificationBar';

function Home() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [riepilogoData, setRiepilogoData] = useState({
    totaleSpeseOggi: 0,
    totaleEntrateOggi: 0,
    totaleSpeseSettimana: 0,
    totaleEntrateSettimana: 0,
    totaleSpeseMese: 0,
    totaleEntrateMese: 0,
    bilancioMese: 0,
    ultimaTransazione: null,
    categoriaTopSpese: null,
    numeroTransazioniMese: 0
  });
  
  const { addMultipleNotifications } = useNotifications();

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/login');
      return;
    }

    caricaRiepilogoData();
  }, [navigate]);

  const caricaRiepilogoData = async () => {
    setIsLoading(true);
    try {
      const token = localStorage.getItem('token');
      
      // Carica transazioni recenti
      const [speseRes, entrateRes] = await Promise.all([
        axios.get(`${BASE_URL}/api/spese?limit=1000`, { headers: { 'Authorization': `Bearer ${token}` } }),
        axios.get(`${BASE_URL}/api/entrate?limit=1000`, { headers: { 'Authorization': `Bearer ${token}` } })
      ]);

      const tutte_spese = speseRes.data.spese || [];
      const tutte_entrate = entrateRes.data.entrate || [];
      const tutte_transazioni = [...tutte_spese, ...tutte_entrate].sort((a, b) => 
        new Date(b.data || b.createdAt) - new Date(a.data || a.createdAt)
      );

      // Calcola date per filtri
      const oggi = new Date();
      const inizioOggi = new Date(oggi.getFullYear(), oggi.getMonth(), oggi.getDate());
      const inizioSettimana = new Date(oggi);
      inizioSettimana.setDate(oggi.getDate() - oggi.getDay());
      const inizioMese = new Date(oggi.getFullYear(), oggi.getMonth(), 1);

      // Calcola totali
      const speseOggi = tutte_spese.filter(s => new Date(s.data || s.createdAt) >= inizioOggi);
      const entrateOggi = tutte_entrate.filter(e => new Date(e.data || e.createdAt) >= inizioOggi);
      const speseSettimana = tutte_spese.filter(s => new Date(s.data || s.createdAt) >= inizioSettimana);
      const entrateSettimana = tutte_entrate.filter(e => new Date(e.data || e.createdAt) >= inizioSettimana);
      const speseMese = tutte_spese.filter(s => new Date(s.data || s.createdAt) >= inizioMese);
      const entrateMese = tutte_entrate.filter(e => new Date(e.data || e.createdAt) >= inizioMese);

      // Categoria top spese del mese
      const categorieSpese = {};
      speseMese.forEach(s => {
        const cat = s.categoria || 'Altro';
        categorieSpese[cat] = (categorieSpese[cat] || 0) + Math.abs(s.importo);
      });
      const categoriaTop = Object.entries(categorieSpese).sort((a, b) => b[1] - a[1])[0];

      setRiepilogoData({
        totaleSpeseOggi: speseOggi.reduce((sum, s) => sum + Math.abs(s.importo), 0),
        totaleEntrateOggi: entrateOggi.reduce((sum, e) => sum + e.importo, 0),
        totaleSpeseSettimana: speseSettimana.reduce((sum, s) => sum + Math.abs(s.importo), 0),
        totaleEntrateSettimana: entrateSettimana.reduce((sum, e) => sum + e.importo, 0),
        totaleSpeseMese: speseMese.reduce((sum, s) => sum + Math.abs(s.importo), 0),
        totaleEntrateMese: entrateMese.reduce((sum, e) => sum + e.importo, 0),
        bilancioMese: entrateMese.reduce((sum, e) => sum + e.importo, 0) - speseMese.reduce((sum, s) => sum + Math.abs(s.importo), 0),
        ultime5Transazioni: tutte_transazioni.slice(0, 5),
        categoriaTopSpese: categoriaTop ? { nome: categoriaTop[0], importo: categoriaTop[1] } : null,
        numeroTransazioniMese: speseMese.length + entrateMese.length,
        dettagliCategorie: {
          spese: Object.entries(categorieSpese).sort((a, b) => b[1] - a[1]).slice(0, 5),
          entrate: (() => {
            const categorieEntrate = {};
            entrateMese.forEach(e => {
              const cat = e.categoria || 'Altro';
              categorieEntrate[cat] = (categorieEntrate[cat] || 0) + e.importo;
            });
            return Object.entries(categorieEntrate).sort((a, b) => b[1] - a[1]).slice(0, 5);
          })(),
          numeroCategorieSpeseUsate: Object.keys(categorieSpese).length,
          numeroCategorieEntrateUsate: (() => {
            const categorieEntrate = {};
            entrateMese.forEach(e => {
              const cat = e.categoria || 'Altro';
              categorieEntrate[cat] = (categorieEntrate[cat] || 0) + e.importo;
            });
            return Object.keys(categorieEntrate).length;
          })()
        }
      });

    } catch (err) {
      console.error('Errore nel caricamento del riepilogo:', err);
      setError('Errore nel caricamento dei dati di riepilogo');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-6">
      <h1 className="text-4xl font-bold text-center mb-8 text-gray-800 dark:text-white">
        📊 Dashboard Budget
      </h1>

      {/* Barra Notifiche */}
      <NotificationBar />

      {error && (
        <div className="mb-6 p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg">
          {error}
        </div>
      )}

      {isLoading ? (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Caricamento riepilogo...</p>
        </div>
      ) : (
        <>
          {/* Quick Actions */}
          <div className="mb-8 text-center">
            <button
              onClick={() => navigate('/transazioni')}
              className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white text-xl font-bold py-4 px-8 rounded-xl shadow-lg transform transition-all duration-200 hover:scale-105 hover:shadow-xl mx-2 mb-2"
            >
              💸 Aggiungi Spesa
            </button>
            <button
              onClick={() => navigate('/filtri')}
              className="bg-gradient-to-r from-green-600 to-teal-600 hover:from-green-700 hover:to-teal-700 text-white text-xl font-bold py-4 px-8 rounded-xl shadow-lg transform transition-all duration-200 hover:scale-105 hover:shadow-xl mx-2 mb-2"
            >
              🔍 Ricerca e Filtri
            </button>
            <button
              onClick={() => navigate('/budget/settings')}
              className="bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700 text-white text-xl font-bold py-4 px-8 rounded-xl shadow-lg transform transition-all duration-200 hover:scale-105 hover:shadow-xl mx-2 mb-2"
            >
              ⚙️ Gestisci Categorie
            </button>
          </div>

          {/* Riepilogo Oggi */}
          <div className="mb-8">
            <h2 className="text-2xl font-bold mb-4 text-gray-800 dark:text-white flex items-center">
              <span className="mr-2">📅</span>
              Oggi
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-green-50 dark:bg-green-900 p-6 rounded-xl shadow-md border-l-4 border-green-500">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-green-700 dark:text-green-300 text-sm font-medium">Entrate Oggi</p>
                    <p className="text-2xl font-bold text-green-800 dark:text-green-200">€{riepilogoData.totaleEntrateOggi.toFixed(2)}</p>
                  </div>
                  <span className="text-3xl">💰</span>
                </div>
              </div>
              <div className="bg-red-50 dark:bg-red-900 p-6 rounded-xl shadow-md border-l-4 border-red-500">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-red-700 dark:text-red-300 text-sm font-medium">Spese Oggi</p>
                    <p className="text-2xl font-bold text-red-800 dark:text-red-200">€{riepilogoData.totaleSpeseOggi.toFixed(2)}</p>
                  </div>
                  <span className="text-3xl">💸</span>
                </div>
              </div>
              <div className={`p-6 rounded-xl shadow-md border-l-4 ${
                (riepilogoData.totaleEntrateOggi - riepilogoData.totaleSpeseOggi) >= 0 
                  ? 'bg-blue-50 dark:bg-blue-900 border-blue-500' 
                  : 'bg-orange-50 dark:bg-orange-900 border-orange-500'
              }`}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className={`text-sm font-medium ${
                      (riepilogoData.totaleEntrateOggi - riepilogoData.totaleSpeseOggi) >= 0 
                        ? 'text-blue-700 dark:text-blue-300' 
                        : 'text-orange-700 dark:text-orange-300'
                    }`}>Bilancio Oggi</p>
                    <p className={`text-2xl font-bold ${
                      (riepilogoData.totaleEntrateOggi - riepilogoData.totaleSpeseOggi) >= 0 
                        ? 'text-blue-800 dark:text-blue-200' 
                        : 'text-orange-800 dark:text-orange-200'
                    }`}>
                      €{(riepilogoData.totaleEntrateOggi - riepilogoData.totaleSpeseOggi).toFixed(2)}
                    </p>
                  </div>
                  <span className="text-3xl">{(riepilogoData.totaleEntrateOggi - riepilogoData.totaleSpeseOggi) >= 0 ? '📈' : '📉'}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Riepilogo Mese */}
          <div className="mb-8">
            <h2 className="text-2xl font-bold mb-4 text-gray-800 dark:text-white flex items-center">
              <span className="mr-2">📊</span>
              Questo Mese
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-600 dark:text-gray-400 text-sm">Entrate Mese</p>
                    <p className="text-xl font-bold text-green-600 dark:text-green-400">€{riepilogoData.totaleEntrateMese.toFixed(2)}</p>
                  </div>
                  <span className="text-2xl">📈</span>
                </div>
              </div>
              <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-600 dark:text-gray-400 text-sm">Spese Mese</p>
                    <p className="text-xl font-bold text-red-600 dark:text-red-400">€{riepilogoData.totaleSpeseMese.toFixed(2)}</p>
                  </div>
                  <span className="text-2xl">📉</span>
                </div>
              </div>
              <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-600 dark:text-gray-400 text-sm">Bilancio Mese</p>
                    <p className={`text-xl font-bold ${riepilogoData.bilancioMese >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                      €{riepilogoData.bilancioMese.toFixed(2)}
                    </p>
                  </div>
                  <span className="text-2xl">{riepilogoData.bilancioMese >= 0 ? '✅' : '⚠️'}</span>
                </div>
              </div>
              <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-600 dark:text-gray-400 text-sm">Transazioni</p>
                    <p className="text-xl font-bold text-blue-600 dark:text-blue-400">{riepilogoData.numeroTransazioniMese}</p>
                  </div>
                  <span className="text-2xl">📝</span>
                </div>
              </div>
            </div>
          </div>

          {/* Dettagli Categorie */}
          <div className="mb-8">
            <h2 className="text-2xl font-bold mb-4 text-gray-800 dark:text-white flex items-center">
              <span className="mr-2">📋</span>
              Categorie Questo Mese
            </h2>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Top Categorie Spese */}
              <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md">
                <h3 className="text-lg font-bold mb-4 text-red-600 dark:text-red-400 flex items-center">
                  <span className="mr-2">💸</span>
                  Top Categorie Spese ({riepilogoData.dettagliCategorie?.numeroCategorieSpeseUsate || 0} totali)
                </h3>
                {riepilogoData.dettagliCategorie?.spese?.length > 0 ? (
                  <div className="space-y-3">
                    {riepilogoData.dettagliCategorie.spese.map(([categoria, importo], index) => (
                      <div key={categoria} className="flex items-center justify-between p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border-l-4 border-red-500">
                        <div className="flex items-center space-x-3">
                          <span className="text-lg font-bold text-red-600 dark:text-red-400">#{index + 1}</span>
                          <span className="font-semibold text-gray-800 dark:text-white">{categoria}</span>
                        </div>
                        <span className="text-lg font-bold text-red-600 dark:text-red-400">€{importo.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500 dark:text-gray-400 italic">Nessuna spesa questo mese</p>
                )}
              </div>

              {/* Top Categorie Entrate */}
              <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md">
                <h3 className="text-lg font-bold mb-4 text-green-600 dark:text-green-400 flex items-center">
                  <span className="mr-2">💰</span>
                  Top Categorie Entrate ({riepilogoData.dettagliCategorie?.numeroCategorieEntrateUsate || 0} totali)
                </h3>
                {riepilogoData.dettagliCategorie?.entrate?.length > 0 ? (
                  <div className="space-y-3">
                    {riepilogoData.dettagliCategorie.entrate.map(([categoria, importo], index) => (
                      <div key={categoria} className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border-l-4 border-green-500">
                        <div className="flex items-center space-x-3">
                          <span className="text-lg font-bold text-green-600 dark:text-green-400">#{index + 1}</span>
                          <span className="font-semibold text-gray-800 dark:text-white">{categoria}</span>
                        </div>
                        <span className="text-lg font-bold text-green-600 dark:text-green-400">€{importo.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500 dark:text-gray-400 italic">Nessuna entrata questo mese</p>
                )}
              </div>
            </div>

            {/* Statistiche Categorie */}
            <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-gradient-to-r from-blue-500 to-blue-600 p-4 rounded-xl text-white text-center">
                <div className="text-2xl font-bold">
                  {(riepilogoData.dettagliCategorie?.numeroCategorieSpeseUsate || 0) + (riepilogoData.dettagliCategorie?.numeroCategorieEntrateUsate || 0)}
                </div>
                <div className="text-sm opacity-90">Categorie Utilizzate</div>
              </div>
              <div className="bg-gradient-to-r from-purple-500 to-purple-600 p-4 rounded-xl text-white text-center">
                <div className="text-2xl font-bold">
                  {riepilogoData.dettagliCategorie?.spese?.length > 0 ? 
                    `€${Math.max(...riepilogoData.dettagliCategorie.spese.map(([, importo]) => importo)).toFixed(0)}` : 
                    '€0'
                  }
                </div>
                <div className="text-sm opacity-90">Spesa Max per Categoria</div>
              </div>
              <div className="bg-gradient-to-r from-teal-500 to-teal-600 p-4 rounded-xl text-white text-center">
                <div className="text-2xl font-bold">
                  {riepilogoData.dettagliCategorie?.entrate?.length > 0 ? 
                    `€${Math.max(...riepilogoData.dettagliCategorie.entrate.map(([, importo]) => importo)).toFixed(0)}` : 
                    '€0'
                  }
                </div>
                <div className="text-sm opacity-90">Entrata Max per Categoria</div>
              </div>
            </div>
          </div>

          {/* Informazioni Aggiuntive */}
          <div className="grid grid-cols-1 gap-6">
            {/* Ultime 5 Transazioni */}
            {riepilogoData.ultime5Transazioni?.length > 0 && (
              <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md">
                <h3 className="text-lg font-bold mb-4 text-gray-800 dark:text-white flex items-center">
                  <span className="mr-2">🕐</span>
                  Ultime 5 Transazioni
                </h3>
                <div className="space-y-3">
                  {riepilogoData.ultime5Transazioni.map((transazione, index) => (
                    <div key={index} className={`flex items-center justify-between p-3 rounded-lg border-l-4 ${
                      transazione.importo >= 0 
                        ? 'bg-green-50 dark:bg-green-900/20 border-green-500' 
                        : 'bg-red-50 dark:bg-red-900/20 border-red-500'
                    }`}>
                      <div className="flex items-center space-x-3">
                        <span className={`text-lg font-bold ${transazione.importo >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                          #{index + 1}
                        </span>
                        <div>
                          <span className="font-semibold text-gray-800 dark:text-white">{transazione.descrizione}</span>
                          <div className="flex items-center space-x-2 text-xs text-gray-600 dark:text-gray-400">
                            <span>{transazione.categoria}</span>
                            <span>•</span>
                            <span>{new Date(transazione.data || transazione.createdAt).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' })}</span>
                          </div>
                        </div>
                      </div>
                      <span className={`text-lg font-bold ${transazione.importo >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                        {transazione.importo >= 0 ? '+' : ''}€{Math.abs(transazione.importo).toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default Home;