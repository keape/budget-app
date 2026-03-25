import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Modal,
  ActivityIndicator,
  StyleSheet,
  RefreshControl,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import { API_URL } from '../config';
import { AllocationMode, deriveOnAmountChange, deriveOnQuantityChange, deriveOnPriceChange } from '../utils/allocationCalc';

const BASE_URL = API_URL;

type ActiveTab = 'mese' | 'piano' | 'portfolio';

// ============================================================
// TypeScript Interfaces
// ============================================================
interface InstrumentData {
  _id: string;
  ticker: string;
  name: string;
  type: string;
  currency?: string;
  exchange?: string;
  country?: string;
  lastPrice?: number;
}

interface AllocationData {
  _id: string;
  instrumentId: InstrumentData;
  amount: number;
  quantity?: number;
  priceAtAllocation?: number;
  savingsMonthId: string;
}

interface PlanAllocation {
  instrumentId: InstrumentData;
  targetPercentage: number;
}

interface PlanData {
  _id: string;
  userId: string;
  allocations: PlanAllocation[];
}

interface PortfolioItem {
  instrument: InstrumentData;
  totalAmount: number;
  totalQuantity: number;
  estimatedCurrentValue: number | null;
}

interface SavingsMonthData {
  _id: string;
  anno: number;
  mese: number;
  income: number;
  expenses: number;
  savings: number;
  status: string;
}

interface SavingsScreenProps {
  navigation: { navigate: (screen: string, params?: any) => void; goBack: () => void };
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 10 }, (_, i) => CURRENT_YEAR - 3 + i);

const TICKER_COLORS = [
  '#4F46E5', '#059669', '#DC2626', '#D97706', '#7C3AED',
  '#0891B2', '#BE185D', '#65A30D', '#EA580C', '#0284C7',
];

function getTickerColor(ticker: string): string {
  let hash = 0;
  for (let i = 0; i < ticker.length; i++) {
    hash = ticker.charCodeAt(i) + ((hash << 5) - hash);
  }
  return TICKER_COLORS[Math.abs(hash) % TICKER_COLORS.length];
}

const SavingsScreen: React.FC<SavingsScreenProps> = ({ navigation }) => {
  const { userToken } = useAuth();
  const { currency, isDarkMode, showBalance } = useSettings();

  // --- Navigation / Tab state ---
  const [activeTab, setActiveTab] = useState<ActiveTab>('mese');
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return d.getMonth();
  });
  const [selectedYear, setSelectedYear] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return d.getFullYear();
  });

  // --- Month/Year picker modals ---
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const [showYearPicker, setShowYearPicker] = useState(false);

  // --- Data ---
  const [savingsMonth, setSavingsMonth] = useState<SavingsMonthData | null>(null);
  const [allocations, setAllocations] = useState<AllocationData[]>([]);
  const [plan, setPlan] = useState<PlanData | null>(null);
  const [portfolio, setPortfolio] = useState<PortfolioItem[]>([]);

  // --- Loading / Refreshing ---
  const [isLoading, setIsLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // --- Add Allocation Modal ---
  const [showAddAllocationModal, setShowAddAllocationModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<InstrumentData[]>([]);
  const [selectedInstrument, setSelectedInstrument] = useState<InstrumentData | null>(null);
  const [newAmount, setNewAmount] = useState('');
  const [newQuantity, setNewQuantity] = useState('');
  const [newPrice, setNewPrice] = useState('');
  const [allocationMode, setAllocationMode] = useState<AllocationMode>('amount');

  // --- Add Plan Modal ---
  const [showAddPlanModal, setShowAddPlanModal] = useState(false);
  const [planSearchQuery, setPlanSearchQuery] = useState('');
  const [planSearchResults, setPlanSearchResults] = useState<InstrumentData[]>([]);
  const [planSelectedInstrument, setPlanSelectedInstrument] = useState<InstrumentData | null>(null);
  const [pianoPct, setPianoPct] = useState('');

  // --- AbortController ---
  const abortControllerRef = useRef<AbortController | null>(null);

  // Tracks whether the Add Allocation modal is open — guards the async fallback price fetch
  const allocationModalOpenRef = useRef(false);

  // --- Debounce refs ---
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const planSearchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ============================================================
  // Data Loading
  // ============================================================
  const loadData = async (signal: AbortSignal) => {
    if (!userToken) return;
    setIsLoading(true);
    try {
      if (activeTab === 'mese') {
        const monthsRes = await fetch(`${BASE_URL}/api/savings/months`, {
          headers: { Authorization: `Bearer ${userToken}` },
          signal,
        });
        if (signal.aborted) return;
        if (!monthsRes.ok) {
          setSavingsMonth(null);
          setAllocations([]);
          return;
        }
        const monthsJson = await monthsRes.json();
        if (signal.aborted) return;

        let month =
          monthsJson.data?.find(
            (m: any) => m.anno === selectedYear && m.mese === selectedMonth,
          ) ?? null;

        // If no document yet, ask the backend to compute and create it for this past month
        if (!month) {
          const now = new Date();
          const isFutureOrCurrent =
            selectedYear > now.getFullYear() ||
            (selectedYear === now.getFullYear() && selectedMonth >= now.getMonth());
          if (!isFutureOrCurrent) {
            const ensureRes = await fetch(`${BASE_URL}/api/savings/ensure-month`, {
              method: 'POST',
              headers: { Authorization: `Bearer ${userToken}`, 'Content-Type': 'application/json' },
              body: JSON.stringify({ anno: selectedYear, mese: selectedMonth }),
              signal,
            });
            if (!signal.aborted && ensureRes.ok) {
              const ensureJson = await ensureRes.json();
              if (!signal.aborted) month = ensureJson.data ?? null;
            }
          }
        }

        setSavingsMonth(month);

        if (month) {
          const allocRes = await fetch(
            `${BASE_URL}/api/savings/months/${month._id}/allocations`,
            { headers: { Authorization: `Bearer ${userToken}` }, signal },
          );
          if (signal.aborted) return;
          if (allocRes.ok) {
            const allocJson = await allocRes.json();
            if (signal.aborted) return;
            setAllocations(allocJson.data ?? []);
          }
        } else {
          setAllocations([]);
        }
      }

      if (activeTab === 'piano') {
        const planRes = await fetch(`${BASE_URL}/api/savings/plan`, {
          headers: { Authorization: `Bearer ${userToken}` },
          signal,
        });
        if (signal.aborted) return;
        if (planRes.ok) {
          const planJson = await planRes.json();
          if (signal.aborted) return;
          setPlan(planJson.data);
        }
      }

      if (activeTab === 'portfolio') {
        const portRes = await fetch(`${BASE_URL}/api/savings/portfolio`, {
          headers: { Authorization: `Bearer ${userToken}` },
          signal,
        });
        if (signal.aborted) return;
        if (portRes.ok) {
          const portJson = await portRes.json();
          if (signal.aborted) return;
          setPortfolio(portJson.data ?? []);
        }
      }
    } catch (e: any) {
      if (e.name !== 'AbortError') {
        console.error('SavingsScreen loadData error:', e);
      }
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  const isFocusedRef = useRef(false);

  useFocusEffect(
    useCallback(() => {
      isFocusedRef.current = true;
      if (userToken) {
        abortControllerRef.current?.abort();
        abortControllerRef.current = new AbortController();
        loadData(abortControllerRef.current.signal);
      }
      return () => {
        isFocusedRef.current = false;
        abortControllerRef.current?.abort();
      };
    }, [userToken]),
  );

  useEffect(() => {
    if (!isFocusedRef.current || !userToken) return;
    abortControllerRef.current?.abort();
    abortControllerRef.current = new AbortController();
    loadData(abortControllerRef.current.signal);
  }, [activeTab, selectedMonth, selectedYear]);

  // Clean up debounce timeouts on unmount
  useEffect(() => {
    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
      if (planSearchDebounceRef.current) clearTimeout(planSearchDebounceRef.current);
    };
  }, []);

  const onRefresh = () => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = new AbortController();
    setRefreshing(true);
    loadData(abortControllerRef.current.signal);
  };

  const reloadData = () => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = new AbortController();
    loadData(abortControllerRef.current.signal);
  };

  // ============================================================
  // Instrument Search — Allocation Modal
  // ============================================================
  const handleSearchChange = (text: string) => {
    setSearchQuery(text);
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    if (!text.trim()) {
      setSearchResults([]);
      return;
    }
    searchDebounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `${BASE_URL}/api/instruments/search?q=${encodeURIComponent(text)}`,
          { headers: { Authorization: `Bearer ${userToken}` } },
        );
        if (res.ok) {
          const json = await res.json();
          setSearchResults(json.data ?? []);
        }
      } catch {}
    }, 300);
  };

  const handleSelectInstrument = (item: InstrumentData) => {
    setSelectedInstrument(item);
    setSearchQuery('');
    setSearchResults([]);

    if (item.lastPrice != null) {
      setNewPrice(item.lastPrice.toFixed(2));
    } else {
      // Fallback: fetch fresh price only if not present in search result
      fetch(`${BASE_URL}/api/instruments/${encodeURIComponent(item.ticker)}`, {
        headers: { Authorization: `Bearer ${userToken}` },
      })
        .then(res => res.ok ? res.json() : null)
        .then(json => {
          const price = json?.data?.lastPrice;
          if (price != null && allocationModalOpenRef.current) {
            // Only set if user hasn't already typed a price
            setNewPrice(prev => (prev === '' ? price.toFixed(2) : prev));
          }
        })
        .catch(() => {});
    }
  };

  // ============================================================
  // Instrument Search — Plan Modal
  // ============================================================
  const handlePlanSearchChange = (text: string) => {
    setPlanSearchQuery(text);
    if (planSearchDebounceRef.current) clearTimeout(planSearchDebounceRef.current);
    if (!text.trim()) {
      setPlanSearchResults([]);
      return;
    }
    planSearchDebounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `${BASE_URL}/api/instruments/search?q=${encodeURIComponent(text)}`,
          { headers: { Authorization: `Bearer ${userToken}` } },
        );
        if (res.ok) {
          const json = await res.json();
          setPlanSearchResults(json.data ?? []);
        }
      } catch {}
    }, 300);
  };

  // ============================================================
  // Reset Allocation Modal
  // ============================================================
  const resetAllocationModal = () => {
    allocationModalOpenRef.current = false;
    setShowAddAllocationModal(false);
    setSelectedInstrument(null);
    setNewAmount('');
    setNewQuantity('');
    setNewPrice('');
    setSearchQuery('');
    setSearchResults([]);
    setAllocationMode('amount');
  };

  // ============================================================
  // Save Allocation
  // ============================================================
  const handleSaveAllocation = async () => {
    if (!selectedInstrument || !newAmount || !savingsMonth) return;
    try {
      const body: any = {
        instrumentId: selectedInstrument._id,
        amount: parseFloat(newAmount),
      };
      if (newQuantity) body.quantity = parseFloat(newQuantity);
      if (newPrice) body.priceAtAllocation = parseFloat(newPrice);

      const res = await fetch(
        `${BASE_URL}/api/savings/months/${savingsMonth._id}/allocations`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${userToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
        },
      );
      if (res.ok) {
        resetAllocationModal();
        reloadData();
      } else {
        const errJson = await res.json().catch(() => ({}));
        Alert.alert('Error', errJson.error ?? 'Could not add allocation');
      }
    } catch (e) {
      console.error(e);
    }
  };

  // ============================================================
  // Delete Allocation
  // ============================================================
  const handleDeleteAllocation = (allId: string) => {
    if (!savingsMonth) return;
    Alert.alert('Delete', 'Delete this allocation?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            const response = await fetch(
              `${BASE_URL}/api/savings/months/${savingsMonth._id}/allocations/${allId}`,
              {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${userToken}` },
              },
            );
            if (!response.ok) {
              Alert.alert('Error', 'Could not delete allocation. Please try again.');
              return;
            }
            reloadData();
          } catch (e) {
            console.error(e);
          }
        },
      },
    ]);
  };

  // ============================================================
  // Save Plan Entry
  // ============================================================
  const handleSavePlanEntry = async () => {
    if (!planSelectedInstrument || !pianoPct) return;
    const pct = parseFloat(pianoPct);
    if (isNaN(pct) || pct <= 0) {
      Alert.alert('Error', 'Please enter a valid percentage');
      return;
    }
    const currentAllocations: any[] = plan?.allocations ?? [];
    const newEntry = {
      instrumentId: planSelectedInstrument._id,
      targetPercentage: pct,
    };
    const updated = [...currentAllocations, newEntry];
    await savePlan(updated);
    setShowAddPlanModal(false);
    setPlanSelectedInstrument(null);
    setPianoPct('');
    setPlanSearchQuery('');
    setPlanSearchResults([]);
    reloadData();
  };

  // ============================================================
  // Delete Plan Entry
  // ============================================================
  const handleDeletePlanEntry = async (index: number) => {
    const currentAllocations: any[] = plan?.allocations ?? [];
    const updated = currentAllocations.filter((_: any, i: number) => i !== index);
    await savePlan(updated);
    reloadData();
  };

  const savePlan = async (allocationsArr: any[]) => {
    try {
      const response = await fetch(`${BASE_URL}/api/savings/plan`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${userToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ allocations: allocationsArr }),
      });
      if (!response.ok) {
        Alert.alert('Error', 'Could not save plan. Please try again.');
        return;
      }
    } catch (e) {
      console.error('savePlan error:', e);
    }
  };

  // ============================================================
  // Helpers
  // ============================================================
  const formatCurrency = (val: number) =>
    showBalance ? `${currency}${val.toFixed(2)}` : '****';

  const totalPlanPct = (plan?.allocations ?? []).reduce(
    (sum: number, a: PlanAllocation) => sum + (a.targetPercentage ?? 0),
    0,
  );

  const portfolioTotalValue = portfolio.reduce(
    (sum: number, item: PortfolioItem) =>
      sum + (item.estimatedCurrentValue ?? item.totalAmount ?? 0),
    0,
  );

  // ============================================================
  // Render: Month/Year Selector
  // ============================================================
  const renderMonthSelector = () => (
    <View style={styles.periodContainer}>
      <TouchableOpacity
        style={[styles.periodButton, isDarkMode && styles.periodButtonDark]}
        onPress={() => setShowMonthPicker(true)}
      >
        <Text style={[styles.periodButtonText, isDarkMode && { color: '#F9FAFB' }]}>
          {MONTHS[selectedMonth]}
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.periodButton, isDarkMode && styles.periodButtonDark]}
        onPress={() => setShowYearPicker(true)}
      >
        <Text style={[styles.periodButtonText, isDarkMode && { color: '#F9FAFB' }]}>
          {selectedYear}
        </Text>
      </TouchableOpacity>
    </View>
  );

  // ============================================================
  // Render: Month Picker Modal
  // ============================================================
  const renderMonthPickerModal = () => (
    <Modal visible={showMonthPicker} transparent animationType="slide">
      <View style={styles.pickerOverlay}>
        <View style={[styles.pickerContainer, isDarkMode && { backgroundColor: '#1F2937' }]}>
          <Text style={[styles.pickerTitle, isDarkMode && { color: '#F9FAFB' }]}>
            Select Month
          </Text>
          <ScrollView>
            {MONTHS.map((m, idx) => (
              <TouchableOpacity
                key={m}
                style={[
                  styles.pickerItem,
                  isDarkMode && { borderBottomColor: '#374151' },
                  selectedMonth === idx && (isDarkMode ? { backgroundColor: '#374151' } : styles.pickerItemActive),
                ]}
                onPress={() => {
                  setSelectedMonth(idx);
                  setShowMonthPicker(false);
                }}
              >
                <Text
                  style={[
                    styles.pickerItemText,
                    isDarkMode && { color: '#D1D5DB' },
                    selectedMonth === idx && styles.pickerItemTextActive,
                  ]}
                >
                  {m}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <TouchableOpacity
            style={styles.pickerClose}
            onPress={() => setShowMonthPicker(false)}
          >
            <Text style={styles.pickerCloseText}>Close</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );

  // ============================================================
  // Render: Year Picker Modal
  // ============================================================
  const renderYearPickerModal = () => (
    <Modal visible={showYearPicker} transparent animationType="slide">
      <View style={styles.pickerOverlay}>
        <View style={[styles.pickerContainer, isDarkMode && { backgroundColor: '#1F2937' }]}>
          <Text style={[styles.pickerTitle, isDarkMode && { color: '#F9FAFB' }]}>
            Select Year
          </Text>
          <ScrollView>
            {YEARS.map(y => (
              <TouchableOpacity
                key={y}
                style={[
                  styles.pickerItem,
                  isDarkMode && { borderBottomColor: '#374151' },
                  selectedYear === y && (isDarkMode ? { backgroundColor: '#374151' } : styles.pickerItemActive),
                ]}
                onPress={() => {
                  setSelectedYear(y);
                  setShowYearPicker(false);
                }}
              >
                <Text
                  style={[
                    styles.pickerItemText,
                    isDarkMode && { color: '#D1D5DB' },
                    selectedYear === y && styles.pickerItemTextActive,
                  ]}
                >
                  {y}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <TouchableOpacity
            style={styles.pickerClose}
            onPress={() => setShowYearPicker(false)}
          >
            <Text style={styles.pickerCloseText}>Close</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );

  // ============================================================
  // Render: Ticker Badge
  // ============================================================
  const TickerBadge = ({ ticker }: { ticker: string }) => (
    <View style={[styles.tickerBadge, { backgroundColor: getTickerColor(ticker ?? 'X') }]}>
      <Text style={styles.tickerBadgeText} numberOfLines={1}>
        {(ticker ?? '?').toUpperCase().slice(0, 5)}
      </Text>
    </View>
  );

  // ============================================================
  // Render: Tab "Mese"
  // ============================================================
  const renderMeseTab = () => {
    const income = savingsMonth?.income ?? 0;
    const expenses = savingsMonth?.expenses ?? 0;
    const risparmio = savingsMonth?.savings ?? (income - expenses);

    return (
      <ScrollView
        style={styles.tabContent}
        contentContainerStyle={{ paddingBottom: 100 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {renderMonthSelector()}

        {savingsMonth === null ? (
          <View style={[styles.emptyCard, isDarkMode && { backgroundColor: '#1F2937' }]}>
            <Text style={[styles.emptyText, isDarkMode && { color: '#9CA3AF' }]}>
              No data for this month
            </Text>
            <Text style={[styles.emptySubText, isDarkMode && { color: '#6B7280' }]}>
              {MONTHS[selectedMonth]} {selectedYear}
            </Text>
          </View>
        ) : (
          <>
            {/* Mini Cards */}
            <View style={styles.miniCardsRow}>
              <View style={[styles.miniCard, isDarkMode && { backgroundColor: '#1F2937' }]}>
                <Text style={[styles.miniCardLabel, isDarkMode && { color: '#9CA3AF' }]}>
                  Income
                </Text>
                <Text style={[styles.miniCardValue, { color: '#10B981' }]}>
                  {formatCurrency(income)}
                </Text>
              </View>
              <View style={[styles.miniCard, isDarkMode && { backgroundColor: '#1F2937' }]}>
                <Text style={[styles.miniCardLabel, isDarkMode && { color: '#9CA3AF' }]}>
                  Expenses
                </Text>
                <Text style={[styles.miniCardValue, { color: '#EF4444' }]}>
                  {formatCurrency(expenses)}
                </Text>
              </View>
              <View style={[styles.miniCard, isDarkMode && { backgroundColor: '#1F2937' }]}>
                <Text style={[styles.miniCardLabel, isDarkMode && { color: '#9CA3AF' }]}>
                  Savings
                </Text>
                <Text
                  style={[
                    styles.miniCardValue,
                    { color: risparmio >= 0 ? '#10B981' : '#EF4444' },
                  ]}
                >
                  {formatCurrency(risparmio)}
                </Text>
              </View>
            </View>

            {/* Available to allocate */}
            {(() => {
              const totalAllocated = allocations.reduce((s: number, a: AllocationData) => s + (a.amount ?? 0), 0);
              const available = risparmio - totalAllocated;
              return (
                <View style={[styles.availableCard, { backgroundColor: available >= 0 ? (isDarkMode ? '#064E3B' : '#ECFDF5') : (isDarkMode ? '#450A0A' : '#FEF2F2') }]}>
                  <Text style={[styles.availableLabel, { color: isDarkMode ? '#6EE7B7' : '#065F46' }]}>
                    Available to allocate
                  </Text>
                  <Text style={[styles.availableAmount, { color: available >= 0 ? '#10B981' : '#EF4444' }]}>
                    {showBalance ? `${available >= 0 ? '' : '-'}${currency}${Math.abs(available).toFixed(2)}` : '****'}
                  </Text>
                  {totalAllocated > 0 && (
                    <Text style={[styles.availableSub, { color: isDarkMode ? '#6B7280' : '#9CA3AF' }]}>
                      {currency}{totalAllocated.toFixed(2)} already allocated
                    </Text>
                  )}
                </View>
              );
            })()}

            {/* Allocations List */}
            <Text style={[styles.sectionTitle, isDarkMode && { color: '#F9FAFB' }]}>
              Allocations
            </Text>
            {allocations.length === 0 ? (
              <Text style={[styles.emptyText, isDarkMode && { color: '#9CA3AF' }]}>
                No allocations
              </Text>
            ) : (
              allocations.map((alloc: AllocationData) => {
                const ticker = alloc.instrumentId?.ticker ?? '?';
                const name = alloc.instrumentId?.name ?? ticker;
                const type = alloc.instrumentId?.type ?? '';
                return (
                  <View
                    key={alloc._id}
                    style={[styles.allocationRow, isDarkMode && { backgroundColor: '#1F2937' }]}
                  >
                    <TickerBadge ticker={ticker} />
                    <View style={styles.allocationInfo}>
                      <Text
                        style={[styles.allocationName, isDarkMode && { color: '#F9FAFB' }]}
                        numberOfLines={1}
                      >
                        {name}
                      </Text>
                      {type ? (
                        <Text style={[styles.allocationMeta, isDarkMode && { color: '#9CA3AF' }]}>
                          {type}
                        </Text>
                      ) : null}
                    </View>
                    <View style={styles.allocationAmounts}>
                      <Text style={[styles.allocationAmount, isDarkMode && { color: '#F9FAFB' }]}>
                        {formatCurrency(alloc.amount ?? 0)}
                      </Text>
                      {alloc.quantity > 0 && (
                        <Text style={[styles.allocationMeta, isDarkMode && { color: '#9CA3AF' }]}>
                          x{alloc.quantity}
                        </Text>
                      )}
                    </View>
                    <TouchableOpacity
                      style={styles.deleteBtn}
                      onPress={() => handleDeleteAllocation(alloc._id)}
                    >
                      <Text style={styles.deleteBtnText}>✕</Text>
                    </TouchableOpacity>
                  </View>
                );
              })
            )}

            {/* Add Allocation Button */}
            <TouchableOpacity
              style={[styles.addButton, isDarkMode && { backgroundColor: '#312e81', borderColor: '#4338ca' }]}
              onPress={() => {
                allocationModalOpenRef.current = true;
                setShowAddAllocationModal(true);
              }}
            >
              <Text style={[styles.addButtonText, isDarkMode && { color: '#e0e7ff' }]}>
                + Add allocation
              </Text>
            </TouchableOpacity>

            {/* Piano vs Reale */}
            {plan && (plan.allocations?.length ?? 0) > 0 && allocations.length > 0 && (
              <>
                <Text style={[styles.sectionTitle, isDarkMode && { color: '#F9FAFB' }]}>
                  Plan vs Actual
                </Text>
                {(plan.allocations ?? []).map((pEntry: PlanAllocation, idx: number) => {
                  const ticker = pEntry.instrumentId?.ticker ?? '?';
                  const name = pEntry.instrumentId?.name ?? ticker;
                  const targetPct: number = pEntry.targetPercentage ?? 0;

                  // Find actual allocation for this instrument
                  const instrId = pEntry.instrumentId?._id;
                  const totalAlloc = allocations.reduce(
                    (s: number, a: AllocationData) => s + (a.amount ?? 0),
                    0,
                  );
                  const instrAlloc = allocations
                    .filter((a: AllocationData) => a.instrumentId?._id === instrId)
                    .reduce((s: number, a: AllocationData) => s + (a.amount ?? 0), 0);
                  const actualPct =
                    totalAlloc > 0 ? (instrAlloc / totalAlloc) * 100 : 0;

                  return (
                    <View
                      key={idx}
                      style={[styles.pianoRealeRow, isDarkMode && { backgroundColor: '#1F2937' }]}
                    >
                      <View style={styles.pianoRealeHeader}>
                        <TickerBadge ticker={ticker} />
                        <Text
                          style={[styles.pianoRealeName, isDarkMode && { color: '#F9FAFB' }]}
                          numberOfLines={1}
                        >
                          {name}
                        </Text>
                        <Text style={[styles.pianoRealeTarget, isDarkMode && { color: '#9CA3AF' }]}>
                          Target: {targetPct.toFixed(1)}%
                        </Text>
                      </View>
                      {/* Target bar (gray outline) */}
                      <View style={styles.progressTrackOuter}>
                        <View
                          style={[
                            styles.progressTarget,
                            { width: `${Math.min(targetPct, 100)}%` },
                          ]}
                        />
                        <View
                          style={[
                            styles.progressActual,
                            { width: `${Math.min(actualPct, 100)}%` },
                          ]}
                        />
                      </View>
                      <Text style={[styles.pianoRealeActual, isDarkMode && { color: '#9CA3AF' }]}>
                        Actual: {actualPct.toFixed(1)}%
                      </Text>
                    </View>
                  );
                })}
              </>
            )}
          </>
        )}
      </ScrollView>
    );
  };

  // ============================================================
  // Render: Tab "Piano"
  // ============================================================
  const renderPianoTab = () => {
    const planAllocations: PlanAllocation[] = plan?.allocations ?? [];
    const isNoData = !plan || planAllocations.length === 0;

    return (
      <ScrollView
        style={styles.tabContent}
        contentContainerStyle={{ paddingBottom: 100 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <Text style={[styles.sectionTitle, isDarkMode && { color: '#F9FAFB' }]}>
          Allocation plan
        </Text>

        {isNoData ? (
          <View style={[styles.emptyCard, isDarkMode && { backgroundColor: '#1F2937' }]}>
            <Text style={[styles.emptyText, isDarkMode && { color: '#9CA3AF' }]}>
              No plan set
            </Text>
          </View>
        ) : (
          <>
            {planAllocations.map((pEntry: PlanAllocation, idx: number) => {
              const ticker = pEntry.instrumentId?.ticker ?? '?';
              const name = pEntry.instrumentId?.name ?? ticker;
              const targetPct: number = pEntry.targetPercentage ?? 0;

              return (
                <View
                  key={idx}
                  style={[styles.allocationRow, isDarkMode && { backgroundColor: '#1F2937' }]}
                >
                  <TickerBadge ticker={ticker} />
                  <View style={styles.allocationInfo}>
                    <Text
                      style={[styles.allocationName, isDarkMode && { color: '#F9FAFB' }]}
                      numberOfLines={1}
                    >
                      {name}
                    </Text>
                    <Text
                      style={[styles.allocationMeta, isDarkMode && { color: '#9CA3AF' }]}
                    >
                      Target: {targetPct.toFixed(1)}%
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.deleteBtn}
                    onPress={() => handleDeletePlanEntry(idx)}
                  >
                    <Text style={styles.deleteBtnText}>✕</Text>
                  </TouchableOpacity>
                </View>
              );
            })}

            {/* Total percentage */}
            <View style={[styles.totalPctRow, isDarkMode && { backgroundColor: '#1F2937' }]}>
              <Text style={[styles.totalPctLabel, isDarkMode && { color: '#9CA3AF' }]}>
                Total allocated:
              </Text>
              <Text
                style={[
                  styles.totalPctValue,
                  { color: totalPlanPct > 100 ? '#EF4444' : isDarkMode ? '#F9FAFB' : '#111827' },
                ]}
              >
                {totalPlanPct.toFixed(1)}%
              </Text>
            </View>
            {totalPlanPct > 100 && (
              <Text style={styles.overAllocWarning}>
                Warning: total exceeds 100%
              </Text>
            )}
          </>
        )}

        <TouchableOpacity
          style={[styles.addButton, isDarkMode && { backgroundColor: '#312e81', borderColor: '#4338ca' }]}
          onPress={() => setShowAddPlanModal(true)}
        >
          <Text style={[styles.addButtonText, isDarkMode && { color: '#e0e7ff' }]}>
            + Add instrument
          </Text>
        </TouchableOpacity>
      </ScrollView>
    );
  };

  // ============================================================
  // Render: Tab "Portfolio"
  // ============================================================
  const renderPortfolioTab = () => (
    <ScrollView
      style={styles.tabContent}
      contentContainerStyle={{ paddingBottom: 100 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <Text style={[styles.sectionTitle, isDarkMode && { color: '#F9FAFB' }]}>
        Investment portfolio
      </Text>

      {portfolio.length === 0 ? (
        <View style={[styles.emptyCard, isDarkMode && { backgroundColor: '#1F2937' }]}>
          <Text style={[styles.emptyText, isDarkMode && { color: '#9CA3AF' }]}>
            No investments recorded
          </Text>
        </View>
      ) : (
        <>
          {portfolio.map((item: PortfolioItem, idx: number) => {
            const ticker = item.instrument?.ticker ?? '?';
            const name = item.instrument?.name ?? ticker;
            const itemCurrency = item.instrument?.currency ?? '';
            const totalAmount: number = item.totalAmount ?? 0;
            const totalQuantity: number = item.totalQuantity ?? 0;
            const estValue: number | null = item.estimatedCurrentValue ?? null;

            return (
              <View
                key={idx}
                style={[styles.portfolioRow, isDarkMode && { backgroundColor: '#1F2937' }]}
              >
                <TickerBadge ticker={ticker} />
                <View style={styles.portfolioInfo}>
                  <Text
                    style={[styles.portfolioName, isDarkMode && { color: '#F9FAFB' }]}
                    numberOfLines={1}
                  >
                    {name}
                  </Text>
                  {itemCurrency ? (
                    <Text style={[styles.portfolioMeta, isDarkMode && { color: '#9CA3AF' }]}>
                      {itemCurrency}
                    </Text>
                  ) : null}
                </View>
                <View style={styles.portfolioValues}>
                  <Text style={[styles.portfolioAmount, isDarkMode && { color: '#F9FAFB' }]}>
                    {formatCurrency(totalAmount)}
                  </Text>
                  {totalQuantity > 0 && (
                    <Text style={[styles.portfolioMeta, isDarkMode && { color: '#9CA3AF' }]}>
                      Q: {totalQuantity.toFixed(4)}
                    </Text>
                  )}
                  <Text
                    style={[
                      styles.portfolioEstValue,
                      { color: estValue != null ? '#4F46E5' : '#9CA3AF' },
                    ]}
                  >
                    Current value:{' '}
                    {estValue != null ? formatCurrency(estValue) : 'N/A'}
                  </Text>
                </View>
              </View>
            );
          })}

          {/* Total Portfolio Value */}
          <View
            style={[styles.portfolioTotalRow, isDarkMode && { backgroundColor: '#1F2937' }]}
          >
            <Text style={[styles.portfolioTotalLabel, isDarkMode && { color: '#9CA3AF' }]}>
              Total portfolio value:
            </Text>
            <Text style={[styles.portfolioTotalValue, { color: '#4F46E5' }]}>
              {formatCurrency(portfolioTotalValue)}
            </Text>
          </View>
        </>
      )}
    </ScrollView>
  );

  // ============================================================
  // Render: Add Allocation Modal
  // ============================================================
  const renderAddAllocationModal = () => (
    <Modal
      visible={showAddAllocationModal}
      transparent
      animationType="slide"
      onRequestClose={resetAllocationModal}
    >
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContainer, isDarkMode && { backgroundColor: '#1F2937' }]}>
            <Text style={[styles.modalTitle, isDarkMode && { color: '#F9FAFB' }]}>
              Add allocation
            </Text>

            {/* Instrument Search */}
            {selectedInstrument ? (
              <View style={[styles.selectedInstrumentRow, isDarkMode && { backgroundColor: '#374151' }]}>
                <TickerBadge ticker={selectedInstrument.ticker ?? '?'} />
                <Text style={[styles.selectedInstrumentText, isDarkMode && { color: '#F9FAFB' }]} numberOfLines={1}>
                  {selectedInstrument.name ?? selectedInstrument.ticker}
                </Text>
                <TouchableOpacity onPress={() => { setSelectedInstrument(null); setSearchQuery(''); }}>
                  <Text style={{ color: '#EF4444', fontWeight: '600' }}>✕</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                <TextInput
                  style={[styles.modalInput, isDarkMode && { backgroundColor: '#374151', color: '#F9FAFB' }]}
                  placeholder="Search instrument (e.g. VWCE, BTC...)"
                  placeholderTextColor={isDarkMode ? '#6B7280' : '#9CA3AF'}
                  value={searchQuery}
                  onChangeText={handleSearchChange}
                />
                {searchResults.length > 0 && (
                  <ScrollView style={styles.searchResultsContainer} nestedScrollEnabled>
                    {searchResults.map((item: InstrumentData) => (
                      <TouchableOpacity
                        key={item._id}
                        style={[styles.searchResultRow, isDarkMode && { borderBottomColor: '#374151' }]}
                        onPress={() => handleSelectInstrument(item)}
                      >
                        <TickerBadge ticker={item.ticker ?? '?'} />
                        <Text style={[styles.searchResultText, isDarkMode && { color: '#F9FAFB' }]} numberOfLines={1}>
                          {item.name ?? item.ticker}
                        </Text>
                        <Text style={[styles.searchResultType, isDarkMode && { color: '#9CA3AF' }]}>
                          {item.type ?? ''}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                )}
              </>
            )}

            {/* Amount */}
            <TextInput
              style={[styles.modalInput, isDarkMode && { backgroundColor: '#374151', color: '#F9FAFB' }]}
              placeholder={`Amount (${currency})`}
              placeholderTextColor={isDarkMode ? '#6B7280' : '#9CA3AF'}
              keyboardType="numeric"
              value={newAmount}
              onChangeText={setNewAmount}
            />

            {/* Quantity (optional) */}
            <TextInput
              style={[styles.modalInput, isDarkMode && { backgroundColor: '#374151', color: '#F9FAFB' }]}
              placeholder="Quantity (optional)"
              placeholderTextColor={isDarkMode ? '#6B7280' : '#9CA3AF'}
              keyboardType="numeric"
              value={newQuantity}
              onChangeText={setNewQuantity}
            />

            {/* Price at allocation (optional) */}
            <TextInput
              style={[styles.modalInput, isDarkMode && { backgroundColor: '#374151', color: '#F9FAFB' }]}
              placeholder="Price at time (optional)"
              placeholderTextColor={isDarkMode ? '#6B7280' : '#9CA3AF'}
              keyboardType="numeric"
              value={newPrice}
              onChangeText={setNewPrice}
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalBtnCancel, isDarkMode && { backgroundColor: '#374151' }]}
                onPress={resetAllocationModal}
              >
                <Text style={[styles.modalBtnTextCancel, isDarkMode && { color: '#D1D5DB' }]}>
                  Cancel
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalBtnSave]}
                onPress={handleSaveAllocation}
              >
                <Text style={styles.modalBtnTextSave}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );

  // ============================================================
  // Render: Add Plan Modal
  // ============================================================
  const renderAddPlanModal = () => (
    <Modal
      visible={showAddPlanModal}
      transparent
      animationType="slide"
      onRequestClose={() => setShowAddPlanModal(false)}
    >
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContainer, isDarkMode && { backgroundColor: '#1F2937' }]}>
            <Text style={[styles.modalTitle, isDarkMode && { color: '#F9FAFB' }]}>
              Add instrument to plan
            </Text>

            {/* Instrument Search */}
            {planSelectedInstrument ? (
              <View style={[styles.selectedInstrumentRow, isDarkMode && { backgroundColor: '#374151' }]}>
                <TickerBadge ticker={planSelectedInstrument.ticker ?? '?'} />
                <Text style={[styles.selectedInstrumentText, isDarkMode && { color: '#F9FAFB' }]} numberOfLines={1}>
                  {planSelectedInstrument.name ?? planSelectedInstrument.ticker}
                </Text>
                <TouchableOpacity onPress={() => { setPlanSelectedInstrument(null); setPlanSearchQuery(''); }}>
                  <Text style={{ color: '#EF4444', fontWeight: '600' }}>✕</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                <TextInput
                  style={[styles.modalInput, isDarkMode && { backgroundColor: '#374151', color: '#F9FAFB' }]}
                  placeholder="Search instrument..."
                  placeholderTextColor={isDarkMode ? '#6B7280' : '#9CA3AF'}
                  value={planSearchQuery}
                  onChangeText={handlePlanSearchChange}
                />
                {planSearchResults.length > 0 && (
                  <ScrollView style={styles.searchResultsContainer} nestedScrollEnabled>
                    {planSearchResults.map((item: InstrumentData) => (
                      <TouchableOpacity
                        key={item._id}
                        style={[styles.searchResultRow, isDarkMode && { borderBottomColor: '#374151' }]}
                        onPress={() => {
                          setPlanSelectedInstrument(item);
                          setPlanSearchQuery('');
                          setPlanSearchResults([]);
                        }}
                      >
                        <TickerBadge ticker={item.ticker ?? '?'} />
                        <Text style={[styles.searchResultText, isDarkMode && { color: '#F9FAFB' }]} numberOfLines={1}>
                          {item.name ?? item.ticker}
                        </Text>
                        <Text style={[styles.searchResultType, isDarkMode && { color: '#9CA3AF' }]}>
                          {item.type ?? ''}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                )}
              </>
            )}

            {/* Target Percentage */}
            <TextInput
              style={[styles.modalInput, isDarkMode && { backgroundColor: '#374151', color: '#F9FAFB' }]}
              placeholder="Target percentage (e.g. 30)"
              placeholderTextColor={isDarkMode ? '#6B7280' : '#9CA3AF'}
              keyboardType="numeric"
              value={pianoPct}
              onChangeText={setPianoPct}
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalBtnCancel, isDarkMode && { backgroundColor: '#374151' }]}
                onPress={() => {
                  setShowAddPlanModal(false);
                  setPlanSelectedInstrument(null);
                  setPianoPct('');
                  setPlanSearchQuery('');
                  setPlanSearchResults([]);
                }}
              >
                <Text style={[styles.modalBtnTextCancel, isDarkMode && { color: '#D1D5DB' }]}>
                  Cancel
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalBtnSave]}
                onPress={handleSavePlanEntry}
              >
                <Text style={styles.modalBtnTextSave}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );

  // ============================================================
  // Main Render
  // ============================================================
  return (
    <View style={[styles.container, isDarkMode && { backgroundColor: '#111827' }]}>
      {/* Internal Tab Bar */}
      <View style={[styles.internalTabBar, isDarkMode && { backgroundColor: '#1F2937', borderBottomColor: '#374151' }]}>
        {(['mese', 'piano', 'portfolio'] as ActiveTab[]).map(tab => (
          <TouchableOpacity
            key={tab}
            style={[
              styles.internalTab,
              activeTab === tab && styles.internalTabActive,
              activeTab === tab && isDarkMode && { borderBottomColor: '#818CF8' },
            ]}
            onPress={() => setActiveTab(tab)}
          >
            <Text
              style={[
                styles.internalTabText,
                isDarkMode && { color: '#9CA3AF' },
                activeTab === tab && styles.internalTabTextActive,
                activeTab === tab && isDarkMode && { color: '#818CF8' },
              ]}
            >
              {tab === 'mese' ? 'Month' : tab === 'piano' ? 'Plan' : 'Portfolio'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Loading Overlay */}
      {isLoading && !refreshing && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#4F46E5" />
        </View>
      )}

      {/* Tab Content */}
      {!isLoading || refreshing ? (
        <>
          {activeTab === 'mese' && renderMeseTab()}
          {activeTab === 'piano' && renderPianoTab()}
          {activeTab === 'portfolio' && renderPortfolioTab()}
        </>
      ) : null}

      {/* Modals */}
      {renderMonthPickerModal()}
      {renderYearPickerModal()}
      {renderAddAllocationModal()}
      {renderAddPlanModal()}
    </View>
  );
};

// ============================================================
// Styles
// ============================================================
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },

  // Internal Tab Bar
  internalTabBar: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  internalTab: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  internalTabActive: {
    borderBottomColor: '#4F46E5',
  },
  internalTabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
  internalTabTextActive: {
    color: '#4F46E5',
  },

  // Loading
  loadingOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Tab content
  tabContent: {
    flex: 1,
    padding: 16,
  },

  // Period selector
  periodContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
    gap: 12,
  },
  periodButton: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  periodButtonDark: {
    backgroundColor: '#1F2937',
    borderColor: '#374151',
  },
  periodButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },

  // Section title
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#111827',
    marginTop: 16,
    marginBottom: 10,
  },

  // Empty state
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 32,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
    marginBottom: 16,
  },
  emptyText: {
    color: '#6B7280',
    fontSize: 15,
    fontStyle: 'italic',
    textAlign: 'center',
  },
  emptySubText: {
    color: '#9CA3AF',
    fontSize: 13,
    marginTop: 4,
    textAlign: 'center',
  },

  // Mini cards (income/expenses/savings)
  miniCardsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  miniCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  miniCardLabel: {
    fontSize: 11,
    color: '#6B7280',
    marginBottom: 4,
    fontWeight: '500',
  },
  miniCardValue: {
    fontSize: 14,
    fontWeight: '700',
  },

  // Available to allocate banner
  availableCard: {
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    alignItems: 'center',
  },
  availableLabel: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  availableAmount: {
    fontSize: 26,
    fontWeight: '800',
  },
  availableSub: {
    fontSize: 12,
    marginTop: 4,
  },

  // Ticker Badge
  tickerBadge: {
    width: 44,
    height: 44,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
    flexShrink: 0,
  },
  tickerBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },

  // Allocation row
  allocationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 2,
  },
  allocationInfo: {
    flex: 1,
    marginRight: 8,
  },
  allocationName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  allocationMeta: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  allocationAmounts: {
    alignItems: 'flex-end',
    marginRight: 8,
  },
  allocationAmount: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
  },

  // Delete button
  deleteBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FEE2E2',
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteBtnText: {
    color: '#EF4444',
    fontSize: 12,
    fontWeight: '700',
  },

  // Add button
  addButton: {
    backgroundColor: '#E0E7FF',
    padding: 14,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#C7D2FE',
    marginTop: 8,
    marginBottom: 16,
  },
  addButtonText: {
    color: '#4F46E5',
    fontWeight: '700',
    fontSize: 14,
  },

  // Piano vs Reale
  pianoRealeRow: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 2,
  },
  pianoRealeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  pianoRealeName: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  pianoRealeTarget: {
    fontSize: 12,
    color: '#6B7280',
  },
  progressTrackOuter: {
    height: 12,
    backgroundColor: '#E5E7EB',
    borderRadius: 6,
    overflow: 'hidden',
    position: 'relative',
    marginBottom: 4,
  },
  progressTarget: {
    position: 'absolute',
    top: 0,
    left: 0,
    height: '100%',
    backgroundColor: '#D1D5DB',
    borderRadius: 6,
  },
  progressActual: {
    position: 'absolute',
    top: 0,
    left: 0,
    height: '100%',
    backgroundColor: '#4F46E5',
    borderRadius: 6,
  },
  pianoRealeActual: {
    fontSize: 11,
    color: '#6B7280',
    textAlign: 'right',
  },

  // Piano total %
  totalPctRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 14,
    marginBottom: 4,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 2,
  },
  totalPctLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
  totalPctValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  overAllocWarning: {
    color: '#EF4444',
    fontSize: 12,
    fontStyle: 'italic',
    textAlign: 'center',
    marginBottom: 8,
  },

  // Portfolio row
  portfolioRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 2,
  },
  portfolioInfo: {
    flex: 1,
    marginRight: 8,
  },
  portfolioName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  portfolioMeta: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  portfolioValues: {
    alignItems: 'flex-end',
  },
  portfolioAmount: {
    fontSize: 13,
    fontWeight: '600',
    color: '#111827',
  },
  portfolioEstValue: {
    fontSize: 12,
    marginTop: 2,
  },
  portfolioTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 16,
    marginTop: 8,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 3,
  },
  portfolioTotalLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
  portfolioTotalValue: {
    fontSize: 20,
    fontWeight: '700',
  },

  // Modals
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 36,
    maxHeight: '85%',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 16,
    textAlign: 'center',
  },
  modalInput: {
    backgroundColor: '#F3F4F6',
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
    marginBottom: 12,
    color: '#111827',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
  },
  modalBtn: {
    flex: 1,
    padding: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  modalBtnCancel: {
    backgroundColor: '#F3F4F6',
  },
  modalBtnSave: {
    backgroundColor: '#4F46E5',
  },
  modalBtnTextCancel: {
    color: '#374151',
    fontWeight: '600',
  },
  modalBtnTextSave: {
    color: '#FFFFFF',
    fontWeight: '700',
  },

  // Instrument search results
  searchResultsContainer: {
    maxHeight: 180,
    borderRadius: 10,
    backgroundColor: '#F9FAFB',
    marginBottom: 12,
  },
  searchResultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  searchResultText: {
    flex: 1,
    fontSize: 14,
    color: '#111827',
    fontWeight: '500',
  },
  searchResultType: {
    fontSize: 11,
    color: '#9CA3AF',
    marginLeft: 4,
  },

  // Selected instrument row
  selectedInstrumentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EEF2FF',
    borderRadius: 10,
    padding: 10,
    marginBottom: 12,
  },
  selectedInstrumentText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },

  // Month/Year Picker
  pickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pickerContainer: {
    backgroundColor: '#FFFFFF',
    width: '80%',
    maxHeight: '70%',
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 5,
  },
  pickerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 20,
    textAlign: 'center',
  },
  pickerItem: {
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  pickerItemActive: {
    backgroundColor: '#F3F4F6',
  },
  pickerItemText: {
    color: '#374151',
    fontSize: 17,
    textAlign: 'center',
  },
  pickerItemTextActive: {
    color: '#4F46E5',
    fontWeight: '700',
  },
  pickerClose: {
    marginTop: 16,
    backgroundColor: '#EF4444',
    padding: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  pickerCloseText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});

export default SavingsScreen;
