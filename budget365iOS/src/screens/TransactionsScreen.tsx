import React, { useState, useEffect, useCallback, useRef } from 'react';
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
  ScrollView,
  LayoutAnimation,
  Platform,
  UIManager,
  NativeSyntheticEvent,
  NativeScrollEvent
} from 'react-native';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import { useAppTheme } from '../hooks/useAppTheme';
import { API_URL } from '../config';
import { warmupBackend } from '../utils/apiClient';

const BASE_URL = API_URL;
const ACCENT = '#c4f23a';

const STRINGS = {
  it: {
    confirmDeleteTitle: 'Conferma eliminazione',
    confirmDeleteMsg: 'Sei sicuro di voler eliminare questa transazione?',
    cancel: 'Annulla',
    delete: 'Elimina',
    successTitle: 'Fatto',
    successMsg: 'Transazione eliminata',
    errorTitle: 'Errore',
    errorMsg: 'Impossibile eliminare la transazione',
    income: 'Entrata',
    expense: 'Spesa',
    incomes: 'Entrate',
    expenses: 'Spese',
    all: 'Tutte',
    eyebrowTransactions: 'TRANSAZIONI',
    found: 'TROVATE',
    filter: 'FILTRO',
    addExpense: '+ Spesa',
    addIncome: '+ Entrata',
    searchPlaceholder: '🔍 Cerca nelle descrizioni...',
    hideFilters: 'Nascondi filtri',
    showFilters: 'Mostra filtri',
    transactionType: 'TIPO TRANSAZIONE',
    category: 'CATEGORIA',
    dateRange: 'INTERVALLO DATE (AAAA-MM-GG)',
    fromPlaceholder: 'Da (es. 2024-01-01)',
    toPlaceholder: 'A (es. 2024-12-31)',
    resetFilters: 'Reimposta filtri',
    emptyState: 'Nessuna transazione trovata.',
  },
  en: {
    confirmDeleteTitle: 'Confirm deletion',
    confirmDeleteMsg: 'Are you sure you want to delete this transaction?',
    cancel: 'Cancel',
    delete: 'Delete',
    successTitle: 'Success',
    successMsg: 'Transaction deleted',
    errorTitle: 'Error',
    errorMsg: 'Unable to delete transaction',
    income: 'Income',
    expense: 'Expense',
    incomes: 'Income',
    expenses: 'Expense',
    all: 'All',
    eyebrowTransactions: 'TRANSACTIONS',
    found: 'FOUND',
    filter: 'FILTER',
    addExpense: '+ Expense',
    addIncome: '+ Income',
    searchPlaceholder: '🔍 Search in descriptions...',
    hideFilters: 'Hide Filters',
    showFilters: 'Show Filters',
    transactionType: 'TRANSACTION TYPE',
    category: 'CATEGORY',
    dateRange: 'DATE RANGE (YYYY-MM-DD)',
    fromPlaceholder: 'From (e.g. 2024-01-01)',
    toPlaceholder: 'To (e.g. 2024-12-31)',
    resetFilters: 'Reset Filters',
    emptyState: 'No transactions found.',
  },
} as const;

interface Transaction {
  _id: string;
  importo: number;
  categoria: string;
  descrizione?: string;
  data: string;
  tipo: 'entrata' | 'uscita';
}

const TransactionsScreen: React.FC<{ route?: any }> = ({ route }) => {
  const { userToken } = useAuth();
  const { currency, showBalance, isDarkMode, language } = useSettings();
  const t = useAppTheme();
  const navigation = useNavigation<any>();
  const s = STRINGS[language];

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
  const abortControllerRef = useRef<AbortController | null>(null);

  // Collapsible header on scroll
  const [headerVisible, setHeaderVisible] = useState(true);
  const scrollOffsetRef = useRef(0);
  const isHeaderVisibleRef = useRef(true);

  const handleScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const currentY = e.nativeEvent.contentOffset.y;
    const diff = currentY - scrollOffsetRef.current;

    if (currentY <= 0) {
      scrollOffsetRef.current = currentY;
      if (!isHeaderVisibleRef.current) {
        isHeaderVisibleRef.current = true;
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setHeaderVisible(true);
      }
    } else if (diff > 8 && isHeaderVisibleRef.current) {
      scrollOffsetRef.current = currentY;
      isHeaderVisibleRef.current = false;
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setHeaderVisible(false);
    } else if (diff < -8 && !isHeaderVisibleRef.current) {
      scrollOffsetRef.current = currentY;
      isHeaderVisibleRef.current = true;
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setHeaderVisible(true);
    }
  };

  // Apply filters from Stats screen navigation
  useEffect(() => {
    const params = route?.params;
    if (!params) return;
    if (params.filterCategory !== undefined) setFilterCategory(params.filterCategory || '');
    if (params.filterType !== undefined) setFilterType(params.filterType || 'tutte');
    if (params.startDate !== undefined) setStartDate(params.startDate || '');
    if (params.endDate !== undefined) setEndDate(params.endDate || '');
    if (params.filterCategory || params.filterType || params.startDate) setShowFilters(true);
  }, [route?.params]);

  useFocusEffect(
    useCallback(() => {
      if (userToken) {
        abortControllerRef.current?.abort();
        abortControllerRef.current = new AbortController();
        loadData(abortControllerRef.current.signal);
      }
      return () => {
        abortControllerRef.current?.abort();
      };
    }, [userToken])
  );

  useEffect(() => {
    applyFilters();
  }, [allTransactions, searchQuery, filterType, filterCategory, startDate, endDate]);

  const loadData = async (signal?: AbortSignal) => {
    setIsLoading(true);
    try {
      await warmupBackend();
      if (signal?.aborted) return;
      // Fetch Categories
      const catRes = await fetch(`${BASE_URL}/api/categorie`, {
        headers: { 'Authorization': `Bearer ${userToken}` },
        signal,
      });
      if (signal?.aborted) return;
      if (catRes.ok) {
        const data = await catRes.json();
        if (signal?.aborted) return;
        setCategorieSpese(data.categorie.spese || []);
        setCategorieEntrate(data.categorie.entrate || []);
      }

      // Fetch All Transactions
      // Using limit=2000 to get a good history without overkilling the mobile device
      const [speseRes, entrateRes] = await Promise.all([
        fetch(`${BASE_URL}/api/spese?limit=2000`, { headers: { 'Authorization': `Bearer ${userToken}` }, signal }),
        fetch(`${BASE_URL}/api/entrate?limit=2000`, { headers: { 'Authorization': `Bearer ${userToken}` }, signal })
      ]);

      if (signal?.aborted) return;

      const speseData = await speseRes.json();
      const entrateData = await entrateRes.json();

      if (signal?.aborted) return;

      const spese = (speseData.spese || []).map((s: any) => ({ ...s, tipo: 'uscita' }));
      const entrate = (entrateData.entrate || []).map((e: any) => ({ ...e, tipo: 'entrata' }));

      const all = [...spese, ...entrate].sort((a, b) =>
        new Date(b.data).getTime() - new Date(a.data).getTime()
      );

      setAllTransactions(all);
    } catch (error: any) {
      if (error?.name !== 'AbortError') {
        console.error("Error loading data:", error);
      }
    } finally {
      if (!signal?.aborted) {
        setIsLoading(false);
      }
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

  const formatCurrency = (value: number, signed = false) => {
    if (!showBalance) return '****';
    const sign = signed ? (value >= 0 ? '+' : '-') : '';
    return `${sign}${currency}${Math.abs(value).toFixed(2)}`;
  };

  const deleteTransaction = async (id: string, tipo: string) => {
    Alert.alert(
      s.confirmDeleteTitle,
      s.confirmDeleteMsg,
      [
        { text: s.cancel, style: 'cancel' },
        {
          text: s.delete,
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
                Alert.alert(s.successTitle, s.successMsg);
              } else {
                Alert.alert(s.errorTitle, s.errorMsg);
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
      <View style={[styles.card, { backgroundColor: t.surface, borderColor: t.line }]}>
        <View style={{ flex: 1 }}>
          <View style={styles.cardHeader}>
            <Text style={[styles.catText, { color: t.text }]} numberOfLines={1}>{item.categoria}</Text>
            <View style={[styles.badge, { backgroundColor: isEntrata ? 'rgba(22,163,74,0.14)' : 'rgba(220,38,38,0.14)' }]}>
              <Text style={[styles.badgeText, { color: isEntrata ? t.pos : t.neg }]}>
                {isEntrata ? s.income : s.expense}
              </Text>
            </View>
          </View>

          <Text style={[styles.amountText, { color: isEntrata ? t.pos : t.neg }]}>
            {formatCurrency(isEntrata ? Math.abs(item.importo) : -Math.abs(item.importo), true)}
          </Text>

          {item.descrizione ? (
            <Text style={[styles.descText, { color: t.text2 }]} numberOfLines={2}>{item.descrizione}</Text>
          ) : null}

          <Text style={[styles.dateText, { color: t.text3 }]}>{new Date(item.data).toLocaleDateString(language === 'it' ? 'it-IT' : 'en-US')}</Text>
        </View>

        <View style={styles.actionButtons}>
          <TouchableOpacity
            activeOpacity={0.6}
            style={[styles.actionBtn, {
              backgroundColor: isDarkMode ? 'rgba(59,130,246,0.18)' : 'rgba(59,130,246,0.12)',
              borderColor: isDarkMode ? 'rgba(59,130,246,0.35)' : 'rgba(59,130,246,0.25)',
            }]}
            onPress={() => navigation.navigate('AddTransaction', { transactionToEdit: item })}
          >
            <Text style={{ fontSize: 15 }}>✏️</Text>
          </TouchableOpacity>
          <TouchableOpacity
            activeOpacity={0.6}
            style={[styles.actionBtn, {
              backgroundColor: isDarkMode ? 'rgba(255,107,107,0.15)' : 'rgba(220,38,38,0.10)',
              borderColor: isDarkMode ? 'rgba(255,107,107,0.30)' : 'rgba(220,38,38,0.22)',
            }]}
            onPress={() => deleteTransaction(item._id, item.tipo)}
          >
            <Text style={{ fontSize: 15 }}>🗑️</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const currentCategories = filterType === 'entrata' ? categorieEntrate :
    filterType === 'uscita' ? categorieSpese :
      [...new Set([...categorieSpese, ...categorieEntrate])].sort();

  return (
    <View style={[styles.container, { backgroundColor: t.bg }]}>
      <View style={[styles.hero, { backgroundColor: t.surface, borderColor: t.line }]}>
        <Text style={[styles.heroEyebrow, { color: t.text3 }]}>{s.eyebrowTransactions}</Text>
        <Text style={[styles.heroAmount, { color: calculateTotal() >= 0 ? t.pos : t.neg }]}>
          {formatCurrency(calculateTotal(), true)}
        </Text>
        <View style={[styles.flowRow, { backgroundColor: t.surface2 }]}>
          <View style={styles.flowCell}>
            <View style={[styles.flowDot, { backgroundColor: ACCENT }]} />
            <View>
              <Text style={[styles.flowLabel, { color: t.text3 }]}>{s.found}</Text>
              <Text style={[styles.flowVal, { color: t.text }]}>{filteredTransactions.length}</Text>
            </View>
          </View>
          <View style={[styles.flowDivider, { backgroundColor: t.line2 }]} />
          <View style={styles.flowCell}>
            <View style={[styles.flowDot, { backgroundColor: filterType === 'entrata' ? t.pos : filterType === 'uscita' ? t.neg : t.text3 }]} />
            <View>
              <Text style={[styles.flowLabel, { color: t.text3 }]}>{s.filter}</Text>
              <Text style={[styles.flowVal, { color: t.text }]}>
                {filterType === 'tutte' ? s.all : filterType === 'entrata' ? s.incomes : s.expenses}
              </Text>
            </View>
          </View>
        </View>
      </View>

      {headerVisible && (
      <View>
      <View style={styles.actionsContainer}>
        <TouchableOpacity
          style={[styles.actionPill, { backgroundColor: t.surface, borderColor: t.neg }]}
          onPress={() => navigation.navigate('AddTransaction')}
        >
          <Text style={[styles.actionPillText, { color: t.neg }]}>{s.addExpense}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionPill, { backgroundColor: t.surface, borderColor: t.pos }]}
          onPress={() => navigation.navigate('AddTransaction', { type: 'entrata' })}
        >
          <Text style={[styles.actionPillText, { color: t.pos }]}>{s.addIncome}</Text>
        </TouchableOpacity>
      </View>

      {/* Header & Search */}
      <View style={[styles.searchContainer, { backgroundColor: t.surface, borderColor: t.line }]}>
        <TextInput
          style={[styles.searchInput, { backgroundColor: t.surface2, color: t.text, borderColor: searchQuery ? ACCENT : t.line }]}
          placeholder={s.searchPlaceholder}
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholderTextColor={t.text3}
        />
        <TouchableOpacity style={[styles.filterToggleBtn, { borderColor: t.line2 }]} onPress={() => setShowFilters(!showFilters)}>
          <Text style={[styles.filterToggleText, { color: t.text2 }]}>{showFilters ? s.hideFilters : s.showFilters}</Text>
        </TouchableOpacity>
      </View>

      {/* Filters Section */}
      {showFilters && (
        <View style={[styles.filtersSection, { backgroundColor: t.surface, borderColor: t.line }]}>
          <Text style={[styles.filterLabel, { color: t.text3 }]}>{s.transactionType}</Text>
          <View style={[styles.typeRow, { backgroundColor: t.surface2 }]}>
            {(['tutte', 'entrata', 'uscita'] as const).map(option => (
              <TouchableOpacity
                key={option}
                style={[
                  styles.typeBtn,
                  filterType === option && { backgroundColor: option === 'entrata' ? '#16a34a' : option === 'uscita' ? '#dc2626' : ACCENT }
                ]}
                onPress={() => {
                  setFilterType(option);
                  setFilterCategory(''); // Reset cat on type change
                }}
              >
                <Text style={[styles.typeBtnText, { color: filterType === option ? '#0c0c0c' : t.text2 }, filterType === 'entrata' && option === 'entrata' && { color: '#fff' }, filterType === 'uscita' && option === 'uscita' && { color: '#fff' }]}>
                  {option === 'tutte' ? s.all : option === 'entrata' ? s.incomes : s.expenses}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={[styles.filterLabel, { color: t.text3 }]}>{s.category}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
            <TouchableOpacity
              style={[styles.catBtn, { backgroundColor: t.surface2, borderColor: t.line }, filterCategory === '' && { backgroundColor: ACCENT, borderColor: ACCENT }]}
              onPress={() => setFilterCategory('')}
            >
              <Text style={[styles.catBtnText, { color: filterCategory === '' ? '#0c0c0c' : t.text2 }]}>{s.all}</Text>
            </TouchableOpacity>
            {currentCategories.map(cat => (
              <TouchableOpacity
                key={cat}
                style={[styles.catBtn, { backgroundColor: t.surface2, borderColor: t.line }, filterCategory === cat && { backgroundColor: ACCENT, borderColor: ACCENT }]}
                onPress={() => setFilterCategory(cat)}
              >
                <Text style={[styles.catBtnText, { color: filterCategory === cat ? '#0c0c0c' : t.text2 }]}>{cat}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <Text style={[styles.filterLabel, { color: t.text3 }]}>{s.dateRange}</Text>
          <View style={styles.dateRow}>
            <TextInput
              style={[styles.dateInput, { backgroundColor: t.surface2, borderColor: t.line, color: t.text }]}
              placeholder={s.fromPlaceholder}
              value={startDate}
              onChangeText={setStartDate}
              placeholderTextColor={t.text3}
            />
            <TextInput
              style={[styles.dateInput, { backgroundColor: t.surface2, borderColor: t.line, color: t.text }]}
              placeholder={s.toPlaceholder}
              value={endDate}
              onChangeText={setEndDate}
              placeholderTextColor={t.text3}
            />
          </View>

          <TouchableOpacity style={[styles.resetBtn, { backgroundColor: t.surface2, borderColor: t.line2 }]} onPress={resetFilters}>
            <Text style={[styles.resetBtnText, { color: t.text2 }]}>{s.resetFilters}</Text>
          </TouchableOpacity>
        </View>
      )}
      </View>
      )}

      {/* List */}
      {isLoading ? (
        <View style={{ flex: 1, justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={ACCENT} />
        </View>
      ) : (
        <FlatList
          data={filteredTransactions}
          keyExtractor={item => item._id}
          renderItem={renderTransaction}
          contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          ListEmptyComponent={
            <View style={[styles.emptyCard, { backgroundColor: t.surface, borderColor: t.line }]}>
              <Text style={[styles.emptyText, { color: t.text3 }]}>{s.emptyState}</Text>
            </View>
          }
        />
      )}

      <TouchableOpacity
        style={[styles.fab, { backgroundColor: ACCENT }]}
        activeOpacity={0.85}
        onPress={() => navigation.navigate('AddTransaction')}
      >
        <Text style={styles.fabIcon}>+</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  hero: {
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 12,
    borderRadius: 20,
    borderWidth: 1,
    padding: 20,
  },
  heroEyebrow: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1.4,
    marginBottom: 8,
  },
  heroAmount: {
    fontSize: 40,
    fontWeight: '700',
    letterSpacing: -1,
    marginBottom: 18,
    lineHeight: 46,
  },
  flowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    padding: 10,
  },
  flowCell: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  flowDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  flowLabel: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 1,
    marginBottom: 2,
  },
  flowVal: {
    fontSize: 14,
    fontWeight: '600',
  },
  flowDivider: {
    width: 1,
    height: 28,
    marginHorizontal: 8,
  },
  actionsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 10,
    marginBottom: 12,
  },
  actionPill: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1.5,
    alignItems: 'center',
  },
  actionPillText: {
    fontSize: 14,
    fontWeight: '700',
  },
  searchContainer: {
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
  },
  searchInput: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    fontSize: 16,
    marginBottom: 8,
  },
  filterToggleBtn: {
    alignSelf: 'center',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  filterToggleText: { fontWeight: '600', fontSize: 13 },

  filtersSection: {
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
  },
  filterLabel: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1,
    marginBottom: 8,
  },
  typeRow: { flexDirection: 'row', marginBottom: 16, borderRadius: 12, padding: 4, gap: 4 },
  typeBtn: {
    flex: 1,
    paddingVertical: 9,
    alignItems: 'center',
    borderRadius: 9,
  },
  typeBtnText: { fontSize: 13, fontWeight: '600' },

  catBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    marginRight: 8,
  },
  catBtnText: { fontSize: 13, fontWeight: '600' },

  dateRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  dateInput: {
    flex: 1,
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
  },

  resetBtn: {
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
    alignItems: 'center',
  },
  resetBtnText: { fontWeight: '600' },

  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4, marginRight: 8, gap: 8 },
  catText: { fontSize: 14, fontWeight: '600', flex: 1 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  badgeText: { fontSize: 10, fontWeight: '700' },
  amountText: { fontSize: 20, fontWeight: '700', marginBottom: 4, letterSpacing: -0.2 },
  descText: { fontSize: 14, marginBottom: 4 },
  dateText: { fontSize: 12 },
  actionButtons: { flexDirection: 'row', alignItems: 'center' },
  actionBtn: { width: 36, height: 36, marginLeft: 6, borderRadius: 10, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  emptyCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
    padding: 18,
    alignItems: 'center',
  },
  emptyText: { textAlign: 'center', fontSize: 13, fontWeight: '500', fontStyle: 'italic' },
  fab: {
    position: 'absolute',
    bottom: 28,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    zIndex: 100,
  },
  fabIcon: {
    fontSize: 28,
    fontWeight: '400',
    color: '#0c0c0c',
    lineHeight: 30,
  },
});

export default TransactionsScreen;
