import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    View,
    Text,
    ScrollView,
    StyleSheet,
    TouchableOpacity,
    ActivityIndicator,
    RefreshControl,
    Modal,
    TextInput,
    KeyboardAvoidingView,
    Platform,
    Alert,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import { useAppTheme } from '../hooks/useAppTheme';
import { API_URL } from '../config';
import { warmupBackend } from '../utils/apiClient';
import { useFocusEffect } from '@react-navigation/native';

const BASE_URL = API_URL;
const ACCENT = '#c4f23a';

const CATEGORY_COLORS = [
    '#c4f23a', '#7dd3fc', '#fb923c', '#f472b6', '#a78bfa',
    '#34d399', '#fbbf24', '#f87171', '#60a5fa', '#facc15',
];

const MONTHS = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
];

function getCategoryColor(key: string): string {
    let hash = 0;
    const s = (key || '?').toString();
    for (let i = 0; i < s.length; i++) {
        hash = s.charCodeAt(i) + ((hash << 5) - hash);
    }
    return CATEGORY_COLORS[Math.abs(hash) % CATEGORY_COLORS.length];
}

const HomeScreen = ({ navigation }: { navigation: any }) => {
    const { userToken, logout } = useAuth();
    const { currency, showBalance } = useSettings();
    const t = useAppTheme();
    const [isLoading, setIsLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const abortControllerRef = useRef<AbortController | null>(null);

    // ── Month navigation ────────────────────────────────────
    const [selectedMonth, setSelectedMonth] = useState(() => new Date().getMonth());
    const [selectedYear, setSelectedYear] = useState(() => new Date().getFullYear());

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
    const isFutureMonth =
        selectedYear > new Date().getFullYear() ||
        (selectedYear === new Date().getFullYear() && selectedMonth > new Date().getMonth());

    // ── Dashboard data ──────────────────────────────────────
    const [riepilogoData, setRiepilogoData] = useState({
        totaleSpeseMese: 0,
        totaleEntrateMese: 0,
        bilancioMese: 0,
        numeroTransazioniMese: 0,
        ultime5Transazioni: [] as any[],
        dettagliCategorie: {
            spese: [] as [string, number][],
            entrate: [] as [string, number][],
        },
    });

    const [budgetData, setBudgetData] = useState({
        budgetSpeseMese: 0,
        budgetEntrateMese: 0
    });

    const [savingsData, setSavingsData] = useState<{
        savings: number;
        allocatedPercent: number;
        monthId: string | null;
    } | null>(null);

    // ── Quick-add modal ─────────────────────────────────────
    const [showQuickAddModal, setShowQuickAddModal] = useState(false);
    const [qaType, setQaType] = useState<'uscita' | 'entrata'>('uscita');
    const [qaAmount, setQaAmount] = useState('');
    const [qaCategory, setQaCategory] = useState('');
    const [qaDescription, setQaDescription] = useState('');
    const [isSavingQa, setIsSavingQa] = useState(false);

    // ── Header settings ─────────────────────────────────────
    useEffect(() => {
        navigation.setOptions({
            headerRight: () => (
                <TouchableOpacity onPress={() => navigation.navigate('Settings')} style={{ marginRight: 15 }}>
                    <Text style={{ fontSize: 22 }}>⚙️</Text>
                </TouchableOpacity>
            ),
        });
    }, [navigation, logout]);

    // ── Data loading ────────────────────────────────────────
    const caricaDati = async (signal?: AbortSignal) => {
        try {
            await warmupBackend();
            if (signal?.aborted) return;

            const mese = selectedMonth;
            const anno = selectedYear;
            const inizioMese = new Date(anno, mese, 1);

            const [speseRes, entrateRes, budgetRes] = await Promise.all([
                fetch(`${BASE_URL}/api/spese?limit=1000`, { headers: { 'Authorization': `Bearer ${userToken}` }, signal }),
                fetch(`${BASE_URL}/api/entrate?limit=1000`, { headers: { 'Authorization': `Bearer ${userToken}` }, signal }),
                fetch(`${BASE_URL}/api/budget-settings?anno=${anno}&mese=${mese}`, {
                    headers: { 'Authorization': `Bearer ${userToken}` },
                    signal,
                })
            ]);

            if (signal?.aborted) return;

            const speseData = await speseRes.json();
            const entrateData = await entrateRes.json();
            const budgetSettings = budgetRes.ok ? await budgetRes.json() : { spese: {}, entrate: {} };

            if (signal?.aborted) return;

            const tutte_spese = speseData.spese || [];
            const tutte_entrate = entrateData.entrate || [];

            // Filter by selected month
            const speseMese = tutte_spese.filter((s: any) => {
                const d = new Date(s.data);
                return d.getFullYear() === anno && d.getMonth() === mese;
            });
            const entrateMese = tutte_entrate.filter((e: any) => {
                const d = new Date(e.data);
                return d.getFullYear() === anno && d.getMonth() === mese;
            });

            const tutte_transazioni = [
                ...speseMese.map((s: any) => ({ ...s, type: 'uscita', importo: -Math.abs(s.importo) })),
                ...entrateMese.map((e: any) => ({ ...e, type: 'entrata', importo: Math.abs(e.importo) }))
            ].sort((a, b) =>
                new Date(b.data || b.createdAt).getTime() - new Date(a.data || a.createdAt).getTime()
            );

            const totaleSpeseMese = speseMese.reduce((sum: number, s: any) => sum + Math.abs(s.importo), 0);
            const totaleEntrateMese = entrateMese.reduce((sum: number, e: any) => sum + e.importo, 0);

            // Categorie
            const catSpese: { [key: string]: number } = {};
            speseMese.forEach((s: any) => {
                catSpese[s.categoria] = (catSpese[s.categoria] || 0) + Math.abs(s.importo);
            });
            const catEntrate: { [key: string]: number } = {};
            entrateMese.forEach((e: any) => {
                catEntrate[e.categoria] = (catEntrate[e.categoria] || 0) + e.importo;
            });

            // Budget
            const totBudgetSpese = Object.values(budgetSettings.spese || {}).reduce((a: any, b: any) => a + b, 0) as number;
            const totBudgetEntrate = Object.values(budgetSettings.entrate || {}).reduce((a: any, b: any) => a + b, 0) as number;

            setRiepilogoData({
                totaleSpeseMese,
                totaleEntrateMese,
                bilancioMese: totaleEntrateMese - totaleSpeseMese,
                numeroTransazioniMese: speseMese.length + entrateMese.length,
                ultime5Transazioni: tutte_transazioni.slice(0, 5),
                dettagliCategorie: {
                    spese: Object.entries(catSpese).sort((a, b) => b[1] - a[1]).slice(0, 5),
                    entrate: Object.entries(catEntrate).sort((a, b) => b[1] - a[1]).slice(0, 5),
                }
            });

            setBudgetData({
                budgetSpeseMese: totBudgetSpese,
                budgetEntrateMese: totBudgetEntrate
            });

            // Fire-and-forget auto-close — only for current month
            const now = new Date();
            if (mese === now.getMonth() && anno === now.getFullYear()) {
                fetch(`${BASE_URL}/api/savings/auto-close`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${userToken}`, 'Content-Type': 'application/json' },
                }).catch(() => {});
            }

            // Fetch savings months
            if (!isFutureMonth) {
                const savingsRes = await fetch(`${BASE_URL}/api/savings/months`, {
                    headers: { 'Authorization': `Bearer ${userToken}` },
                    signal,
                });
                if (savingsRes.ok) {
                    const savingsJson = await savingsRes.json();
                    if (signal?.aborted) return;
                    if (savingsJson.success && savingsJson.data.length > 0) {
                        const latestMonth = savingsJson.data.find(
                            (m: any) => m.anno === anno && m.mese === mese
                        );
                        if (latestMonth) {
                            const allocRes = await fetch(`${BASE_URL}/api/savings/months/${latestMonth._id}/allocations`, {
                                headers: { 'Authorization': `Bearer ${userToken}` },
                                signal,
                            });
                            if (allocRes.ok) {
                                const allocJson = await allocRes.json();
                                if (signal?.aborted) return;
                                let allocatedPercent = 0;
                                if (allocJson.success && latestMonth.savings > 0) {
                                    const totalAllocated = allocJson.data.reduce((sum: number, a: any) => sum + a.amount, 0);
                                    allocatedPercent = Math.min(100, Math.round((totalAllocated / latestMonth.savings) * 100));
                                }
                                setSavingsData({ savings: latestMonth.savings, allocatedPercent, monthId: latestMonth._id });
                            } else {
                                setSavingsData(null);
                            }
                        } else {
                            setSavingsData(null);
                        }
                    } else {
                        setSavingsData(null);
                    }
                } else {
                    setSavingsData(null);
                }
            } else {
                setSavingsData(null);
            }

        } catch (error: any) {
            if (error?.name !== 'AbortError') {
                console.error("Errore caricamento dashboard:", error);
            }
        } finally {
            if (!signal?.aborted) {
                setIsLoading(false);
                setRefreshing(false);
            }
        }
    };

    useFocusEffect(
        useCallback(() => {
            if (userToken) {
                abortControllerRef.current?.abort();
                abortControllerRef.current = new AbortController();
                caricaDati(abortControllerRef.current.signal);
            }
            return () => {
                abortControllerRef.current?.abort();
            };
        }, [userToken])
    );

    useEffect(() => {
        if (!userToken) return;
        abortControllerRef.current?.abort();
        abortControllerRef.current = new AbortController();
        caricaDati(abortControllerRef.current.signal);
    }, [selectedMonth, selectedYear]);

    const onRefresh = () => {
        abortControllerRef.current?.abort();
        abortControllerRef.current = new AbortController();
        setRefreshing(true);
        caricaDati(abortControllerRef.current.signal);
    };

    const reloadData = () => {
        abortControllerRef.current?.abort();
        abortControllerRef.current = new AbortController();
        caricaDati(abortControllerRef.current.signal);
    };

    // ── Quick-add handlers ──────────────────────────────────
    const resetQuickAdd = () => {
        setShowQuickAddModal(false);
        setQaType('uscita');
        setQaAmount('');
        setQaCategory('');
        setQaDescription('');
        setIsSavingQa(false);
    };

    const handleSaveQuickAdd = async () => {
        const amount = parseFloat(qaAmount);
        if (isNaN(amount) || amount <= 0) {
            Alert.alert('Error', 'Enter a valid amount');
            return;
        }
        if (!qaCategory.trim()) {
            Alert.alert('Error', 'Enter a category');
            return;
        }
        setIsSavingQa(true);
        try {
            const endpoint = qaType === 'uscita' ? '/api/spese' : '/api/entrate';
            const body = {
                importo: amount,
                categoria: qaCategory.trim(),
                descrizione: qaDescription.trim() || qaCategory.trim(),
                data: new Date(selectedYear, selectedMonth, 1).toISOString().split('T')[0],
            };
            const res = await fetch(`${BASE_URL}${endpoint}`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${userToken}`, 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            if (res.ok) {
                resetQuickAdd();
                reloadData();
            } else {
                const err = await res.json().catch(() => ({}));
                Alert.alert('Error', err.error || 'Could not save transaction');
            }
        } catch (e) {
            Alert.alert('Error', 'Network error');
        } finally {
            setIsSavingQa(false);
        }
    };

    const formatCurrency = (val: number) =>
        showBalance
            ? `${currency}${Math.abs(val).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
            : '****';

    // ── Sub-components ──────────────────────────────────────
    const CategoryChip = ({ label, size = 36 }: { label: string; size?: number }) => (
        <View
            style={{
                width: size,
                height: size,
                borderRadius: Math.round(size * 0.25),
                backgroundColor: getCategoryColor(label),
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
            }}
        >
            <Text style={{ color: '#0c0c0c', fontWeight: '800', fontSize: size <= 28 ? 9 : 10 }}>
                {(label || '?').toUpperCase().slice(0, 3)}
            </Text>
        </View>
    );

    // ── Quick-add Modal ─────────────────────────────────────
    const renderQuickAddModal = () => (
        <Modal
            visible={showQuickAddModal}
            transparent
            animationType="slide"
            onRequestClose={resetQuickAdd}
        >
            <KeyboardAvoidingView
                style={{ flex: 1 }}
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            >
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContainer, { backgroundColor: t.surface }]}>
                        <View style={[styles.sheetGrab, { backgroundColor: t.line2 }]} />
                        <Text style={[styles.modalTitle, { color: t.text }]}>
                            {qaType === 'uscita' ? 'Add expense' : 'Add income'}
                        </Text>

                        {/* Type toggle */}
                        <View style={[styles.modeToggle, { backgroundColor: t.surface2 }]}>
                            {(['uscita', 'entrata'] as const).map(m => (
                                <TouchableOpacity
                                    key={m}
                                    style={[styles.modeBtn, qaType === m && { backgroundColor: m === 'uscita' ? t.neg : t.pos }]}
                                    onPress={() => setQaType(m)}
                                >
                                    <Text
                                        style={[
                                            styles.modeBtnText,
                                            { color: qaType === m ? '#fff' : t.text2 },
                                        ]}
                                    >
                                        {m === 'uscita' ? 'Expense' : 'Income'}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        {/* Amount */}
                        <View style={[styles.field, { backgroundColor: t.surface2, borderColor: qaAmount ? ACCENT : t.line, marginTop: 12 }]}>
                            <Text style={[styles.fieldLabel, { color: t.text3, backgroundColor: t.surface2 }]}>Amount</Text>
                            <Text style={[styles.fieldPrefix, { color: t.text3 }]}>{currency}</Text>
                            <TextInput
                                style={[styles.fieldInput, { color: t.text }]}
                                placeholder="0.00"
                                placeholderTextColor={t.text3}
                                keyboardType="numeric"
                                value={qaAmount}
                                onChangeText={setQaAmount}
                                autoFocus
                            />
                        </View>

                        {/* Category */}
                        <View style={[styles.field, { backgroundColor: t.surface2, borderColor: t.line, marginTop: 8 }]}>
                            <Text style={[styles.fieldLabel, { color: t.text3, backgroundColor: t.surface2 }]}>Category</Text>
                            <TextInput
                                style={[styles.fieldInput, { color: t.text }]}
                                placeholder="e.g. Groceries, Freelance"
                                placeholderTextColor={t.text3}
                                value={qaCategory}
                                onChangeText={setQaCategory}
                                returnKeyType="next"
                            />
                        </View>

                        {/* Description */}
                        <View style={[styles.field, { backgroundColor: t.surface2, borderColor: t.line, marginTop: 8 }]}>
                            <Text style={[styles.fieldLabel, { color: t.text3, backgroundColor: t.surface2 }]}>Description (optional)</Text>
                            <TextInput
                                style={[styles.fieldInput, { color: t.text }]}
                                placeholder="Quick note…"
                                placeholderTextColor={t.text3}
                                value={qaDescription}
                                onChangeText={setQaDescription}
                                returnKeyType="done"
                                onSubmitEditing={handleSaveQuickAdd}
                            />
                        </View>

                        <View style={styles.sheetActions}>
                            <TouchableOpacity
                                style={[styles.sheetCancel, { backgroundColor: t.surface2 }]}
                                onPress={resetQuickAdd}
                            >
                                <Text style={[styles.sheetCancelText, { color: t.text }]}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.sheetSave, { backgroundColor: qaType === 'uscita' ? t.neg : t.pos }]}
                                onPress={handleSaveQuickAdd}
                                disabled={isSavingQa}
                            >
                                {isSavingQa
                                    ? <ActivityIndicator size="small" color="#fff" />
                                    : <Text style={styles.sheetSaveText}>Save</Text>
                                }
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </KeyboardAvoidingView>
        </Modal>
    );

    // ── Loading state ───────────────────────────────────────
    if (isLoading) {
        return (
            <View style={[styles.container, styles.loadingContainer, { backgroundColor: t.bg }]}>
                <ActivityIndicator size="large" color={ACCENT} />
            </View>
        );
    }

    // ── Main render ────────────────────────────────────────
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

            <ScrollView
                style={{ flex: 1 }}
                contentContainerStyle={{ paddingBottom: 120 }}
                showsVerticalScrollIndicator={false}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={ACCENT} />}
            >
                {/* ── Hero — Monthly Summary ── */}
                <View style={[styles.hero, { backgroundColor: t.surface, borderColor: t.line }]}>
                    <Text style={[styles.heroEyebrow, { color: t.text3 }]}>
                        Overview · {MONTHS[selectedMonth]} {selectedYear}
                    </Text>
                    <Text style={[styles.heroAmount, { color: t.text }]}>
                        {showBalance
                            ? `${riepilogoData.bilancioMese >= 0 ? '+' : ''}${currency}${riepilogoData.bilancioMese.toFixed(2)}`
                            : '****'}
                    </Text>
                    <View style={[styles.flowRow, { backgroundColor: t.surface2 }]}>
                        <View style={styles.flowCell}>
                            <View style={[styles.flowDot, { backgroundColor: t.pos }]} />
                            <View>
                                <Text style={[styles.flowLabel, { color: t.text3 }]}>INCOME</Text>
                                <Text style={[styles.flowVal, { color: t.pos }]}>
                                    {showBalance ? `+${currency}${riepilogoData.totaleEntrateMese.toFixed(2)}` : '****'}
                                </Text>
                            </View>
                        </View>
                        <View style={[styles.flowDivider, { backgroundColor: t.line2 }]} />
                        <View style={styles.flowCell}>
                            <View style={[styles.flowDot, { backgroundColor: t.neg }]} />
                            <View>
                                <Text style={[styles.flowLabel, { color: t.text3 }]}>EXPENSES</Text>
                                <Text style={[styles.flowVal, { color: t.neg }]}>
                                    {showBalance ? `−${currency}${riepilogoData.totaleSpeseMese.toFixed(2)}` : '****'}
                                </Text>
                            </View>
                        </View>
                    </View>
                </View>

                {/* ── Quick action buttons ── */}
                <View style={styles.actionsContainer}>
                    <TouchableOpacity
                        style={[styles.actionBtn, { backgroundColor: t.surface, borderColor: t.neg }]}
                        onPress={() => navigation.navigate('AddTransaction')}
                    >
                        <Text style={[styles.actionBtnText, { color: t.neg }]}>+ Expense</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.actionBtn, { backgroundColor: t.surface, borderColor: t.pos }]}
                        onPress={() => navigation.navigate('AddTransaction', { type: 'entrata' })}
                    >
                        <Text style={[styles.actionBtnText, { color: t.pos }]}>+ Income</Text>
                    </TouchableOpacity>
                </View>

                {/* ── Quick nav grid ── */}
                <View style={[styles.card, { backgroundColor: t.surface, borderColor: t.line, marginHorizontal: 16, marginBottom: 16 }]}>
                    <View style={styles.navGrid}>
                        <TouchableOpacity style={[styles.navBtn, { backgroundColor: t.surface2 }]} onPress={() => navigation.navigate('Transactions')}>
                            <Text style={styles.navIcon}>↗</Text>
                            <Text style={[styles.navLabel, { color: t.text2 }]}>Transactions</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.navBtn, { backgroundColor: t.surface2 }]} onPress={() => navigation.navigate('Budget')}>
                            <Text style={styles.navIcon}>📋</Text>
                            <Text style={[styles.navLabel, { color: t.text2 }]}>Budget</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.navBtn, { backgroundColor: t.surface2 }]} onPress={() => navigation.navigate('Savings' as never)}>
                            <Text style={styles.navIcon}>💰</Text>
                            <Text style={[styles.navLabel, { color: t.text2 }]}>Savings</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.navBtn, { backgroundColor: t.surface2 }]} onPress={() => navigation.navigate('Stats')}>
                            <Text style={styles.navIcon}>📊</Text>
                            <Text style={[styles.navLabel, { color: t.text2 }]}>Stats</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* ── Savings card ── */}
                {savingsData ? (
                    <TouchableOpacity
                        style={[styles.allocCard, { backgroundColor: t.surface, borderColor: t.line }]}
                        onPress={() => navigation.navigate('Savings' as never)}
                    >
                        <View style={styles.rowBetween}>
                            <Text style={[styles.microLabel, { color: t.text3 }]}>MONTHLY SAVINGS</Text>
                            <Text style={[styles.cardPct, { color: ACCENT }]}>{savingsData.allocatedPercent}%</Text>
                        </View>
                        <Text style={[styles.heroAmountSmall, { color: savingsData.savings >= 0 ? t.pos : t.neg, marginTop: 4 }]}>
                            {showBalance
                                ? `${savingsData.savings >= 0 ? '+' : '−'}${currency}${Math.abs(savingsData.savings).toFixed(2)}`
                                : '****'}
                        </Text>
                        <View style={[styles.track, { backgroundColor: t.surface2, marginTop: 12 }]}>
                            <View style={[styles.trackFill, { width: `${savingsData.allocatedPercent}%` as any, backgroundColor: ACCENT }]} />
                        </View>
                        <Text style={[styles.heroSubMeta, { color: t.text3, marginTop: 8 }]}>
                            {savingsData.allocatedPercent}% allocated
                        </Text>
                    </TouchableOpacity>
                ) : !isFutureMonth ? (
                    <View style={[styles.allocCard, { backgroundColor: t.surface, borderColor: t.line, opacity: 0.5 }]}>
                        <Text style={[styles.microLabel, { color: t.text3 }]}>MONTHLY SAVINGS</Text>
                        <Text style={[styles.emptyText, { color: t.text3, marginTop: 8 }]}>No savings data for this month</Text>
                    </View>
                ) : null}

                {/* ── Budget vs Actual ── */}
                <View style={[styles.card, { backgroundColor: t.surface, borderColor: t.line, marginHorizontal: 16, marginBottom: 16 }]}>
                    <View style={styles.sectionHead}>
                        <Text style={[styles.sectionTitle, { color: t.text3 }]}>BUDGET VS ACTUAL</Text>
                        <TouchableOpacity onPress={() => navigation.navigate('Budget')}>
                            <Text style={[styles.sectionMeta, { color: t.text3 }]}>Edit ›</Text>
                        </TouchableOpacity>
                    </View>

                    {/* Expenses bar */}
                    <View style={{ marginTop: 12 }}>
                        <View style={styles.rowBetween}>
                            <Text style={[styles.allocName, { color: t.text }]}>Expenses</Text>
                            <Text style={[styles.allocAmt, { color: t.neg }]}>
                                {showBalance ? `${currency}${riepilogoData.totaleSpeseMese.toFixed(2)}` : '****'}
                            </Text>
                        </View>
                        <View style={[styles.allocBar, { backgroundColor: t.surface2 }]}>
                            <View style={[styles.allocBarFill, {
                                width: `${Math.min((riepilogoData.totaleSpeseMese / (budgetData.budgetSpeseMese || riepilogoData.totaleSpeseMese * 1.2)) * 100, 100)}%` as any,
                                backgroundColor: t.neg,
                            }]} />
                        </View>
                        <Text style={[styles.allocMeta, { color: t.text3, marginTop: 3 }]}>
                            Budget: {showBalance ? `${currency}${budgetData.budgetSpeseMese.toFixed(2)}` : '****'}
                        </Text>
                    </View>

                    <View style={{ height: 16 }} />

                    {/* Income bar */}
                    <View>
                        <View style={styles.rowBetween}>
                            <Text style={[styles.allocName, { color: t.text }]}>Income</Text>
                            <Text style={[styles.allocAmt, { color: t.pos }]}>
                                {showBalance ? `${currency}${riepilogoData.totaleEntrateMese.toFixed(2)}` : '****'}
                            </Text>
                        </View>
                        <View style={[styles.allocBar, { backgroundColor: t.surface2 }]}>
                            <View style={[styles.allocBarFill, {
                                width: `${Math.min((riepilogoData.totaleEntrateMese / (budgetData.budgetEntrateMese || riepilogoData.totaleEntrateMese * 1.2)) * 100, 100)}%` as any,
                                backgroundColor: t.pos,
                            }]} />
                        </View>
                        <Text style={[styles.allocMeta, { color: t.text3, marginTop: 3 }]}>
                            Budget: {showBalance ? `${currency}${budgetData.budgetEntrateMese.toFixed(2)}` : '****'}
                        </Text>
                    </View>
                </View>

                {/* ── Top expenses ── */}
                <View style={{ paddingHorizontal: 16, gap: 12, marginBottom: 16 }}>
                    <View style={[styles.card, { backgroundColor: t.surface, borderColor: t.line }]}>
                        <View style={styles.sectionHead}>
                            <Text style={[styles.sectionTitle, { color: t.text3 }]}>TOP EXPENSES</Text>
                            <TouchableOpacity onPress={() => navigation.navigate('Transactions')}>
                                <Text style={[styles.sectionMeta, { color: t.text3 }]}>All ›</Text>
                            </TouchableOpacity>
                        </View>
                        {riepilogoData.dettagliCategorie.spese.length === 0 ? (
                            <View style={[styles.emptyCard, { backgroundColor: t.surface, borderColor: t.line, marginTop: 8 }]}>
                                <Text style={[styles.emptyText, { color: t.text3 }]}>No expenses this month</Text>
                            </View>
                        ) : (
                            <>
                                <View style={{ gap: 8, marginTop: 8 }}>
                                    {riepilogoData.dettagliCategorie.spese.map(([cat, val], idx) => (
                                        <View key={idx} style={[styles.allocRow, { backgroundColor: t.surface, borderColor: t.line }]}>
                                            <CategoryChip label={cat} />
                                            <View style={styles.allocMid}>
                                                <View style={styles.rowBetween}>
                                                    <Text style={[styles.allocName, { color: t.text }]} numberOfLines={1}>{cat}</Text>
                                                    <Text style={[styles.allocAmt, { color: t.neg }]}>
                                                        {showBalance ? `${currency}${val.toFixed(0)}` : '****'}
                                                    </Text>
                                                </View>
                                            </View>
                                        </View>
                                    ))}
                                </View>
                                {/* Ghost add expense inline */}
                                <TouchableOpacity
                                    style={[styles.ghostBtn, { borderColor: t.line2, marginTop: 8 }]}
                                    onPress={() => navigation.navigate('AddTransaction')}
                                >
                                    <Text style={[styles.ghostBtnText, { color: t.text2 }]}>+ Add expense</Text>
                                </TouchableOpacity>
                            </>
                        )}
                    </View>

                    {/* ── Top income ── */}
                    <View style={[styles.card, { backgroundColor: t.surface, borderColor: t.line }]}>
                        <View style={styles.sectionHead}>
                            <Text style={[styles.sectionTitle, { color: t.text3 }]}>TOP INCOME</Text>
                            <TouchableOpacity onPress={() => navigation.navigate('Transactions')}>
                                <Text style={[styles.sectionMeta, { color: t.text3 }]}>All ›</Text>
                            </TouchableOpacity>
                        </View>
                        {riepilogoData.dettagliCategorie.entrate.length === 0 ? (
                            <View style={[styles.emptyCard, { backgroundColor: t.surface, borderColor: t.line, marginTop: 8 }]}>
                                <Text style={[styles.emptyText, { color: t.text3 }]}>No income this month</Text>
                            </View>
                        ) : (
                            <>
                                <View style={{ gap: 8, marginTop: 8 }}>
                                    {riepilogoData.dettagliCategorie.entrate.map(([cat, val], idx) => (
                                        <View key={idx} style={[styles.allocRow, { backgroundColor: t.surface, borderColor: t.line }]}>
                                            <CategoryChip label={cat} />
                                            <View style={styles.allocMid}>
                                                <View style={styles.rowBetween}>
                                                    <Text style={[styles.allocName, { color: t.text }]} numberOfLines={1}>{cat}</Text>
                                                    <Text style={[styles.allocAmt, { color: t.pos }]}>
                                                        {showBalance ? `+${currency}${val.toFixed(0)}` : '****'}
                                                    </Text>
                                                </View>
                                            </View>
                                        </View>
                                    ))}
                                </View>
                                {/* Ghost add income inline */}
                                <TouchableOpacity
                                    style={[styles.ghostBtn, { borderColor: t.line2, marginTop: 8 }]}
                                    onPress={() => navigation.navigate('AddTransaction', { type: 'entrata' })}
                                >
                                    <Text style={[styles.ghostBtnText, { color: t.text2 }]}>+ Add income</Text>
                                </TouchableOpacity>
                            </>
                        )}
                    </View>
                </View>

                {/* ── Recent Activity ── */}
                <View style={[styles.card, { backgroundColor: t.surface, borderColor: t.line, marginHorizontal: 16, marginBottom: 16 }]}>
                    <View style={styles.sectionHead}>
                        <Text style={[styles.sectionTitle, { color: t.text3 }]}>RECENT ACTIVITY</Text>
                        <TouchableOpacity onPress={() => navigation.navigate('Transactions')}>
                            <Text style={[styles.sectionMeta, { color: t.text3 }]}>All ›</Text>
                        </TouchableOpacity>
                    </View>
                    {riepilogoData.ultime5Transazioni.length === 0 ? (
                        <View style={[styles.emptyCard, { backgroundColor: t.surface, borderColor: t.line, marginTop: 8 }]}>
                            <Text style={[styles.emptyText, { color: t.text3 }]}>No transactions yet</Text>
                        </View>
                    ) : (
                        <View style={{ gap: 0, marginTop: 8 }}>
                            {riepilogoData.ultime5Transazioni.map((tx, i) => (
                                <View
                                    key={i}
                                    style={[
                                        styles.transactionRow,
                                        { borderBottomColor: t.line },
                                        i === riepilogoData.ultime5Transazioni.length - 1 && { borderBottomWidth: 0 },
                                    ]}
                                >
                                    <View style={{ flex: 1, marginRight: 12 }}>
                                        <Text style={[styles.transDesc, { color: t.text }]} numberOfLines={1}>
                                            {tx.descrizione || tx.categoria}
                                        </Text>
                                        <Text style={[styles.transDate, { color: t.text3 }]}>
                                            {new Date(tx.data).toLocaleDateString('it-IT')}
                                        </Text>
                                    </View>
                                    <Text style={[styles.transAmount, { color: tx.importo >= 0 ? t.pos : t.neg }]}>
                                        {showBalance
                                            ? `${tx.importo >= 0 ? '+' : '−'}${currency}${Math.abs(tx.importo).toFixed(2)}`
                                            : '****'}
                                    </Text>
                                </View>
                            ))}
                        </View>
                    )}
                </View>
            </ScrollView>

            {/* ── FAB — quick add ── */}
            <TouchableOpacity
                style={[styles.fab, { backgroundColor: ACCENT }]}
                activeOpacity={0.85}
                onPress={() => setShowQuickAddModal(true)}
            >
                <Text style={styles.fabIcon}>+</Text>
            </TouchableOpacity>

            {/* ── Quick-add modal ── */}
            {renderQuickAddModal()}
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1 },
    loadingContainer: { justifyContent: 'center', alignItems: 'center' },

    // ── Month navigator ──
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

    // ── Hero ──
    hero: {
        marginHorizontal: 16,
        marginTop: 4,
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
        fontSize: 44,
        fontWeight: '700',
        letterSpacing: -1.5,
        marginBottom: 18,
        lineHeight: 50,
    },
    heroAmountSmall: {
        fontSize: 30,
        fontWeight: '700',
        letterSpacing: -1,
        lineHeight: 36,
    },
    heroSubMeta: {
        fontSize: 12,
        fontWeight: '500',
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

    // ── Action buttons ──
    actionsContainer: {
        flexDirection: 'row',
        paddingHorizontal: 16,
        gap: 10,
        marginBottom: 12,
    },
    actionBtn: {
        flex: 1,
        paddingVertical: 12,
        borderRadius: 14,
        borderWidth: 1.5,
        alignItems: 'center',
    },
    actionBtnText: {
        fontSize: 14,
        fontWeight: '700',
    },

    // ── Nav grid ──
    navGrid: {
        flexDirection: 'row',
        gap: 8,
    },
    navBtn: {
        flex: 1,
        alignItems: 'center',
        paddingVertical: 12,
        borderRadius: 10,
    },
    navIcon: {
        fontSize: 20,
        marginBottom: 4,
    },
    navLabel: {
        fontSize: 10,
        fontWeight: '600',
        letterSpacing: 0.2,
    },

    // ── Card (generic) ──
    card: {
        borderRadius: 16,
        borderWidth: 1,
        padding: 16,
    },
    emptyCard: {
        borderRadius: 12,
        borderWidth: 1,
        borderStyle: 'dashed',
        padding: 16,
        alignItems: 'center',
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

    // ── Progress track ──
    track: {
        height: 6,
        borderRadius: 3,
        overflow: 'hidden',
    },
    trackFill: {
        height: '100%',
        borderRadius: 3,
    },

    // ── Micro label/value ──
    microLabel: {
        fontSize: 11,
        fontWeight: '600',
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    microVal: {
        fontSize: 16,
        fontWeight: '600',
        letterSpacing: -0.3,
    },

    // ── Section head ──
    sectionHead: {
        flexDirection: 'row',
        alignItems: 'baseline',
        justifyContent: 'space-between',
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

    // ── Allocation-row-style (category items) ──
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
        marginTop: 6,
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

    // ── Ghost button ──
    ghostBtn: {
        paddingVertical: 12,
        borderRadius: 12,
        borderWidth: 1,
        borderStyle: 'dashed',
        alignItems: 'center',
    },
    ghostBtnText: {
        fontSize: 13,
        fontWeight: '600',
    },

    // ── FAB ──
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

    // ── Transaction row ──
    transactionRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 12,
        borderBottomWidth: StyleSheet.hairlineWidth,
    },
    transDesc: {
        fontSize: 14,
        fontWeight: '600',
        letterSpacing: -0.1,
    },
    transDate: {
        fontSize: 11,
        marginTop: 2,
    },
    transAmount: {
        fontSize: 14,
        fontWeight: '700',
        letterSpacing: -0.1,
    },

    // ── Savings card (nested alloc card) ──
    allocCard: {
        marginHorizontal: 16,
        marginBottom: 16,
        borderRadius: 16,
        borderWidth: 1,
        padding: 16,
    },

    // ── Modal ──
    modalOverlay: {
        flex: 1,
        justifyContent: 'flex-end',
        backgroundColor: 'rgba(0,0,0,0.5)',
    },
    modalContainer: {
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        padding: 20,
        paddingBottom: Platform.OS === 'ios' ? 40 : 24,
        gap: 8,
    },
    sheetGrab: {
        width: 40,
        height: 4,
        borderRadius: 2,
        alignSelf: 'center',
        marginBottom: 12,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: '700',
        letterSpacing: -0.3,
        marginBottom: 8,
    },
    modeToggle: {
        flexDirection: 'row',
        borderRadius: 12,
        padding: 4,
        gap: 4,
    },
    modeBtn: {
        flex: 1,
        paddingVertical: 10,
        borderRadius: 9,
        alignItems: 'center',
    },
    modeBtnText: {
        fontSize: 13,
        fontWeight: '600',
    },
    field: {
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: 12,
        borderWidth: 1,
        paddingHorizontal: 14,
        height: 52,
        gap: 6,
    },
    fieldLabel: {
        fontSize: 10,
        fontWeight: '600',
        textTransform: 'uppercase',
        letterSpacing: 0.8,
        position: 'absolute',
        top: -9,
        left: 12,
        paddingHorizontal: 4,
    },
    fieldPrefix: {
        fontSize: 16,
        fontWeight: '500',
    },
    fieldInput: {
        flex: 1,
        fontSize: 20,
        fontWeight: '500',
        padding: 0,
        letterSpacing: -0.3,
    },
    sheetActions: {
        flexDirection: 'row',
        gap: 10,
        marginTop: 12,
    },
    sheetCancel: {
        flex: 1,
        paddingVertical: 14,
        borderRadius: 12,
        alignItems: 'center',
    },
    sheetCancelText: {
        fontSize: 15,
        fontWeight: '600',
    },
    sheetSave: {
        flex: 1,
        paddingVertical: 14,
        borderRadius: 12,
        alignItems: 'center',
    },
    sheetSaveText: {
        fontSize: 15,
        fontWeight: '700',
        color: '#fff',
    },

    // ── Empty ──
    emptyText: {
        fontSize: 13,
        fontWeight: '500',
        fontStyle: 'italic',
        textAlign: 'center',
    },
});

export default HomeScreen;
