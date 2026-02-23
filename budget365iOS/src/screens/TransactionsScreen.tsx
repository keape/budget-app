import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  TextInput,
  Modal,
  ScrollView
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
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

const TransactionsScreen: React.FC = () => {
  const { userToken } = useAuth();
  const { currency, isDarkMode } = useSettings();
  const navigation = useNavigation<any>();

  // Data State
  const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);
  const [filteredTransactions, setFilteredTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'tutte' | 'entrata' | 'uscita'>('tutte');
  const [filterCategory, setFilterCategory] = useState<string>('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  // Categories State
  const [categorieSpese, setCategorieSpese] = useState<string[]>([]);
  const [categorieEntrate, setCategorieEntrate] = useState<string[]>([]);

  useFocusEffect(
    useCallback(() => {
      if (userToken) {
        loadData();
      }
    }, [userToken])
  );

  useEffect(() => {
    applyFilters();
  }, [allTransactions, searchQuery, filterType, filterCategory, startDate, endDate]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      // Fetch Categories
      const catRes = await fetch(`${BASE_URL}/api/categorie`, {
        headers: { 'Authorization': `Bearer ${userToken}` }
      });
      if (catRes.ok) {
        const data = await catRes.json();
        setCategorieSpese(data.categorie.spese || []);
        setCategorieEntrate(data.categorie.entrate || []);
      }

      // Fetch All Transactions
      // Using limit=2000 to get a good history without overkilling the mobile device
      const [speseRes, entrateRes] = await Promise.all([
        fetch(`${BASE_URL}/api/spese?limit=2000`, { headers: { 'Authorization': `Bearer ${userToken}` } }),
        fetch(`${BASE_URL}/api/entrate?limit=2000`, { headers: { 'Authorization': `Bearer ${userToken}` } })
      ]);

      const speseData = await speseRes.json();
      const entrateData = await entrateRes.json();

      const spese = (speseData.spese || []).map((s: any) => ({ ...s, tipo: 'uscita' }));
      const entrate = (entrateData.entrate || []).map((e: any) => ({ ...e, tipo: 'entrata' }));

      const all = [...spese, ...entrate].sort((a, b) =>
        new Date(b.data).getTime() - new Date(a.data).getTime()
      );

      setAllTransactions(all);
    } catch (error) {
      console.error("Error loading data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const applyFilters = () => {
    let result = [...allTransactions];

    // 1. Filter by Type
    if (filterType !== 'tutte') {
      result = result.filter(t => t.tipo === filterType);
    }

    // 2. Filter by Search Query (Description)
    if (searchQuery) {
      const lowerQuery = searchQuery.toLowerCase();
      result = result.filter(t =>
        (t.descrizione?.toLowerCase() || '').includes(lowerQuery)
      );
    }

    // 3. Filter by Category
    if (filterCategory) {
      result = result.filter(t => t.categoria === filterCategory);
    }

    // 4. Filter by Date
    if (startDate) {
      // Basic string comparison works for YYYY-MM-DD
      result = result.filter(t => t.data.split('T')[0] >= startDate);
    }
    if (endDate) {
      result = result.filter(t => t.data.split('T')[0] <= endDate);
    }

    setFilteredTransactions(result);
  };

  const resetFilters = () => {
    setSearchQuery('');
    setFilterType('tutte');
    setFilterCategory('');
    setStartDate('');
    setEndDate('');
  };

  const calculateTotal = () => {
    return filteredTransactions.reduce((acc, t) => {
      const val = t.tipo === 'entrata' ? Math.abs(t.importo) : -Math.abs(t.importo);
      return acc + val;
    }, 0);
  };

  const deleteTransaction = async (id: string, tipo: string) => {
    Alert.alert(
      'Confirm deletion',
      'Are you sure you want to delete this transaction?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              if (!userToken) return;
              const endpoint = tipo === 'entrata' ? 'entrate' : 'spese';

              const response = await fetch(`${BASE_URL}/api/${endpoint}/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${userToken}` }
              });

              if (response.ok) {
                // Remove from local state immediately for responsiveness
                setAllTransactions(prev => prev.filter(t => t._id !== id));
                Alert.alert('Success', 'Transaction deleted');
              } else {
                Alert.alert('Error', 'Unable to delete transaction');
              }
            } catch (error) {
              console.error('Error deleting:', error);
            }
          }
        }
      ]
    );
  };

  const renderTransaction = ({ item }: { item: Transaction }) => {
    const isEntrata = item.tipo === 'entrata';
    return (
      <View style={[styles.card, isDarkMode && { backgroundColor: '#1F2937' }]}>
        <View style={{ flex: 1 }}>
          <View style={styles.cardHeader}>
            <Text style={[styles.catText, isDarkMode && { color: '#E5E7EB' }]}>{item.categoria}</Text>
            <View style={[styles.badge, isEntrata ? styles.badgeEntrata : styles.badgeUscita]}>
              <Text style={[styles.badgeText, isEntrata ? styles.badgeTextEntrata : styles.badgeTextUscita]}>
                {isEntrata ? 'Income' : 'Expense'}
              </Text>
            </View>
          </View>

          <Text style={[styles.amountText, isEntrata ? styles.amountEntrata : styles.amountUscita]}>
            {isEntrata ? '+' : '-'}{currency}{Math.abs(item.importo).toFixed(2)}
          </Text>

          {item.descrizione ? (
            <Text style={[styles.descText, isDarkMode && { color: '#9CA3AF' }]}>{item.descrizione}</Text>
          ) : null}

          <Text style={[styles.dateText, isDarkMode && { color: '#6B7280' }]}>{new Date(item.data).toLocaleDateString('it-IT')}</Text>
        </View>

        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => navigation.navigate('AddTransaction', { transactionToEdit: item })}
          >
            <Text>✏️</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => deleteTransaction(item._id, item.tipo)}
          >
            <Text>🗑️</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const currentCategories = filterType === 'entrata' ? categorieEntrate :
    filterType === 'uscita' ? categorieSpese :
      [...new Set([...categorieSpese, ...categorieEntrate])].sort();

  return (
    <View style={[styles.container, isDarkMode && { backgroundColor: '#111827' }]}>
      {/* Header & Search */}
      <View style={[styles.searchContainer, isDarkMode && { backgroundColor: '#111827', borderBottomColor: '#374151' }]}>
        <TextInput
          style={[styles.searchInput, isDarkMode && { backgroundColor: '#1F2937', color: '#F9FAFB' }]}
          placeholder="🔍 Search in descriptions..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholderTextColor="#9CA3AF"
        />
        <TouchableOpacity style={styles.filterToggleBtn} onPress={() => setShowFilters(!showFilters)}>
          <Text style={[styles.filterToggleText, isDarkMode && { color: '#818CF8' }]}>{showFilters ? 'Hide Filters' : 'Show Filters'}</Text>
        </TouchableOpacity>
      </View>

      {/* Filters Section */}
      {showFilters && (
        <View style={[styles.filtersSection, isDarkMode && { backgroundColor: '#111827', borderBottomColor: '#374151' }]}>
          <Text style={[styles.filterLabel, isDarkMode && { color: '#E5E7EB' }]}>Transaction Type:</Text>
          <View style={styles.typeRow}>
            {(['tutte', 'entrata', 'uscita'] as const).map(t => (
              <TouchableOpacity
                key={t}
                style={[
                  styles.typeBtn,
                  isDarkMode && { backgroundColor: '#1F2937', borderColor: '#374151' },
                  filterType === t && styles.typeBtnActive
                ]}
                onPress={() => {
                  setFilterType(t);
                  setFilterCategory(''); // Reset cat on type change
                }}
              >
                <Text style={[styles.typeBtnText, isDarkMode && { color: '#D1D5DB' }, filterType === t && styles.typeBtnTextActive]}>
                  {t === 'tutte' ? 'All' : t === 'entrata' ? 'Income' : 'Expense'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={[styles.filterLabel, isDarkMode && { color: '#E5E7EB' }]}>Category:</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
            <TouchableOpacity
              style={[styles.catBtn, isDarkMode && { backgroundColor: '#374151' }, filterCategory === '' && styles.catBtnActive]}
              onPress={() => setFilterCategory('')}
            >
              <Text style={[styles.catBtnText, isDarkMode && { color: '#D1D5DB' }, filterCategory === '' && styles.catBtnTextActive]}>All</Text>
            </TouchableOpacity>
            {currentCategories.map(cat => (
              <TouchableOpacity
                key={cat}
                style={[styles.catBtn, isDarkMode && { backgroundColor: '#374151' }, filterCategory === cat && styles.catBtnActive]}
                onPress={() => setFilterCategory(cat)}
              >
                <Text style={[styles.catBtnText, isDarkMode && { color: '#D1D5DB' }, filterCategory === cat && styles.catBtnTextActive]}>{cat}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <Text style={[styles.filterLabel, isDarkMode && { color: '#E5E7EB' }]}>Date Range (YYYY-MM-DD):</Text>
          <View style={styles.dateRow}>
            <TextInput
              style={[styles.dateInput, isDarkMode && { backgroundColor: '#1F2937', borderColor: '#374151', color: '#F9FAFB' }]}
              placeholder="From (e.g. 2024-01-01)"
              value={startDate}
              onChangeText={setStartDate}
              placeholderTextColor="#9CA3AF"
            />
            <TextInput
              style={[styles.dateInput, isDarkMode && { backgroundColor: '#1F2937', borderColor: '#374151', color: '#F9FAFB' }]}
              placeholder="To (e.g. 2024-12-31)"
              value={endDate}
              onChangeText={setEndDate}
              placeholderTextColor="#9CA3AF"
            />
          </View>

          <TouchableOpacity style={[styles.resetBtn, isDarkMode && { backgroundColor: '#374151' }]} onPress={resetFilters}>
            <Text style={[styles.resetBtnText, isDarkMode && { color: '#D1D5DB' }]}>Reset Filters</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Summary */}
      <View style={[styles.summaryBar, isDarkMode && { backgroundColor: '#1e1b4b', borderBottomColor: '#312e81' }]}>
        <View style={styles.summaryItem}>
          <Text style={[styles.summaryLabel, isDarkMode && { color: '#9CA3AF' }]}>Found</Text>
          <Text style={[styles.summaryValue, isDarkMode && { color: '#F9FAFB' }]}>{filteredTransactions.length}</Text>
        </View>
        <View style={styles.summaryItem}>
          <Text style={[styles.summaryLabel, isDarkMode && { color: '#9CA3AF' }]}>Total</Text>
          <Text style={[styles.summaryValue, { color: calculateTotal() >= 0 ? '#10B981' : '#F87171' }]}>
            {calculateTotal() >= 0 ? '+' : ''}{currency}{calculateTotal().toFixed(2)}
          </Text>
        </View>
      </View>

      {/* List */}
      {isLoading ? (
        <View style={{ flex: 1, justifyContent: 'center' }}>
          <ActivityIndicator size="large" color="#4F46E5" />
        </View>
      ) : (
        <FlatList
          data={filteredTransactions}
          keyExtractor={item => item._id}
          renderItem={renderTransaction}
          contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
          ListEmptyComponent={
            <Text style={styles.emptyText}>No transactions found.</Text>
          }
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  searchContainer: {
    padding: 16,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  searchInput: {
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 8,
    color: '#111827',
  },
  filterToggleBtn: { alignSelf: 'center' },
  filterToggleText: { color: '#4F46E5', fontWeight: 'bold' },

  filtersSection: {
    padding: 16,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  filterLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  typeRow: { flexDirection: 'row', marginBottom: 16 },
  typeBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
  },
  typeBtnActive: { backgroundColor: '#4F46E5', borderColor: '#4F46E5' },
  typeBtnText: { color: '#374151' },
  typeBtnTextActive: { color: 'white' },

  catBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#F3F4F6',
    borderRadius: 16,
    marginRight: 8,
  },
  catBtnActive: { backgroundColor: '#4F46E5' },
  catBtnText: { color: '#374151', fontSize: 13 },
  catBtnTextActive: { color: 'white' },

  dateRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  dateInput: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    color: '#111827',
  },

  resetBtn: {
    backgroundColor: '#E5E7EB',
    padding: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  resetBtnText: { color: '#374151', fontWeight: 'bold' },

  summaryBar: {
    flexDirection: 'row',
    padding: 12,
    backgroundColor: '#EEF2FF',
    justifyContent: 'space-around',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E7FF',
  },
  summaryItem: { alignItems: 'center' },
  summaryLabel: { fontSize: 12, color: '#6B7280' },
  summaryValue: { fontSize: 16, fontWeight: 'bold', color: '#111827' },

  card: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2, elevation: 2,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4, marginRight: 8 },
  catText: { fontSize: 14, fontWeight: '600', color: '#374151' },
  badge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8 },
  badgeEntrata: { backgroundColor: '#D1FAE5' },
  badgeUscita: { backgroundColor: '#FEE2E2' },
  badgeText: { fontSize: 10, fontWeight: 'bold' },
  badgeTextEntrata: { color: '#065F46' },
  badgeTextUscita: { color: '#991B1B' },
  amountText: { fontSize: 18, fontWeight: 'bold', marginBottom: 4 },
  amountEntrata: { color: '#059669' },
  amountUscita: { color: '#DC2626' },
  descText: { fontSize: 14, color: '#6B7280', fontStyle: 'italic', marginBottom: 4 },
  dateText: { fontSize: 12, color: '#9CA3AF' },
  actionButtons: { flexDirection: 'row', alignItems: 'center' },
  actionBtn: { padding: 8, marginLeft: 4 },
  emptyText: { textAlign: 'center', marginTop: 40, color: '#6B7280' },
});

export default TransactionsScreen;