import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Alert,
  ActivityIndicator,
  Switch,
  Platform,
  Modal,
  InputAccessoryView,
  Keyboard,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import { API_URL } from '../config';
import { warmupBackend, fetchWithRetry } from '../utils/apiClient';

const BASE_URL = API_URL;

const STRINGS = {
  it: {
    editTitle: 'Modifica Transazione',
    frequenzaMensile: 'Mensile',
    frequenzaSettimanale: 'Settimanale',
    frequenzaAnnuale: 'Annuale',
    errore: 'Errore',
    campiObbligatori: 'Compila tutti i campi obbligatori',
    utenteNonAutenticato: 'Utente non autenticato',
    successo: 'Successo',
    transazioneEsito: (tipo: 'spesa' | 'entrata', isEditing: boolean) =>
      `${tipo === 'spesa' ? 'Spesa' : 'Entrata'} ${isEditing ? 'aggiornata' : 'aggiunta'} con successo!`,
    ok: 'OK',
    aggiungiUnAltra: "Aggiungi un'altra",
    impossibileInserire: 'Impossibile inserire la transazione',
    ricorrenzaDescrizione: (categoria: string) => `Ricorrenza ${categoria}`,
    transazioneRicorrenteCreata: 'Transazione ricorrente creata con successo!',
    impossibileCreareRicorrente: 'Impossibile creare la transazione ricorrente',
    erroreRete: 'Errore di rete. Riprova più tardi.',
    modalitaSingola: '📅 Singola',
    modalitaRicorrente: '🔄 Ricorrente',
    vediElencoRicorrenti: '📑 Vedi elenco ricorrenti',
    spesa: 'Spesa',
    entrata: 'Entrata',
    importoPlaceholder: (currency: string) => `Importo (${currency} es. 12,50)`,
    fine: 'Fine',
    categoria: 'Categoria',
    descrizionePlaceholder: 'Descrizione (opzionale)',
    data: 'Data',
    opzioniRicorrenza: 'Opzioni Ricorrenza',
    frequenza: 'Frequenza',
    dataInizio: 'Data Inizio',
    ricorrenzaInfinita: 'Ricorrenza Infinita',
    dataFine: 'Data Fine',
    submitButton: (isEditing: boolean, periodica: boolean) =>
      isEditing ? 'Aggiorna Transazione' : (periodica ? 'Crea Transazione Ricorrente' : 'Aggiungi'),
  },
  en: {
    editTitle: 'Edit Transaction',
    frequenzaMensile: 'Monthly',
    frequenzaSettimanale: 'Weekly',
    frequenzaAnnuale: 'Yearly',
    errore: 'Error',
    campiObbligatori: 'Please fill in all mandatory fields',
    utenteNonAutenticato: 'User not authenticated',
    successo: 'Success',
    transazioneEsito: (tipo: 'spesa' | 'entrata', isEditing: boolean) =>
      `${tipo === 'spesa' ? 'Expense' : 'Income'} ${isEditing ? 'updated' : 'added'} successfully!`,
    ok: 'OK',
    aggiungiUnAltra: 'Add another',
    impossibileInserire: 'Unable to insert transaction',
    ricorrenzaDescrizione: (categoria: string) => `Recurrence ${categoria}`,
    transazioneRicorrenteCreata: 'Recurring transaction created successfully!',
    impossibileCreareRicorrente: 'Unable to create recurring transaction',
    erroreRete: 'Network error. Please try again later.',
    modalitaSingola: '📅 One-time',
    modalitaRicorrente: '🔄 Recurring',
    vediElencoRicorrenti: '📑 View recurring list',
    spesa: 'Expense',
    entrata: 'Income',
    importoPlaceholder: (currency: string) => `Amount (${currency} e.g. 12.50)`,
    fine: 'Done',
    categoria: 'Category',
    descrizionePlaceholder: 'Description (optional)',
    data: 'Date',
    opzioniRicorrenza: 'Recurring Options',
    frequenza: 'Frequency',
    dataInizio: 'Start Date',
    ricorrenzaInfinita: 'Infinite Recurrence',
    dataFine: 'End Date',
    submitButton: (isEditing: boolean, periodica: boolean) =>
      isEditing ? 'Update Transaction' : (periodica ? 'Create Recurring Transaction' : 'Add'),
  },
  es: {
    editTitle: 'Editar Transacción',
    frequenzaMensile: 'Mensual',
    frequenzaSettimanale: 'Semanal',
    frequenzaAnnuale: 'Anual',
    errore: 'Error',
    campiObbligatori: 'Completa todos los campos obligatorios',
    utenteNonAutenticato: 'Usuario no autenticado',
    successo: 'Éxito',
    transazioneEsito: (tipo: 'spesa' | 'entrata', isEditing: boolean) =>
      `${tipo === 'spesa' ? 'Gasto' : 'Ingreso'} ${isEditing ? 'actualizado' : 'añadido'} con éxito!`,
    ok: 'OK',
    aggiungiUnAltra: 'Añadir otra',
    impossibileInserire: 'No se pudo insertar la transacción',
    ricorrenzaDescrizione: (categoria: string) => `Recurrencia ${categoria}`,
    transazioneRicorrenteCreata: '¡Transacción recurrente creada con éxito!',
    impossibileCreareRicorrente: 'No se pudo crear la transacción recurrente',
    erroreRete: 'Error de red. Inténtalo de nuevo más tarde.',
    modalitaSingola: '📅 Única',
    modalitaRicorrente: '🔄 Recurrente',
    vediElencoRicorrenti: '📑 Ver lista de recurrentes',
    spesa: 'Gasto',
    entrata: 'Ingreso',
    importoPlaceholder: (currency: string) => `Importe (${currency} ej. 12,50)`,
    fine: 'Listo',
    categoria: 'Categoría',
    descrizionePlaceholder: 'Descripción (opcional)',
    data: 'Fecha',
    opzioniRicorrenza: 'Opciones de Recurrencia',
    frequenza: 'Frecuencia',
    dataInizio: 'Fecha de Inicio',
    ricorrenzaInfinita: 'Recurrencia Infinita',
    dataFine: 'Fecha de Fin',
    submitButton: (isEditing: boolean, periodica: boolean) =>
      isEditing ? 'Actualizar Transacción' : (periodica ? 'Crear Transacción Recurrente' : 'Añadir'),
  },
};

interface AddTransactionScreenProps {
  navigation: any;
  route?: any;
}

const AddTransactionScreen: React.FC<AddTransactionScreenProps> = ({ navigation, route }) => {
  const { userToken, logout } = useAuth();
  const { currency, isDarkMode, language } = useSettings();
  const t = STRINGS[language];
  const [tipo, setTipo] = useState<'spesa' | 'entrata'>('spesa');
  const [importo, setImporto] = useState('');
  const [categoria, setCategoria] = useState('');
  const [descrizione, setDescrizione] = useState('');
  const [categorieSpese, setCategorieSpese] = useState<string[]>([]);
  const [categorieEntrate, setCategorieEntrate] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [modalitaTransazione, setModalitaTransazione] = useState<'una_tantum' | 'periodica'>('una_tantum');
  const [data, setData] = useState(new Date().toISOString().split('T')[0]);

  // Edit Mode State
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    if (route?.params?.transactionToEdit) {
      const tx = route.params.transactionToEdit;
      setIsEditing(true);
      setEditingId(tx._id);
      setTipo(tx.tipo);
      setImporto(String(Math.abs(tx.importo)));
      setCategoria(tx.categoria);
      setDescrizione(tx.descrizione || '');
      setData(tx.data ? tx.data.split('T')[0] : new Date().toISOString().split('T')[0]);
      setModalitaTransazione('una_tantum');
      navigation.setOptions({ title: t.editTitle });
    } else if (route?.params?.type) {
      // Handle direct type navigation (e.g. widget shortcuts)
      setTipo(route.params.type);
      // Pre-fill additional params from widget/deep link
      if (route.params.importo) {
        setImporto(String(route.params.importo));
      }
      if (route.params.categoria) {
        setCategoria(route.params.categoria);
      }
      if (route.params.descrizione) {
        setDescrizione(route.params.descrizione);
      }
    }
  }, [route?.params?.transactionToEdit, route?.params?.type, route?.params?.importo, route?.params?.categoria, route?.params?.descrizione]);

  // Stati per transazioni periodiche
  const [tipoRipetizione, setTipoRipetizione] = useState('mensile');
  const [dataInizio, setDataInizio] = useState(new Date().toISOString().split('T')[0]);
  const [dataFine, setDataFine] = useState('');
  const [isInfinito, setIsInfinito] = useState(true);

  // Date picker state
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [activeDateField, setActiveDateField] = useState<'data' | 'dataInizio' | 'dataFine' | null>(null);

  const tipiRipetizione = [
    { value: 'mensile', label: t.frequenzaMensile },
    { value: 'settimanale', label: t.frequenzaSettimanale },
    { value: 'annuale', label: t.frequenzaAnnuale },
  ];

  const handleDateChange = (event: any, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setShowDatePicker(false);
    }
    if (selectedDate) {
      const yr = selectedDate.getFullYear();
      const mo = String(selectedDate.getMonth() + 1).padStart(2, '0');
      const da = String(selectedDate.getDate()).padStart(2, '0');
      const formattedDate = `${yr}-${mo}-${da}`;

      if (activeDateField === 'data') setData(formattedDate);
      else if (activeDateField === 'dataInizio') setDataInizio(formattedDate);
      else if (activeDateField === 'dataFine') setDataFine(formattedDate);
    }
  };

  const openDatePicker = (field: 'data' | 'dataInizio' | 'dataFine') => {
    setActiveDateField(field);
    setShowDatePicker(true);
  };

  useEffect(() => {
    if (userToken) {
      fetchCategorie();
    }
  }, [userToken]);

  const fetchCategorie = async () => {
    if (!userToken) return;

    try {
      await warmupBackend();
      const response = await fetchWithRetry(`${BASE_URL}/api/categorie`, {
        headers: { 'Authorization': `Bearer ${userToken}` }
      });

      if (response.ok) {
        const data = await response.json();
        if (data && data.categorie) {
          setCategorieSpese(data.categorie.spese || []);
          setCategorieEntrate(data.categorie.entrate || []);

          // Imposta categoria predefinita
          if (tipo === 'spesa' && data.categorie.spese?.length > 0) {
            setCategoria(data.categorie.spese[0]);
          } else if (tipo === 'entrata' && data.categorie.entrate?.length > 0) {
            setCategoria(data.categorie.entrate[0]);
          }
        }
      }
    } catch (error) {
      console.error('Errore nel caricamento delle categorie:', error);
    }
  };

  const aggiungiTransazione = async () => {
    if (!importo || !categoria) {
      Alert.alert(t.errore, t.campiObbligatori);
      return;
    }

    if (!userToken) {
      Alert.alert(t.errore, t.utenteNonAutenticato);
      return;
    }

    setIsLoading(true);
    try {
      if (modalitaTransazione === 'una_tantum') {
        // Transazione Spesa/Entrata standard
        const endpoint = tipo === 'spesa' ? 'spese' : 'entrate';
        const dataTransazione = data;

        const url = isEditing
          ? `${BASE_URL}/api/${endpoint}/${editingId}`
          : `${BASE_URL}/api/${endpoint}`;

        const method = isEditing ? 'PUT' : 'POST';

        const response = await fetch(url, {
          method: method,
          headers: {
            'Authorization': `Bearer ${userToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            descrizione,
            importo: tipo === 'spesa' ? -Math.abs(Number(importo)) : Math.abs(Number(importo)),
            categoria,
            data: dataTransazione
          }),
        });

        if (response.ok) {
          Alert.alert(
            t.successo,
            t.transazioneEsito(tipo, isEditing),
            isEditing
              ? [{ text: t.ok, onPress: () => navigation.goBack() }]
              : [
                  { text: t.ok, onPress: () => navigation.goBack() },
                  { text: t.aggiungiUnAltra, onPress: () => resetForm() },
                ]
          );
        } else {
          try {
            const errorData = await response.json();
            Alert.alert(t.errore, errorData.message || t.impossibileInserire);
          } catch (e) {
            Alert.alert(t.errore, t.impossibileInserire);
          }
        }

      } else {
        // Transazione Periodica
        const configurazioneDefault = {
          giorno: 1,
          gestione_giorno_mancante: 'ultimo_disponibile',
          ogni_n_mesi: 1,
          mese: 1,
          giorni_settimana: [],
          giorno_settimana: 1,
          ogni_n_giorni: 30
        };

        const abbonamento = {
          importo: tipo === 'spesa' ? -Math.abs(Number(importo)) : Math.abs(Number(importo)),
          categoria,
          descrizione: descrizione || t.ricorrenzaDescrizione(categoria),
          tipo_ripetizione: tipoRipetizione,
          configurazione: configurazioneDefault,
          data_inizio: dataInizio,
          data_fine: isInfinito ? null : dataFine,
          attiva: true
        };

        const response = await fetch(`${BASE_URL}/api/transazioni-periodiche`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${userToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(abbonamento),
        });

        if (response.ok) {
          // Triggera generazione movimenti mancanti (come da web app)
          fetch(`${BASE_URL}/api/transazioni-periodiche/genera`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${userToken}` }
          }).catch(err => console.error("Error generating transactions:", err));

          Alert.alert(
            t.successo,
            t.transazioneRicorrenteCreata,
            [
              { text: t.ok, onPress: () => navigation.goBack() },
              { text: t.aggiungiUnAltra, onPress: () => resetForm() },
            ]
          );
        } else {
          const errorData = await response.json();
          Alert.alert(t.errore, errorData.message || t.impossibileCreareRicorrente);
        }
      }
    } catch (error) {
      console.error('Errore nell\'inserimento:', error);
      Alert.alert(t.errore, t.erroreRete);
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setDescrizione('');
    setImporto('');
    setCategoria('');
    setDataFine('');
    setIsInfinito(true);
    const today = new Date().toISOString().split('T')[0];
    setData(today);
    setDataInizio(today);
  };

  const handleTipoChange = (nuovoTipo: 'spesa' | 'entrata') => {
    setTipo(nuovoTipo);
    setCategoria(''); // Reset categoria quando cambia il tipo
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={88}
    >
    <ScrollView
      style={[styles.container, isDarkMode && { backgroundColor: '#111827' }]}
      contentContainerStyle={{ paddingBottom: 40 }}
      keyboardShouldPersistTaps="handled"
    >
      {/* Selettore Modalità - Disable in Edit Mode */}
      {!isEditing && (
        <View style={[styles.modalitySelector, isDarkMode && { backgroundColor: '#374151' }]}>
          <TouchableOpacity
            style={[
              styles.modalityButton,
              modalitaTransazione === 'una_tantum' && styles.modalityButtonActive
            ]}
            onPress={() => setModalitaTransazione('una_tantum')}
          >
            <Text style={[
              styles.modalityButtonText,
              isDarkMode && { color: '#D1D5DB' },
              modalitaTransazione === 'una_tantum' && styles.modalityButtonTextActive
            ]}>
              {t.modalitaSingola}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.modalityButton,
              modalitaTransazione === 'periodica' && styles.modalityButtonActive
            ]}
            onPress={() => setModalitaTransazione('periodica')}
          >
            <Text style={[
              styles.modalityButtonText,
              isDarkMode && { color: '#D1D5DB' },
              modalitaTransazione === 'periodica' && styles.modalityButtonTextActive
            ]}>
              {t.modalitaRicorrente}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* View Existing Recurring Button */}
      {modalitaTransazione === 'periodica' && (
        <TouchableOpacity
          style={styles.viewRecurringBtn}
          onPress={() => navigation.navigate('PeriodicTransactions')}
        >
          <Text style={styles.viewRecurringBtnText}>{t.vediElencoRicorrenti}</Text>
        </TouchableOpacity>
      )}

      <View style={styles.form}>
        {/* Tipo Transazione */}
        <View style={styles.tipoSelector}>
          <TouchableOpacity
            style={[
              styles.tipoButton,
              styles.tipoButtonLeft,
              isDarkMode && { backgroundColor: '#374151' },
              tipo === 'spesa' && styles.tipoButtonSpesaActive
            ]}
            onPress={() => handleTipoChange('spesa')}
          >
            <Text style={[
              styles.tipoButtonText,
              isDarkMode && { color: '#D1D5DB' },
              tipo === 'spesa' && styles.tipoButtonTextActive
            ]}>
              {t.spesa}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.tipoButton,
              styles.tipoButtonRight,
              isDarkMode && { backgroundColor: '#374151' },
              tipo === 'entrata' && styles.tipoButtonEntrataActive
            ]}
            onPress={() => handleTipoChange('entrata')}
          >
            <Text style={[
              styles.tipoButtonText,
              isDarkMode && { color: '#D1D5DB' },
              tipo === 'entrata' && styles.tipoButtonTextActive
            ]}>
              {t.entrata}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Importo */}
        <View style={styles.inputContainer}>
          <TextInput
            style={[styles.input, isDarkMode && { backgroundColor: '#1F2937', borderColor: '#374151', color: '#F9FAFB' }]}
            placeholder={t.importoPlaceholder(currency)}
            value={importo}
            onChangeText={(text) => setImporto(text.replace(',', '.'))}
            keyboardType="decimal-pad"
            placeholderTextColor="#9CA3AF"
            inputAccessoryViewID="importoAccessory"
          />
        </View>

        <InputAccessoryView nativeID="importoAccessory">
          <View style={[styles.keyboardAccessory, isDarkMode && { backgroundColor: '#1F2937', borderTopColor: '#374151' }]}>
            <TouchableOpacity onPress={() => Keyboard.dismiss()} style={styles.keyboardDoneButton}>
              <Text style={styles.keyboardDoneText}>{t.fine}</Text>
            </TouchableOpacity>
          </View>
        </InputAccessoryView>

        {/* Category */}
        <View style={styles.inputContainer}>
          <Text style={[styles.label, isDarkMode && { color: '#E5E7EB' }]}>{t.categoria}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categorieContainer}>
            {(tipo === 'spesa' ? categorieSpese : categorieEntrate).map(cat => (
              <TouchableOpacity
                key={cat}
                style={[
                  styles.categoriaButton,
                  isDarkMode && { backgroundColor: '#374151', borderColor: '#4B5563' },
                  categoria === cat && styles.categoriaButtonActive
                ]}
                onPress={() => setCategoria(cat)}
              >
                <Text style={[
                  styles.categoriaButtonText,
                  isDarkMode && { color: '#D1D5DB' },
                  categoria === cat && styles.categoriaButtonTextActive
                ]}>
                  {cat}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Descrizione */}
        <View style={styles.inputContainer}>
          <TextInput
            style={[styles.input, isDarkMode && { backgroundColor: '#1F2937', borderColor: '#374151', color: '#F9FAFB' }]}
            placeholder={t.descrizionePlaceholder}
            value={descrizione}
            onChangeText={setDescrizione}
            placeholderTextColor="#9CA3AF"
          />
        </View>

        {/* Data - Solo per una_tantum */}
        {modalitaTransazione === 'una_tantum' && (
          <View style={styles.inputContainer}>
            <Text style={[styles.label, isDarkMode && { color: '#E5E7EB' }]}>{t.data}</Text>
            <TouchableOpacity onPress={() => openDatePicker('data')}>
              <TextInput
                style={[styles.input, isDarkMode && { backgroundColor: '#1F2937', borderColor: '#374151', color: '#F9FAFB' }]}
                placeholder="YYYY-MM-DD"
                value={data}
                editable={false}
                pointerEvents="none"
                placeholderTextColor="#9CA3AF"
              />
            </TouchableOpacity>
          </View>
        )}

        {/* CAMPI AGGIUNTIVI PER TRANS. PERIODICA */}
        {modalitaTransazione === 'periodica' ? (
          <View style={[styles.periodicaContainer, isDarkMode && { backgroundColor: '#1F2937', borderColor: '#374151' }]}>
            <Text style={[styles.sectionTitle, isDarkMode && { color: '#F9FAFB' }]}>{t.opzioniRicorrenza}</Text>

            {/* Tipo Ripetizione */}
            <Text style={[styles.label, isDarkMode && { color: '#E5E7EB' }]}>{t.frequenza}</Text>
            <View style={styles.chipContainer}>
              {tipiRipetizione.map((rep) => (
                <TouchableOpacity
                  key={rep.value}
                  style={[
                    styles.chip,
                    isDarkMode && { backgroundColor: '#374151', borderColor: '#4B5563' },
                    tipoRipetizione === rep.value && styles.chipActive
                  ]}
                  onPress={() => setTipoRipetizione(rep.value)}
                >
                  <Text style={[
                    styles.chipText,
                    isDarkMode && { color: '#D1D5DB' },
                    tipoRipetizione === rep.value && styles.chipTextActive
                  ]}>{rep.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Data Inizio */}
            <Text style={[styles.label, isDarkMode && { color: '#E5E7EB' }]}>{t.dataInizio}</Text>
            <TouchableOpacity onPress={() => openDatePicker('dataInizio')}>
              <TextInput
                style={[styles.input, isDarkMode && { backgroundColor: '#1F2937', borderColor: '#374151', color: '#F9FAFB' }]}
                placeholder="YYYY-MM-DD"
                value={dataInizio}
                editable={false}
                pointerEvents="none"
                placeholderTextColor="#9CA3AF"
              />
            </TouchableOpacity>

            {/* Infinito Switch */}
            <View style={styles.switchContainer}>
              <Text style={[styles.label, isDarkMode && { color: '#E5E7EB' }]}>{t.ricorrenzaInfinita}</Text>
              <Switch
                value={isInfinito}
                onValueChange={setIsInfinito}
                trackColor={{ false: "#767577", true: "#163B2C" }}
                thumbColor={isInfinito ? "#FFFFFF" : "#f4f3f4"}
              />
            </View>

            {/* Data Fine (se non infinito) */}
            {!isInfinito && (
              <View>
                <Text style={[styles.label, isDarkMode && { color: '#E5E7EB' }]}>{t.dataFine}</Text>
                <TouchableOpacity onPress={() => openDatePicker('dataFine')}>
                  <TextInput
                    style={[styles.input, isDarkMode && { backgroundColor: '#1F2937', borderColor: '#374151', color: '#F9FAFB' }]}
                    placeholder="YYYY-MM-DD"
                    value={dataFine}
                    editable={false}
                    pointerEvents="none"
                    placeholderTextColor="#9CA3AF"
                  />
                </TouchableOpacity>
              </View>
            )}
          </View>
        ) : null}

        {/* Bottone Aggiungi */}
        <TouchableOpacity
          style={[styles.addButton, isLoading && styles.addButtonDisabled]}
          onPress={aggiungiTransazione}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.addButtonText}>
              {t.submitButton(isEditing, modalitaTransazione === 'periodica')}
            </Text>
          )}
        </TouchableOpacity>
      </View>

      {/* RENDER DATEPICKER */}
      {showDatePicker && Platform.OS === 'android' && (
        <DateTimePicker
          value={
            activeDateField === 'data' && data ? new Date(data) :
              activeDateField === 'dataInizio' && dataInizio ? new Date(dataInizio) :
                activeDateField === 'dataFine' && dataFine ? new Date(dataFine) :
                  new Date()
          }
          mode="date"
          display="default"
          onChange={handleDateChange}
        />
      )}

      {showDatePicker && Platform.OS === 'ios' && (
        <Modal transparent={true} animationType="slide">
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, isDarkMode && { backgroundColor: '#1F2937' }]}>
              <View style={styles.modalHeader}>
                <TouchableOpacity onPress={() => setShowDatePicker(false)}>
                  <Text style={[styles.modalDoneText, isDarkMode && { color: '#4ADE80' }]}>{t.fine}</Text>
                </TouchableOpacity>
              </View>
              <DateTimePicker
                value={
                  activeDateField === 'data' && data ? new Date(data) :
                    activeDateField === 'dataInizio' && dataInizio ? new Date(dataInizio) :
                      activeDateField === 'dataFine' && dataFine ? new Date(dataFine) :
                        new Date()
                }
                mode="date"
                display="spinner"
                onChange={handleDateChange}
                textColor={isDarkMode ? "white" : "black"}
              />
            </View>
          </View>
        </Modal>
      )}

    </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  keyboardAccessory: {
    backgroundColor: '#F3F4F6',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  keyboardDoneButton: {
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  keyboardDoneText: {
    color: '#163B2C',
    fontWeight: '600',
    fontSize: 16,
  },
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    padding: 20,
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#163B2C',
    textAlign: 'center',
  },
  modalitySelector: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginBottom: 20,
    backgroundColor: '#E5E7EB',
    borderRadius: 12,
    padding: 4,
  },
  modalityButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalityButtonActive: {
    backgroundColor: '#163B2C',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  modalityButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
  },
  modalityButtonTextActive: {
    color: '#FFFFFF',
  },
  form: {
    paddingHorizontal: 20,
  },
  tipoSelector: {
    flexDirection: 'row',
    marginBottom: 20,
  },
  tipoButton: {
    flex: 1,
    paddingVertical: 16,
    alignItems: 'center',
    backgroundColor: '#E5E7EB',
  },
  tipoButtonLeft: {
    borderTopLeftRadius: 12,
    borderBottomLeftRadius: 12,
  },
  tipoButtonRight: {
    borderTopRightRadius: 12,
    borderBottomRightRadius: 12,
  },
  tipoButtonSpesaActive: {
    backgroundColor: '#DC2626',
  },
  tipoButtonEntrataActive: {
    backgroundColor: '#059669',
  },
  tipoButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
  },
  tipoButtonTextActive: {
    color: '#FFFFFF',
  },
  inputContainer: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#D1D5DB',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
    fontSize: 16,
    color: '#111827',
  },
  categorieContainer: {
    maxHeight: 50,
  },
  categoriaButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 8,
    backgroundColor: '#F3F4F6',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#D1D5DB',
  },
  categoriaButtonActive: {
    backgroundColor: '#163B2C',
    borderColor: '#163B2C',
  },
  categoriaButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
  },
  categoriaButtonTextActive: {
    color: '#FFFFFF',
  },
  buttonsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 10,
    marginBottom: 30,
  },
  addButton: {
    backgroundColor: '#2563EB',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 30,
  },
  addButtonDisabled: {
    backgroundColor: '#9CA3AF',
  },
  addButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  addAnotherButton: {
    backgroundColor: 'transparent',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#2563EB',
  },
  addAnotherButtonText: {
    color: '#2563EB',
    fontSize: 16,
    fontWeight: '600',
  },
  periodicaContainer: {
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    padding: 15,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 15,
  },
  chipContainer: {
    flexDirection: 'row',
    marginBottom: 15,
  },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    marginRight: 10,
    borderWidth: 1,
    borderColor: '#D1D5DB',
  },
  chipActive: {
    backgroundColor: '#163B2C',
    borderColor: '#163B2C',
  },
  chipText: {
    color: '#374151',
    fontWeight: '500',
  },
  chipTextActive: {
    color: '#FFFFFF',
  },
  switchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 15,
    marginTop: 5,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    paddingBottom: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  modalDoneText: {
    color: '#163B2C',
    fontSize: 18,
    fontWeight: '600',
  },
  viewRecurringBtn: {
    marginHorizontal: 20,
    marginBottom: 15,
    padding: 12,
    backgroundColor: '#EEF2FF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#C7D2FE',
    alignItems: 'center',
  },
  viewRecurringBtnText: {
    color: '#163B2C',
    fontWeight: '700',
    fontSize: 15,
  },
});

export default AddTransactionScreen;