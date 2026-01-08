import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { API_URL } from '../config';

const BASE_URL = API_URL;

interface Transaction {
  _id: string;
  importo: number;
  categoria: string;
  descrizione?: string;
  data: string;
  tipo: 'entrata' | 'uscita';
}

interface TransactionsScreenProps {
  navigation: any;
}

const TransactionsScreen: React.FC<TransactionsScreenProps> = ({ navigation }) => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadTransactions();
  }, []);

  const loadTransactions = async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      if (!token) {
        navigation.navigate('Login');
        return;
      }

      const [speseResponse, entrateResponse] = await Promise.all([
        fetch(`${BASE_URL}/api/spese?page=1&limit=100`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch(`${BASE_URL}/api/entrate?page=1&limit=100`, {
          headers: { 'Authorization': `Bearer ${token}` }
        })
      ]);

      const speseData = await speseResponse.json();
      const entrateData = await entrateResponse.json();

      const spese = (speseData.spese || []).map((spesa: any) => ({ ...spesa, tipo: 'uscita' }));
      const entrate = (entrateData.entrate || []).map((entrata: any) => ({ ...entrata, tipo: 'entrata' }));

      const allTransactions = [...spese, ...entrate].sort((a, b) =>
        new Date(b.data).getTime() - new Date(a.data).getTime()
      );

      setTransactions(allTransactions);
    } catch (error) {
      console.error('Errore nel caricamento delle transazioni:', error);
      Alert.alert('Errore', 'Impossibile caricare le transazioni');
    } finally {
      setIsLoading(false);
    }
  };

  const deleteTransaction = async (id: string, tipo: string) => {
    Alert.alert(
      'Conferma eliminazione',
      'Sei sicuro di voler eliminare questa transazione?',
      [
        { text: 'Annulla', style: 'cancel' },
        {
          text: 'Elimina',
          style: 'destructive',
          onPress: async () => {
            try {
              const token = await AsyncStorage.getItem('token');
              const endpoint = tipo === 'entrata' ? 'entrate' : 'spese';

              const response = await fetch(`${BASE_URL}/api/${endpoint}/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
              });

              if (response.ok) {
                loadTransactions(); // Ricarica la lista
                Alert.alert('Successo', 'Transazione eliminata');
              } else {
                Alert.alert('Errore', 'Impossibile eliminare la transazione');
              }
            } catch (error) {
              console.error('Errore nell\'eliminazione:', error);
              Alert.alert('Errore', 'Errore di rete');
            }
          }
        }
      ]
    );
  };

  const renderTransaction = ({ item }: { item: Transaction }) => {
    const isEntrata = item.tipo === 'entrata';
    const importo = Math.abs(Number(item.importo));
    const segno = isEntrata ? '+' : '-';
    const date = new Date(item.data).toLocaleDateString('it-IT');

    return (
      <View style={styles.transactionCard}>
        <View style={styles.transactionContent}>
          <View style={styles.transactionHeader}>
            <Text style={styles.categoria}>{item.categoria}</Text>
            <View style={[
              styles.tipoBadge,
              isEntrata ? styles.tipoBadgeEntrata : styles.tipoBadgeUscita
            ]}>
              <Text style={[
                styles.tipoBadgeText,
                isEntrata ? styles.tipoBadgeTextEntrata : styles.tipoBadgeTextUscita
              ]}>
                {isEntrata ? 'Entrata' : 'Uscita'}
              </Text>
            </View>
          </View>

          <Text style={[
            styles.importo,
            isEntrata ? styles.importoEntrata : styles.importoUscita
          ]}>
            {segno}{importo.toFixed(2)} €
          </Text>

          {item.descrizione && (
            <Text style={styles.descrizione}>{item.descrizione}</Text>
          )}

          <Text style={styles.data}>{date}</Text>
        </View>

        <TouchableOpacity
          style={styles.deleteButton}
          onPress={() => deleteTransaction(item._id, item.tipo)}
        >
          <Text style={styles.deleteButtonText}>🗑️</Text>
        </TouchableOpacity>
      </View>
    );
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4F46E5" />
        <Text style={styles.loadingText}>Caricamento transazioni...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Le tue Transazioni</Text>
        <TouchableOpacity style={styles.refreshButton} onPress={loadTransactions}>
          <Text style={styles.refreshButtonText}>🔄</Text>
        </TouchableOpacity>
      </View>

      {transactions.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyTitle}>Nessuna transazione</Text>
          <Text style={styles.emptySubtitle}>
            Inizia aggiungendo la tua prima transazione
          </Text>
        </View>
      ) : (
        <FlatList
          data={transactions}
          keyExtractor={(item) => item._id}
          renderItem={renderTransaction}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
  },
  refreshButton: {
    padding: 8,
  },
  refreshButtonText: {
    fontSize: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#6B7280',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#374151',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
  },
  listContent: {
    padding: 16,
  },
  transactionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  transactionContent: {
    flex: 1,
  },
  transactionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  categoria: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    flex: 1,
  },
  tipoBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  tipoBadgeEntrata: {
    backgroundColor: '#D1FAE5',
  },
  tipoBadgeUscita: {
    backgroundColor: '#FEE2E2',
  },
  tipoBadgeText: {
    fontSize: 12,
    fontWeight: '500',
  },
  tipoBadgeTextEntrata: {
    color: '#065F46',
  },
  tipoBadgeTextUscita: {
    color: '#991B1B',
  },
  importo: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  importoEntrata: {
    color: '#059669',
  },
  importoUscita: {
    color: '#DC2626',
  },
  descrizione: {
    fontSize: 14,
    color: '#6B7280',
    fontStyle: 'italic',
    marginBottom: 4,
  },
  data: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  deleteButton: {
    marginLeft: 12,
    padding: 8,
  },
  deleteButtonText: {
    fontSize: 18,
  },
});

export default TransactionsScreen;