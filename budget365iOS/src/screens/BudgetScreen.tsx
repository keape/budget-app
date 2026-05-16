import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Modal,
  InputAccessoryView,
  Keyboard,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import { useAppTheme } from '../hooks/useAppTheme';
import { API_URL } from '../config';
import { warmupBackend } from '../utils/apiClient';

const BASE_URL = API_URL;
const ACCENT = '#c4f23a';

interface BudgetScreenProps {
  navigation: any;
}

const BudgetScreen: React.FC<BudgetScreenProps> = ({ navigation }) => {
  const { userToken, logout } = useAuth();
  const { currency, showBalance } = useSettings();
  const t = useAppTheme();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const today = new Date();
  const [selectedMonth, setSelectedMonth] = useState(today.getMonth());
  const [selectedYear, setSelectedYear] = useState(today.getFullYear());

  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const YEARLY_SENTINEL = 12;
  const monthsWithYearly = [...months, 'Full Year'];
  const isYearlyMode = selectedMonth === YEARLY_SENTINEL;

  const years = [2024, 2025, 2026, 2027];

  const [isMonthModalVisible, setIsMonthModalVisible] = useState(false);
  const [isYearModalVisible, setIsYearModalVisible] = useState(false);

  // Data State
  const [categories, setCategories] = useState<string[]>([]);
  const [budgetSettings, setBudgetSettings] = useState<Record<string, number>>({});
  const [actualSpending, setActualSpending] = useState<Record<string, number>>({});

  // Yearly aggregated state
  const [yearlyBudget, setYearlyBudget] = useState<Record<string, number>>({});
  const [yearlyActual, setYearlyActual] = useState<Record<string, number>>({});

  // Dirty State (changes made by user)
  const [localBudget, setLocalBudget] = useState<Record<string, string>>({}); // Store as string for TextInput

  const [activeTab, setActiveTab] = useState<'expenses' | 'income'>('expenses');

  const totalBudget = categories.reduce((sum, cat) => {
    const limitStr = localBudget[cat] || '0';
    const limit = isYearlyMode ? (yearlyBudget[cat] || 0) : (parseFloat(limitStr.replace(',', '.')) || 0);
    return sum + limit;
  }, 0);

  const totalActual = categories.reduce((sum, cat) => {
    const spending = isYearlyMode ? (yearlyActual[cat] || 0) : (actualSpending[cat] || 0);
    return sum + spending;
  }, 0);

  const totalPct = totalBudget > 0 ? Math.min(Math.round((totalActual / totalBudget) * 100), 999) : 0;

  const formatCurrency = (value: number) => (
    showBalance ? `${currency}${Math.abs(value).toFixed(2)}` : '****'
  );

  useFocusEffect(
    useCallback(() => {
      if (userToken) {
        loadData();
      }
    }, [userToken, activeTab, selectedMonth, selectedYear])
  );

  const loadData = async () => {
    try {
      setIsLoading(true);
      await warmupBackend();
      const year = selectedYear;
      const month = selectedMonth;

      // 1. Fetch Categories
      const catRes = await fetch(`${BASE_URL}/api/categorie`, {
        headers: { 'Authorization': `Bearer ${userToken}` }
      });
      const catData = await catRes.json();

      const targetCategories = activeTab === 'expenses'
        ? (catData.categorie?.spese || [])
        : (catData.categorie?.entrate || []);

      setCategories(targetCategories);

      // 1.5. Clean up duplicates to avoid sync issues
      try {
        await fetch(`${BASE_URL}/api/budget-settings/emergency-fix`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${userToken}` }
        });
      } catch (err) {
        console.log("Cleanup failed", err);
      }

      if (isYearlyMode) {
        // 2a. Yearly mode: fetch all 12 months in parallel and aggregate
        const allSettings = await Promise.all(
          Array.from({ length: 12 }, (_, m) =>
            fetch(`${BASE_URL}/api/budget-settings?anno=${year}&mese=${m}`, {
              headers: { 'Authorization': `Bearer ${userToken}` }
            }).then(r => r.ok ? r.json() : { spese: {}, entrate: {} })
          )
        );

        const aggBudget: Record<string, number> = {};
        allSettings.forEach(s => {
          const src = activeTab === 'expenses' ? (s.spese || {}) : (s.entrate || {});
          Object.entries(src).forEach(([cat, val]) => {
            aggBudget[cat] = (aggBudget[cat] || 0) + (val as number);
          });
        });
        setYearlyBudget(aggBudget);
        setBudgetSettings(aggBudget);

        // 3a. Fetch actual spending for the whole year
        const endpoint = activeTab === 'expenses' ? 'spese' : 'entrate';
        const txRes = await fetch(`${BASE_URL}/api/${endpoint}?limit=5000`, {
          headers: { 'Authorization': `Bearer ${userToken}` }
        });
        const txData = await txRes.json();
        const transactions = activeTab === 'expenses' ? (txData.spese || []) : (txData.entrate || []);

        const aggActual: Record<string, number> = {};
        transactions
          .filter((t: any) => new Date(t.data).getFullYear() === year)
          .forEach((t: any) => {
            aggActual[t.categoria] = (aggActual[t.categoria] || 0) + Math.abs(t.importo);
          });
        setYearlyActual(aggActual);
        setActualSpending(aggActual);

        // Initialize local inputs (read-only in yearly mode)
        const dispLocal: Record<string, string> = {};
        targetCategories.forEach((cat: string) => {
          dispLocal[cat] = String(aggBudget[cat] || 0);
        });
        setLocalBudget(dispLocal);

      } else {
        // 2b. Monthly mode: existing logic
        const settingsRes = await fetch(`${BASE_URL}/api/budget-settings?anno=${year}&mese=${month}`, {
          headers: { 'Authorization': `Bearer ${userToken}` }
        });
        const settingsData = settingsRes.ok ? await settingsRes.json() : { spese: {}, entrate: {} };

        const currentLimits = activeTab === 'expenses'
          ? (settingsData.spese || {})
          : (settingsData.entrate || {});

        setBudgetSettings(currentLimits);

        // Initialize local inputs
        const initialLocal: Record<string, string> = {};
        targetCategories.forEach((cat: string) => {
          initialLocal[cat] = currentLimits[cat] ? String(currentLimits[cat]) : '0';
        });
        setLocalBudget(initialLocal);

        // 3b. Fetch Actual Spending (Transactions)
        const endpoint = activeTab === 'expenses' ? 'spese' : 'entrate';
        const txRes = await fetch(`${BASE_URL}/api/${endpoint}?limit=1000`, {
          headers: { 'Authorization': `Bearer ${userToken}` }
        });
        const txData = await txRes.json();
        const transactions = activeTab === 'expenses' ? (txData.spese || []) : (txData.entrate || []);

        // Filter for current month and aggregate
        const startOfMonth = new Date(year, month, 1).getTime();
        const endOfMonth = new Date(year, month + 1, 0).getTime();

        const aggregated: Record<string, number> = {};
        transactions.forEach((t: any) => {
          const tDate = new Date(t.data).getTime();
          if (tDate >= startOfMonth && tDate <= endOfMonth) {
            aggregated[t.categoria] = (aggregated[t.categoria] || 0) + Math.abs(t.importo);
          }
        });
        setActualSpending(aggregated);
      }

    } catch (error) {
      console.error("Error loading budget planner:", error);
      Alert.alert("Error", "Failed to load budget data.");
    } finally {
      setIsLoading(false);
    }
  };

  const persistBudget = async (
    budgetToSave: Record<string, string>,
    tab: 'expenses' | 'income'
  ) => {
    try {
      // Background save, no blocking UI
      // We could set isSaving(true) if we wanted to show a small indicator

      const year = selectedYear;
      const month = selectedMonth;

      // We need to fetch current full settings first to preserve the OTHER tab's data
      const settingsRes = await fetch(`${BASE_URL}/api/budget-settings?anno=${year}&mese=${month}`, {
        headers: { 'Authorization': `Bearer ${userToken}` }
      });
      const currentRemote = settingsRes.ok ? await settingsRes.json() : { spese: {}, entrate: {} };

      // Prepare new numbers with safety checks
      const newValues: Record<string, number> = {};
      Object.entries(budgetToSave).forEach(([cat, valStr]) => {
        const normalized = valStr.replace(',', '.');
        const val = parseFloat(normalized);
        if (!isNaN(val) && isFinite(val) && val >= 0) {
          newValues[cat] = val;
        }
      });

      // Construct payload matching backend expectation
      const payload = {
        anno: year,
        mese: month,
        isYearly: false,
        settings: {
          spese: tab === 'expenses' ? newValues : (currentRemote.spese || {}),
          entrate: tab === 'income' ? newValues : (currentRemote.entrate || {})
        }
      };

      const saveRes = await fetch(`${BASE_URL}/api/budget-settings`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${userToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (saveRes.ok) {
        // Silent success. 
        // We DO NOT reload data here to avoid race conditions (ghost categories reappearing).
        // The local state is already up to date.
        console.log("Autosave success");
      } else {
        if (saveRes.status === 401 || saveRes.status === 403) {
          Alert.alert("Session Expired", "Your session is invalid. Please login again.");
          logout();
          return;
        }
        console.log("Autosave failed", await saveRes.json());
      }

    } catch (e) {
      console.error("Autosave error", e);
    }
  };

  const renderScrubber = (value: number, limit: number, color: string) => {
    let percentage = 0;
    if (limit > 0) {
      percentage = (value / limit) * 100;
      percentage = Math.min(percentage, 100);
    } else if (value > 0) {
      percentage = 100;
    }

    if (isNaN(percentage) || !isFinite(percentage)) {
      percentage = 0;
    }

    const isOverBudget = limit > 0 && value > limit;

    return (
      <View style={styles.scrubberContainer}>
        <View style={[styles.scrubberTrack, { backgroundColor: t.surface2 }]}>
          <View
            style={[
              styles.scrubberFill,
              {
                width: `${percentage}%`,
                backgroundColor: isOverBudget ? '#EF4444' : color
              }
            ]}
          />
        </View>
        <Text style={[styles.scrubberText, { color: t.text2 }]}>
          {percentage.toFixed(0)}%
        </Text>
      </View>
    );
  };

  const handleCopyFromPrevious = async () => {
    try {
      setIsLoading(true);

      let prevMonth = selectedMonth - 1;
      let prevYear = selectedYear;
      if (prevMonth < 0) {
        prevMonth = 11;
        prevYear -= 1;
      }

      console.log(`📋 Copying from: ${prevMonth}/${prevYear} to ${selectedMonth}/${selectedYear}`);

      const settingsRes = await fetch(`${BASE_URL}/api/budget-settings?anno=${prevYear}&mese=${prevMonth}`, {
        headers: { 'Authorization': `Bearer ${userToken}` }
      });

      if (!settingsRes.ok) throw new Error("Failed to load previous month");

      const settingsData = await settingsRes.json();
      const prevLimits = activeTab === 'expenses'
        ? (settingsData.spese || {})
        : (settingsData.entrate || {});

      // Apply these limits to current month local state
      const newLocal = { ...localBudget };
      Object.keys(prevLimits).forEach(cat => {
        if (categories.includes(cat)) {
          newLocal[cat] = String(prevLimits[cat]);
        }
      });

      setLocalBudget(newLocal);

      // Persist the entire new budget state for this month
      await persistBudget(newLocal, activeTab);

      Alert.alert("Success", `Values copied from ${months[prevMonth]} ${prevYear}`);
    } catch (error) {
      console.error(error);
      Alert.alert("Error", "Unable to copy values from the previous month");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyPreviousYear = async () => {
    if (!isYearlyMode) return;
    try {
      setIsLoading(true);
      const prevYear = selectedYear - 1;

      // Fetch prevYear and currentYear for all 12 months in parallel (24 GETs total)
      const [prevResults, currResults] = await Promise.all([
        Promise.all(
          Array.from({ length: 12 }, (_, m) =>
            fetch(`${BASE_URL}/api/budget-settings?anno=${prevYear}&mese=${m}`, {
              headers: { 'Authorization': `Bearer ${userToken}` }
            }).then(r => r.ok ? r.json() : { spese: {}, entrate: {} })
          )
        ),
        Promise.all(
          Array.from({ length: 12 }, (_, m) =>
            fetch(`${BASE_URL}/api/budget-settings?anno=${selectedYear}&mese=${m}`, {
              headers: { 'Authorization': `Bearer ${userToken}` }
            }).then(r => r.ok ? r.json() : { spese: {}, entrate: {} })
          )
        )
      ]);

      // POST 12 months in parallel
      await Promise.all(
        Array.from({ length: 12 }, (_, m) =>
          fetch(`${BASE_URL}/api/budget-settings`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${userToken}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              anno: selectedYear,
              mese: m,
              isYearly: false,
              settings: {
                spese: activeTab === 'expenses'
                  ? (prevResults[m].spese || {})
                  : (currResults[m].spese || {}),
                entrate: activeTab === 'income'
                  ? (prevResults[m].entrate || {})
                  : (currResults[m].entrate || {})
              }
            })
          })
        )
      );

      Alert.alert(
        'Success',
        `${activeTab === 'expenses' ? 'Expense' : 'Income'} budgets copied from ${prevYear} to ${selectedYear}`
      );
      loadData();
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'Unable to copy previous year values');
    } finally {
      setIsLoading(false);
    }
  };

  const renderMonthPicker = () => (
    <Modal visible={isMonthModalVisible} transparent animationType="slide">
      <View style={styles.modalOverlayPicker}>
        <View style={[styles.pickerModalContent, { backgroundColor: t.surface }]}>
          <Text style={[styles.modalTitlePicker, { color: t.text }]}>Select Month</Text>
          <ScrollView>
            {monthsWithYearly.map((m, idx) => (
              <TouchableOpacity
                key={m}
                style={[styles.pickerItem, { borderBottomColor: t.line }, selectedMonth === idx && { backgroundColor: t.surface2 }]}
                onPress={() => {
                  setSelectedMonth(idx);
                  setIsMonthModalVisible(false);
                }}
              >
                <Text style={[styles.pickerItemText, { color: t.text }, selectedMonth === idx && styles.pickerItemTextActive]}>{m}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <TouchableOpacity style={styles.closeButtonPicker} onPress={() => setIsMonthModalVisible(false)}>
            <Text style={styles.closeButtonTextPicker}>Close</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );

  const renderYearPicker = () => (
    <Modal visible={isYearModalVisible} transparent animationType="slide">
      <View style={styles.modalOverlayPicker}>
        <View style={[styles.pickerModalContent, { backgroundColor: t.surface }]}>
          <Text style={[styles.modalTitlePicker, { color: t.text }]}>Select Year</Text>
          <ScrollView>
            {years.map(y => (
              <TouchableOpacity
                key={y}
                style={[styles.pickerItem, { borderBottomColor: t.line }, selectedYear === y && { backgroundColor: t.surface2 }]}
                onPress={() => {
                  setSelectedYear(y);
                  setIsYearModalVisible(false);
                }}
              >
                <Text style={[styles.pickerItemText, { color: t.text }, selectedYear === y && styles.pickerItemTextActive]}>{y}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <TouchableOpacity style={styles.closeButtonPicker} onPress={() => setIsYearModalVisible(false)}>
            <Text style={styles.closeButtonTextPicker}>Close</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );


  // Rename Category State
  const [isRenameModalVisible, setIsRenameModalVisible] = useState(false);
  const [categoryToRename, setCategoryToRename] = useState<string | null>(null);
  const [renamedCategoryName, setRenamedCategoryName] = useState('');

  // Add Category State
  const [isAddCatModalVisible, setIsAddCatModalVisible] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');

  const handleAddCategory = () => {
    if (!newCategoryName.trim()) {
      Alert.alert('Error', 'Please enter a category name');
      return;
    }

    if (categories.includes(newCategoryName.trim())) {
      Alert.alert('Error', 'Category already exists');
      return;
    }

    const name = newCategoryName.trim();
    const newCats = [...categories, name];
    const newLocal = { ...localBudget, [name]: '0' };

    setCategories(newCats);
    setLocalBudget(newLocal);
    setIsAddCatModalVisible(false);
    setNewCategoryName('');

    // Autosave immediately
    persistBudget(newLocal, activeTab);
  };

  const handleRenameCategory = async () => {
    if (!categoryToRename || !renamedCategoryName.trim()) {
      Alert.alert('Error', 'Please enter a valid name');
      return;
    }

    const oldName = categoryToRename;
    const newName = renamedCategoryName.trim();
    const type = activeTab === 'expenses' ? 'spese' : 'entrate';

    if (categories.includes(newName)) {
      Alert.alert('Error', 'Category name already exists');
      return;
    }

    try {
      // Optimistic UI Update
      const newCats = categories.map(c => c === oldName ? newName : c);
      const newLocal = { ...localBudget };
      const value = newLocal[oldName];
      delete newLocal[oldName];
      newLocal[newName] = value;

      setCategories(newCats);
      setLocalBudget(newLocal);
      setIsRenameModalVisible(false);
      setCategoryToRename(null);
      setRenamedCategoryName('');

      // Call Global Rename Endpoint
      const response = await fetch(`${BASE_URL}/api/categorie/rename`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${userToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ oldName, newName, type })
      });

      if (!response.ok) {
        throw new Error("Failed to rename global category");
      }

    } catch (error) {
      console.error("Rename failed", error);
      Alert.alert("Error", "Could not rename category globally. Please try again.");
      // Rollback (optional, but good for UX)
      loadData();
    }
  };

  const handleDeleteCategory = (catName: string) => {
    Alert.alert(
      'Delete Category',
      `Are you sure you want to delete "${catName}"? This will remove it from ALL history.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Everywhere', style: 'destructive', onPress: async () => {
            try {
              // Optimistic UI Update
              const newCats = categories.filter(c => c !== catName);
              const newLocal = { ...localBudget };
              delete newLocal[catName];

              setCategories(newCats);
              setLocalBudget(newLocal);

              // Call Global Delete Endpoint (POST for body reliability)
              const type = activeTab === 'expenses' ? 'spese' : 'entrate';
              await fetch(`${BASE_URL}/api/categorie/delete`, {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${userToken}`,
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({ name: catName, type })
              });

            } catch (error) {
              console.error("Delete failed", error);
              Alert.alert("Error", "Could not delete category globally.");
            }
          }
        }
      ]
    );
  };

  if (isLoading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: t.bg }]}>
        <ActivityIndicator size="large" color={ACCENT} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: t.bg }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 100 : 0}
    >
      <View style={[styles.hero, { backgroundColor: t.surface, borderColor: t.line }]}>
        <Text style={[styles.heroEyebrow, { color: t.text3 }]}>
          {activeTab === 'expenses' ? 'EXPENSE BUDGET' : 'INCOME GOALS'}
        </Text>
        <Text style={[styles.heroAmount, { color: t.text }]}>
          {formatCurrency(totalBudget)}
        </Text>
        <View style={[styles.flowRow, { backgroundColor: t.surface2 }]}>
          <View style={styles.flowCell}>
            <View style={[styles.flowDot, { backgroundColor: activeTab === 'expenses' ? t.neg : t.pos }]} />
            <View>
              <Text style={[styles.flowLabel, { color: t.text3 }]}>
                {activeTab === 'expenses' ? 'ACTUAL' : 'EARNED'}
              </Text>
              <Text style={[styles.flowVal, { color: activeTab === 'expenses' ? t.neg : t.pos }]}>
                {formatCurrency(totalActual)}
              </Text>
            </View>
          </View>
          <View style={[styles.flowDivider, { backgroundColor: t.line2 }]} />
          <View style={styles.flowCell}>
            <View style={[styles.flowDot, { backgroundColor: ACCENT }]} />
            <View>
              <Text style={[styles.flowLabel, { color: t.text3 }]}>USED</Text>
              <Text style={[styles.flowVal, { color: t.text }]}>{totalPct}%</Text>
            </View>
          </View>
        </View>
      </View>

      {/* Period Selection */}
      <View style={styles.periodContainer}>
        <TouchableOpacity style={[styles.periodButton, { backgroundColor: t.surface, borderColor: t.line }]} onPress={() => setIsMonthModalVisible(true)}>
          <Text style={[styles.periodButtonText, { color: t.text }]}>{isYearlyMode ? 'Full Year' : months[selectedMonth]}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.periodButton, { backgroundColor: t.surface, borderColor: t.line }]} onPress={() => setIsYearModalVisible(true)}>
          <Text style={[styles.periodButtonText, { color: t.text }]}>{selectedYear}</Text>
        </TouchableOpacity>
      </View>

      {!isYearlyMode ? (
        <TouchableOpacity style={[styles.copyButton, { backgroundColor: t.surface, borderColor: t.line2 }]} onPress={handleCopyFromPrevious}>
          <Text style={[styles.copyButtonText, { color: t.text2 }]}>
            Copy values from {months[selectedMonth === 0 ? 11 : selectedMonth - 1]}
          </Text>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity
          style={[styles.copyButton, { backgroundColor: t.surface, borderColor: t.line2 }]}
          onPress={handleCopyPreviousYear}
        >
          <Text style={[styles.copyButtonText, { color: t.text2 }]}>
            Copy {activeTab === 'expenses' ? 'expenses' : 'income'} from {selectedYear - 1}
          </Text>
        </TouchableOpacity>
      )}

      {/* Tabs */}
      <View style={[styles.tabContainer, { backgroundColor: t.surface2 }]}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'expenses' && { backgroundColor: t.neg }]}
          onPress={() => setActiveTab('expenses')}
        >
          <Text style={[styles.tabText, { color: t.text }, activeTab === 'expenses' && styles.activeTabText]}>Expenses</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'income' && { backgroundColor: t.pos }]}
          onPress={() => setActiveTab('income')}
        >
          <Text style={[styles.tabText, { color: t.text }, activeTab === 'income' && styles.activeTabText]}>Income (Goals)</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollContent} contentContainerStyle={{ paddingBottom: 100 }}>
        {/* Add Category Button */}
        <TouchableOpacity
          style={[styles.addCategoryButton, { backgroundColor: t.surface, borderColor: t.line }]}
          onPress={() => setIsAddCatModalVisible(true)}
        >
          <Text style={[styles.addCategoryText, { color: t.text2 }]}>+ Add New Category</Text>
        </TouchableOpacity>

        {categories.map((cat) => {
          const spending = isYearlyMode ? (yearlyActual[cat] || 0) : (actualSpending[cat] || 0);
          const limitStr = localBudget[cat] || '0';
          const limit = isYearlyMode ? (yearlyBudget[cat] || 0) : (parseFloat(limitStr.replace(',', '.')) || 0);

          return (
            <View key={cat} style={[styles.budgetCard, { backgroundColor: t.surface, borderColor: t.line }]}>
              <View style={styles.cardHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                  <TouchableOpacity
                    onPress={() => {
                      setCategoryToRename(cat);
                      setRenamedCategoryName(cat);
                      setIsRenameModalVisible(true);
                    }}
                    style={{
                      marginRight: 8,
                      backgroundColor: t.surface2,
                      width: 34,
                      height: 34,
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: 10,
                      borderWidth: 1,
                      borderColor: t.line
                    }}
                  >
                    <Text style={{ fontSize: 16 }}>✏️</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => handleDeleteCategory(cat)}
                    style={{
                      marginRight: 8,
                      backgroundColor: t.surface2,
                      width: 34,
                      height: 34,
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: 10,
                      borderWidth: 1,
                      borderColor: t.line
                    }}
                  >
                    <Text style={{ fontSize: 16 }}>🗑️</Text>
                  </TouchableOpacity>
                  <Text style={[styles.catName, { color: t.text }]} numberOfLines={1}>{cat}</Text>
                </View>
                <View style={[styles.inputContainer, { backgroundColor: t.surface2, borderColor: t.line }]}>
                  <Text style={[styles.currency, { color: t.text2 }]}>{currency}</Text>
                  <TextInput
                    style={[styles.input, { color: t.text }, isYearlyMode && { color: t.text2 }]}
                    keyboardType="numeric"
                    value={limitStr}
                    editable={!isYearlyMode}
                    onChangeText={isYearlyMode ? undefined : (text) => {
                      const cleaned = text.replace(/^0+(\d)/, '$1');
                      setLocalBudget(prev => ({ ...prev, [cat]: cleaned }));
                    }}
                    onEndEditing={isYearlyMode ? undefined : () => persistBudget(localBudget, activeTab)}
                    placeholder="0"
                    placeholderTextColor={t.text3}
                    inputAccessoryViewID="budgetInputAccessory"
                  />
                </View>
              </View>

              <View style={styles.statsRow}>
                <Text style={[styles.spentText, { color: t.text2 }]}>
                  Actual: <Text style={{ fontWeight: 'bold' }}>{currency}{spending.toFixed(2)}</Text>
                </Text>
              </View>

              <View style={styles.scrubberContainer}>
                <View style={[styles.scrubberTrack, { backgroundColor: t.surface2 }]}>
                  <View
                    style={[
                      styles.scrubberFill,
                      {
                        width: `${Math.min((spending / (limit || 1)) * 100, 100)}%`,
                        backgroundColor: (limit > 0 && spending > limit) ? '#EF4444' : (activeTab === 'expenses' ? '#DC2626' : '#059669')
                      }
                    ]}
                  />
                </View>
                <Text style={[styles.scrubberText, { color: t.text2 }]}>
                  {((spending / (limit || 1)) * 100).toFixed(0)}%
                </Text>
              </View>
            </View>
          );
        })}

        {categories.length === 0 && (
          <Text style={[styles.emptyText, { color: t.text3 }]}>No categories found.</Text>
        )}
      </ScrollView>

      {/* Rename Category Modal */}
      <Modal
        visible={isRenameModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setIsRenameModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: t.surface }]}>
            <Text style={[styles.modalTitle, { color: t.text }]}>Modify Category</Text>
            <Text style={[styles.modalSubtitle, { color: t.text2 }]}>Rename "{categoryToRename}" to:</Text>

            <TextInput
              style={[styles.modalInput, { backgroundColor: t.surface2, color: t.text }]}
              placeholder="New name..."
              placeholderTextColor={t.text3}
              value={renamedCategoryName}
              onChangeText={setRenamedCategoryName}
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalBtnCancel, { backgroundColor: t.surface2 }]}
                onPress={() => setIsRenameModalVisible(false)}
              >
                <Text style={[styles.modalBtnTextCancel, { color: t.text }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalBtnSave]}
                onPress={handleRenameCategory}
              >
                <Text style={styles.modalBtnTextSave}>Rename</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Add Category Modal */}
      <Modal
        visible={isAddCatModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setIsAddCatModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: t.surface }]}>
            <Text style={[styles.modalTitle, { color: t.text }]}>New Category</Text>
            <Text style={[styles.modalSubtitle, { color: t.text2 }]}>Enter category name for {activeTab}</Text>

            <TextInput
              style={[styles.modalInput, { backgroundColor: t.surface2, color: t.text }]}
              placeholder="e.g. Vacation, Hobbies"
              placeholderTextColor={t.text3}
              value={newCategoryName}
              onChangeText={setNewCategoryName}
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalBtnCancel, { backgroundColor: t.surface2 }]}
                onPress={() => setIsAddCatModalVisible(false)}
              >
                <Text style={[styles.modalBtnTextCancel, { color: t.text }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalBtnSave]}
                onPress={handleAddCategory}
              >
                <Text style={styles.modalBtnTextSave}>Add</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {isSaving && (
        <View style={[styles.savingIndicator, { backgroundColor: t.surface2 }]}>
          <ActivityIndicator size="small" color={ACCENT} />
          <Text style={[styles.savingText, { color: t.text2 }]}>Saving...</Text>
        </View>
      )}

      {renderMonthPicker()}
      {renderYearPicker()}

      <InputAccessoryView nativeID="budgetInputAccessory">
        <View style={[styles.keyboardAccessory, { backgroundColor: t.surface, borderTopColor: t.line }]}>
          <TouchableOpacity
            onPress={() => {
              Keyboard.dismiss();
              persistBudget(localBudget, activeTab);
            }}
            style={styles.keyboardDoneButton}
          >
            <Text style={styles.keyboardDoneText}>Done</Text>
          </TouchableOpacity>
        </View>
      </InputAccessoryView>
    </KeyboardAvoidingView >
  );
};

const styles = StyleSheet.create({
  keyboardAccessory: {
    borderTopWidth: 1,
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  keyboardDoneButton: {
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  keyboardDoneText: {
    color: '#c4f23a',
    fontWeight: '600',
    fontSize: 16,
  },
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
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
  tabContainer: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 12,
    padding: 4,
    gap: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 9,
  },
  tabText: {
    fontWeight: '600',
  },
  activeTabText: {
    color: '#ffffff',
  },
  scrollContent: {
    flex: 1,
    padding: 16,
  },
  budgetCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  catName: {
    fontSize: 15,
    fontWeight: '700',
    flex: 1,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 8,
    width: 100,
    height: 40,
  },
  currency: {
    fontSize: 16,
    marginRight: 4,
  },
  input: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  spentText: {
    fontSize: 14,
  },
  scrubberContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  scrubberTrack: {
    flex: 1,
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  scrubberFill: {
    height: '100%',
    borderRadius: 4,
  },
  scrubberText: {
    fontSize: 12,
    width: 40,
    textAlign: 'right',
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 20,
    fontStyle: 'italic',
  },
  addCategoryButton: {
    padding: 12,
    borderRadius: 12,
    marginBottom: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  addCategoryText: {
    fontWeight: 'bold',
    fontSize: 14,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 20,
  },
  modalContent: {
    borderRadius: 16,
    padding: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  modalSubtitle: {
    fontSize: 14,
    marginBottom: 16,
    textAlign: 'center',
  },
  modalInput: {
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 20,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  modalBtn: {
    flex: 1,
    padding: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  modalBtnCancel: {
  },
  modalBtnSave: {
    backgroundColor: '#c4f23a',
  },
  modalBtnTextCancel: {
    fontWeight: '600',
  },
  modalBtnTextSave: {
    color: '#0c0c0c',
    fontWeight: '600',
  },
  savingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 8,
    marginHorizontal: 16,
    marginBottom: 20,
  },
  savingText: {
    fontSize: 12,
    marginLeft: 8,
  },
  periodContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  periodButton: {
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    width: '48%',
    alignItems: 'center',
  },
  periodButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  copyButton: {
    marginHorizontal: 16,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
    alignItems: 'center',
    marginBottom: 12,
  },
  copyButtonText: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  modalOverlayPicker: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pickerModalContent: {
    width: '80%',
    maxHeight: '70%',
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 5,
  },
  pickerItem: {
    paddingVertical: 15,
    borderBottomWidth: 1,
  },
  pickerItemActive: {
  },
  pickerItemText: {
    fontSize: 18,
    textAlign: 'center',
  },
  pickerItemTextActive: {
    color: '#c4f23a',
    fontWeight: 'bold',
  },
  closeButtonPicker: {
    marginTop: 20,
    backgroundColor: '#c4f23a',
    padding: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  closeButtonTextPicker: {
    color: '#0c0c0c',
    fontSize: 16,
    fontWeight: 'bold',
  },
  modalTitlePicker: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  }
});

export default BudgetScreen;
