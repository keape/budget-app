import React, { useState, useEffect } from 'react';
import axios from 'axios';
import BASE_URL from './config';
import { useNavigate } from 'react-router-dom';


function BudgetSettings() {
  const navigate = useNavigate();
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [budgetSettings, setBudgetSettings] = useState({ spese: {}, entrate: {} });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isCopying, setIsCopying] = useState(false);
  const [error, setError] = useState(null);
  const [editingCategory, setEditingCategory] = useState({ type: null, oldName: null, newName: '' });
  const [newCategory, setNewCategory] = useState({ type: null, name: '', value: '' });
  const [showAddCategory, setShowAddCategory] = useState({ spese: false, entrate: false });

  const mesi = [
    "Intero anno", "Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno",
    "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre"
  ];

  // Categorie di base che verranno integrate con quelle personalizzate
  const categorieSpeseDiBase = [
    "Abbigliamento", "Abbonamenti", "Acqua", "Alimentari", "Altre spese", "Bar",
    "Cinema Mostre Cultura", "Elettricità", "Giardinaggio/Agricoltura/Falegnameria",
    "Manutenzione/Arredamento casa", "Mutuo", "Regali", "Ristorante", "Salute",
    "Sport/Attrezzatura sportiva", "Tecnologia", "Vacanza", "Vela"
  ];

  const categorieEntrateDiBase = [
    "Altra entrata", "Consulenze", "Interessi", "MBO", "Stipendio", "Ticket", "Welfare"
  ];

  // Funzione per ottenere tutte le categorie (base + personalizzate dal database)
  const getAllCategories = (tipo) => {
    const baseCategories = tipo === 'spese' ? categorieSpeseDiBase : categorieEntrateDiBase;
    const dbCategories = Object.keys(budgetSettings[tipo] || {});
    // Unisce categorie base con quelle presenti nel database, evitando duplicati e ordinando alfabeticamente
    return [...new Set([...baseCategories, ...dbCategories])].sort((a, b) => a.localeCompare(b, 'it', { sensitivity: 'base' }));
  };

  useEffect(() => {
    console.log('🔍 useEffect HOOK - TEST TOKEN');
    const token = localStorage.getItem('token');
    console.log('Token in useEffect:', !!token);
    
    if (token) {
      try {
        const parts = token.split('.');
        const payload = JSON.parse(atob(parts[1]));
        console.log('🔍 useEffect - Token utente:', {
          username: payload.username,
          userId: payload.userId,
          isExpired: Date.now() / 1000 > payload.exp
        });
      } catch (e) {
        console.error('❌ useEffect - Errore token:', e);
      }
    }
    
    if (!token) {
      handleAuthError('Token non trovato. Effettua nuovamente il login.');
      return;
    }
    fetchBudgetSettings();
  }, [selectedYear, selectedMonth]);

  const handleAuthError = (message) => {
      setError(message);
      localStorage.removeItem('token');
      window.location.href = '/login';
  };

  const fetchBudgetSettings = async () => {
    console.log('🔍 TEST TOKEN AL CARICAMENTO PAGINA BUDGET SETTINGS');
    const token = localStorage.getItem('token');
    console.log('Token presente:', !!token);
    if (token) {
      try {
        const parts = token.split('.');
        const payload = JSON.parse(atob(parts[1]));
        console.log('🔍 Payload token utente corrente:', {
          username: payload.username,
          userId: payload.userId,
          exp: payload.exp,
          iat: payload.iat,
          isExpired: Date.now() / 1000 > payload.exp,
          timeToExpiry: payload.exp - (Date.now() / 1000),
          tokenLength: token.length,
          tokenStart: token.substring(0, 50) + '...'
        });
      } catch (e) {
        console.error('❌ Errore decodifica token:', e);
      }
    } else {
      console.error('❌ NESSUN TOKEN TROVATO');
    }
    
    setIsLoading(true);
    setError(null);
    try {
      if (!token) throw new Error('Token non trovato');

      // Per "Intero anno", recupera tutti i budget mensili e sommali
      if (selectedMonth === 0) {
        console.log('Recupero budget di tutti i mesi per l\'intero anno', selectedYear);
        
        // Array per memorizzare le promesse di tutte le richieste mensili
        const budgetPromises = [];
        
        // Crea una richiesta per ogni mese dell'anno
        for (let mese = 0; mese < 12; mese++) {
          budgetPromises.push(
            axios.get(`${BASE_URL}/api/budget-settings`, {
              params: { 
                anno: selectedYear,
                mese: mese
              },
              headers: { 'Authorization': `Bearer ${token}` }
            })
          );
        }
        
        // Esegui tutte le richieste in parallelo
        const budgetResponses = await Promise.all(budgetPromises);
        
        // Inizializza oggetti per accumulare i budget
        const budgetAnnuale = {
          spese: {},
          entrate: {}
        };
        
        // Somma i budget di tutti i mesi
        budgetResponses.forEach((response) => {
          const budgetMensile = response.data || { spese: {}, entrate: {} };
          
          // Somma le spese
          Object.entries(budgetMensile.spese || {}).forEach(([categoria, importo]) => {
            budgetAnnuale.spese[categoria] = (budgetAnnuale.spese[categoria] || 0) + importo;
          });
          
          // Somma le entrate
          Object.entries(budgetMensile.entrate || {}).forEach(([categoria, importo]) => {
            budgetAnnuale.entrate[categoria] = (budgetAnnuale.entrate[categoria] || 0) + importo;
          });
        });
        
        console.log('Budget annuale calcolato:', budgetAnnuale);
        setBudgetSettings(budgetAnnuale);
      } else {
        // Per un mese specifico, recupera solo il budget di quel mese
        const params = { 
          anno: selectedYear,
          mese: selectedMonth - 1 // Invia null per "Intero anno"
        };

        console.log('Recupero impostazioni:', {
          url: `${BASE_URL}/api/budget-settings`,
          params: params,
          token: 'presente'
        });

        const response = await axios.get(`${BASE_URL}/api/budget-settings`, {
          params: params,
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });

        console.log('Risposta ricevuta:', response.data);
        setBudgetSettings({
          spese: response.data.spese || {},
          entrate: response.data.entrate || {}
        });
      }
    } catch (error) {
      console.error('Dettagli errore:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status
      });
      
      if (error.response?.status === 401 || error.response?.status === 403) {
        handleAuthError('Sessione scaduta o non valida. Effettua nuovamente il login.');
      } else {
        setError('Errore nel caricamento delle impostazioni del budget. Riprova più tardi.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleBudgetChange = (categoria, tipo, valore) => {
    setBudgetSettings(prev => ({
      ...prev,
      [tipo]: {
        ...prev[tipo],
        [categoria]: valore === '' ? 0 : parseFloat(valore)
      }
    }));
  };

  // Gestione modifica nome categoria
  const startEditingCategory = (tipo, categoria) => {
    setEditingCategory({ type: tipo, oldName: categoria, newName: categoria });
  };

  const cancelEditingCategory = () => {
    setEditingCategory({ type: null, oldName: null, newName: '' });
  };

  const saveEditingCategory = () => {
    if (!editingCategory.newName.trim() || editingCategory.newName === editingCategory.oldName) {
      cancelEditingCategory();
      return;
    }

    // Validazione nome categoria
    if (editingCategory.newName.length > 50) {
      alert('Il nome della categoria non può superare i 50 caratteri');
      return;
    }

    // Controlla caratteri speciali
    const invalidChars = /[<>{}[\]\\]/;
    if (invalidChars.test(editingCategory.newName)) {
      alert('Il nome della categoria contiene caratteri non validi');
      return;
    }

    const allCategories = getAllCategories(editingCategory.type);
    if (allCategories.includes(editingCategory.newName.trim()) && editingCategory.newName.trim() !== editingCategory.oldName) {
      alert('Questa categoria esiste già');
      return;
    }

    setBudgetSettings(prev => {
      const newSettings = { ...prev };
      const tipo = editingCategory.type;
      const oldValue = newSettings[tipo][editingCategory.oldName] || 0;
      
      // Rimuovi la vecchia categoria e aggiungi la nuova
      delete newSettings[tipo][editingCategory.oldName];
      newSettings[tipo][editingCategory.newName.trim()] = oldValue;
      
      return newSettings;
    });
    
    cancelEditingCategory();
  };

  // Gestione aggiunta nuova categoria
  const addNewCategory = () => {
    if (!newCategory.name.trim() || !newCategory.type) {
      alert('Inserisci un nome valido per la categoria');
      return;
    }

    // Validazione nome categoria
    if (newCategory.name.length > 50) {
      alert('Il nome della categoria non può superare i 50 caratteri');
      return;
    }

    // Controlla caratteri speciali
    const invalidChars = /[<>{}[\]\\]/;
    if (invalidChars.test(newCategory.name)) {
      alert('Il nome della categoria contiene caratteri non validi');
      return;
    }

    const allCategories = getAllCategories(newCategory.type);
    if (allCategories.includes(newCategory.name.trim())) {
      alert('Questa categoria esiste già');
      return;
    }

    // Validazione valore
    const value = newCategory.value === '' ? 0 : parseFloat(newCategory.value);
    if (isNaN(value) || value < 0) {
      alert('Inserisci un importo valido (numero positivo)');
      return;
    }

    setBudgetSettings(prev => ({
      ...prev,
      [newCategory.type]: {
        ...prev[newCategory.type],
        [newCategory.name.trim()]: value
      }
    }));

    setNewCategory({ type: null, name: '', value: '' });
    setShowAddCategory({ spese: false, entrate: false });
  };

  // Gestione eliminazione categoria
  const deleteCategory = (tipo, categoria) => {
    if (window.confirm(`Sei sicuro di voler eliminare la categoria "${categoria}"?\n\nQuesta azione rimuoverà anche tutti i valori associati alla categoria.`)) {
      setBudgetSettings(prev => {
        const newSettings = { ...prev };
        delete newSettings[tipo][categoria];
        return newSettings;
      });
    }
  };

  // Funzione per esportare le impostazioni
  const esportaImpostazioni = () => {
    const data = {
      anno: selectedYear,
      mese: selectedMonth === 0 ? 'Intero anno' : mesi[selectedMonth],
      impostazioni: budgetSettings,
      dataEsportazione: new Date().toISOString(),
      versione: '1.0'
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `budget-settings-${selectedYear}-${selectedMonth === 0 ? 'intero-anno' : mesi[selectedMonth].toLowerCase()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Funzione per importare le impostazioni
  const importaImpostazioni = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        if (data.impostazioni && data.impostazioni.spese && data.impostazioni.entrate) {
          setBudgetSettings(data.impostazioni);
          alert('Impostazioni importate con successo!');
        } else {
          alert('File non valido. Assicurati di importare un file di esportazione corretto.');
        }
      } catch (error) {
        alert('Errore nel leggere il file. Assicurati che sia un file JSON valido.');
      }
    };
    reader.readAsText(file);
    
    // Reset input
    event.target.value = '';
  };

  const salvaBudget = async () => {
    console.log('🚀 Inizio salvaBudget');
    
    // Test immediato del token PRIMA di tutto
    const testToken = localStorage.getItem('token');
    console.log('🔍 Token presente:', !!testToken);
    if (testToken) {
      try {
        const tokenParts = testToken.split('.');
        if (tokenParts.length === 3) {
          const payload = JSON.parse(atob(tokenParts[1].replace(/-/g, '+').replace(/_/g, '/')));
          console.log('🔍 Token valido per utente:', {
            username: payload.username,
            userId: payload.userId,
            exp: payload.exp,
            isExpired: Date.now() / 1000 > payload.exp,
            timeToExpiry: payload.exp - (Date.now() / 1000)
          });
        }
      } catch (e) {
        console.error('❌ Token malformato:', e);
      }
    }
    
    setIsSaving(true);
    setError(null);
    try {
      // Il token viene gestito automaticamente dall'axios interceptor

      // Pulisce le categorie con valori vuoti o nulli prima del salvataggio
      const cleanBudgetSettings = {
        spese: Object.fromEntries(
          Object.entries(budgetSettings.spese || {})
            .filter(([_, value]) => value !== null && value !== undefined && value !== '' && !isNaN(value))
            .map(([key, value]) => [key.trim(), parseFloat(value)])
        ),
        entrate: Object.fromEntries(
          Object.entries(budgetSettings.entrate || {})
            .filter(([_, value]) => value !== null && value !== undefined && value !== '' && !isNaN(value))
            .map(([key, value]) => [key.trim(), parseFloat(value)])
        )
      };

      // Se è selezionato "Intero anno", salva le impostazioni per tutti i mesi
      if (selectedMonth === 0) {
        console.log('💾 Salvataggio per intero anno - esecuzione sequenziale per evitare conflitti');
        
        // Gestione manuale token per l'intero anno
        const token = localStorage.getItem('token');
        if (!token) {
          throw new Error('Token non trovato. Effettua il login.');
        }
        
        // Salva le stesse impostazioni per ogni mese - SEQUENZIALMENTE per evitare race conditions
        for (let mese = 0; mese < 12; mese++) {
          const dataToSend = {
            anno: selectedYear,
            mese: mese,
            isYearly: false, // Ogni mese è un'impostazione mensile
            settings: cleanBudgetSettings
          };

          console.log(`💾 Salvataggio mese ${mese + 1}/12`);
          
          try {
            // Usa axios con headers espliciti
            await axios.post(`${BASE_URL}/api/budget-settings`, dataToSend, {
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
              },
              timeout: 20000
            });
            console.log(`✅ Mese ${mese + 1} salvato con successo`);
            
            // Piccolo delay per evitare race conditions nel database
            if (mese < 11) { // Non fare delay dopo l'ultimo mese
              await new Promise(resolve => setTimeout(resolve, 100));
            }
          } catch (error) {
            console.error(`❌ Errore nel salvataggio del mese ${mese + 1}:`, error);
            throw error; // Interrompi il loop se c'è un errore
          }
        }

        alert('Impostazioni salvate con successo per tutti i mesi!');
      } else {
        // Salva le impostazioni solo per il mese selezionato
        const dataToSend = {
          anno: selectedYear,
          mese: selectedMonth - 1,
          isYearly: false, // È un'impostazione mensile
          settings: cleanBudgetSettings
        };

        // Validazione dati prima dell'invio
        if (!dataToSend.anno || !dataToSend.settings) {
          throw new Error('Dati mancanti: anno o settings non definiti');
        }
        
        if (dataToSend.mese === undefined || dataToSend.mese === null) {
          throw new Error('Mese non definito correttamente');
        }
        
        console.log('🔄 Invio dati puliti e validati:', {
          baseUrl: BASE_URL,
          fullUrl: `${BASE_URL}/api/budget-settings`,
          data: dataToSend,
          dataValidation: {
            hasAnno: !!dataToSend.anno,
            hasMese: dataToSend.mese !== undefined,
            hasSettings: !!dataToSend.settings,
            hasSpese: !!dataToSend.settings.spese,
            hasEntrate: !!dataToSend.settings.entrate,
            isYearly: dataToSend.isYearly
          },
          cleanBudgetSettings: cleanBudgetSettings,
          budgetSettingsOriginal: budgetSettings
        });

        console.log('🚀 Invio richiesta di salvataggio al backend...');
        console.log('📤 Dati inviati:', dataToSend);
        
        // Test endpoint semplice prima del salvataggio vero
        console.log('🧪 Test endpoint semplice prima...');
        try {
          const testResponse = await axios.post(`${BASE_URL}/api/test-save`, {}, {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            timeout: 10000
          });
          console.log('✅ Test endpoint OK:', testResponse.data);
        } catch (testError) {
          console.error('❌ Test endpoint fallito:', testError.message);
          throw new Error(`Test endpoint fallito: ${testError.message}`);
        }
        
        // Sistema di retry per gestire timeout e problemi di rete
        let response;
        let lastError;
        const maxRetries = 3;
        
        // Gestione manuale token per bypassare problemi interceptor
        const token = localStorage.getItem('token');
        if (!token) {
          throw new Error('Token non trovato. Effettua il login.');
        }
        
        // Debug token per troubleshooting keape86
        try {
          const tokenParts = token.split('.');
          if (tokenParts.length === 3) {
            const payload = JSON.parse(atob(tokenParts[1].replace(/-/g, '+').replace(/_/g, '/')));
            console.log('🔍 Debug token utente:', {
              username: payload.username,
              userId: payload.userId,
              exp: payload.exp,
              iat: payload.iat,
              isExpired: Date.now() / 1000 > payload.exp,
              timeToExpiry: payload.exp - (Date.now() / 1000)
            });
          }
        } catch (tokenError) {
          console.error('❌ Errore nel decodificare il token:', tokenError);
        }
        
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
          try {
            console.log(`🔄 Tentativo ${attempt}/${maxRetries} con fetch diretto...`);
            const saveStartTime = Date.now();
            
            // Torna ad axios con headers espliciti per evitare problemi CORS con fetch
            response = await axios.post(`${BASE_URL}/api/budget-settings`, dataToSend, {
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
              },
              timeout: 20000
            });
            
            const saveDuration = Date.now() - saveStartTime;
            console.log(`✅ Risposta ricevuta al tentativo ${attempt} in ${saveDuration}ms:`, response.status, response.data);
            break; // Successo, esci dal loop
            
          } catch (error) {
            lastError = error;
            console.warn(`⚠️ Tentativo ${attempt} fallito:`, {
              message: error.message,
              status: error.response?.status,
              statusText: error.response?.statusText,
              data: error.response?.data,
              isAuthError: error.response?.status === 401 || error.response?.status === 403
            });
            
            if (attempt < maxRetries) {
              const delay = attempt * 2000; // 2s, 4s delay progressivo
              console.log(`⏳ Attendo ${delay}ms prima del prossimo tentativo...`);
              await new Promise(resolve => setTimeout(resolve, delay));
            }
          }
        }
        
        if (!response) {
          throw lastError || new Error('Tutti i tentativi di salvataggio sono falliti');
        }

        console.log('Risposta salvataggio:', response.data);
        alert('Impostazioni salvate con successo!');
        setBudgetSettings({
          spese: response.data.spese || {},
          entrate: response.data.entrate || {}
        });
      }
    } catch (error) {
      console.error('🚨 Dettagli errore salvataggio:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
        config: {
          url: error.config?.url,
          method: error.config?.method,
          data: error.config?.data
        },
        fullError: error
      });

      if (error.response?.status === 401 || error.response?.status === 403) {
         handleAuthError('Sessione scaduta o non valida durante il salvataggio. Effettua nuovamente il login.');
      } else {
        // Log dettagliato per tutti i tipi di errore
        console.error('🚨 Dettagli completi errore:', {
          message: error.message,
          code: error.code,
          response: error.response,
          request: error.request,
          config: error.config,
          isNetworkError: !error.response,
          baseURL: BASE_URL,
          fullURL: `${BASE_URL}/api/budget-settings`
        });
        
        // Mostra il messaggio di errore specifico dal backend se disponibile
        const backendMessage = error.response?.data?.message || error.message;
        setError(`Errore nel salvataggio: ${backendMessage}. Controlla la console per dettagli.`);
      }
    } finally {
      setIsSaving(false);
    }
  };

  const copiaDaMesePrecedente = async () => {
    // Non fare nulla se è selezionato "Intero anno" o se è Gennaio (non c'è mese precedente nello stesso anno)
    if (selectedMonth === 0 || selectedMonth === 1) {
      alert('Non è possibile copiare i valori per questa selezione');
      return;
    }

    setIsCopying(true);
    setError(null);
    
    try {
      const token = localStorage.getItem('token');
      if (!token) throw new Error('Token non trovato');

      // Calcola il mese precedente
      const mesePrecedente = selectedMonth - 1;
      
      // Recupera le impostazioni del mese precedente
      const response = await axios.get(`${BASE_URL}/api/budget-settings`, {
        params: { 
          anno: selectedYear,
          mese: mesePrecedente - 1 // Indice 0-based per l'API
        },
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      // Imposta i valori del mese precedente nel mese corrente
      setBudgetSettings({
        spese: response.data.spese || {},
        entrate: response.data.entrate || {}
      });

      alert(`Valori copiati con successo da ${mesi[mesePrecedente]} a ${mesi[selectedMonth]}!`);
    } catch (error) {
      console.error('Errore durante la copia dei valori:', error);
      
      if (error.response?.status === 401 || error.response?.status === 403) {
        handleAuthError('Sessione scaduta o non valida. Effettua nuovamente il login.');
      } else {
        setError('Errore durante la copia dei valori. Riprova più tardi.');
      }
    } finally {
      setIsCopying(false);
    }
  };

  const copiaDaMeseSuccessivo = async () => {
    // Non fare nulla se è selezionato "Intero anno" o se è Dicembre (non c'è mese successivo nello stesso anno)
    if (selectedMonth === 0 || selectedMonth === 12) {
      alert('Non è possibile copiare i valori per questa selezione');
      return;
    }

    setIsCopying(true);
    setError(null);
    
    try {
      const token = localStorage.getItem('token');
      if (!token) throw new Error('Token non trovato');

      // Calcola il mese successivo
      const meseSuccessivo = selectedMonth + 1;
      
      // Recupera le impostazioni del mese successivo
      const response = await axios.get(`${BASE_URL}/api/budget-settings`, {
        params: { 
          anno: selectedYear,
          mese: meseSuccessivo - 1 // Indice 0-based per l'API
        },
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      // Imposta i valori del mese successivo nel mese corrente
      setBudgetSettings({
        spese: response.data.spese || {},
        entrate: response.data.entrate || {}
      });

      alert(`Valori copiati con successo da ${mesi[meseSuccessivo]} a ${mesi[selectedMonth]}!`);
    } catch (error) {
      console.error('Errore durante la copia dei valori:', error);
      
      if (error.response?.status === 401 || error.response?.status === 403) {
        handleAuthError('Sessione scaduta o non valida. Effettua nuovamente il login.');
      } else {
        setError('Errore durante la copia dei valori. Riprova più tardi.');
      }
    } finally {
      setIsCopying(false);
    }
  };

  return (
    <div className="theme-container p-6">
      <h1 className="text-4xl font-bold text-center mb-4 text-indigo-700 dark:text-indigo-300">
        Impostazioni Budget {selectedMonth === 0 ? 'Intero anno' : mesi[selectedMonth]} {selectedYear}
      </h1>

      {error && (
        <div className="mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded">
          {error}
        </div>
      )}

      {/* Selettori periodo */}
      <div className="flex justify-center items-center mb-8 gap-4 flex-wrap">
        <select
          className="w-full px-6 py-4 text-lg bg-white dark:bg-gray-700 border-2 border-blue-300 dark:border-blue-600 rounded-lg shadow-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 hover:border-blue-400 text-gray-800 dark:text-white"
          value={selectedMonth}
          onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
        >
          {mesi.map((mese, index) => (
            <option key={index} value={index}>{mese}</option>
          ))}
        </select>
        <select
          className="w-full px-6 py-4 text-lg bg-white dark:bg-gray-700 border-2 border-blue-300 dark:border-blue-600 rounded-lg shadow-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 hover:border-blue-400 text-gray-800 dark:text-white"
          value={selectedYear}
          onChange={(e) => setSelectedYear(parseInt(e.target.value))}
        >
          {Array.from({ length: 12 }, (_, i) => new Date().getFullYear() - 5 + i).map(year => (
            <option key={year} value={year}>{year}</option>
          ))}
        </select>
        
        {/* Bottoni per copiare dai mesi precedente/successivo */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {selectedMonth > 0 && selectedMonth !== 1 && (
            <button
              onClick={copiaDaMesePrecedente}
              disabled={isCopying || isLoading}
              className={`px-6 py-4 text-lg font-semibold text-white rounded-lg shadow-md transition-all duration-200 ${isCopying || isLoading
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-purple-600 hover:bg-purple-700 hover:scale-105'
              }`}
            >
              {isCopying ? 'Copia in corso...' : `Copia valori da ${mesi[selectedMonth-1]}`}
            </button>
          )}
          
          {selectedMonth > 0 && selectedMonth !== 12 && (
            <button
              onClick={copiaDaMeseSuccessivo}
              disabled={isCopying || isLoading}
              className={`px-6 py-4 text-lg font-semibold text-white rounded-lg shadow-md transition-all duration-200 ${isCopying || isLoading
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-green-600 hover:bg-green-700 hover:scale-105'
              }`}
            >
              {isCopying ? 'Copia in corso...' : `Copia valori da ${mesi[selectedMonth+1]}`}
            </button>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center items-center py-8">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Sezione Spese */}
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-lg">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-red-600 dark:text-red-400">Budget Spese</h2>
              <button
                onClick={() => setShowAddCategory({ ...showAddCategory, spese: !showAddCategory.spese })}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors duration-200 flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Aggiungi Categoria
              </button>
            </div>
            
            {/* Form per aggiungere nuova categoria spese */}
            {showAddCategory.spese && (
              <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
                <h3 className="text-lg font-semibold mb-3 text-red-800 dark:text-red-200">Nuova Categoria Spese</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <input
                    type="text"
                    placeholder="Nome categoria..."
                    value={newCategory.type === 'spese' ? newCategory.name : ''}
                    onChange={(e) => setNewCategory({ type: 'spese', name: e.target.value, value: newCategory.value })}
                    className="px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
                  />
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="Importo..."
                    value={newCategory.type === 'spese' ? newCategory.value : ''}
                    onChange={(e) => setNewCategory({ type: 'spese', name: newCategory.name, value: e.target.value })}
                    className="px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={addNewCategory}
                      className="flex-1 px-3 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
                    >
                      Aggiungi
                    </button>
                    <button
                      onClick={() => {
                        setShowAddCategory({ ...showAddCategory, spese: false });
                        setNewCategory({ type: null, name: '', value: '' });
                      }}
                      className="px-3 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600 transition-colors"
                    >
                      Annulla
                    </button>
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-4">
              {getAllCategories('spese').map(categoria => (
                <div key={categoria} className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  {editingCategory.type === 'spese' && editingCategory.oldName === categoria ? (
                    <div className="flex-1 flex items-center gap-2">
                      <input
                        type="text"
                        value={editingCategory.newName}
                        onChange={(e) => setEditingCategory({ ...editingCategory, newName: e.target.value })}
                        className="flex-1 px-2 py-1 bg-white dark:bg-gray-600 border border-gray-300 dark:border-gray-500 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        onKeyPress={(e) => e.key === 'Enter' && saveEditingCategory()}
                        autoFocus
                      />
                      <button
                        onClick={saveEditingCategory}
                        className="p-1 text-green-600 hover:text-green-800"
                        title="Salva"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </button>
                      <button
                        onClick={cancelEditingCategory}
                        className="p-1 text-red-600 hover:text-red-800"
                        title="Annulla"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ) : (
                    <div className="flex-1 flex items-center gap-2">
                      <label className="flex-1 text-gray-700 dark:text-gray-300">{categoria}</label>
                      <button
                        onClick={() => startEditingCategory('spese', categoria)}
                        className="p-1 text-blue-600 hover:text-blue-800"
                        title="Modifica nome categoria"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      {!categorieSpeseDiBase.includes(categoria) && (
                        <button
                          onClick={() => deleteCategory('spese', categoria)}
                          className="p-1 text-red-600 hover:text-red-800"
                          title="Elimina categoria"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      )}
                    </div>
                  )}
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={budgetSettings.spese?.[categoria] ?? ''}
                    onChange={(e) => handleBudgetChange(categoria, 'spese', e.target.value)}
                    className="w-32 px-3 py-2 bg-white dark:bg-gray-600 border border-gray-300 dark:border-gray-500 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Sezione Entrate */}
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-lg">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-green-600 dark:text-green-400">Budget Entrate</h2>
              <button
                onClick={() => setShowAddCategory({ ...showAddCategory, entrate: !showAddCategory.entrate })}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors duration-200 flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Aggiungi Categoria
              </button>
            </div>
            
            {/* Form per aggiungere nuova categoria entrate */}
            {showAddCategory.entrate && (
              <div className="mb-6 p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                <h3 className="text-lg font-semibold mb-3 text-green-800 dark:text-green-200">Nuova Categoria Entrate</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <input
                    type="text"
                    placeholder="Nome categoria..."
                    value={newCategory.type === 'entrate' ? newCategory.name : ''}
                    onChange={(e) => setNewCategory({ type: 'entrate', name: e.target.value, value: newCategory.value })}
                    className="px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="Importo..."
                    value={newCategory.type === 'entrate' ? newCategory.value : ''}
                    onChange={(e) => setNewCategory({ type: 'entrate', name: newCategory.name, value: e.target.value })}
                    className="px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={addNewCategory}
                      className="flex-1 px-3 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
                    >
                      Aggiungi
                    </button>
                    <button
                      onClick={() => {
                        setShowAddCategory({ ...showAddCategory, entrate: false });
                        setNewCategory({ type: null, name: '', value: '' });
                      }}
                      className="px-3 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600 transition-colors"
                    >
                      Annulla
                    </button>
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-4">
              {getAllCategories('entrate').map(categoria => (
                <div key={categoria} className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  {editingCategory.type === 'entrate' && editingCategory.oldName === categoria ? (
                    <div className="flex-1 flex items-center gap-2">
                      <input
                        type="text"
                        value={editingCategory.newName}
                        onChange={(e) => setEditingCategory({ ...editingCategory, newName: e.target.value })}
                        className="flex-1 px-2 py-1 bg-white dark:bg-gray-600 border border-gray-300 dark:border-gray-500 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        onKeyPress={(e) => e.key === 'Enter' && saveEditingCategory()}
                        autoFocus
                      />
                      <button
                        onClick={saveEditingCategory}
                        className="p-1 text-green-600 hover:text-green-800"
                        title="Salva"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </button>
                      <button
                        onClick={cancelEditingCategory}
                        className="p-1 text-red-600 hover:text-red-800"
                        title="Annulla"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ) : (
                    <div className="flex-1 flex items-center gap-2">
                      <label className="flex-1 text-gray-700 dark:text-gray-300">{categoria}</label>
                      <button
                        onClick={() => startEditingCategory('entrate', categoria)}
                        className="p-1 text-blue-600 hover:text-blue-800"
                        title="Modifica nome categoria"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      {!categorieEntrateDiBase.includes(categoria) && (
                        <button
                          onClick={() => deleteCategory('entrate', categoria)}
                          className="p-1 text-red-600 hover:text-red-800"
                          title="Elimina categoria"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      )}
                    </div>
                  )}
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={budgetSettings.entrate?.[categoria] ?? ''}
                    onChange={(e) => handleBudgetChange(categoria, 'entrate', e.target.value)}
                    className="w-32 px-3 py-2 bg-white dark:bg-gray-600 border border-gray-300 dark:border-gray-500 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Pulsanti Azioni */}
      <div className="flex flex-col md:flex-row justify-center items-center gap-4 mt-8">
        <button
          onClick={salvaBudget}
          disabled={isSaving || isLoading}
          className={`px-8 py-4 text-lg font-semibold text-white rounded-lg shadow-lg transition-all duration-200 transform hover:scale-105 ${
            isSaving || isLoading
              ? 'bg-gray-400 cursor-not-allowed'
              : 'bg-blue-600 hover:bg-blue-700'
          }`}
        >
          {isSaving ? 'Salvataggio in corso...' : 'Salva impostazioni'}
        </button>
        
        <div className="flex gap-4">
          <button
            onClick={esportaImpostazioni}
            disabled={isLoading}
            className="px-6 py-3 text-sm font-semibold text-white bg-purple-600 hover:bg-purple-700 rounded-lg shadow-lg transition-all duration-200 transform hover:scale-105 flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Esporta
          </button>
          
          <label className="px-6 py-3 text-sm font-semibold text-white bg-orange-600 hover:bg-orange-700 rounded-lg shadow-lg transition-all duration-200 transform hover:scale-105 cursor-pointer flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
            </svg>
            Importa
            <input
              type="file"
              accept=".json"
              onChange={importaImpostazioni}
              className="hidden"
            />
          </label>
        </div>
      </div>
    </div>
  );
}

export default BudgetSettings;