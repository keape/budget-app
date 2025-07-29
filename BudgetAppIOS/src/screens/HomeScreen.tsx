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
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const BASE_URL = 'https://budget-app-cd5o.onrender.com';

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
        // Reset form
        setDescrizione('');
        setImporto('');
        setCategoria('');
      } else {
        Alert.alert('Errore', 'Impossibile inserire la transazione');
      }
    } catch (error) {
      console.error('Errore nell\'inserimento:', error);
      Alert.alert('Errore', 'Errore di rete. Riprova più tardi.');
    } finally {
      setIsLoading(false);
    }
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
            placeholder="Importo"
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
});

export default HomeScreen;