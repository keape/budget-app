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
  Switch,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { API_URL } from '../config';

const BASE_URL = API_URL;

interface HomeScreenProps {
  navigation: any;
}

const HomeScreen: React.FC<HomeScreenProps> = ({ navigation }) => {
  const [tipo, setTipo] = useState<'spesa' | 'entrata'>('spesa');
  const [importo, setImporto] = useState('');
  const [categoria, setCategoria] = useState('');
  const [descrizione, setDescrizione] = useState('');
  const [categorieSpese, setCategorieSpese] = useState<string[]>([]);
  const [categorieEntrate, setCategorieEntrate] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [modalitaTransazione, setModalitaTransazione] = useState<'una_tantum' | 'periodica'>('una_tantum');

  // Stati per transazioni periodiche
  const [tipoRipetizione, setTipoRipetizione] = useState('mensile');
  const [dataInizio, setDataInizio] = useState(new Date().toISOString().split('T')[0]);
  const [dataFine, setDataFine] = useState('');
  const [isInfinito, setIsInfinito] = useState(true);

  const tipiRipetizione = [
    { value: 'mensile', label: 'Mensile' },
    { value: 'settimanale', label: 'Settimanale' },
    { value: 'annuale', label: 'Annuale' },
  ];

  useEffect(() => {
    checkAuthAndLoadCategories();
  }, []);

  const checkAuthAndLoadCategories = async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      if (!token) {
        navigation.navigate('Login');
        return;
      }
      await fetchCategorie();
    } catch (error) {
      console.error('Error checking auth:', error);
      navigation.navigate('Login');
    }
  };

  const fetchCategorie = async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      const response = await fetch(`${BASE_URL}/api/categorie`, {
        headers: { 'Authorization': `Bearer ${token}` }
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
      Alert.alert('Errore', 'Inserisci tutti i campi obbligatori');
      return;
    }

    setIsLoading(true);
    try {
      const token = await AsyncStorage.getItem('token');

      if (modalitaTransazione === 'una_tantum') {
        // Transazione Spesa/Entrata standard
        const endpoint = tipo === 'spesa' ? 'spese' : 'entrate';
        const dataTransazione = new Date().toISOString().split('T')[0];

        const response = await fetch(`${BASE_URL}/api/${endpoint}`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
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
          Alert.alert('Successo', `${tipo === 'spesa' ? 'Spesa' : 'Entrata'} inserita con successo!`);
          resetForm();
        } else {
          try {
            const errorData = await response.json();
            Alert.alert('Errore', errorData.message || 'Impossibile inserire la transazione');
          } catch (e) {
            Alert.alert('Errore', 'Impossibile inserire la transazione');
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
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(abbonamento),
        });

        if (response.ok) {
          Alert.alert('Successo', 'Ricorrenza creata con successo!');

          // Triggera generazione movimenti mancanti (come da web app)
          fetch(`${BASE_URL}/api/transazioni-periodiche/genera`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
          }).catch(err => console.error("Error generating transactions:", err));

          resetForm();
        } else {
          const errorData = await response.json();
          Alert.alert('Errore', errorData.message || 'Impossibile creare la ricorrenza');
        }
      }
    } catch (error) {
      console.error('Errore nell\'inserimento:', error);
      Alert.alert('Errore', 'Errore di rete. Riprova più tardi.');
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
    setDataInizio(new Date().toISOString().split('T')[0]);
  };

  const handleTipoChange = (nuovoTipo: 'spesa' | 'entrata') => {
    setTipo(nuovoTipo);
    setCategoria(''); // Reset categoria quando cambia il tipo
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Gestione Transazioni</Text>
      </View>

      {/* Selettore Modalità */}
      <View style={styles.modalitySelector}>
        <TouchableOpacity
          style={[
            styles.modalityButton,
            modalitaTransazione === 'una_tantum' && styles.modalityButtonActive
          ]}
          onPress={() => setModalitaTransazione('una_tantum')}
        >
          <Text style={[
            styles.modalityButtonText,
            modalitaTransazione === 'una_tantum' && styles.modalityButtonTextActive
          ]}>
            📅 Una tantum
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
            modalitaTransazione === 'periodica' && styles.modalityButtonTextActive
          ]}>
            🔄 Periodica
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.form}>
        {/* Tipo Transazione */}
        <View style={styles.tipoSelector}>
          <TouchableOpacity
            style={[
              styles.tipoButton,
              styles.tipoButtonLeft,
              tipo === 'spesa' && styles.tipoButtonSpesaActive
            ]}
            onPress={() => handleTipoChange('spesa')}
          >
            <Text style={[
              styles.tipoButtonText,
              tipo === 'spesa' && styles.tipoButtonTextActive
            ]}>
              Spesa
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.tipoButton,
              styles.tipoButtonRight,
              tipo === 'entrata' && styles.tipoButtonEntrataActive
            ]}
            onPress={() => handleTipoChange('entrata')}
          >
            <Text style={[
              styles.tipoButtonText,
              tipo === 'entrata' && styles.tipoButtonTextActive
            ]}>
              Entrata
            </Text>
          </TouchableOpacity>
        </View>

        {/* Importo */}
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            placeholder="Importo (es. 12.50)"
            value={importo}
            onChangeText={setImporto}
            keyboardType="numeric"
            placeholderTextColor="#9CA3AF"
          />
        </View>

        {/* Categoria */}
        <View style={styles.inputContainer}>
          <Text style={styles.label}>Categoria</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categorieContainer}>
            {(tipo === 'spesa' ? categorieSpese : categorieEntrate).map(cat => (
              <TouchableOpacity
                key={cat}
                style={[
                  styles.categoriaButton,
                  categoria === cat && styles.categoriaButtonActive
                ]}
                onPress={() => setCategoria(cat)}
              >
                <Text style={[
                  styles.categoriaButtonText,
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
            style={styles.input}
            placeholder="Descrizione (facoltativa)"
            value={descrizione}
            onChangeText={setDescrizione}
            placeholderTextColor="#9CA3AF"
          />
        </View>

        {/* CAMPI AGGIUNTIVI PER TRANS. PERIODICA */}
        {modalitaTransazione === 'periodica' ? (
          <View style={styles.periodicaContainer}>
            <Text style={styles.sectionTitle}>Opzioni Ricorrenza</Text>

            {/* Tipo Ripetizione */}
            <Text style={styles.label}>Frequenza</Text>
            <View style={styles.chipContainer}>
              {tipiRipetizione.map((rep) => (
                <TouchableOpacity
                  key={rep.value}
                  style={[
                    styles.chip,
                    tipoRipetizione === rep.value && styles.chipActive
                  ]}
                  onPress={() => setTipoRipetizione(rep.value)}
                >
                  <Text style={[
                    styles.chipText,
                    tipoRipetizione === rep.value && styles.chipTextActive
                  ]}>{rep.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Data Inizio */}
            <Text style={styles.label}>Data Inizio (YYYY-MM-DD)</Text>
            <TextInput
              style={styles.input}
              placeholder="YYYY-MM-DD"
              value={dataInizio}
              onChangeText={setDataInizio}
              placeholderTextColor="#9CA3AF"
            />

            {/* Infinito Switch */}
            <View style={styles.switchContainer}>
              <Text style={styles.label}>Ricorrenza infinita</Text>
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
                <Text style={styles.label}>Data Fine (YYYY-MM-DD)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="YYYY-MM-DD"
                  value={dataFine}
                  onChangeText={setDataFine}
                  placeholderTextColor="#9CA3AF"
                />
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
              {modalitaTransazione === 'periodica' ? 'Crea ricorrenza periodica' : 'Aggiungi'}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
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
});

export default HomeScreen;