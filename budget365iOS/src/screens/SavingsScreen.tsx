import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
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
  KeyboardAvoidingView,
  Platform,
  Animated,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import { API_URL } from '../config';
import { warmupBackend } from '../utils/apiClient';
import { AllocationMode, deriveOnPriceChange } from '../utils/allocationCalc';

const BASE_URL = API_URL;
const ACCENT = '#c4f23a';

const TICKER_PALETTE = [
  '#c4f23a', '#7dd3fc', '#fb923c', '#f472b6', '#a78bfa',
  '#34d399', '#fbbf24', '#f87171', '#60a5fa', '#facc15',
];
const PLAN_COLORS = [
  '#c4f23a', '#7dd3fc', '#fb923c', '#a78bfa', '#34d399',
  '#f472b6', '#fbbf24', '#f87171', '#60a5fa', '#facc15',
];

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
  targetAmount?: number;
}

interface YearSummaryByInstrument {
  instrumentId: string;
  instrument: InstrumentData;
  totalAmount: number;
}

interface PlanYearSummary {
  totalSavings: number;
  totalIncome: number;
  totalExpenses: number;
  monthCount: number;
  byInstrument: YearSummaryByInstrument[];
}

interface MonthlyTarget {
  anno: number;
  mese: number;
  targetSavings: number;
}

interface PlanData {
  _id: string;
  userId: string;
  monthlyTargets: MonthlyTarget[];
  allocations: PlanAllocation[];
}

interface PortfolioItem {
  instrument: InstrumentData;
  totalAmount: number;
  totalQuantity: number;
  totalQuantitySold: number;
  currentQuantity: number;
  remainingCostBasis: number;
  estimatedCurrentValue: number | null;
  unrealizedGain: number | null;
  realizedGain: number;
}

interface SaleData {
  _id: string;
  instrumentId: InstrumentData;
  quantity: number;
  priceAtSale: number;
  proceeds: number;
  costBasis: number;
  capitalGain: number;
  savingsMonthId: string;
  createdAt: string;
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

function getTickerColor(ticker: string): string {
  let hash = 0;
  const s = (ticker || 'X').toString();
  for (let i = 0; i < s.length; i++) {
    hash = s.charCodeAt(i) + ((hash << 5) - hash);
  }
  return TICKER_PALETTE[Math.abs(hash) % TICKER_PALETTE.length];
}

const TABS: ActiveTab[] = ['mese', 'piano', 'portfolio'];
const TAB_LABELS: Record<ActiveTab, string> = {
  mese: 'Month',
  piano: 'Plan',
  portfolio: 'Portfolio',
};

// ============================================================
// SavingsScreen
// ============================================================
const SavingsScreen: React.FC<SavingsScreenProps> = ({ navigation }) => {
  const { userToken } = useAuth();
  const { currency, isDarkMode, showBalance } = useSettings();

  // ── Theme ─────────────────────────────────────────────────
  const t = useMemo(() => ({
    bg:       isDarkMode ? '#0a0a0a' : '#f6f6f4',
    surface:  isDarkMode ? '#131313' : '#ffffff',
    surface2: isDarkMode ? '#1a1a1a' : '#f0f0ec',
    line:     isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(15,15,18,0.06)',
    line2:    isDarkMode ? 'rgba(255,255,255,0.10)' : 'rgba(15,15,18,0.10)',
    text:     isDarkMode ? '#f4f4f5' : '#0c0c0c',
    text2:    isDarkMode ? '#a1a1aa' : '#5b5b66',
    text3:    isDarkMode ? '#6b6b73' : '#8b8b95',
    pos:      isDarkMode ? '#4ade80' : '#16a34a',
    neg:      isDarkMode ? '#ff6b6b' : '#dc2626',
  }), [isDarkMode]);

  // ── Tab animation ─────────────────────────────────────────
  const tabAnimRef = useRef(new Animated.Value(0));
  const [tabBarWidth, setTabBarWidth] = useState(0);

  const changeTab = (tab: ActiveTab) => {
    const idx = TABS.indexOf(tab);
    const sliderWidth = tabBarWidth > 0 ? (tabBarWidth - 8) / 3 : 0;
    Animated.spring(tabAnimRef.current, {
      toValue: idx * sliderWidth,
      useNativeDriver: true,
      tension: 200,
      friction: 22,
    }).start();
    setActiveTab(tab);
  };

  // ── State ─────────────────────────────────────────────────
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

  const [savingsMonth, setSavingsMonth] = useState<SavingsMonthData | null>(null);
  const [allocations, setAllocations] = useState<AllocationData[]>([]);
  const [sales, setSales] = useState<SaleData[]>([]);
  const [plan, setPlan] = useState<PlanData | null>(null);
  const [portfolio, setPortfolio] = useState<PortfolioItem[]>([]);

  const [isLoading, setIsLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Add Allocation Modal
  const [showAddAllocationModal, setShowAddAllocationModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<InstrumentData[]>([]);
  const [selectedInstrument, setSelectedInstrument] = useState<InstrumentData | null>(null);
  const [newAmount, setNewAmount] = useState('');
  const [newQuantity, setNewQuantity] = useState('');
  const [newPrice, setNewPrice] = useState('');
  const [isPriceFetching, setIsPriceFetching] = useState(false);
  const [allocationMode, setAllocationMode] = useState<AllocationMode>('amount');

  // Add Plan Modal
  const [showAddPlanModal, setShowAddPlanModal] = useState(false);
  const [planSearchQuery, setPlanSearchQuery] = useState('');
  const [planSearchResults, setPlanSearchResults] = useState<InstrumentData[]>([]);
  const [planSelectedInstrument, setPlanSelectedInstrument] = useState<InstrumentData | null>(null);
  const [pianoPct, setPianoPct] = useState('');
  const [pianoTargetAmount, setPianoTargetAmount] = useState('');

  // Sell modal
  const [showSellModal, setShowSellModal] = useState(false);
  const [sellItem, setSellItem] = useState<PortfolioItem | null>(null);
  const [sellQuantity, setSellQuantity] = useState('');
  const [sellPrice, setSellPrice] = useState('');
  const [isSavingSell, setIsSavingSell] = useState(false);

  // Target savings editing
  const [isEditingTargetSavings, setIsEditingTargetSavings] = useState(false);
  const [targetSavingsInput, setTargetSavingsInput] = useState('');

  // Plan tab view
  const [planView, setPlanView] = useState<'month' | 'year'>('month');
  const [planYearSummary, setPlanYearSummary] = useState<PlanYearSummary | null>(null);
  const [planMonthAllocations, setPlanMonthAllocations] = useState<AllocationData[]>([]);
  const [planMonthSavings, setPlanMonthSavings] = useState(0);

  // Refs
  const abortControllerRef = useRef<AbortController | null>(null);
  const allocationModalOpenRef = useRef(false);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const planSearchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isFocusedRef = useRef(false);

  // ── Month navigation ──────────────────────────────────────
  const prevMonth = () => {
    if (selectedMonth === 0) {
      setSelectedMonth(11);
      setSelectedYear(y => y - 1);
    } else {
      setSelectedMonth(m => m - 1);
    }
  };
  const nextMonth = () => {
    if (selectedMonth === 11) {
      setSelectedMonth(0);
      setSelectedYear(y => y + 1);
    } else {
      setSelectedMonth(m => m + 1);
    }
  };

  // ============================================================
  // Data Loading
  // ============================================================
  const loadData = async (signal: AbortSignal) => {
    if (!userToken) return;
    setIsLoading(true);
    try {
      await warmupBackend();
      if (signal?.aborted) return;

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

        // Call ensure-month for current and past months — backend recomputes from
        // live transactions so stale cached DB values get corrected on every view.
        const now = new Date();
        const isFuture =
          selectedYear > now.getFullYear() ||
          (selectedYear === now.getFullYear() && selectedMonth > now.getMonth());
        if (!isFuture) {
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

        setSavingsMonth(month);

        if (month) {
          const [allocRes, salesRes] = await Promise.all([
            fetch(`${BASE_URL}/api/savings/months/${month._id}/allocations`, {
              headers: { Authorization: `Bearer ${userToken}` }, signal,
            }),
            fetch(`${BASE_URL}/api/savings/months/${month._id}/sales`, {
              headers: { Authorization: `Bearer ${userToken}` }, signal,
            }),
          ]);
          if (signal.aborted) return;
          if (allocRes.ok) {
            const allocJson = await allocRes.json();
            if (!signal.aborted) setAllocations(allocJson.data ?? []);
          }
          if (salesRes.ok) {
            const salesJson = await salesRes.json();
            if (!signal.aborted) setSales(salesJson.data ?? []);
          }
        } else {
          setAllocations([]);
          setSales([]);
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

        // Month data for plan tab (actual vs target)
        const nowP = new Date();
        const isFutureP =
          selectedYear > nowP.getFullYear() ||
          (selectedYear === nowP.getFullYear() && selectedMonth > nowP.getMonth());
        if (!isFutureP) {
          const ensureRes = await fetch(`${BASE_URL}/api/savings/ensure-month`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${userToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ anno: selectedYear, mese: selectedMonth }),
            signal,
          });
          if (!signal.aborted && ensureRes.ok) {
            const ensureJson = await ensureRes.json();
            const monthData = ensureJson.data;
            if (!signal.aborted && monthData) {
              setPlanMonthSavings(monthData.savings ?? 0);
              const allocRes = await fetch(
                `${BASE_URL}/api/savings/months/${monthData._id}/allocations`,
                { headers: { Authorization: `Bearer ${userToken}` }, signal },
              );
              if (!signal.aborted && allocRes.ok) {
                const allocJson = await allocRes.json();
                if (!signal.aborted) setPlanMonthAllocations(allocJson.data ?? []);
              }
            }
          }
        } else {
          setPlanMonthSavings(0);
          setPlanMonthAllocations([]);
        }

        // Year summary
        const yearRes = await fetch(`${BASE_URL}/api/savings/year-summary?year=${selectedYear}`, {
          headers: { Authorization: `Bearer ${userToken}` },
          signal,
        });
        if (!signal.aborted && yearRes.ok) {
          const yearJson = await yearRes.json();
          if (!signal.aborted) setPlanYearSummary(yearJson.data ?? null);
        }
      }

      if (activeTab === 'portfolio') {
        const portRes = await fetch(
          `${BASE_URL}/api/savings/portfolio?anno=${selectedYear}&mese=${selectedMonth}`,
          { headers: { Authorization: `Bearer ${userToken}` }, signal },
        );
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
  }, [activeTab, selectedMonth, selectedYear, planView]);

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
    if (!text.trim()) { setSearchResults([]); return; }
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
    setNewPrice('');
    setIsPriceFetching(true);

    fetch(`${BASE_URL}/api/instruments/${encodeURIComponent(item.ticker)}/price`, {
      headers: { Authorization: `Bearer ${userToken}` },
    })
      .then(res => res.ok ? res.json() : null)
      .then(json => {
        const price = json?.data?.price;
        if (allocationModalOpenRef.current) {
          setIsPriceFetching(false);
          if (price != null) setNewPrice(prev => (prev === '' ? price.toFixed(2) : prev));
        }
      })
      .catch(() => { if (allocationModalOpenRef.current) setIsPriceFetching(false); });
  };

  // ============================================================
  // Live Calculation Handlers
  // ============================================================
  const handleAmountChange = (text: string) => {
    setNewAmount(text);
    const a = parseFloat(text);
    const p = parseFloat(newPrice);
    const q = parseFloat(newQuantity);
    if (!isNaN(a) && a > 0) {
      if (!isNaN(p) && p > 0) setNewQuantity((a / p).toFixed(6));
      else if (!isNaN(q) && q > 0) setNewPrice((a / q).toFixed(2));
    }
  };

  const handleQuantityChange = (text: string) => {
    setNewQuantity(text);
    const q = parseFloat(text);
    const a = parseFloat(newAmount);
    const p = parseFloat(newPrice);
    if (allocationMode === 'amount') {
      if (!isNaN(q) && q > 0 && !isNaN(a) && a > 0) setNewPrice((a / q).toFixed(2));
      else if (!isNaN(q) && !isNaN(p) && p > 0) setNewAmount((q * p).toFixed(2));
    } else {
      if (!isNaN(q) && !isNaN(p) && p > 0) setNewAmount((q * p).toFixed(2));
      else if (!isNaN(q) && q > 0 && !isNaN(a) && a > 0) setNewPrice((a / q).toFixed(2));
    }
  };

  const handlePriceChange = (text: string) => {
    setNewPrice(text);
    const result = deriveOnPriceChange(newAmount, newQuantity, text, allocationMode);
    if (result !== null) {
      if (result.field === 'quantity') setNewQuantity(result.value);
      else setNewAmount(result.value);
    }
  };

  // ============================================================
  // Instrument Search — Plan Modal
  // ============================================================
  const handlePlanSearchChange = (text: string) => {
    setPlanSearchQuery(text);
    if (planSearchDebounceRef.current) clearTimeout(planSearchDebounceRef.current);
    if (!text.trim()) { setPlanSearchResults([]); return; }
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
  // Reset / Save / Delete — Allocation
  // ============================================================
  const resetAllocationModal = () => {
    allocationModalOpenRef.current = false;
    setShowAddAllocationModal(false);
    setSelectedInstrument(null);
    setNewAmount('');
    setNewQuantity('');
    setNewPrice('');
    setIsPriceFetching(false);
    setSearchQuery('');
    setSearchResults([]);
    setAllocationMode('amount');
  };

  const handleSaveAllocation = async () => {
    if (!selectedInstrument || !newAmount) return;
    const now = new Date();
    const isFuture =
      selectedYear > now.getFullYear() ||
      (selectedYear === now.getFullYear() && selectedMonth > now.getMonth());
    if (isFuture) {
      Alert.alert('Error', 'Cannot add allocations for future months');
      return;
    }
    const parsedAmount = parseFloat(newAmount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      Alert.alert('Error', 'Please enter a valid amount greater than 0');
      return;
    }
    if (newQuantity) {
      const q = parseFloat(newQuantity);
      if (isNaN(q) || q <= 0) { Alert.alert('Error', 'Quantity must be greater than 0'); return; }
    }
    if (newPrice) {
      const p = parseFloat(newPrice);
      if (isNaN(p) || p <= 0) { Alert.alert('Error', 'Price must be greater than 0'); return; }
    }
    try {
      let monthId = savingsMonth?._id;
      if (!monthId) {
        const ensureRes = await fetch(`${BASE_URL}/api/savings/ensure-month`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${userToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ anno: selectedYear, mese: selectedMonth }),
        });
        if (!ensureRes.ok) { Alert.alert('Error', 'Could not prepare month record'); return; }
        const ensureJson = await ensureRes.json();
        monthId = ensureJson.data?._id;
        if (!monthId) { Alert.alert('Error', 'Could not get month ID'); return; }
      }

      const body: any = { instrumentId: selectedInstrument._id, amount: parsedAmount };
      if (newQuantity) body.quantity = parseFloat(newQuantity);
      if (newPrice) body.priceAtAllocation = parseFloat(newPrice);
      const res = await fetch(
        `${BASE_URL}/api/savings/months/${monthId}/allocations`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${userToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        },
      );
      if (res.ok) { resetAllocationModal(); reloadData(); }
      else {
        const errJson = await res.json().catch(() => ({}));
        Alert.alert('Error', errJson.error ?? 'Could not add allocation');
      }
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'Network error');
    }
  };

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
              { method: 'DELETE', headers: { Authorization: `Bearer ${userToken}` } },
            );
            if (!response.ok) { Alert.alert('Error', 'Could not delete allocation.'); return; }
            reloadData();
          } catch (e) { console.error(e); }
        },
      },
    ]);
  };

  // ============================================================
  // Sell
  // ============================================================
  const handleOpenSell = (item: PortfolioItem) => {
    setSellItem(item);
    setSellQuantity('');
    setSellPrice(item.instrument?.lastPrice != null ? String(item.instrument.lastPrice) : '');
    setShowSellModal(true);
  };

  const handleConfirmSell = async () => {
    if (!sellItem) return;
    const qty = parseFloat(sellQuantity);
    const price = parseFloat(sellPrice);
    if (!qty || qty <= 0 || qty > (sellItem.currentQuantity ?? 0) + 1e-9) {
      Alert.alert('Error', `Quantity must be between 0 and ${sellItem.currentQuantity}`);
      return;
    }
    if (!price || price <= 0) {
      Alert.alert('Error', 'Enter a valid sale price');
      return;
    }
    setIsSavingSell(true);
    try {
      // Ensure month exists to get savingsMonthId
      const ensureRes = await fetch(`${BASE_URL}/api/savings/ensure-month`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${userToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ anno: selectedYear, mese: selectedMonth }),
      });
      if (!ensureRes.ok) { Alert.alert('Error', 'Could not prepare month record'); return; }
      const ensureJson = await ensureRes.json();
      const monthId = ensureJson.data?._id;
      if (!monthId) { Alert.alert('Error', 'Could not get month ID'); return; }

      const saleRes = await fetch(`${BASE_URL}/api/savings/months/${monthId}/sales`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${userToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instrumentId: sellItem.instrument._id,
          quantity: qty,
          priceAtSale: price,
        }),
      });
      if (!saleRes.ok) {
        const errJson = await saleRes.json().catch(() => ({}));
        Alert.alert('Error', errJson.error ?? 'Could not save sale');
        return;
      }
      setShowSellModal(false);
      setSellItem(null);
      reloadData();
    } catch (e) {
      console.error('handleConfirmSell error:', e);
      Alert.alert('Error', 'Network error');
    } finally {
      setIsSavingSell(false);
    }
  };

  const handleDeleteSale = (saleId: string, monthId: string) => {
    Alert.alert('Delete sale', 'Delete this sale record?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            const res = await fetch(
              `${BASE_URL}/api/savings/months/${monthId}/sales/${saleId}`,
              { method: 'DELETE', headers: { Authorization: `Bearer ${userToken}` } },
            );
            if (!res.ok) { Alert.alert('Error', 'Could not delete sale.'); return; }
            reloadData();
          } catch (e) { console.error(e); }
        },
      },
    ]);
  };

  // ============================================================
  // Save / Delete — Plan
  // ============================================================
  const handleSavePlanEntry = async () => {
    if (!planSelectedInstrument || !pianoPct) return;
    const pct = parseFloat(pianoPct);
    if (isNaN(pct) || pct <= 0) { Alert.alert('Error', 'Please enter a valid percentage'); return; }
    const currentAllocations: any[] = plan?.allocations ?? [];
    const newEntry: any = { instrumentId: planSelectedInstrument._id, targetPercentage: pct };
    if (pianoTargetAmount) {
      const amt = parseFloat(pianoTargetAmount);
      if (!isNaN(amt) && amt > 0) newEntry.targetAmount = amt;
    }
    await savePlan([...currentAllocations, newEntry]);
    setShowAddPlanModal(false);
    setPlanSelectedInstrument(null);
    setPianoPct('');
    setPianoTargetAmount('');
    setPlanSearchQuery('');
    setPlanSearchResults([]);
    reloadData();
  };

  const handleDeletePlanEntry = async (index: number) => {
    const currentAllocations: any[] = plan?.allocations ?? [];
    await savePlan(currentAllocations.filter((_: any, i: number) => i !== index));
    reloadData();
  };

  const savePlan = async (allocationsArr: any[]) => {
    try {
      const response = await fetch(`${BASE_URL}/api/savings/plan`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${userToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ allocations: allocationsArr }),
      });
      if (!response.ok) Alert.alert('Error', 'Could not save plan.');
    } catch (e) { console.error('savePlan error:', e); }
  };

  const handleConfirmTargetSavings = async () => {
    const val = targetSavingsInput.trim() === '' ? null : parseFloat(targetSavingsInput);
    if (val !== null && (isNaN(val) || val < 0)) {
      Alert.alert('Error', 'Please enter a valid amount');
      return;
    }
    setIsEditingTargetSavings(false);
    try {
      const res = await fetch(`${BASE_URL}/api/savings/plan/monthly-target`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${userToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ anno: selectedYear, mese: selectedMonth, targetSavings: val }),
      });
      if (!res.ok) Alert.alert('Error', 'Could not save savings goal.');
    } catch (e) { console.error('handleConfirmTargetSavings error:', e); }
    reloadData();
  };

  // ============================================================
  // Helpers
  // ============================================================
  const formatCurrency = (val: number) =>
    showBalance ? `${currency}${Math.abs(val).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '****';

  const formatReturnAbs = (abs: number): string => {
    if (!showBalance) return '****';
    const sign = abs >= 0 ? '+' : '−';
    return `${sign}${currency}${Math.abs(abs).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatReturnPct = (pct: number): string => {
    if (!showBalance) return '****';
    const sign = pct >= 0 ? '+' : '';
    return `${sign}${pct.toFixed(1)}%`;
  };

  const totalPlanPct = (plan?.allocations ?? []).reduce(
    (sum: number, a: PlanAllocation) => sum + (a.targetPercentage ?? 0), 0,
  );

  const portfolioTotalInvested = portfolio.reduce(
    (sum: number, item: PortfolioItem) => sum + (item.totalAmount ?? 0), 0,
  );
  const pricedItems = portfolio.filter(
    (item: PortfolioItem) => item.estimatedCurrentValue != null,
  );
  const portfolioTotalCurrentValue = pricedItems.reduce(
    (sum: number, item: PortfolioItem) => sum + (item.estimatedCurrentValue as number), 0,
  );
  const portfolioTotalPricedCostBasis = pricedItems.reduce(
    (sum: number, item: PortfolioItem) => sum + (item.remainingCostBasis ?? 0), 0,
  );
  const portfolioTotalUnrealizedGain = portfolioTotalCurrentValue - portfolioTotalPricedCostBasis;
  const portfolioTotalRealizedGain = portfolio.reduce(
    (sum: number, item: PortfolioItem) => sum + (item.realizedGain ?? 0), 0,
  );
  const portfolioTotalReturnAbs = portfolioTotalUnrealizedGain;
  const portfolioTotalReturnPct =
    portfolioTotalPricedCostBasis > 0
      ? (portfolioTotalUnrealizedGain / portfolioTotalPricedCostBasis) * 100
      : null;

  // ============================================================
  // TickerChip
  // ============================================================
  const TickerChip = ({
    ticker,
    size = 40,
    color,
  }: {
    ticker: string;
    size?: number;
    color?: string;
  }) => (
    <View
      style={[
        styles.tickerChip,
        {
          width: size,
          height: size,
          borderRadius: Math.round(size * 0.25),
          backgroundColor: color || getTickerColor(ticker),
        },
      ]}
    >
      <Text style={[styles.tickerChipText, { fontSize: size <= 32 ? 9 : 10 }]}>
        {(ticker || '?').toUpperCase().slice(0, 5)}
      </Text>
    </View>
  );

  // ============================================================
  // Render: Month tab
  // ============================================================
  const renderMeseTab = () => {
    const income = savingsMonth?.income ?? 0;
    const expenses = savingsMonth?.expenses ?? 0;
    const savings = savingsMonth?.savings ?? income - expenses;
    const totalAlloc = allocations.reduce((s, a) => s + (a.amount ?? 0), 0);
    const available = savings - totalAlloc;
    const allocPct = savings > 0 ? Math.min((totalAlloc / savings) * 100, 100) : 0;
    const maxAlloc = allocations.length ? Math.max(...allocations.map(a => a.amount)) : 1;

    return (
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[styles.tabContent, { paddingBottom: 120 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={ACCENT} />
        }
      >
        {savingsMonth === null ? (
          <View style={[styles.emptyCard, { backgroundColor: t.surface, borderColor: t.line }]}>
            <Text style={[styles.emptyText, { color: t.text3 }]}>No data for this month</Text>
            <Text style={[styles.emptySubText, { color: t.text3 }]}>
              {MONTHS[selectedMonth]} {selectedYear}
            </Text>
          </View>
        ) : (
          <>
            {/* ── Hero ── */}
            <View style={[styles.hero, { backgroundColor: t.surface, borderColor: t.line }]}>
              <Text style={[styles.heroEyebrow, { color: t.text3 }]}>
                Savings · {MONTHS[selectedMonth]} {selectedYear}
              </Text>
              <Text style={[styles.heroAmount, { color: t.text }]}>
                {formatCurrency(savings)}
              </Text>
              <View style={[styles.flowRow, { backgroundColor: t.surface2 }]}>
                <View style={styles.flowCell}>
                  <View style={[styles.flowDot, { backgroundColor: t.pos }]} />
                  <View>
                    <Text style={[styles.flowLabel, { color: t.text3 }]}>INCOME</Text>
                    <Text style={[styles.flowVal, { color: t.pos }]}>{formatCurrency(income)}</Text>
                  </View>
                </View>
                <View style={[styles.flowDivider, { backgroundColor: t.line2 }]} />
                <View style={styles.flowCell}>
                  <View style={[styles.flowDot, { backgroundColor: t.neg }]} />
                  <View>
                    <Text style={[styles.flowLabel, { color: t.text3 }]}>EXPENSES</Text>
                    <Text style={[styles.flowVal, { color: t.neg }]}>{formatCurrency(expenses)}</Text>
                  </View>
                </View>
              </View>
            </View>

            {/* ── Allocated card ── */}
            <View style={[styles.card, { backgroundColor: t.surface, borderColor: t.line }]}>
              <View style={styles.rowBetween}>
                <Text style={[styles.cardLabel, { color: t.text2 }]}>Allocated</Text>
                <Text style={[styles.cardPct, { color: ACCENT }]}>{allocPct.toFixed(0)}%</Text>
              </View>
              <View style={[styles.track, { backgroundColor: t.surface2 }]}>
                <View style={[styles.trackFill, { width: `${allocPct}%` as any, backgroundColor: ACCENT }]} />
              </View>
              <View style={[styles.rowBetween, { marginTop: 12 }]}>
                <View>
                  <Text style={[styles.microLabel, { color: t.text3 }]}>INVESTED</Text>
                  <Text style={[styles.microVal, { color: t.text }]}>{formatCurrency(totalAlloc)}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={[styles.microLabel, { color: t.text3 }]}>AVAILABLE</Text>
                  <Text style={[styles.microVal, { color: available >= 0 ? ACCENT : t.neg }]}>
                    {showBalance
                      ? `${available < 0 ? '−' : ''}${currency}${Math.abs(available).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                      : '****'}
                  </Text>
                </View>
              </View>
            </View>

            {/* ── Allocations ── */}
            <View style={[styles.sectionHead, { marginTop: 4 }]}>
              <Text style={[styles.sectionTitle, { color: t.text3 }]}>ALLOCATIONS</Text>
              <Text style={[styles.sectionMeta, { color: t.text3 }]}>{allocations.length} items</Text>
            </View>

            {allocations.length === 0 ? (
              <Text style={[styles.emptyText, { color: t.text3, textAlign: 'center', marginVertical: 8 }]}>
                No allocations yet
              </Text>
            ) : (
              allocations.map(alloc => {
                const ticker = alloc.instrumentId?.ticker ?? '?';
                const name = alloc.instrumentId?.name ?? ticker;
                const type = alloc.instrumentId?.type ?? '';
                const qty = alloc.quantity;
                const barW = maxAlloc > 0 ? (alloc.amount / maxAlloc) * 100 : 0;
                const pctOfSavings = savings > 0 ? (alloc.amount / savings) * 100 : 0;
                return (
                  <View key={alloc._id} style={[styles.allocRow, { backgroundColor: t.surface, borderColor: t.line }]}>
                    <TickerChip ticker={ticker} />
                    <View style={styles.allocMid}>
                      <View style={styles.rowBetween}>
                        <Text style={[styles.allocName, { color: t.text }]} numberOfLines={1}>
                          {name}
                        </Text>
                        <Text style={[styles.allocAmt, { color: t.text }]}>
                          {formatCurrency(alloc.amount)}
                        </Text>
                      </View>
                      <View style={[styles.allocBar, { backgroundColor: t.surface2 }]}>
                        <View style={[styles.allocBarFill, { width: `${barW}%` as any, backgroundColor: ACCENT }]} />
                      </View>
                      <View style={styles.rowBetween}>
                        <Text style={[styles.allocMeta, { color: t.text3 }]}>
                          {ticker}
                          {type ? ` · ${type}` : ''}
                          {qty ? ` · ×${qty}` : ''}
                        </Text>
                        <Text style={[styles.allocPct, { color: t.text2 }]}>
                          {pctOfSavings.toFixed(1)}% of savings
                        </Text>
                      </View>
                    </View>
                    <TouchableOpacity
                      style={styles.deleteBtn}
                      onPress={() => handleDeleteAllocation(alloc._id)}
                    >
                      <Text style={[styles.deleteBtnText, { color: t.text3 }]}>✕</Text>
                    </TouchableOpacity>
                  </View>
                );
              })
            )}

            {/* ── Ghost add button ── */}
            <TouchableOpacity
              style={[styles.ghostBtn, { borderColor: t.line2 }]}
              onPress={() => {
                allocationModalOpenRef.current = true;
                setShowAddAllocationModal(true);
              }}
            >
              <Text style={[styles.ghostBtnText, { color: t.text2 }]}>+ Add allocation</Text>
            </TouchableOpacity>

            {/* ── Sales ── */}
            {sales.length > 0 && (
              <>
                <View style={[styles.sectionHead, { marginTop: 16 }]}>
                  <Text style={[styles.sectionTitle, { color: t.text3 }]}>SALES</Text>
                  <Text style={[styles.sectionMeta, { color: t.text3 }]}>{sales.length} items</Text>
                </View>
                {sales.map(sale => {
                  const ticker = sale.instrumentId?.ticker ?? '?';
                  const name = sale.instrumentId?.name ?? ticker;
                  const gain = sale.capitalGain ?? 0;
                  const gainPos = gain >= 0;
                  return (
                    <View
                      key={sale._id}
                      style={[
                        styles.allocRow,
                        { backgroundColor: t.surface, borderColor: t.line, borderLeftWidth: 3, borderLeftColor: gainPos ? t.pos : t.neg },
                      ]}
                    >
                      <TickerChip ticker={ticker} />
                      <View style={styles.allocMid}>
                        <View style={styles.rowBetween}>
                          <Text style={[styles.allocName, { color: t.text }]} numberOfLines={1}>
                            {name}
                          </Text>
                          <Text style={[styles.allocAmt, { color: gainPos ? t.pos : t.neg }]}>
                            {formatReturnAbs(gain)}
                          </Text>
                        </View>
                        <View style={styles.rowBetween}>
                          <Text style={[styles.allocMeta, { color: t.text3 }]}>
                            ×{sale.quantity} @ {currency}{sale.priceAtSale?.toFixed(2)}
                          </Text>
                          <Text style={[styles.allocPct, { color: t.text2 }]}>
                            {formatCurrency(sale.proceeds)} proceeds
                          </Text>
                        </View>
                      </View>
                      <TouchableOpacity
                        style={styles.deleteBtn}
                        onPress={() => handleDeleteSale(sale._id, sale.savingsMonthId)}
                      >
                        <Text style={[styles.deleteBtnText, { color: t.text3 }]}>✕</Text>
                      </TouchableOpacity>
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
  // Render: Plan tab
  // ============================================================
  const renderPianoTab = () => {
    const planAllocations: PlanAllocation[] = plan?.allocations ?? [];
    const pctColor =
      totalPlanPct === 100 ? ACCENT : totalPlanPct > 100 ? t.neg : t.text;

    const activeTotalAllocAmount =
      planView === 'month'
        ? planMonthAllocations.reduce((s, a) => s + (a.amount ?? 0), 0)
        : (planYearSummary?.byInstrument.reduce((s, b) => s + b.totalAmount, 0) ?? 0);

    // Savings goal computed values — per month
    const monthlyTargets = plan?.monthlyTargets ?? [];
    const currentMonthTarget = monthlyTargets.find(
      m => m.anno === selectedYear && m.mese === selectedMonth,
    );
    const planTargetSavings = currentMonthTarget?.targetSavings ?? null;

    // Year view: sum of all targets set for selectedYear
    const yearTargets = monthlyTargets.filter(m => m.anno === selectedYear);
    const yearTargetTotal = yearTargets.length > 0
      ? yearTargets.reduce((s, m) => s + m.targetSavings, 0)
      : null;

    const actualSavingsForGoal = planView === 'month'
      ? planMonthSavings
      : (planYearSummary?.totalSavings ?? 0);
    const displayGoalTarget = planView === 'year' ? yearTargetTotal : planTargetSavings;
    const goalPct = displayGoalTarget != null && displayGoalTarget > 0
      ? Math.min((actualSavingsForGoal / displayGoalTarget) * 100, 100) : 0;
    const goalMet = displayGoalTarget != null && actualSavingsForGoal >= displayGoalTarget;

    return (
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[styles.tabContent, { paddingBottom: 120 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={ACCENT} />
        }
      >
        {/* ── Month / Year toggle ── */}
        <View style={[styles.planViewToggle, { backgroundColor: t.surface2 }]}>
          {(['month', 'year'] as const).map(v => (
            <TouchableOpacity
              key={v}
              style={[
                styles.planViewBtn,
                planView === v && { backgroundColor: t.surface },
              ]}
              onPress={() => {
                if (isEditingTargetSavings) setIsEditingTargetSavings(false);
                setPlanView(v);
              }}
            >
              <Text style={[styles.planViewBtnText, { color: planView === v ? t.text : t.text3 }]}>
                {v === 'month' ? 'Month' : 'Year'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Savings goal card ── */}
        <View style={[styles.card, { backgroundColor: t.surface, borderColor: isEditingTargetSavings ? ACCENT : t.line }]}>
          <Text style={[styles.microLabel, { color: t.text3 }]}>
            {planView === 'year' ? 'ANNUAL SAVINGS GOAL' : 'MONTHLY SAVINGS GOAL'}
          </Text>

          {isEditingTargetSavings ? (
            <>
              <View style={[styles.field, { backgroundColor: t.surface2, borderColor: ACCENT, marginTop: 14, marginBottom: 0 }]}>
                <Text style={[styles.fieldLabel, { color: t.text3, backgroundColor: t.surface2 }]}>
                  {planView === 'year' ? 'Annual goal' : 'Monthly goal'}
                </Text>
                <Text style={[styles.fieldPrefix, { color: t.text3 }]}>{currency}</Text>
                <TextInput
                  style={[styles.fieldInput, { color: t.text }]}
                  placeholder="0.00"
                  placeholderTextColor={t.text3}
                  keyboardType="numeric"
                  value={targetSavingsInput}
                  onChangeText={setTargetSavingsInput}
                  autoFocus
                  returnKeyType="done"
                  onSubmitEditing={handleConfirmTargetSavings}
                />
              </View>
              <View style={[styles.sheetActions, { marginTop: 14 }]}>
                <TouchableOpacity
                  style={[styles.sheetCancel, { backgroundColor: t.surface2 }]}
                  onPress={() => setIsEditingTargetSavings(false)}
                >
                  <Text style={[styles.sheetCancelText, { color: t.text }]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.sheetSave, { backgroundColor: ACCENT }]}
                  onPress={handleConfirmTargetSavings}
                >
                  <Text style={styles.sheetSaveText}>Save</Text>
                </TouchableOpacity>
              </View>
            </>
          ) : displayGoalTarget != null ? (
            <>
              <View style={[styles.rowBetween, { marginTop: 10 }]}>
                <Text style={[styles.heroAmount, { fontSize: 32, marginBottom: 0, color: t.text }]}>
                  {formatCurrency(displayGoalTarget)}
                </Text>
                {planView === 'month' ? (
                  <TouchableOpacity
                    style={{ paddingHorizontal: 14, paddingVertical: 8, backgroundColor: t.surface2, borderRadius: 8 }}
                    onPress={() => {
                      setTargetSavingsInput(planTargetSavings!.toString());
                      setIsEditingTargetSavings(true);
                    }}
                  >
                    <Text style={{ fontSize: 13, fontWeight: '600', color: t.text2 }}>Edit</Text>
                  </TouchableOpacity>
                ) : (
                  <Text style={{ fontSize: 11, color: t.text3, flexShrink: 1, textAlign: 'right' }}>
                    {yearTargets.length} month{yearTargets.length !== 1 ? 's' : ''} planned
                  </Text>
                )}
              </View>
              <View style={[styles.track, { backgroundColor: t.surface2, marginTop: 14 }]}>
                <View style={[styles.trackFill, { width: `${goalPct}%` as any, backgroundColor: goalMet ? t.pos : ACCENT }]} />
              </View>
              <View style={[styles.rowBetween, { marginTop: 8 }]}>
                <Text style={[styles.microLabel, { color: t.text3 }]}>
                  {planView === 'year' ? 'SAVED THIS YEAR' : 'SAVED THIS MONTH'}
                </Text>
                <Text style={{ fontSize: 12, fontWeight: '600', color: goalMet ? t.pos : t.text2 }}>
                  {formatCurrency(actualSavingsForGoal)} / {formatCurrency(displayGoalTarget)} · {goalPct.toFixed(0)}%
                </Text>
              </View>
            </>
          ) : planView === 'month' ? (
            <TouchableOpacity
              style={{
                marginTop: 12,
                paddingVertical: 14,
                alignItems: 'center',
                backgroundColor: t.surface2,
                borderRadius: 10,
                borderWidth: 1,
                borderStyle: 'dashed',
                borderColor: t.line2,
              }}
              onPress={() => {
                setTargetSavingsInput('');
                setIsEditingTargetSavings(true);
              }}
            >
              <Text style={{ fontSize: 14, fontWeight: '600', color: t.text3 }}>+ Set savings goal</Text>
            </TouchableOpacity>
          ) : (
            <Text style={{ fontSize: 13, color: t.text3, marginTop: 10, textAlign: 'center' }}>
              No monthly goals set for {selectedYear}.{'\n'}Switch to Month view to add them.
            </Text>
          )}
        </View>

        {/* ── Year hero ── */}
        {planView === 'year' && planYearSummary && planYearSummary.monthCount > 0 && (
          <View style={[styles.hero, { backgroundColor: t.surface, borderColor: t.line }]}>
            <Text style={[styles.heroEyebrow, { color: t.text3 }]}>
              Year savings · {selectedYear}
            </Text>
            <Text style={[styles.heroAmount, { color: t.text }]}>
              {formatCurrency(planYearSummary.totalSavings)}
            </Text>
            <View style={[styles.flowRow, { backgroundColor: t.surface2 }]}>
              <View style={styles.flowCell}>
                <View style={[styles.flowDot, { backgroundColor: t.pos }]} />
                <View>
                  <Text style={[styles.flowLabel, { color: t.text3 }]}>INCOME</Text>
                  <Text style={[styles.flowVal, { color: t.pos }]}>
                    {formatCurrency(planYearSummary.totalIncome)}
                  </Text>
                </View>
              </View>
              <View style={[styles.flowDivider, { backgroundColor: t.line2 }]} />
              <View style={styles.flowCell}>
                <View style={[styles.flowDot, { backgroundColor: t.neg }]} />
                <View>
                  <Text style={[styles.flowLabel, { color: t.text3 }]}>EXPENSES</Text>
                  <Text style={[styles.flowVal, { color: t.neg }]}>
                    {formatCurrency(planYearSummary.totalExpenses)}
                  </Text>
                </View>
              </View>
            </View>
          </View>
        )}

        {/* ── Plan summary circle + stacked bar ── */}
        {planAllocations.length > 0 && (
          <View
            style={[
              styles.card,
              {
                backgroundColor: t.surface,
                borderColor: t.line,
                alignItems: 'center',
                paddingVertical: 24,
                gap: 16,
              },
            ]}
          >
            <View style={[styles.planCircle, { borderColor: pctColor }]}>
              <Text style={[styles.planCirclePct, { color: pctColor }]}>
                {totalPlanPct.toFixed(0)}%
              </Text>
              <Text style={[styles.planCircleSub, { color: t.text3 }]}>
                {planAllocations.length} instruments
              </Text>
            </View>
            <View style={[styles.stackedBar, { backgroundColor: t.surface2 }]}>
              {planAllocations.map((p, i) => (
                <View
                  key={i}
                  style={{ flex: p.targetPercentage, backgroundColor: PLAN_COLORS[i % PLAN_COLORS.length] }}
                />
              ))}
            </View>
          </View>
        )}

        {/* ── Section head ── */}
        <View style={[styles.sectionHead, { marginTop: planAllocations.length > 0 ? 4 : 0 }]}>
          <Text style={[styles.sectionTitle, { color: t.text3 }]}>TARGET ALLOCATION</Text>
        </View>

        {planAllocations.length === 0 ? (
          <View style={[styles.emptyCard, { backgroundColor: t.surface, borderColor: t.line }]}>
            <Text style={[styles.emptyText, { color: t.text3 }]}>No plan set</Text>
          </View>
        ) : (
          planAllocations.map((p, idx) => {
            const ticker = p.instrumentId?.ticker ?? '?';
            const name = p.instrumentId?.name ?? ticker;
            const target = p.targetPercentage ?? 0;
            const instrId = p.instrumentId?._id;
            const segColor = PLAN_COLORS[idx % PLAN_COLORS.length];

            // Actual allocated amount for this instrument (month or year)
            let instrAllocAmount = 0;
            if (planView === 'month') {
              instrAllocAmount = planMonthAllocations
                .filter(a => a.instrumentId?._id === instrId)
                .reduce((s, a) => s + (a.amount ?? 0), 0);
            } else {
              const yearEntry = planYearSummary?.byInstrument.find(
                b => b.instrumentId.toString() === instrId,
              );
              instrAllocAmount = yearEntry?.totalAmount ?? 0;
            }

            const actualPct =
              activeTotalAllocAmount > 0 ? (instrAllocAmount / activeTotalAllocAmount) * 100 : 0;
            const drift = actualPct - target;
            const driftColor =
              Math.abs(drift) < 0.5 ? t.pos : drift > 0 ? '#f59e0b' : t.text3;

            // Target amount display
            const monthlyTarget = p.targetAmount ?? null;
            const displayTarget =
              monthlyTarget != null
                ? planView === 'year'
                  ? monthlyTarget * 12
                  : monthlyTarget
                : null;
            const targetAmountPct =
              displayTarget != null && displayTarget > 0
                ? Math.min((instrAllocAmount / displayTarget) * 100, 100)
                : null;

            return (
              <View key={idx} style={[styles.planRow, { backgroundColor: t.surface, borderColor: t.line }]}>
                <View style={styles.planRowHead}>
                  <TickerChip ticker={ticker} size={36} color={segColor} />
                  <Text style={[styles.planName, { color: t.text }]} numberOfLines={1}>
                    {name}
                  </Text>
                  <Text style={[styles.planTarget, { color: t.text }]}>{target}%</Text>
                  <TouchableOpacity
                    style={{ padding: 4 }}
                    onPress={() => handleDeletePlanEntry(idx)}
                  >
                    <Text style={[styles.deleteBtnText, { color: t.text3 }]}>✕</Text>
                  </TouchableOpacity>
                </View>

                {/* Dual track: target bg + actual fill */}
                <View style={[styles.planTrack, { backgroundColor: t.surface2 }]}>
                  <View
                    style={[
                      styles.planTrackTarget,
                      {
                        width: `${Math.min(100, target)}%` as any,
                        backgroundColor: isDarkMode
                          ? 'rgba(255,255,255,0.08)'
                          : 'rgba(0,0,0,0.06)',
                        borderRightColor: t.text3,
                      },
                    ]}
                  />
                  <View
                    style={[
                      styles.planTrackActual,
                      { width: `${Math.min(100, actualPct)}%` as any, backgroundColor: segColor },
                    ]}
                  />
                </View>

                <View style={styles.rowBetween}>
                  <Text style={[styles.planActualLabel, { color: t.text2 }]}>
                    Actual {actualPct.toFixed(1)}%
                  </Text>
                  <Text style={[styles.planDrift, { color: driftColor }]}>
                    {drift > 0 ? '↑' : drift < 0 ? '↓' : '·'} {Math.abs(drift).toFixed(1)}%
                  </Text>
                </View>

                {/* Target amount row */}
                {displayTarget != null && (
                  <View style={[styles.planGoalRow, { borderTopColor: t.line }]}>
                    <View style={{ flex: 1, gap: 6 }}>
                      <View style={styles.rowBetween}>
                        <Text style={[styles.planActualLabel, { color: t.text3 }]}>
                          {planView === 'year' ? 'Annual goal' : 'Monthly goal'}
                        </Text>
                        <Text style={[styles.planActualLabel, { color: t.text2 }]}>
                          {formatCurrency(instrAllocAmount)} / {formatCurrency(displayTarget)}
                        </Text>
                      </View>
                      <View style={[styles.planTrack, { backgroundColor: t.surface2 }]}>
                        <View
                          style={[
                            styles.planTrackActual,
                            {
                              width: `${targetAmountPct ?? 0}%` as any,
                              backgroundColor:
                                (targetAmountPct ?? 0) >= 100
                                  ? t.pos
                                  : segColor,
                            },
                          ]}
                        />
                      </View>
                    </View>
                  </View>
                )}
              </View>
            );
          })
        )}

        <TouchableOpacity
          style={[styles.ghostBtn, { borderColor: t.line2 }]}
          onPress={() => setShowAddPlanModal(true)}
        >
          <Text style={[styles.ghostBtnText, { color: t.text2 }]}>+ Add instrument</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  };

  // ============================================================
  // Render: Portfolio tab
  // ============================================================
  const renderPortfolioTab = () => {
    const hasValue = pricedItems.length > 0;
    const retPositive = portfolioTotalReturnAbs >= 0;

    return (
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[styles.tabContent, { paddingBottom: 120 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={ACCENT} />
        }
      >
        {/* ── Portfolio hero ── */}
        <View style={[styles.hero, { backgroundColor: t.surface, borderColor: t.line }]}>
          <Text style={[styles.heroEyebrow, { color: t.text3 }]}>Portfolio value</Text>
          <Text style={[styles.heroAmount, { color: t.text }]}>
            {formatCurrency(hasValue ? portfolioTotalCurrentValue : portfolioTotalInvested)}
          </Text>
          {hasValue && (
            <View style={styles.heroSubRow}>
              <View
                style={[
                  styles.badge,
                  {
                    backgroundColor: retPositive
                      ? `${t.pos}26`
                      : `${t.neg}26`,
                  },
                ]}
              >
                <Text style={[styles.badgeText, { color: retPositive ? t.pos : t.neg }]}>
                  {retPositive ? '↑' : '↓'}
                  {portfolioTotalReturnPct != null
                    ? ` ${Math.abs(portfolioTotalReturnPct).toFixed(1)}%`
                    : ''}{' '}
                  · {formatReturnAbs(portfolioTotalReturnAbs)}
                </Text>
              </View>
              <Text style={[styles.heroSubMeta, { color: t.text3 }]}>
                Invested {formatCurrency(portfolioTotalInvested)}
              </Text>
            </View>
          )}
        </View>

        {portfolio.length === 0 ? (
          <View style={[styles.emptyCard, { backgroundColor: t.surface, borderColor: t.line }]}>
            <Text style={[styles.emptyText, { color: t.text3 }]}>No investments recorded</Text>
          </View>
        ) : (
          <>
            <View style={styles.sectionHead}>
              <Text style={[styles.sectionTitle, { color: t.text3 }]}>HOLDINGS</Text>
              <Text style={[styles.sectionMeta, { color: t.text3 }]}>
                {portfolio.length} positions
              </Text>
            </View>

            {portfolio.map((item, idx) => {
              const ticker = item.instrument?.ticker ?? '?';
              const name = item.instrument?.name ?? ticker;
              const itemCurrency = item.instrument?.currency ?? '';
              const estValue = item.estimatedCurrentValue ?? null;
              const unrealized = item.unrealizedGain ?? null;
              const unrealizedPct =
                unrealized != null && (item.remainingCostBasis ?? 0) > 0
                  ? (unrealized / item.remainingCostBasis) * 100
                  : null;
              const unrealizedPos = unrealized == null ? true : unrealized >= 0;
              const realized = item.realizedGain ?? 0;
              const isClosed = (item.currentQuantity ?? 0) < 1e-9;

              return (
                <View
                  key={idx}
                  style={[styles.portRow, { backgroundColor: t.surface, borderColor: t.line }]}
                >
                  <TickerChip ticker={ticker} />
                  <View style={styles.portMid}>
                    <Text style={[styles.portName, { color: t.text }]} numberOfLines={1}>
                      {name}
                    </Text>
                    <Text style={[styles.portMeta, { color: t.text3 }]}>
                      {ticker}
                      {itemCurrency ? ` · ${itemCurrency}` : ''}
                      {isClosed ? ' · CLOSED' : item.currentQuantity > 0 ? ` · ×${item.currentQuantity.toFixed(4)}` : ''}
                    </Text>
                    {realized !== 0 && (
                      <Text style={[styles.portMeta, { color: realized >= 0 ? t.pos : t.neg }]}>
                        Realized {formatReturnAbs(realized)}
                      </Text>
                    )}
                  </View>
                  <View style={{ alignItems: 'flex-end', gap: 2 }}>
                    {!isClosed && (
                      <Text style={[styles.portCur, { color: t.text }]}>
                        {formatCurrency(estValue ?? item.remainingCostBasis)}
                      </Text>
                    )}
                    {unrealizedPct != null && (
                      <Text style={[styles.portRet, { color: unrealizedPos ? t.pos : t.neg }]}>
                        {unrealizedPos ? '+' : ''}
                        {unrealizedPct.toFixed(1)}%
                      </Text>
                    )}
                    {!isClosed && (
                      <TouchableOpacity
                        style={[styles.sellBtn, { borderColor: t.neg }]}
                        onPress={() => handleOpenSell(item)}
                      >
                        <Text style={[styles.sellBtnText, { color: t.neg }]}>Sell</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              );
            })}

            {/* ── Summary card ── */}
            <View style={[styles.card, { backgroundColor: t.surface, borderColor: t.line }]}>
              <View style={styles.rowBetween}>
                <Text style={[styles.summaryLabel, { color: t.text2 }]}>Invested</Text>
                <Text style={[styles.summaryVal, { color: t.text }]}>
                  {formatCurrency(portfolioTotalInvested)}
                </Text>
              </View>
              {hasValue && (
                <View style={[styles.rowBetween, { marginTop: 6 }]}>
                  <Text style={[styles.summaryLabel, { color: t.text2 }]}>Current value</Text>
                  <Text style={[styles.summaryVal, { color: t.text }]}>
                    {formatCurrency(portfolioTotalCurrentValue)}
                  </Text>
                </View>
              )}
              {hasValue && (
                <View style={[styles.rowBetween, { marginTop: 6 }]}>
                  <Text style={[styles.summaryLabel, { color: t.text2 }]}>Unrealized P&L</Text>
                  <Text style={[styles.summaryReturnVal, { color: portfolioTotalUnrealizedGain >= 0 ? t.pos : t.neg }]}>
                    {formatReturnAbs(portfolioTotalUnrealizedGain)}
                    {portfolioTotalReturnPct != null ? `  ${formatReturnPct(portfolioTotalReturnPct)}` : ''}
                  </Text>
                </View>
              )}
              {portfolioTotalRealizedGain !== 0 && (
                <View
                  style={[
                    styles.rowBetween,
                    { borderTopColor: t.line, marginTop: 12, paddingTop: 12, borderTopWidth: 1 },
                  ]}
                >
                  <Text style={[styles.summaryLabel, { color: t.text2 }]}>Realized P&L</Text>
                  <Text
                    style={[
                      styles.summaryReturnVal,
                      { color: portfolioTotalRealizedGain >= 0 ? t.pos : t.neg },
                    ]}
                  >
                    {formatReturnAbs(portfolioTotalRealizedGain)}
                  </Text>
                </View>
              )}
            </View>
          </>
        )}
      </ScrollView>
    );
  };

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
          <View style={[styles.modalContainer, { backgroundColor: t.surface }]}>
            <View style={[styles.sheetGrab, { backgroundColor: t.line2 }]} />
            <Text style={[styles.modalTitle, { color: t.text }]}>Add allocation</Text>

            {selectedInstrument ? (
              <View style={[styles.pickedRow, { backgroundColor: t.surface2, borderRadius: 12 }]}>
                <TickerChip ticker={selectedInstrument.ticker ?? '?'} size={36} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.pickedName, { color: t.text }]} numberOfLines={1}>
                    {selectedInstrument.name ?? selectedInstrument.ticker}
                  </Text>
                  <Text style={[styles.pickedMeta, { color: t.text3 }]}>
                    {selectedInstrument.ticker} · {selectedInstrument.type}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.pickedClear}
                  onPress={() => { setSelectedInstrument(null); setSearchQuery(''); }}
                >
                  <Text style={[styles.pickedClearText, { color: t.text3 }]}>✕</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                <TextInput
                  style={[styles.sheetInput, { backgroundColor: t.surface2, color: t.text, borderColor: t.line }]}
                  placeholder="Search instrument (VWCE, BTC, …)"
                  placeholderTextColor={t.text3}
                  value={searchQuery}
                  onChangeText={handleSearchChange}
                />
                {searchResults.length > 0 && (
                  <ScrollView
                    style={[styles.searchResults, { backgroundColor: t.surface2 }]}
                    nestedScrollEnabled
                  >
                    {searchResults.map(item => (
                      <TouchableOpacity
                        key={item._id}
                        style={[styles.searchRow, { borderBottomColor: t.line }]}
                        onPress={() => handleSelectInstrument(item)}
                      >
                        <TickerChip ticker={item.ticker ?? '?'} size={32} />
                        <Text style={[styles.searchName, { color: t.text }]} numberOfLines={1}>
                          {item.name ?? item.ticker}
                        </Text>
                        <Text style={[styles.searchType, { color: t.text3 }]}>
                          {item.type ?? ''}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                )}
              </>
            )}

            {/* Mode toggle */}
            <Text style={[styles.modeLabel, { color: t.text3 }]}>What do you want to enter?</Text>
            <View style={[styles.modeToggle, { backgroundColor: t.surface2 }]}>
              <View
                style={[
                  styles.modeSlider,
                  {
                    backgroundColor: ACCENT,
                    transform: [{ translateX: allocationMode === 'amount' ? 0 : (/* width/2 */ 0) }],
                    left: allocationMode === 'amount' ? 4 : '50%' as any,
                  },
                ]}
              />
              {(['amount', 'quantity'] as AllocationMode[]).map(m => (
                <TouchableOpacity
                  key={m}
                  style={styles.modeBtn}
                  onPress={() => setAllocationMode(m)}
                >
                  <Text
                    style={[
                      styles.modeBtnText,
                      { color: allocationMode === m ? '#0c0c0c' : t.text2 },
                    ]}
                  >
                    {m === 'amount' ? 'Amount' : 'Quantity'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Amount field */}
            <View
              style={[
                styles.field,
                {
                  backgroundColor: allocationMode === 'amount' ? t.surface : t.surface2,
                  borderColor: allocationMode === 'amount' ? ACCENT : t.line,
                },
              ]}
            >
              <Text style={[styles.fieldLabel, { color: t.text3, backgroundColor: allocationMode === 'amount' ? t.surface : t.surface2 }]}>
                Amount{allocationMode !== 'amount' ? ' (auto)' : ''}
              </Text>
              <Text style={[styles.fieldPrefix, { color: t.text3 }]}>{currency}</Text>
              <TextInput
                style={[styles.fieldInput, { color: t.text }]}
                placeholder="0.00"
                placeholderTextColor={t.text3}
                keyboardType="numeric"
                value={newAmount}
                onChangeText={handleAmountChange}
              />
            </View>

            {/* Quantity field */}
            <View
              style={[
                styles.field,
                {
                  backgroundColor: allocationMode === 'quantity' ? t.surface : t.surface2,
                  borderColor: allocationMode === 'quantity' ? ACCENT : t.line,
                },
              ]}
            >
              <Text style={[styles.fieldLabel, { color: t.text3, backgroundColor: allocationMode === 'quantity' ? t.surface : t.surface2 }]}>
                Quantity{allocationMode !== 'quantity' ? ' (auto)' : ''}
              </Text>
              <TextInput
                style={[styles.fieldInput, { color: t.text }]}
                placeholder="0"
                placeholderTextColor={t.text3}
                keyboardType="numeric"
                value={newQuantity}
                onChangeText={handleQuantityChange}
              />
            </View>

            {/* Price field */}
            <View
              style={[
                styles.field,
                { backgroundColor: t.surface2, borderColor: t.line, opacity: isPriceFetching ? 0.6 : 1 },
              ]}
            >
              <Text style={[styles.fieldLabel, { color: t.text3, backgroundColor: t.surface2 }]}>Price</Text>
              <Text style={[styles.fieldPrefix, { color: t.text3 }]}>{currency}</Text>
              <TextInput
                style={[styles.fieldInput, { color: t.text }]}
                placeholder={isPriceFetching ? 'Fetching…' : '0.00'}
                placeholderTextColor={t.text3}
                keyboardType="numeric"
                editable={!isPriceFetching}
                value={newPrice}
                onChangeText={handlePriceChange}
              />
            </View>

            <View style={styles.sheetActions}>
              <TouchableOpacity
                style={[styles.sheetCancel, { backgroundColor: t.surface2 }]}
                onPress={resetAllocationModal}
              >
                <Text style={[styles.sheetCancelText, { color: t.text }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.sheetSave, { backgroundColor: ACCENT }]}
                onPress={handleSaveAllocation}
              >
                <Text style={styles.sheetSaveText}>Save</Text>
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
          <View style={[styles.modalContainer, { backgroundColor: t.surface }]}>
            <View style={[styles.sheetGrab, { backgroundColor: t.line2 }]} />
            <Text style={[styles.modalTitle, { color: t.text }]}>Add instrument to plan</Text>

            {planSelectedInstrument ? (
              <View style={[styles.pickedRow, { backgroundColor: t.surface2, borderRadius: 12 }]}>
                <TickerChip ticker={planSelectedInstrument.ticker ?? '?'} size={36} />
                <Text style={[styles.pickedName, { color: t.text, flex: 1 }]} numberOfLines={1}>
                  {planSelectedInstrument.name ?? planSelectedInstrument.ticker}
                </Text>
                <TouchableOpacity
                  style={styles.pickedClear}
                  onPress={() => { setPlanSelectedInstrument(null); setPlanSearchQuery(''); }}
                >
                  <Text style={[styles.pickedClearText, { color: t.text3 }]}>✕</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                <TextInput
                  style={[styles.sheetInput, { backgroundColor: t.surface2, color: t.text, borderColor: t.line }]}
                  placeholder="Search instrument…"
                  placeholderTextColor={t.text3}
                  value={planSearchQuery}
                  onChangeText={handlePlanSearchChange}
                />
                {planSearchResults.length > 0 && (
                  <ScrollView
                    style={[styles.searchResults, { backgroundColor: t.surface2 }]}
                    nestedScrollEnabled
                  >
                    {planSearchResults.map(item => (
                      <TouchableOpacity
                        key={item._id}
                        style={[styles.searchRow, { borderBottomColor: t.line }]}
                        onPress={() => {
                          setPlanSelectedInstrument(item);
                          setPlanSearchQuery('');
                          setPlanSearchResults([]);
                        }}
                      >
                        <TickerChip ticker={item.ticker ?? '?'} size={32} />
                        <Text style={[styles.searchName, { color: t.text }]} numberOfLines={1}>
                          {item.name ?? item.ticker}
                        </Text>
                        <Text style={[styles.searchType, { color: t.text3 }]}>
                          {item.type ?? ''}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                )}
              </>
            )}

            <View style={[styles.field, { backgroundColor: t.surface2, borderColor: t.line, marginTop: 8 }]}>
              <Text style={[styles.fieldLabel, { color: t.text3, backgroundColor: t.surface2 }]}>Target %</Text>
              <TextInput
                style={[styles.fieldInput, { color: t.text }]}
                placeholder="e.g. 30"
                placeholderTextColor={t.text3}
                keyboardType="numeric"
                value={pianoPct}
                onChangeText={setPianoPct}
              />
            </View>

            <View style={[styles.field, { backgroundColor: t.surface2, borderColor: t.line }]}>
              <Text style={[styles.fieldLabel, { color: t.text3, backgroundColor: t.surface2 }]}>Monthly goal (optional)</Text>
              <Text style={[styles.fieldPrefix, { color: t.text3 }]}>{currency}</Text>
              <TextInput
                style={[styles.fieldInput, { color: t.text }]}
                placeholder="e.g. 500"
                placeholderTextColor={t.text3}
                keyboardType="numeric"
                value={pianoTargetAmount}
                onChangeText={setPianoTargetAmount}
              />
            </View>

            <View style={styles.sheetActions}>
              <TouchableOpacity
                style={[styles.sheetCancel, { backgroundColor: t.surface2 }]}
                onPress={() => {
                  setShowAddPlanModal(false);
                  setPlanSelectedInstrument(null);
                  setPianoPct('');
                  setPianoTargetAmount('');
                  setPlanSearchQuery('');
                  setPlanSearchResults([]);
                }}
              >
                <Text style={[styles.sheetCancelText, { color: t.text }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.sheetSave, { backgroundColor: ACCENT }]}
                onPress={handleSavePlanEntry}
              >
                <Text style={styles.sheetSaveText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );

  // ============================================================
  // Render: Sell Modal
  // ============================================================
  const renderSellModal = () => {
    const sellQtyNum   = parseFloat(sellQuantity) || 0;
    const sellPriceNum = parseFloat(sellPrice) || 0;
    const sellProceeds = sellQtyNum * sellPriceNum;
    const avgCost      = sellItem && (sellItem.totalQuantity ?? 0) > 0
      ? (sellItem.totalAmount ?? 0) / sellItem.totalQuantity
      : 0;
    const sellCostBasis = sellQtyNum * avgCost;
    const sellEstPnL    = sellProceeds - sellCostBasis;
    const pnlPos        = sellEstPnL >= 0;
    const isValidSell   =
      sellQtyNum > 0 &&
      sellQtyNum <= (sellItem?.currentQuantity ?? 0) + 1e-9 &&
      sellPriceNum > 0;

    return (
      <Modal
        visible={showSellModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowSellModal(false)}
      >
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContainer, { backgroundColor: t.surface }]}>
              <View style={[styles.sheetGrab, { backgroundColor: t.line2 }]} />
              <Text style={[styles.modalTitle, { color: t.text }]}>Sell asset</Text>

              {sellItem && (
                <View style={[styles.pickedRow, { backgroundColor: t.surface2, borderRadius: 12 }]}>
                  <TickerChip ticker={sellItem.instrument?.ticker ?? '?'} size={36} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.pickedName, { color: t.text }]} numberOfLines={1}>
                      {sellItem.instrument?.name ?? sellItem.instrument?.ticker}
                    </Text>
                    <Text style={[styles.pickedMeta, { color: t.text3 }]}>
                      Available: ×{sellItem.currentQuantity?.toFixed(6)}
                      {avgCost > 0 ? `  ·  avg cost ${currency}${avgCost.toFixed(2)}` : ''}
                    </Text>
                  </View>
                </View>
              )}

              <View style={[styles.field, { backgroundColor: t.surface2, borderColor: t.line, marginTop: 12 }]}>
                <Text style={[styles.fieldLabel, { color: t.text3, backgroundColor: t.surface2 }]}>Quantity</Text>
                <TextInput
                  style={[styles.fieldInput, { color: t.text }]}
                  placeholder="0.00"
                  placeholderTextColor={t.text3}
                  keyboardType="decimal-pad"
                  value={sellQuantity}
                  onChangeText={setSellQuantity}
                />
              </View>

              <View style={[styles.field, { backgroundColor: t.surface2, borderColor: t.line, marginTop: 8 }]}>
                <Text style={[styles.fieldLabel, { color: t.text3, backgroundColor: t.surface2 }]}>Price at sale</Text>
                <TextInput
                  style={[styles.fieldInput, { color: t.text }]}
                  placeholder="0.00"
                  placeholderTextColor={t.text3}
                  keyboardType="decimal-pad"
                  value={sellPrice}
                  onChangeText={setSellPrice}
                />
              </View>

              {sellQtyNum > 0 && sellPriceNum > 0 && (
                <View style={[styles.card, { backgroundColor: t.surface2, borderColor: t.line, marginTop: 8 }]}>
                  <View style={styles.rowBetween}>
                    <Text style={[styles.summaryLabel, { color: t.text2 }]}>Proceeds</Text>
                    <Text style={[styles.summaryVal, { color: t.text }]}>{formatCurrency(sellProceeds)}</Text>
                  </View>
                  <View style={[styles.rowBetween, { marginTop: 6 }]}>
                    <Text style={[styles.summaryLabel, { color: t.text2 }]}>Cost basis (PCM)</Text>
                    <Text style={[styles.summaryVal, { color: t.text2 }]}>{formatCurrency(sellCostBasis)}</Text>
                  </View>
                  <View style={[styles.rowBetween, { marginTop: 6, borderTopWidth: 1, borderTopColor: t.line, paddingTop: 6 }]}>
                    <Text style={[styles.summaryLabel, { color: t.text2 }]}>Est. P&L</Text>
                    <Text style={[styles.summaryReturnVal, { color: pnlPos ? t.pos : t.neg }]}>
                      {formatReturnAbs(sellEstPnL)}
                    </Text>
                  </View>
                </View>
              )}

              <View style={styles.sheetActions}>
                <TouchableOpacity
                  style={[styles.sheetCancel, { backgroundColor: t.surface2 }]}
                  onPress={() => setShowSellModal(false)}
                >
                  <Text style={[styles.sheetCancelText, { color: t.text }]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.sheetSave,
                    { backgroundColor: isValidSell && !isSavingSell ? t.neg : t.surface2 },
                  ]}
                  onPress={handleConfirmSell}
                  disabled={!isValidSell || isSavingSell}
                >
                  {isSavingSell
                    ? <ActivityIndicator size="small" color="#fff" />
                    : <Text style={[styles.sheetSaveText, { color: isValidSell ? '#fff' : t.text3 }]}>Confirm Sell</Text>
                  }
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    );
  };

  // ============================================================
  // Main Render
  // ============================================================
  return (
    <View style={[styles.container, { backgroundColor: t.bg }]}>
      {/* ── Month navigator ── */}
      <View style={[styles.monthNavRow, { backgroundColor: t.bg }]}>
        <TouchableOpacity style={styles.monthArrow} onPress={prevMonth}>
          <Text style={[styles.monthArrowText, { color: t.text2 }]}>‹</Text>
        </TouchableOpacity>
        <Text style={[styles.monthNavText, { color: t.text2 }]}>
          {MONTHS[selectedMonth]} {selectedYear}
        </Text>
        <TouchableOpacity style={styles.monthArrow} onPress={nextMonth}>
          <Text style={[styles.monthArrowText, { color: t.text2 }]}>›</Text>
        </TouchableOpacity>
      </View>

      {/* ── Segmented tab bar ── */}
      <View
        style={[styles.tabBar, { backgroundColor: t.surface, borderColor: t.line }]}
        onLayout={e => {
          const w = e.nativeEvent.layout.width;
          setTabBarWidth(w);
          // Sync slider position after layout
          const idx = TABS.indexOf(activeTab);
          tabAnimRef.current.setValue(idx * ((w - 8) / 3));
        }}
      >
        {tabBarWidth > 0 && (
          <Animated.View
            style={[
              styles.tabSlider,
              {
                backgroundColor: ACCENT,
                width: (tabBarWidth - 8) / 3,
                transform: [{ translateX: tabAnimRef.current }],
              },
            ]}
          />
        )}
        {TABS.map(tab => (
          <TouchableOpacity key={tab} style={styles.tab} onPress={() => changeTab(tab)}>
            <Text
              style={[
                styles.tabText,
                { color: activeTab === tab ? '#0c0c0c' : t.text2 },
              ]}
            >
              {TAB_LABELS[tab]}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* ── Loading overlay ── */}
      {isLoading && !refreshing && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={ACCENT} />
        </View>
      )}

      {/* ── Tab content ── */}
      {(!isLoading || refreshing) && (
        <>
          {activeTab === 'mese' && renderMeseTab()}
          {activeTab === 'piano' && renderPianoTab()}
          {activeTab === 'portfolio' && renderPortfolioTab()}
        </>
      )}

      {/* ── FAB (Month tab only) ── */}
      {activeTab === 'mese' && !isLoading && (
        <TouchableOpacity
          style={[styles.fab, { backgroundColor: ACCENT }]}
          activeOpacity={0.85}
          onPress={() => {
            allocationModalOpenRef.current = true;
            setShowAddAllocationModal(true);
          }}
        >
          <Text style={styles.fabIcon}>+</Text>
        </TouchableOpacity>
      )}

      {/* ── Modals ── */}
      {renderAddAllocationModal()}
      {renderAddPlanModal()}
      {renderSellModal()}
    </View>
  );
};

// ============================================================
// Styles
// ============================================================
const styles = StyleSheet.create({
  container: { flex: 1 },

  // Month navigator row
  monthNavRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    gap: 4,
  },
  monthArrow: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthArrowText: {
    fontSize: 22,
    lineHeight: 24,
    fontWeight: '300',
  },
  monthNavText: {
    fontSize: 13,
    fontWeight: '500',
    minWidth: 120,
    textAlign: 'center',
    letterSpacing: -0.1,
  },

  // Tab bar
  tabBar: {
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 14,
    borderWidth: 1,
    padding: 4,
    flexDirection: 'row',
    position: 'relative',
    overflow: 'hidden',
    flexShrink: 0,
  },
  tabSlider: {
    position: 'absolute',
    top: 4,
    bottom: 4,
    left: 4,
    borderRadius: 10,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    zIndex: 1,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: -0.1,
  },

  // Loading
  loadingOverlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Tab content container
  tabContent: {
    padding: 16,
    gap: 12,
  },

  // Hero card
  hero: {
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
    fontSize: 44,
    fontWeight: '700',
    letterSpacing: -1.5,
    marginBottom: 18,
    lineHeight: 50,
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

  // Hero sub row (portfolio)
  heroSubRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  heroSubMeta: {
    fontSize: 12,
    fontWeight: '500',
  },

  // Generic card
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
  },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardLabel: {
    fontSize: 13,
    fontWeight: '500',
  },
  cardPct: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  track: {
    height: 6,
    borderRadius: 3,
    marginTop: 12,
    overflow: 'hidden',
  },
  trackFill: {
    height: '100%',
    borderRadius: 3,
  },
  microLabel: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 2,
  },
  microVal: {
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: -0.3,
  },

  // Section head
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  sectionMeta: {
    fontSize: 11,
    fontWeight: '500',
    letterSpacing: 0.4,
  },

  // Empty states
  emptyCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 32,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    fontStyle: 'italic',
    textAlign: 'center',
  },
  emptySubText: {
    fontSize: 12,
    marginTop: 4,
    textAlign: 'center',
  },

  // Ticker chip
  tickerChip: {
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  tickerChipText: {
    color: '#0c0c0c',
    fontWeight: '800',
    letterSpacing: 0.4,
  },

  // Allocation row
  allocRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    gap: 12,
  },
  allocMid: {
    flex: 1,
    gap: 6,
  },
  allocName: {
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: -0.1,
    flex: 1,
    marginRight: 8,
  },
  allocAmt: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: -0.1,
    flexShrink: 0,
  },
  allocBar: {
    height: 3,
    borderRadius: 2,
    overflow: 'hidden',
  },
  allocBarFill: {
    height: '100%',
    borderRadius: 2,
  },
  allocMeta: {
    fontSize: 11,
    letterSpacing: 0.2,
  },
  allocPct: {
    fontSize: 11,
    fontWeight: '600',
  },

  // Delete button
  deleteBtn: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  deleteBtnText: {
    fontSize: 14,
    fontWeight: '500',
  },

  // Sell button
  sellBtn: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginTop: 4,
  },
  sellBtnText: {
    fontSize: 11,
    fontWeight: '600',
  },

  // Ghost button
  ghostBtn: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ghostBtnText: {
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: -0.1,
  },

  // FAB
  fab: {
    position: 'absolute',
    bottom: 28,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 8,
    zIndex: 10,
  },
  fabIcon: {
    fontSize: 30,
    fontWeight: '200',
    color: '#0c0c0c',
    lineHeight: 34,
    marginTop: -2,
  },

  // Plan view toggle
  planViewToggle: {
    flexDirection: 'row',
    borderRadius: 10,
    padding: 3,
    marginBottom: 4,
  },
  planViewBtn: {
    flex: 1,
    paddingVertical: 7,
    alignItems: 'center',
    borderRadius: 8,
  },
  planViewBtnText: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: -0.1,
  },

  // Plan goal row
  planGoalRow: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 8,
    marginTop: 4,
    flexDirection: 'row',
    alignItems: 'center',
  },

  // Plan
  planCircle: {
    width: 128,
    height: 128,
    borderRadius: 64,
    borderWidth: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  planCirclePct: {
    fontSize: 30,
    fontWeight: '700',
    letterSpacing: -1,
    lineHeight: 33,
  },
  planCircleSub: {
    fontSize: 11,
    fontWeight: '500',
    textAlign: 'center',
  },
  stackedBar: {
    flexDirection: 'row',
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
    width: '100%',
  },
  planRow: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    gap: 8,
  },
  planRowHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  planName: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: -0.1,
  },
  planTarget: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: -0.1,
  },
  planTrack: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
    position: 'relative',
  },
  planTrackTarget: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    borderRightWidth: 1.5,
    borderStyle: 'dashed',
    borderRadius: 3,
  },
  planTrackActual: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    borderRadius: 3,
  },
  planActualLabel: {
    fontSize: 11,
    fontWeight: '500',
  },
  planDrift: {
    fontSize: 11,
    fontWeight: '600',
  },

  // Portfolio
  portRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    gap: 12,
  },
  portMid: {
    flex: 1,
    minWidth: 0,
  },
  portName: {
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: -0.1,
  },
  portMeta: {
    fontSize: 11,
    marginTop: 2,
  },
  portCur: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: -0.1,
  },
  portRet: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
  summaryLabel: {
    fontSize: 13,
  },
  summaryVal: {
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: -0.1,
  },
  summaryDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  summaryReturnVal: {
    fontSize: 17,
    fontWeight: '700',
  },

  // Modals
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    padding: 18,
    paddingBottom: 36,
    maxHeight: '85%',
  },
  sheetGrab: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 14,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '700',
    textAlign: 'center',
    letterSpacing: -0.3,
    marginBottom: 18,
  },
  pickedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 10,
    marginBottom: 12,
  },
  pickedName: {
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: -0.1,
  },
  pickedMeta: {
    fontSize: 11,
    marginTop: 1,
  },
  pickedClear: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
  },
  pickedClearText: {
    fontSize: 14,
  },
  sheetInput: {
    borderRadius: 12,
    padding: 13,
    fontSize: 14,
    marginBottom: 10,
    borderWidth: 1,
  },
  searchResults: {
    borderRadius: 12,
    marginBottom: 12,
    maxHeight: 200,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 10,
    borderBottomWidth: 1,
  },
  searchName: {
    flex: 1,
    fontSize: 13,
    fontWeight: '500',
  },
  searchType: {
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  modeLabel: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
    marginTop: 6,
  },
  modeToggle: {
    flexDirection: 'row',
    borderRadius: 12,
    padding: 4,
    marginBottom: 14,
    position: 'relative',
  },
  modeSlider: {
    position: 'absolute',
    top: 4,
    bottom: 4,
    width: '50%',
    borderRadius: 9,
  },
  modeBtn: {
    flex: 1,
    paddingVertical: 9,
    alignItems: 'center',
    zIndex: 1,
  },
  modeBtnText: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: -0.1,
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1.5,
    position: 'relative',
  },
  fieldLabel: {
    position: 'absolute',
    top: -8,
    left: 12,
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
    paddingHorizontal: 4,
  },
  fieldPrefix: {
    fontSize: 14,
    fontWeight: '500',
  },
  fieldInput: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: -0.1,
  },
  sheetActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 18,
  },
  sheetCancel: {
    flex: 1,
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  sheetCancelText: {
    fontSize: 14,
    fontWeight: '700',
  },
  sheetSave: {
    flex: 1,
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  sheetSaveText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0c0c0c',
  },
});

export default SavingsScreen;
