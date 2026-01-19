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
  Modal
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import { API_URL } from '../config';

const BASE_URL = API_URL;

interface BudgetScreenProps {
  navigation: any;
}

const BudgetScreen: React.FC<BudgetScreenProps> = ({ navigation }) => {
  const { userToken, logout } = useAuth();
  const { currency, isDarkMode } = useSettings();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const today = new Date();
  const [selectedMonth, setSelectedMonth] = useState(today.getMonth());
  const [selectedYear, setSelectedYear] = useState(today.getFullYear());

  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const years = [2024, 2025, 2026, 2027];

  const [isMonthModalVisible, setIsMonthModalVisible] = useState(false);
  const [isYearModalVisible, setIsYearModalVisible] = useState(false);

  // Data State
  const [categories, setCategories] = useState<string[]>([]);
  const [budgetSettings, setBudgetSettings] = useState<Record<string, number>>({});
  const [actualSpending, setActualSpending] = useState<Record<string, number>>({});

  // Dirty State (changes made by user)
  const [localBudget, setLocalBudget] = useState<Record<string, string>>({}); // Store as string for TextInput

  const [activeTab, setActiveTab] = useState<'expenses' | 'income'>('expenses');

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

      // 2. Fetch Current Budget Settings (Limits)
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

      // 3. Fetch Actual Spending (Transactions)
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
        <View style={styles.scrubberTrack}>
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
        <Text style={styles.scrubberText}>
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

  const renderMonthPicker = () => (
    <Modal visible={isMonthModalVisible} transparent animationType="slide">
      <View style={styles.modalOverlayPicker}>
        <View style={[styles.pickerModalContent, isDarkMode && { backgroundColor: '#1F2937' }]}>
          <Text style={[styles.modalTitlePicker, isDarkMode && { color: '#F9FAFB' }]}>Select Month</Text>
          <ScrollView>
            {months.map((m, idx) => (
              <TouchableOpacity
                key={m}
                style={[styles.pickerItem, isDarkMode && { borderBottomColor: '#374151' }, selectedMonth === idx && (isDarkMode ? { backgroundColor: '#374151' } : styles.pickerItemActive)]}
                onPress={() => {
                  setSelectedMonth(idx);
                  setIsMonthModalVisible(false);
                }}
              >
                <Text style={[styles.pickerItemText, isDarkMode && { color: '#D1D5DB' }, selectedMonth === idx && styles.pickerItemTextActive]}>{m}</Text>
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
        <View style={[styles.pickerModalContent, isDarkMode && { backgroundColor: '#1F2937' }]}>
          <Text style={[styles.modalTitlePicker, isDarkMode && { color: '#F9FAFB' }]}>Select Year</Text>
          <ScrollView>
            {years.map(y => (
              <TouchableOpacity
                key={y}
                style={[styles.pickerItem, isDarkMode && { borderBottomColor: '#374151' }, selectedYear === y && (isDarkMode ? { backgroundColor: '#374151' } : styles.pickerItemActive)]}
                onPress={() => {
                  setSelectedYear(y);
                  setIsYearModalVisible(false);
                }}
              >
                <Text style={[styles.pickerItemText, isDarkMode && { color: '#D1D5DB' }, selectedYear === y && styles.pickerItemTextActive]}>{y}</Text>
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
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4F46E5" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[styles.container, isDarkMode && { backgroundColor: '#111827' }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 100 : 0}
    >
      <View style={[styles.header, isDarkMode && { backgroundColor: '#111827', borderBottomColor: '#374151' }]}>
        <Text style={[styles.title, isDarkMode && { color: '#F9FAFB' }]}>Budget Planner</Text>
        <Text style={[styles.subtitle, isDarkMode && { color: '#9CA3AF' }]}>Manage your monthly limits</Text>
      </View>

      {/* Period Selection */}
      <View style={styles.periodContainer}>
        <TouchableOpacity style={[styles.periodButton, isDarkMode && { backgroundColor: '#1F2937', borderColor: '#374151' }]} onPress={() => setIsMonthModalVisible(true)}>
          <Text style={[styles.periodButtonText, isDarkMode && { color: '#F9FAFB' }]}>{months[selectedMonth]}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.periodButton, isDarkMode && { backgroundColor: '#1F2937', borderColor: '#374151' }]} onPress={() => setIsYearModalVisible(true)}>
          <Text style={[styles.periodButtonText, isDarkMode && { color: '#F9FAFB' }]}>{selectedYear}</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.copyButton} onPress={handleCopyFromPrevious}>
        <Text style={styles.copyButtonText}>
          Copy values from {months[selectedMonth === 0 ? 11 : selectedMonth - 1]}
        </Text>
      </TouchableOpacity>

      {/* Tabs */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, isDarkMode && { backgroundColor: '#374151' }, activeTab === 'expenses' && styles.activeTab]}
          onPress={() => setActiveTab('expenses')}
        >
          <Text style={[styles.tabText, isDarkMode && { color: '#D1D5DB' }, activeTab === 'expenses' && styles.activeTabText]}>Expenses</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, isDarkMode && { backgroundColor: '#374151' }, activeTab === 'income' && styles.activeTab]}
          onPress={() => setActiveTab('income')}
        >
          <Text style={[styles.tabText, isDarkMode && { color: '#D1D5DB' }, activeTab === 'income' && styles.activeTabText]}>Income (Goals)</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollContent} contentContainerStyle={{ paddingBottom: 100 }}>
        {/* Add Category Button */}
        <TouchableOpacity
          style={[styles.addCategoryButton, isDarkMode && { backgroundColor: '#312e81', borderColor: '#4338ca' }]}
          onPress={() => setIsAddCatModalVisible(true)}
        >
          <Text style={[styles.addCategoryText, isDarkMode && { color: '#e0e7ff' }]}>+ Add New Category</Text>
        </TouchableOpacity>

        {categories.map((cat) => {
          const spending = actualSpending[cat] || 0;
          const limitStr = localBudget[cat] || '0';
          const limit = parseFloat(limitStr.replace(',', '.')) || 0;

          return (
            <View key={cat} style={[styles.budgetCard, isDarkMode && { backgroundColor: '#1F2937' }]}>
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
                      backgroundColor: isDarkMode ? '#1e1b4b' : '#EEF2FF',
                      padding: 6,
                      borderRadius: 6,
                      borderWidth: 1,
                      borderColor: isDarkMode ? '#312e81' : '#C7D2FE'
                    }}
                  >
                    <Text style={{ fontSize: 16 }}>✏️</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => handleDeleteCategory(cat)}
                    style={{
                      marginRight: 8,
                      backgroundColor: isDarkMode ? '#450a0a' : '#FEF2F2',
                      padding: 6,
                      borderRadius: 6,
                      borderWidth: 1,
                      borderColor: isDarkMode ? '#7f1d1d' : '#FECACA'
                    }}
                  >
                    <Text style={{ fontSize: 16 }}>🗑️</Text>
                  </TouchableOpacity>
                  <Text style={[styles.catName, isDarkMode && { color: '#E5E7EB' }]} numberOfLines={1}>{cat}</Text>
                </View>
                <View style={[styles.inputContainer, isDarkMode && { backgroundColor: '#374151' }]}>
                  <Text style={[styles.currency, isDarkMode && { color: '#9CA3AF' }]}>{currency}</Text>
                  <TextInput
                    style={[styles.input, isDarkMode && { color: '#F9FAFB' }]}
                    keyboardType="numeric"
                    value={limitStr}
                    onChangeText={(text) => setLocalBudget(prev => ({ ...prev, [cat]: text }))}
                    onEndEditing={() => persistBudget(localBudget, activeTab)}
                    placeholder="0"
                    placeholderTextColor={isDarkMode ? '#6B7280' : '#9CA3AF'}
                  />
                </View>
              </View>

              <View style={styles.statsRow}>
                <Text style={[styles.spentText, isDarkMode && { color: '#9CA3AF' }]}>
                  Actual: <Text style={{ fontWeight: 'bold' }}>{currency}{spending.toFixed(2)}</Text>
                </Text>
              </View>

              <View style={styles.scrubberContainer}>
                <View style={[styles.scrubberTrack, isDarkMode && { backgroundColor: '#374151' }]}>
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
                <Text style={[styles.scrubberText, isDarkMode && { color: '#9CA3AF' }]}>
                  {((spending / (limit || 1)) * 100).toFixed(0)}%
                </Text>
              </View>
            </View>
          );
        })}

        {categories.length === 0 && (
          <Text style={styles.emptyText}>No categories found.</Text>
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
          <View style={[styles.modalContent, isDarkMode && { backgroundColor: '#1F2937' }]}>
            <Text style={[styles.modalTitle, isDarkMode && { color: '#F9FAFB' }]}>Modify Category</Text>
            <Text style={[styles.modalSubtitle, isDarkMode && { color: '#9CA3AF' }]}>Rename "{categoryToRename}" to:</Text>

            <TextInput
              style={[styles.modalInput, isDarkMode && { backgroundColor: '#374151', color: '#F9FAFB' }]}
              placeholder="New name..."
              placeholderTextColor={isDarkMode ? '#6B7280' : '#9CA3AF'}
              value={renamedCategoryName}
              onChangeText={setRenamedCategoryName}
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalBtnCancel, isDarkMode && { backgroundColor: '#374151' }]}
                onPress={() => setIsRenameModalVisible(false)}
              >
                <Text style={[styles.modalBtnTextCancel, isDarkMode && { color: '#D1D5DB' }]}>Cancel</Text>
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
          <View style={[styles.modalContent, isDarkMode && { backgroundColor: '#1F2937' }]}>
            <Text style={[styles.modalTitle, isDarkMode && { color: '#F9FAFB' }]}>New Category</Text>
            <Text style={[styles.modalSubtitle, isDarkMode && { color: '#9CA3AF' }]}>Enter category name for {activeTab}</Text>

            <TextInput
              style={[styles.modalInput, isDarkMode && { backgroundColor: '#374151', color: '#F9FAFB' }]}
              placeholder="e.g. Vacation, Hobbies"
              placeholderTextColor={isDarkMode ? '#6B7280' : '#9CA3AF'}
              value={newCategoryName}
              onChangeText={setNewCategoryName}
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalBtnCancel, isDarkMode && { backgroundColor: '#374151' }]}
                onPress={() => setIsAddCatModalVisible(false)}
              >
                <Text style={[styles.modalBtnTextCancel, isDarkMode && { color: '#D1D5DB' }]}>Cancel</Text>
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
        <View style={styles.savingIndicator}>
          <ActivityIndicator size="small" color="#6366F1" />
          <Text style={styles.savingText}>Saving...</Text>
        </View>
      )}

      {renderMonthPicker()}
      {renderYearPicker()}
    </KeyboardAvoidingView >
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    padding: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
  },
  subtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 4,
  },
  tabContainer: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
    backgroundColor: '#E5E7EB',
  },
  activeTab: {
    backgroundColor: '#4F46E5',
    alignItems: 'center',
  },
  tabText: {
    fontWeight: '600',
    color: '#374151',
  },
  activeTabText: {
    color: '#ffffff',
  },
  scrollContent: {
    flex: 1,
    padding: 16,
  },
  budgetCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  catName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#111827',
    flex: 1,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    paddingHorizontal: 8,
    width: 100,
    height: 40,
  },
  currency: {
    fontSize: 16,
    color: '#6B7280',
    marginRight: 4,
  },
  input: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  spentText: {
    fontSize: 14,
    color: '#6B7280',
  },
  scrubberContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  scrubberTrack: {
    flex: 1,
    height: 8,
    backgroundColor: '#E5E7EB',
    borderRadius: 4,
    overflow: 'hidden',
  },
  scrubberFill: {
    height: '100%',
    borderRadius: 4,
  },
  scrubberText: {
    fontSize: 12,
    color: '#6B7280',
    width: 40,
    textAlign: 'right',
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 20,
    color: '#9CA3AF',
    fontStyle: 'italic',
  },
  addCategoryButton: {
    backgroundColor: '#E0E7FF',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  addCategoryText: {
    color: '#4F46E5',
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
    backgroundColor: 'white',
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
    color: '#6B7280',
    marginBottom: 16,
    textAlign: 'center',
  },
  modalInput: {
    backgroundColor: '#F3F4F6',
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
    borderRadius: 8,
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
    color: 'white',
    fontWeight: '600',
  },
  savingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    backgroundColor: '#EEF2FF',
    borderRadius: 8,
    marginHorizontal: 16,
    marginBottom: 20,
  },
  savingText: {
    color: '#6366F1',
    fontSize: 12,
    marginLeft: 8,
  },
  periodContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginBottom: 10,
    marginTop: 10,
  },
  periodButton: {
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    width: '48%',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  periodButtonText: {
    color: '#111827',
    fontSize: 16,
    fontWeight: '600',
  },
  copyButton: {
    backgroundColor: '#4F46E5',
    marginHorizontal: 16,
    padding: 12,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 10,
  },
  copyButtonText: {
    color: '#FFFFFF',
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
    backgroundColor: '#fff',
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
    borderBottomColor: '#F3F4F6',
  },
  pickerItemActive: {
    backgroundColor: '#F3F4F6',
  },
  pickerItemText: {
    color: '#374151',
    fontSize: 18,
    textAlign: 'center',
  },
  pickerItemTextActive: {
    color: '#4F46E5',
    fontWeight: 'bold',
  },
  closeButtonPicker: {
    marginTop: 20,
    backgroundColor: '#FF6B6B',
    padding: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  closeButtonTextPicker: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  modalTitlePicker: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
    color: '#111827',
  }
});

export default BudgetScreen;