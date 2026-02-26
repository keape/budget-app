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

const BASE_URL = API_URL;

interface AddTransactionScreenProps {
  navigation: any;
  route?: any;
}

const AddTransactionScreen: React.FC<AddTransactionScreenProps> = ({ navigation, route }) => {
  const { userToken, logout } = useAuth();
  const { currency, isDarkMode } = useSettings();
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
      navigation.setOptions({ title: 'Edit Transaction' });
    } else if (route?.params?.type) {
      // Handle direct type navigation (e.g. Add Income button)
      setTipo(route.params.type);
    }
  }, [route?.params?.transactionToEdit, route?.params?.type]);

  // Stati per transazioni periodiche
  const [tipoRipetizione, setTipoRipetizione] = useState('mensile');
  const [dataInizio, setDataInizio] = useState(new Date().toISOString().split('T')[0]);
  const [dataFine, setDataFine] = useState('');
  const [isInfinito, setIsInfinito] = useState(true);

  // Date picker state
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [activeDateField, setActiveDateField] = useState<'data' | 'dataInizio' | 'dataFine' | null>(null);

  const tipiRipetizione = [
    { value: 'mensile', label: 'Monthly' },
    { value: 'settimanale', label: 'Weekly' },
    { value: 'annuale', label: 'Yearly' },
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
      const response = await fetch(`${BASE_URL}/api/categorie`, {
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
      Alert.alert('Error', 'Please fill in all mandatory fields');
      return;
    }

    if (!userToken) {
      Alert.alert('Error', 'User not authenticated');
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
            'Success',
            `${tipo === 'spesa' ? 'Expense' : 'Income'} ${isEditing ? 'updated' : 'added'} successfully!`,
            isEditing
              ? [{ text: 'OK', onPress: () => navigation.goBack() }]
              : [
                  { text: 'OK', onPress: () => navigation.goBack() },
                  { text: 'Add another', onPress: () => resetForm() },
                ]
          );
        } else {
          try {
            const errorData = await response.json();
            Alert.alert('Error', errorData.message || 'Unable to insertion transaction');
          } catch (e) {
            Alert.alert('Error', 'Unable to insert transaction');
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
          descrizione: descrizione || `Recurrence ${categoria}`,
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
            'Success',
            'Recurring transaction created successfully!',
            [
              { text: 'OK', onPress: () => navigation.goBack() },
              { text: 'Add another', onPress: () => resetForm() },
            ]
          );
        } else {
          const errorData = await response.json();
          Alert.alert('Error', errorData.message || 'Unable to create recurring transaction');
        }
      }
    } catch (error) {
      console.error('Errore nell\'inserimento:', error);
      Alert.alert('Error', 'Network error. Please try again later.');
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
              📅 One-time
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
              🔄 Recurring
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
          <Text style={styles.viewRecurringBtnText}>📑 View recurring list</Text>
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
              Expense
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
              Income
            </Text>
          </TouchableOpacity>
        </View>

        {/* Importo */}
        <View style={styles.inputContainer}>
          <TextInput
            style={[styles.input, isDarkMode && { backgroundColor: '#1F2937', borderColor: '#374151', color: '#F9FAFB' }]}
            placeholder={`Amount (${currency} e.g. 12.50)`}
            value={importo}
            onChangeText={setImporto}
            keyboardType="numeric"
            placeholderTextColor="#9CA3AF"
            inputAccessoryViewID="importoAccessory"
          />
        </View>

        <InputAccessoryView nativeID="importoAccessory">
          <View style={[styles.keyboardAccessory, isDarkMode && { backgroundColor: '#1F2937', borderTopColor: '#374151' }]}>
            <TouchableOpacity onPress={() => Keyboard.dismiss()} style={styles.keyboardDoneButton}>
              <Text style={styles.keyboardDoneText}>Done</Text>
            </TouchableOpacity>
          </View>
        </InputAccessoryView>

        {/* Category */}
        <View style={styles.inputContainer}>
          <Text style={[styles.label, isDarkMode && { color: '#E5E7EB' }]}>Category</Text>
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
            placeholder="Description (optional)"
            value={descrizione}
            onChangeText={setDescrizione}
            placeholderTextColor="#9CA3AF"
          />
        </View>

        {/* Data - Solo per una_tantum */}
        {modalitaTransazione === 'una_tantum' && (
          <View style={styles.inputContainer}>
            <Text style={[styles.label, isDarkMode && { color: '#E5E7EB' }]}>Date</Text>
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
            <Text style={[styles.sectionTitle, isDarkMode && { color: '#F9FAFB' }]}>Recurring Options</Text>

            {/* Tipo Ripetizione */}
            <Text style={[styles.label, isDarkMode && { color: '#E5E7EB' }]}>Frequency</Text>
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
            <Text style={[styles.label, isDarkMode && { color: '#E5E7EB' }]}>Start Date</Text>
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
              <Text style={[styles.label, isDarkMode && { color: '#E5E7EB' }]}>Infinite Recurrence</Text>
              <Switch
                value={isInfinito}
                onValueChange={setIsInfinito}
                trackColor={{ false: "#767577", true: "#4F46E5" }}
                thumbColor={isInfinito ? "#FFFFFF" : "#f4f3f4"}
              />
            </View>

            {/* Data Fine (se non infinito) */}
            {!isInfinito && (
              <View>
                <Text style={[styles.label, isDarkMode && { color: '#E5E7EB' }]}>End Date</Text>
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
              {isEditing ? 'Update Transaction' : (modalitaTransazione === 'periodica' ? 'Create Recurring Transaction' : 'Add')}
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
                  <Text style={[styles.modalDoneText, isDarkMode && { color: '#818CF8' }]}>Done</Text>
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
    color: '#4F46E5',
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
    color: '#4F46E5',
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
    backgroundColor: '#4F46E5',
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
    backgroundColor: '#4F46E5',
    borderColor: '#4F46E5',
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
    backgroundColor: '#4F46E5',
    borderColor: '#4F46E5',
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
    color: '#4F46E5',
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
    color: '#4F46E5',
    fontWeight: '700',
    fontSize: 15,
  },
});

export default AddTransactionScreen;