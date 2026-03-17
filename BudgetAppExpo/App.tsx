import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  SafeAreaView,
} from 'react-native';

const BASE_URL = 'https://budget-app-ios-backend.onrender.com';

type Screen = 'login' | 'home' | 'transazioni' | 'budget' | 'settings';

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<Screen>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [transazioni, setTransazioni] = useState<any[]>([]);
  const [token, setToken] = useState('');
  const [serverStatus, setServerStatus] = useState('Controllo server...');
  const [budgetData, setBudgetData] = useState<any>({});
  const [categories, setCategories] = useState<any[]>([]);
  const [statistics, setStatistics] = useState<any>({});
  const [transazioniPeriodiche, setTransazioniPeriodiche] = useState<any[]>([]);

  // Form nuova transazione
  const [tipo, setTipo] = useState<'spesa' | 'entrata'>('spesa');
  const [importo, setImporto] = useState('');
  const [categoria, setCategoria] = useState('');
  const [descrizione, setDescrizione] = useState('');
  const [data, setData] = useState(new Date().toISOString().split('T')[0]);

  // Filtri
  const [filtroCategoria, setFiltroCategoria] = useState('');
  const [filtroTipo, setFiltroTipo] = useState<'tutte' | 'spese' | 'entrate'>('tutte');
  const [dataInizio, setDataInizio] = useState('');
  const [dataFine, setDataFine] = useState('');
  const [ricercaDescrizione, setRicercaDescrizione] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  // Transazioni periodiche
  const [showPeriodicForm, setShowPeriodicForm] = useState(false);
  const [periodicTipo, setPeriodicTipo] = useState<'spesa' | 'entrata'>('spesa');
  const [periodicImporto, setPeriodicImporto] = useState('');
  const [periodicCategoria, setPeriodicCategoria] = useState('');
  const [periodicDescrizione, setPeriodicDescrizione] = useState('');
  const [periodicFrequenza, setPeriodicFrequenza] = useState<'mensile' | 'settimanale'>('mensile');

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const login = async () => {
    if (!username || !password) {
      Alert.alert('Errore', 'Inserisci username e password');
      return;
    }

    setIsLoading(true);
    setServerStatus('Tentativo login...');

    try {
      console.log('Test homepage del server...');
      const homeResponse = await fetch(`${BASE_URL}/`);
      console.log('Homepage status:', homeResponse.status);

      console.log('Test endpoint login...');
      const response = await fetch(`${BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      console.log('Login response status:', response.status);
      console.log('Login response headers:', response.headers);

      const data = await response.json();
      console.log('Login response text:', JSON.stringify(data));

      if (response.ok && data.token) {
        setToken(data.token);
        setIsLoggedIn(true);
        setCurrentScreen('home');
        setServerStatus('Connesso');
        await loadAllData(data.token);
      } else {
        Alert.alert('Errore Login', data.message || 'Credenziali non valide');
        setServerStatus('Errore login');
      }
    } catch (error) {
      console.error('Errore login:', error);
      Alert.alert('Errore', 'Impossibile connettersi al server');
      setServerStatus('Server non raggiungibile');
    } finally {
      setIsLoading(false);
    }
  };

  const loadAllData = async (authToken: string) => {
    await Promise.all([
      loadTransactions(authToken),
      loadBudgetData(authToken),
      loadCategories(authToken),
      loadStatistics(authToken),
      loadTransazioniPeriodiche(authToken)
    ]);
  };

  const loadTransazioniPeriodiche = async (authToken: string) => {
    try {
      const response = await fetch(`${BASE_URL}/api/transazioni-periodiche`, {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      if (response.ok) {
        const data = await response.json();
        setTransazioniPeriodiche(Array.isArray(data) ? data : []);
      }
    } catch (error) {
      console.error('Errore caricamento transazioni periodiche:', error);
    }
  };

  const loadTransactions = async (authToken: string) => {
    try {
      console.log('🔄 Caricamento transazioni...');
      const [speseResponse, entrateResponse] = await Promise.all([
        fetch(`${BASE_URL}/api/spese?page=1&limit=5000`, {
          headers: { 'Authorization': `Bearer ${authToken}` }
        }),
        fetch(`${BASE_URL}/api/entrate?page=1&limit=5000`, {
          headers: { 'Authorization': `Bearer ${authToken}` }
        })
      ]);

      console.log('📊 Response status - Spese:', speseResponse.status, 'Entrate:', entrateResponse.status);

      const speseData = speseResponse.ok ? await speseResponse.json() : [];
      const entrateData = entrateResponse.ok ? await entrateResponse.json() : [];

      console.log('📊 Struttura dati - Spese:', typeof speseData, Object.keys(speseData || {}));
      console.log('📊 Struttura dati - Entrate:', typeof entrateData, Object.keys(entrateData || {}));

      // Le API potrebbero restituire { data: [...] } o direttamente [...]
      const spese = Array.isArray(speseData) ? speseData : (speseData?.data || speseData?.spese || []);
      const entrate = Array.isArray(entrateData) ? entrateData : (entrateData?.data || entrateData?.entrate || []);

      console.log('📊 Array finali - Spese:', spese.length, 'Entrate:', entrate.length);

      const allTransactions = [...spese, ...entrate].sort((a, b) => 
        new Date(b.data || b.createdAt).getTime() - new Date(a.data || a.createdAt).getTime()
      );

      console.log('✅ Transazioni totali caricate:', allTransactions.length);
      setTransazioni(allTransactions);
    } catch (error) {
      console.error('❌ Errore caricamento transazioni:', error);
      setTransazioni([]);
    }
  };

  const loadBudgetData = async (authToken: string) => {
    try {
      const response = await fetch(`${BASE_URL}/api/budget-settings`, {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      if (response.ok) {
        const data = await response.json();
        setBudgetData(data);
      }
    } catch (error) {
      console.error('Errore caricamento budget:', error);
    }
  };

  const loadCategories = async (authToken: string) => {
    try {
      const response = await fetch(`${BASE_URL}/api/categorie`, {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      if (response.ok) {
        const data = await response.json();
        setCategories(data);
      }
    } catch (error) {
      console.error('Errore caricamento categorie:', error);
    }
  };

  const loadStatistics = async (authToken: string) => {
    try {
      const totalSpese = transazioni
        .filter(t => t.importo < 0)
        .reduce((sum, t) => sum + Math.abs(t.importo), 0);
      
      const totalEntrate = transazioni
        .filter(t => t.importo > 0)
        .reduce((sum, t) => sum + t.importo, 0);

      setStatistics({
        totalSpese,
        totalEntrate,
        bilancio: totalEntrate - totalSpese,
        numeroTransazioni: transazioni.length
      });
    } catch (error) {
      console.error('Errore calcolo statistiche:', error);
    }
  };

  const addTransaction = async () => {
    if (!importo || !descrizione || !categoria) {
      Alert.alert('Errore', 'Compila tutti i campi');
      return;
    }

    setIsLoading(true);
    try {
      const endpoint = tipo === 'spesa' ? '/api/spese' : '/api/entrate';
      const response = await fetch(`${BASE_URL}${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          importo: tipo === 'spesa' ? -Math.abs(parseFloat(importo)) : Math.abs(parseFloat(importo)),
          descrizione,
          categoria,
          data
        }),
      });

      if (response.ok) {
        Alert.alert('Successo', `${tipo === 'spesa' ? 'Spesa' : 'Entrata'} aggiunta`);
        setImporto('');
        setDescrizione('');
        setCategoria('');
        await loadTransactions(token);
        await loadStatistics(token);
      } else {
        const error = await response.json();
        Alert.alert('Errore', error.message || 'Errore nell\'aggiunta');
      }
    } catch (error) {
      console.error('Errore aggiunta transazione:', error);
      Alert.alert('Errore', 'Impossibile aggiungere la transazione');
    } finally {
      setIsLoading(false);
    }
  };

  const addPeriodicTransaction = async () => {
    if (!periodicImporto || !periodicDescrizione || !periodicCategoria) {
      Alert.alert('Errore', 'Compila tutti i campi');
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(`${BASE_URL}/api/transazioni-periodiche`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          tipo: periodicTipo,
          importo: periodicTipo === 'spesa' ? -Math.abs(parseFloat(periodicImporto)) : Math.abs(parseFloat(periodicImporto)),
          descrizione: periodicDescrizione,
          categoria: periodicCategoria,
          frequenza: periodicFrequenza
        }),
      });

      if (response.ok) {
        Alert.alert('Successo', 'Transazione periodica aggiunta');
        setPeriodicImporto('');
        setPeriodicDescrizione('');
        setPeriodicCategoria('');
        setShowPeriodicForm(false);
        await loadTransazioniPeriodiche(token);
      } else {
        const error = await response.json();
        Alert.alert('Errore', error.message || 'Errore nell\'aggiunta');
      }
    } catch (error) {
      console.error('Errore aggiunta transazione periodica:', error);
      Alert.alert('Errore', 'Impossibile aggiungere la transazione periodica');
    } finally {
      setIsLoading(false);
    }
  };

  const getFilteredTransactions = () => {
    let filtered = [...transazioni];

    // Filtro per tipo
    if (filtroTipo === 'spese') {
      filtered = filtered.filter(t => t.importo < 0);
    } else if (filtroTipo === 'entrate') {
      filtered = filtered.filter(t => t.importo > 0);
    }

    // Filtro per categoria
    if (filtroCategoria) {
      filtered = filtered.filter(t => t.categoria?.toLowerCase().includes(filtroCategoria.toLowerCase()));
    }

    // Filtro per descrizione
    if (ricercaDescrizione) {
      filtered = filtered.filter(t => t.descrizione?.toLowerCase().includes(ricercaDescrizione.toLowerCase()));
    }

    // Filtro per data inizio
    if (dataInizio) {
      filtered = filtered.filter(t => new Date(t.data || t.createdAt) >= new Date(dataInizio));
    }

    // Filtro per data fine
    if (dataFine) {
      filtered = filtered.filter(t => new Date(t.data || t.createdAt) <= new Date(dataFine));
    }

    return filtered;
  };

  const changePassword = async () => {
    if (!newPassword || !confirmPassword) {
      Alert.alert('Errore', 'Compila tutti i campi');
      return;
    }

    if (newPassword !== confirmPassword) {
      Alert.alert('Errore', 'Le password non coincidono');
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(`${BASE_URL}/api/auth/change-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ newPassword }),
      });

      if (response.ok) {
        Alert.alert('Successo', 'Password cambiata con successo');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        const error = await response.json();
        Alert.alert('Errore', error.message || 'Errore nel cambio password');
      }
    } catch (error) {
      console.error('Errore cambio password:', error);
      Alert.alert('Errore', 'Impossibile cambiare la password');
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    setIsLoggedIn(false);
    setCurrentScreen('login');
    setToken('');
    setTransazioni([]);
    setBudgetData({});
    setCategories([]);
    setStatistics({});
    setUsername('');
    setPassword('');
  };

  const renderLoginScreen = () => (
    <View style={styles.container}>
      <Text style={styles.title}>Budget App</Text>
      <Text style={styles.subtitle}>{serverStatus}</Text>
      
      <TextInput
        style={styles.input}
        placeholder="Username"
        value={username}
        onChangeText={setUsername}
        autoCapitalize="none"
      />
      
      <TextInput
        style={styles.input}
        placeholder="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />
      
      <TouchableOpacity 
        style={[styles.button, isLoading && styles.buttonDisabled]} 
        onPress={login}
        disabled={isLoading}
      >
        {isLoading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Login</Text>
        )}
      </TouchableOpacity>
    </View>
  );

  const renderNavigation = () => (
    <View style={styles.navigation}>
      <TouchableOpacity 
        style={[styles.navButton, currentScreen === 'home' && styles.navButtonActive]}
        onPress={() => setCurrentScreen('home')}
      >
        <Text style={[styles.navButtonText, currentScreen === 'home' && styles.navButtonTextActive]}>
          Home
        </Text>
      </TouchableOpacity>
      
      <TouchableOpacity 
        style={[styles.navButton, currentScreen === 'transazioni' && styles.navButtonActive]}
        onPress={() => setCurrentScreen('transazioni')}
      >
        <Text style={[styles.navButtonText, currentScreen === 'transazioni' && styles.navButtonTextActive]}>
          Transazioni
        </Text>
      </TouchableOpacity>
      
      <TouchableOpacity 
        style={[styles.navButton, currentScreen === 'budget' && styles.navButtonActive]}
        onPress={() => setCurrentScreen('budget')}
      >
        <Text style={[styles.navButtonText, currentScreen === 'budget' && styles.navButtonTextActive]}>
          Budget
        </Text>
      </TouchableOpacity>


      <TouchableOpacity 
        style={[styles.navButton, currentScreen === 'settings' && styles.navButtonActive]}
        onPress={() => setCurrentScreen('settings')}
      >
        <Text style={[styles.navButtonText, currentScreen === 'settings' && styles.navButtonTextActive]}>
          Impostazioni
        </Text>
      </TouchableOpacity>
    </View>
  );

  const renderHomeScreen = () => (
    <ScrollView style={styles.content}>
      <Text style={styles.screenTitle}>Dashboard</Text>
      
      <View style={styles.summaryContainer}>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>Totale Entrate</Text>
          <Text style={[styles.summaryAmount, styles.positive]}>
            €{statistics.totalEntrate?.toFixed(2) || '0.00'}
          </Text>
        </View>
        
        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>Totale Spese</Text>
          <Text style={[styles.summaryAmount, styles.negative]}>
            €{statistics.totalSpese?.toFixed(2) || '0.00'}
          </Text>
        </View>
        
        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>Bilancio</Text>
          <Text style={[
            styles.summaryAmount, 
            (statistics.bilancio || 0) >= 0 ? styles.positive : styles.negative
          ]}>
            €{statistics.bilancio?.toFixed(2) || '0.00'}
          </Text>
        </View>
      </View>

      <View style={styles.quickActions}>
        <Text style={styles.sectionTitle}>Azioni Rapide</Text>
        <TouchableOpacity 
          style={styles.actionButton}
          onPress={() => setCurrentScreen('transazioni')}
        >
          <Text style={styles.actionButtonText}>+ Nuova Transazione</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.recentTransactions}>
        <Text style={styles.sectionTitle}>Transazioni Recenti</Text>
        {transazioni.slice(0, 5).map((trans, index) => (
          <View key={index} style={styles.transactionItem}>
            <View style={styles.transactionInfo}>
              <Text style={styles.transactionDescription}>{trans.descrizione}</Text>
              <Text style={styles.transactionCategory}>{trans.categoria}</Text>
            </View>
            <Text style={[
              styles.transactionAmount,
              trans.importo >= 0 ? styles.positive : styles.negative
            ]}>
              €{Math.abs(trans.importo).toFixed(2)}
            </Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );

  const renderTransactionScreen = () => {
    const filteredTransactions = getFilteredTransactions();
    
    return (
      <ScrollView style={styles.content}>
        <Text style={styles.screenTitle}>Gestione Transazioni</Text>
        
        {/* Bottoni azioni */}
        <View style={styles.actionButtons}>
          <TouchableOpacity 
            style={styles.actionButtonSmall}
            onPress={() => setShowFilters(!showFilters)}
          >
            <Text style={styles.actionButtonText}>
              {showFilters ? 'Nascondi Filtri' : 'Mostra Filtri'}
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.actionButtonSmall}
            onPress={() => setShowPeriodicForm(!showPeriodicForm)}
          >
            <Text style={styles.actionButtonText}>
              {showPeriodicForm ? 'Nascondi Periodiche' : 'Transazioni Periodiche'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Filtri */}
        {showFilters && (
          <View style={styles.formContainer}>
            <Text style={styles.sectionTitle}>Filtri</Text>
            
            <View style={styles.segmentedControl}>
              <TouchableOpacity
                style={[styles.segment, filtroTipo === 'tutte' && styles.segmentActive]}
                onPress={() => setFiltroTipo('tutte')}
              >
                <Text style={[styles.segmentText, filtroTipo === 'tutte' && styles.segmentTextActive]}>
                  Tutte
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.segment, filtroTipo === 'spese' && styles.segmentActive]}
                onPress={() => setFiltroTipo('spese')}
              >
                <Text style={[styles.segmentText, filtroTipo === 'spese' && styles.segmentTextActive]}>
                  Spese
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.segment, filtroTipo === 'entrate' && styles.segmentActive]}
                onPress={() => setFiltroTipo('entrate')}
              >
                <Text style={[styles.segmentText, filtroTipo === 'entrate' && styles.segmentTextActive]}>
                  Entrate
                </Text>
              </TouchableOpacity>
            </View>

            <TextInput
              style={styles.input}
              placeholder="Filtra per categoria"
              value={filtroCategoria}
              onChangeText={setFiltroCategoria}
            />

            <TextInput
              style={styles.input}
              placeholder="Cerca nella descrizione"
              value={ricercaDescrizione}
              onChangeText={setRicercaDescrizione}
            />

            <TextInput
              style={styles.input}
              placeholder="Data inizio (YYYY-MM-DD)"
              value={dataInizio}
              onChangeText={setDataInizio}
            />

            <TextInput
              style={styles.input}
              placeholder="Data fine (YYYY-MM-DD)"
              value={dataFine}
              onChangeText={setDataFine}
            />

            <TouchableOpacity 
              style={styles.clearButton}
              onPress={() => {
                setFiltroCategoria('');
                setRicercaDescrizione('');
                setDataInizio('');
                setDataFine('');
                setFiltroTipo('tutte');
              }}
            >
              <Text style={styles.clearButtonText}>Pulisci Filtri</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Form transazioni periodiche */}
        {showPeriodicForm && (
          <View style={styles.formContainer}>
            <Text style={styles.sectionTitle}>Nuova Transazione Periodica</Text>
            
            <View style={styles.segmentedControl}>
              <TouchableOpacity
                style={[styles.segment, periodicTipo === 'spesa' && styles.segmentActive]}
                onPress={() => setPeriodicTipo('spesa')}
              >
                <Text style={[styles.segmentText, periodicTipo === 'spesa' && styles.segmentTextActive]}>
                  Spesa
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.segment, periodicTipo === 'entrata' && styles.segmentActive]}
                onPress={() => setPeriodicTipo('entrata')}
              >
                <Text style={[styles.segmentText, periodicTipo === 'entrata' && styles.segmentTextActive]}>
                  Entrata
                </Text>
              </TouchableOpacity>
            </View>

            <TextInput
              style={styles.input}
              placeholder="Importo"
              value={periodicImporto}
              onChangeText={setPeriodicImporto}
              keyboardType="numeric"
            />

            <TextInput
              style={styles.input}
              placeholder="Descrizione"
              value={periodicDescrizione}
              onChangeText={setPeriodicDescrizione}
            />

            <TextInput
              style={styles.input}
              placeholder="Categoria"
              value={periodicCategoria}
              onChangeText={setPeriodicCategoria}
            />

            <View style={styles.segmentedControl}>
              <TouchableOpacity
                style={[styles.segment, periodicFrequenza === 'mensile' && styles.segmentActive]}
                onPress={() => setPeriodicFrequenza('mensile')}
              >
                <Text style={[styles.segmentText, periodicFrequenza === 'mensile' && styles.segmentTextActive]}>
                  Mensile
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.segment, periodicFrequenza === 'settimanale' && styles.segmentActive]}
                onPress={() => setPeriodicFrequenza('settimanale')}
              >
                <Text style={[styles.segmentText, periodicFrequenza === 'settimanale' && styles.segmentTextActive]}>
                  Settimanale
                </Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity 
              style={[styles.button, isLoading && styles.buttonDisabled]}
              onPress={addPeriodicTransaction}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>Aggiungi Transazione Periodica</Text>
              )}
            </TouchableOpacity>

            {/* Lista transazioni periodiche esistenti */}
            {transazioniPeriodiche.length > 0 && (
              <View style={styles.periodicList}>
                <Text style={styles.sectionTitle}>Transazioni Periodiche Attive ({transazioniPeriodiche.length})</Text>
                {transazioniPeriodiche.map((trans, index) => (
                  <View key={index} style={styles.transactionItem}>
                    <View style={styles.transactionInfo}>
                      <Text style={styles.transactionDescription}>{trans.descrizione}</Text>
                      <Text style={styles.transactionCategory}>{trans.categoria} - {trans.frequenza}</Text>
                    </View>
                    <Text style={[
                      styles.transactionAmount,
                      trans.importo >= 0 ? styles.positive : styles.negative
                    ]}>
                      €{Math.abs(trans.importo).toFixed(2)}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}

        <View style={styles.formContainer}>
          <Text style={styles.sectionTitle}>Nuova Transazione</Text>
        
        <View style={styles.segmentedControl}>
          <TouchableOpacity
            style={[styles.segment, tipo === 'spesa' && styles.segmentActive]}
            onPress={() => setTipo('spesa')}
          >
            <Text style={[styles.segmentText, tipo === 'spesa' && styles.segmentTextActive]}>
              Spesa
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.segment, tipo === 'entrata' && styles.segmentActive]}
            onPress={() => setTipo('entrata')}
          >
            <Text style={[styles.segmentText, tipo === 'entrata' && styles.segmentTextActive]}>
              Entrata
            </Text>
          </TouchableOpacity>
        </View>

        <TextInput
          style={styles.input}
          placeholder="Importo"
          value={importo}
          onChangeText={setImporto}
          keyboardType="numeric"
        />

        <TextInput
          style={styles.input}
          placeholder="Descrizione"
          value={descrizione}
          onChangeText={setDescrizione}
        />

        <TextInput
          style={styles.input}
          placeholder="Categoria"
          value={categoria}
          onChangeText={setCategoria}
        />

        <TextInput
          style={styles.input}
          placeholder="Data (YYYY-MM-DD)"
          value={data}
          onChangeText={setData}
        />

        <TouchableOpacity 
          style={[styles.button, isLoading && styles.buttonDisabled]}
          onPress={addTransaction}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Aggiungi {tipo === 'spesa' ? 'Spesa' : 'Entrata'}</Text>
          )}
        </TouchableOpacity>
      </View>

      <View style={styles.transactionsList}>
        <Text style={styles.sectionTitle}>
          {filtroTipo === 'tutte' ? 'Tutte le Transazioni' : 
           filtroTipo === 'spese' ? 'Spese' : 'Entrate'} ({filteredTransactions.length})
        </Text>
        {filteredTransactions.map((trans, index) => (
          <View key={index} style={styles.transactionItem}>
            <View style={styles.transactionInfo}>
              <Text style={styles.transactionDescription}>{trans.descrizione}</Text>
              <Text style={styles.transactionCategory}>{trans.categoria}</Text>
              <Text style={styles.transactionDate}>{trans.data}</Text>
            </View>
            <Text style={[
              styles.transactionAmount,
              trans.importo >= 0 ? styles.positive : styles.negative
            ]}>
              €{Math.abs(trans.importo).toFixed(2)}
            </Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );
};

  const renderBudgetScreen = () => {
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    const monthNames = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
      'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];

    const currentMonthTransactions = transazioni.filter(t => {
      const transDate = new Date(t.data || t.createdAt);
      return transDate.getMonth() === currentMonth && transDate.getFullYear() === currentYear;
    });

    const monthlySpese = currentMonthTransactions
      .filter(t => t.importo < 0)
      .reduce((sum, t) => sum + Math.abs(t.importo), 0);

    const monthlyEntrate = currentMonthTransactions
      .filter(t => t.importo > 0)
      .reduce((sum, t) => sum + t.importo, 0);

    const categorieSpese = {};
    currentMonthTransactions
      .filter(t => t.importo < 0)
      .forEach(t => {
        const cat = t.categoria || 'Altro';
        categorieSpese[cat] = (categorieSpese[cat] || 0) + Math.abs(t.importo);
      });

    return (
      <ScrollView style={styles.content}>
        <Text style={styles.screenTitle}>Budget {monthNames[currentMonth]} {currentYear}</Text>
        
        <View style={styles.summaryContainer}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryTitle}>Entrate Mese</Text>
            <Text style={[styles.summaryAmount, styles.positive]}>
              €{monthlyEntrate.toFixed(2)}
            </Text>
          </View>
          
          <View style={styles.summaryCard}>
            <Text style={styles.summaryTitle}>Spese Mese</Text>
            <Text style={[styles.summaryAmount, styles.negative]}>
              €{monthlySpese.toFixed(2)}
            </Text>
          </View>
          
          <View style={styles.summaryCard}>
            <Text style={styles.summaryTitle}>Bilancio Mese</Text>
            <Text style={[
              styles.summaryAmount, 
              (monthlyEntrate - monthlySpese) >= 0 ? styles.positive : styles.negative
            ]}>
              €{(monthlyEntrate - monthlySpese).toFixed(2)}
            </Text>
          </View>
        </View>

        <View style={styles.categorySection}>
          <Text style={styles.sectionTitle}>Spese per Categoria</Text>
          {Object.entries(categorieSpese).map(([categoria, importo]) => (
            <View key={categoria} style={styles.categoryItem}>
              <Text style={styles.categoryName}>{categoria}</Text>
              <Text style={styles.categoryAmount}>€{importo.toFixed(2)}</Text>
            </View>
          ))}
        </View>

        <View style={styles.monthlyTransactions}>
          <Text style={styles.sectionTitle}>Transazioni del Mese ({currentMonthTransactions.length})</Text>
          {currentMonthTransactions.slice(0, 10).map((trans, index) => (
            <View key={index} style={styles.transactionItem}>
              <View style={styles.transactionInfo}>
                <Text style={styles.transactionDescription}>{trans.descrizione}</Text>
                <Text style={styles.transactionCategory}>{trans.categoria}</Text>
                <Text style={styles.transactionDate}>{trans.data}</Text>
              </View>
              <Text style={[
                styles.transactionAmount,
                trans.importo >= 0 ? styles.positive : styles.negative
              ]}>
                €{Math.abs(trans.importo).toFixed(2)}
              </Text>
            </View>
          ))}
        </View>
      </ScrollView>
    );
  };


  const renderSettingsScreen = () => (
    <ScrollView style={styles.content}>
      <Text style={styles.screenTitle}>Impostazioni</Text>
      
      <View style={styles.formContainer}>
        <Text style={styles.sectionTitle}>Cambia Password</Text>
        
        <TextInput
          style={styles.input}
          placeholder="Nuova Password"
          value={newPassword}
          onChangeText={setNewPassword}
          secureTextEntry
        />
        
        <TextInput
          style={styles.input}
          placeholder="Conferma Password"
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          secureTextEntry
        />
        
        <TouchableOpacity 
          style={[styles.button, isLoading && styles.buttonDisabled]}
          onPress={changePassword}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Cambia Password</Text>
          )}
        </TouchableOpacity>
      </View>

      <View style={styles.formContainer}>
        <Text style={styles.sectionTitle}>Account</Text>
        <Text style={styles.userInfo}>Utente: {username}</Text>
        <Text style={styles.userInfo}>Server: {BASE_URL}</Text>
        
        <TouchableOpacity 
          style={[styles.button, styles.logoutButton]}
          onPress={logout}
        >
          <Text style={styles.buttonText}>Logout</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );

  useEffect(() => {
    if (isLoggedIn && token) {
      loadStatistics(token);
    }
  }, [transazioni, isLoggedIn, token]);

  const renderCurrentScreen = () => {
    switch (currentScreen) {
      case 'home':
        return renderHomeScreen();
      case 'transazioni':
        return renderTransactionScreen();
      case 'budget':
        return renderBudgetScreen();
      case 'settings':
        return renderSettingsScreen();
      default:
        return renderHomeScreen();
    }
  };

  if (!isLoggedIn) {
    return (
      <SafeAreaView style={styles.safeArea}>
        {renderLoginScreen()}
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      {renderNavigation()}
      {renderCurrentScreen()}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
    backgroundColor: '#f5f5f5',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 10,
    color: '#333',
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 30,
    color: '#666',
  },
  screenTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    color: '#333',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 15,
    color: '#333',
  },
  input: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 15,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#ddd',
    fontSize: 16,
  },
  button: {
    backgroundColor: '#007AFF',
    borderRadius: 8,
    padding: 15,
    alignItems: 'center',
    marginBottom: 10,
  },
  buttonDisabled: {
    backgroundColor: '#ccc',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  logoutButton: {
    backgroundColor: '#FF3B30',
  },
  navigation: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
  },
  navButton: {
    flex: 1,
    padding: 15,
    alignItems: 'center',
  },
  navButtonActive: {
    backgroundColor: '#007AFF',
  },
  navButtonText: {
    fontSize: 14,
    color: '#333',
  },
  navButtonTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  summaryContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 30,
  },
  summaryCard: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 15,
    flex: 1,
    marginHorizontal: 5,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  summaryTitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 5,
  },
  summaryAmount: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  positive: {
    color: '#34C759',
  },
  negative: {
    color: '#FF3B30',
  },
  quickActions: {
    marginBottom: 30,
  },
  actionButton: {
    backgroundColor: '#34C759',
    borderRadius: 8,
    padding: 15,
    alignItems: 'center',
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  recentTransactions: {
    marginBottom: 20,
  },
  transactionsList: {
    marginTop: 20,
  },
  transactionItem: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 15,
    marginBottom: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  transactionInfo: {
    flex: 1,
  },
  transactionDescription: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  transactionCategory: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  transactionDate: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
  transactionAmount: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  formContainer: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  segmentedControl: {
    flexDirection: 'row',
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
    marginBottom: 15,
  },
  segment: {
    flex: 1,
    padding: 12,
    alignItems: 'center',
    borderRadius: 8,
  },
  segmentActive: {
    backgroundColor: '#007AFF',
  },
  segmentText: {
    fontSize: 16,
    color: '#333',
  },
  segmentTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  statsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  statCard: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 20,
    width: '48%',
    marginBottom: 15,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statTitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 10,
    textAlign: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  userInfo: {
    fontSize: 16,
    color: '#666',
    marginBottom: 10,
  },
  comingSoon: {
    fontSize: 18,
    color: '#666',
    textAlign: 'center',
    marginTop: 50,
    fontStyle: 'italic',
  },
  categorySection: {
    marginBottom: 20,
  },
  categoryItem: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 15,
    marginBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  categoryName: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
  categoryAmount: {
    fontSize: 16,
    color: '#FF3B30',
    fontWeight: 'bold',
  },
  monthlyTransactions: {
    marginBottom: 20,
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 20,
  },
  actionButtonSmall: {
    backgroundColor: '#007AFF',
    borderRadius: 8,
    padding: 10,
    minWidth: 80,
    alignItems: 'center',
  },
  clearButton: {
    backgroundColor: '#FF9500',
    borderRadius: 8,
    padding: 10,
    alignItems: 'center',
    marginTop: 10,
  },
  clearButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600'
  },
  periodicList: {
    marginTop: 20,
    backgroundColor: '#f8f8f8',
    borderRadius: 8,
    padding: 15
  }
});