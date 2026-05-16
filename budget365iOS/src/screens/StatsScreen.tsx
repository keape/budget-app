import React, { useState, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import { useAppTheme } from '../hooks/useAppTheme';
import { API_URL } from '../config';
import { warmupBackend } from '../utils/apiClient';

const BASE_URL = API_URL;
const ACCENT = '#c4f23a';

interface CategoryStats {
    category: string;
    budget: number;
    actual: number;
}

const MONTH_ABBRS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const CAT_COLORS = ['#4F46E5', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16'];
const TREND_BAR_MAX_H = 70;

const StatsScreen: React.FC<{ route?: any; navigation?: any }> = ({ route, navigation }) => {
    const { userToken } = useAuth();
    const { currency, showBalance } = useSettings();
    const t = useAppTheme();

    const [periodMode, setPeriodMode] = useState<'year' | 'month'>('year');
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
    const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
    const [typeMode, setTypeMode] = useState<'spese' | 'entrate'>('spese');

    const [statsData, setStatsData] = useState<CategoryStats[]>([]);
    const [monthlyTotals, setMonthlyTotals] = useState<number[]>(Array(12).fill(0));
    const [netData, setNetData] = useState<{ income: number; expenses: number }>({ income: 0, expenses: 0 });
    const [isLoading, setIsLoading] = useState(false);

    const months = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
    ];

    // Apply initialType param from Home navigation
    useFocusEffect(
        useCallback(() => {
            const initialType = route?.params?.initialType;
            if (initialType === 'entrate' || initialType === 'spese') {
                setTypeMode(initialType);
                navigation?.setParams({ initialType: undefined });
            }
        }, [route?.params?.initialType])
    );

    useFocusEffect(
        useCallback(() => {
            if (userToken) {
                loadStats();
            }
        }, [userToken, periodMode, selectedYear, selectedMonth, typeMode])
    );

    const goBack = () => {
        if (periodMode === 'year') {
            setSelectedYear(y => y - 1);
        } else {
            if (selectedMonth === 0) { setSelectedMonth(11); setSelectedYear(y => y - 1); }
            else { setSelectedMonth(m => m - 1); }
        }
    };

    const goForward = () => {
        if (periodMode === 'year') {
            setSelectedYear(y => y + 1);
        } else {
            if (selectedMonth === 11) { setSelectedMonth(0); setSelectedYear(y => y + 1); }
            else { setSelectedMonth(m => m + 1); }
        }
    };

    const loadStats = async () => {
        setIsLoading(true);
        try {
            await warmupBackend();
            // 1. Budget settings
            const budgetUrl = periodMode === 'year'
                ? `${BASE_URL}/api/budget-settings?anno=${selectedYear}`
                : `${BASE_URL}/api/budget-settings?anno=${selectedYear}&mese=${selectedMonth}`;
            const budgetRes = await fetch(budgetUrl, { headers: { 'Authorization': `Bearer ${userToken}` } });
            let combinedBudget: Record<string, number> = {};
            if (budgetRes.ok) {
                const data = await budgetRes.json();
                combinedBudget = typeMode === 'spese' ? data.spese || {} : data.entrate || {};
            }

            // 2. Fetch spese + entrate in parallel (needed for net balance)
            const [speseRes, entrateRes] = await Promise.all([
                fetch(`${BASE_URL}/api/spese?limit=2000`, { headers: { 'Authorization': `Bearer ${userToken}` } }),
                fetch(`${BASE_URL}/api/entrate?limit=2000`, { headers: { 'Authorization': `Bearer ${userToken}` } }),
            ]);
            const speseData = await speseRes.json();
            const entrateData = await entrateRes.json();
            const allSpese: any[] = speseData.spese || [];
            const allEntrate: any[] = entrateData.entrate || [];

            // 3. Filter by selected period
            const filterByPeriod = (txs: any[]) => txs.filter((t: any) => {
                const d = new Date(t.data);
                if (periodMode === 'year') return d.getFullYear() === selectedYear;
                return d.getFullYear() === selectedYear && d.getMonth() === selectedMonth;
            });
            const filteredSpese = filterByPeriod(allSpese);
            const filteredEntrate = filterByPeriod(allEntrate);

            // 4. Net balance
            const totalExpenses = filteredSpese.reduce((s: number, t: any) => s + Math.abs(t.importo), 0);
            const totalIncome = filteredEntrate.reduce((s: number, t: any) => s + Math.abs(t.importo), 0);
            setNetData({ income: totalIncome, expenses: totalExpenses });

            // 5. Monthly trend (year mode only — all months for selected typeMode)
            if (periodMode === 'year') {
                const monthly = Array(12).fill(0);
                const txsForTrend = typeMode === 'spese' ? allSpese : allEntrate;
                txsForTrend
                    .filter((t: any) => new Date(t.data).getFullYear() === selectedYear)
                    .forEach((t: any) => { monthly[new Date(t.data).getMonth()] += Math.abs(t.importo); });
                setMonthlyTotals(monthly);
            }

            // 6. Category breakdown for selected typeMode
            const filteredTx = typeMode === 'spese' ? filteredSpese : filteredEntrate;
            const actuals: Record<string, number> = {};
            filteredTx.forEach((t: any) => {
                const cat = t.categoria || 'Uncategorized';
                actuals[cat] = (actuals[cat] || 0) + Math.abs(t.importo);
            });
            const allCats = new Set([...Object.keys(combinedBudget), ...Object.keys(actuals)]);
            const finalStats: CategoryStats[] = Array.from(allCats).map(cat => ({
                category: cat,
                budget: combinedBudget[cat] || 0,
                actual: actuals[cat] || 0
            })).sort((a, b) => b.actual - a.actual);
            setStatsData(finalStats);

        } catch (error) {
            console.error("Error loading stats:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const totals = statsData.reduce((acc, curr) => ({
        budget: acc.budget + curr.budget,
        actual: acc.actual + curr.actual,
        diff: acc.diff + (curr.budget - curr.actual)
    }), { budget: 0, actual: 0, diff: 0 });

    const diffLabel = typeMode === 'spese'
        ? (totals.diff >= 0 ? 'Savings' : 'Overbudget')
        : (totals.diff <= 0 ? 'Exceeded Goal' : 'Below Goal');

    const net = netData.income - netData.expenses;
    const netPositive = net >= 0;

    const maxMonthlyVal = Math.max(...monthlyTotals, 1);
    const currentMonthIdx = new Date().getMonth();
    const currentYear = new Date().getFullYear();

    const proportionData = statsData.filter(d => d.actual > 0);
    const proportionTotal = proportionData.reduce((s, d) => s + d.actual, 0);
    const periodLabelText = periodMode === 'year' ? `${selectedYear}` : `${months[selectedMonth]} ${selectedYear}`;
    const formatCurrency = (value: number, signed = false) => {
        if (!showBalance) return '****';
        const sign = signed ? (value >= 0 ? '+' : '-') : '';
        return `${sign}${currency}${Math.abs(value).toFixed(0)}`;
    };

    return (
        <View style={[styles.container, { backgroundColor: t.bg }]}>
            <View style={[styles.hero, { backgroundColor: t.surface, borderColor: t.line }]}>
                <Text style={[styles.heroEyebrow, { color: t.text3 }]}>
                    STATS · {periodLabelText}
                </Text>
                <Text style={[styles.heroAmount, { color: netPositive ? t.pos : t.neg }]}>
                    {formatCurrency(net, true)}
                </Text>
                <View style={[styles.flowRow, { backgroundColor: t.surface2 }]}>
                    <View style={styles.flowCell}>
                        <View style={[styles.flowDot, { backgroundColor: t.pos }]} />
                        <View>
                            <Text style={[styles.flowLabel, { color: t.text3 }]}>INCOME</Text>
                            <Text style={[styles.flowVal, { color: t.pos }]}>{formatCurrency(netData.income)}</Text>
                        </View>
                    </View>
                    <View style={[styles.flowDivider, { backgroundColor: t.line2 }]} />
                    <View style={styles.flowCell}>
                        <View style={[styles.flowDot, { backgroundColor: t.neg }]} />
                        <View>
                            <Text style={[styles.flowLabel, { color: t.text3 }]}>EXPENSES</Text>
                            <Text style={[styles.flowVal, { color: t.neg }]}>{formatCurrency(netData.expenses)}</Text>
                        </View>
                    </View>
                </View>
            </View>

            {/* Header Filters */}
            <View style={styles.filterSection}>

                {/* Expenses / Income toggle */}
                <View style={[styles.typeSelector, { backgroundColor: t.surface2 }]}>
                    <TouchableOpacity
                        style={[styles.typeBtn, typeMode === 'spese' && { backgroundColor: t.neg }]}
                        onPress={() => setTypeMode('spese')}
                    >
                        <Text style={[styles.typeBtnText, { color: t.text }, typeMode === 'spese' && styles.activeTypeBtnText]}>💸 Expenses</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.typeBtn, typeMode === 'entrate' && { backgroundColor: t.pos }]}
                        onPress={() => setTypeMode('entrate')}
                    >
                        <Text style={[styles.typeBtnText, { color: t.text }, typeMode === 'entrate' && styles.activeTypeBtnText]}>💰 Income</Text>
                    </TouchableOpacity>
                </View>

                {/* Period toggle + navigator */}
                <View style={styles.periodRow}>
                    <View style={styles.periodModeToggle}>
                        <TouchableOpacity
                            style={[styles.smallBtn, { backgroundColor: t.surface, borderColor: t.line }, periodMode === 'year' && { backgroundColor: ACCENT, borderColor: ACCENT }]}
                            onPress={() => setPeriodMode('year')}
                        >
                            <Text style={[styles.smallBtnText, { color: t.text }, periodMode === 'year' && styles.activeSmallBtnText]}>Year</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.smallBtn, { backgroundColor: t.surface, borderColor: t.line }, periodMode === 'month' && { backgroundColor: ACCENT, borderColor: ACCENT }]}
                            onPress={() => setPeriodMode('month')}
                        >
                            <Text style={[styles.smallBtnText, { color: t.text }, periodMode === 'month' && styles.activeSmallBtnText]}>Month</Text>
                        </TouchableOpacity>
                    </View>
                    <View style={styles.periodNav}>
                        <TouchableOpacity onPress={goBack} style={styles.navArrowBtn}>
                            <Text style={[styles.navArrow, { color: t.text }]}>‹</Text>
                        </TouchableOpacity>
                        <Text style={[styles.periodLabel, { color: t.text }]}>
                            {periodLabelText}
                        </Text>
                        <TouchableOpacity onPress={goForward} style={styles.navArrowBtn}>
                            <Text style={[styles.navArrow, { color: t.text }]}>›</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>

            <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: 100 }}>
                {isLoading ? (
                    <ActivityIndicator size="large" color={ACCENT} style={{ marginTop: 40 }} />
                ) : (
                    <>
                        {/* Summary cards — Budget / Spent / Diff */}
                        <View style={styles.summaryRow}>
                            <View style={[styles.summaryCardH, { backgroundColor: t.surface, borderColor: t.line }]}>
                                <Text style={[styles.cardLabelH, { color: t.text3 }]}>Budget</Text>
                                <Text style={[styles.cardValueH, { color: t.text }]}>{formatCurrency(totals.budget)}</Text>
                            </View>
                            <View style={[styles.summaryCardH, { backgroundColor: t.surface, borderColor: t.line }]}>
                                <Text style={[styles.cardLabelH, { color: t.text3 }]}>{typeMode === 'spese' ? 'Spent' : 'Earned'}</Text>
                                <Text style={[styles.cardValueH, { color: typeMode === 'spese' ? t.neg : t.pos }]}>{formatCurrency(totals.actual)}</Text>
                            </View>
                            <View style={[styles.summaryCardH, { backgroundColor: t.surface, borderColor: t.line }]}>
                                <Text style={[styles.cardLabelH, { color: t.text3 }]}>Diff</Text>
                                <Text style={[styles.cardValueH, { color: t.text }]}>{formatCurrency(totals.diff)}</Text>
                                <Text style={[styles.cardInfoH, { color: t.text3 }]}>{diffLabel}</Text>
                            </View>
                        </View>

                        {/* Monthly trend chart — year mode only */}
                        {periodMode === 'year' && (
                            <View style={[styles.trendCard, { backgroundColor: t.surface, borderColor: t.line }]}>
                                <Text style={[styles.trendTitle, { color: t.text3 }]}>
                                    Monthly trend · tap a bar to view that month
                                </Text>
                                <View style={styles.trendBars}>
                                    {monthlyTotals.map((val, idx) => {
                                        const barH = val > 0 ? Math.max((val / maxMonthlyVal) * TREND_BAR_MAX_H, 4) : 0;
                                        const isCurrent = idx === currentMonthIdx && selectedYear === currentYear;
                                        const barColor = isCurrent
                                            ? t.text
                                            : (typeMode === 'spese' ? t.neg : t.pos);
                                        return (
                                            <TouchableOpacity
                                                key={idx}
                                                style={styles.trendBarGroup}
                                                onPress={() => { setPeriodMode('month'); setSelectedMonth(idx); }}
                                            >
                                                <View style={[styles.trendBarFill, { height: barH, backgroundColor: barColor }]} />
                                                <Text style={[
                                                    styles.trendBarLabel,
                                                    { color: t.text3 },
                                                    isCurrent && { color: t.text, fontWeight: '700' }
                                                ]}>
                                                    {MONTH_ABBRS[idx]}
                                                </Text>
                                            </TouchableOpacity>
                                        );
                                    })}
                                </View>
                            </View>
                        )}

                        {/* Category proportion bar */}
                        {proportionTotal > 0 && (
                            <View style={[styles.proportionCard, { backgroundColor: t.surface, borderColor: t.line }]}>
                                <Text style={[styles.proportionTitle, { color: t.text3 }]}>
                                    {typeMode === 'spese' ? 'Expense' : 'Income'} distribution
                                </Text>
                                <View style={styles.proportionBar}>
                                    {proportionData.map((item, idx) => (
                                        <View
                                            key={idx}
                                            style={[
                                                styles.proportionSegment,
                                                { flex: item.actual / proportionTotal, backgroundColor: CAT_COLORS[idx % CAT_COLORS.length] },
                                            ]}
                                        />
                                    ))}
                                </View>
                                <View style={styles.proportionLegend}>
                                    {proportionData.slice(0, 5).map((item, idx) => (
                                        <View key={idx} style={styles.proportionLegendItem}>
                                            <View style={[styles.proportionDot, { backgroundColor: CAT_COLORS[idx % CAT_COLORS.length] }]} />
                                            <Text style={[styles.proportionLegendText, { color: t.text2 }]} numberOfLines={1}>
                                                {item.category} {Math.round((item.actual / proportionTotal) * 100)}%
                                            </Text>
                                        </View>
                                    ))}
                                    {proportionData.length > 5 && (
                                        <Text style={[styles.proportionMore, { color: t.text3 }]}>
                                            +{proportionData.length - 5} more
                                        </Text>
                                    )}
                                </View>
                            </View>
                        )}

                        {/* Category breakdown with progress bars */}
                        {statsData.length === 0 ? (
                            <Text style={[styles.emptyText, { color: t.text3 }]}>No data available for this period.</Text>
                        ) : (
                            statsData.map((item, idx) => {
                                const pct = item.budget > 0 ? Math.min(item.actual / item.budget, 1) : 0;
                                const overBudget = typeMode === 'spese' ? item.actual > item.budget : false;
                                const barColor = overBudget ? t.neg : t.pos;
                                const absDiff = Math.abs(item.budget - item.actual);
                                const pctText = item.budget > 0
                                    ? `${Math.round((item.actual / item.budget) * 100)}%  ·  ${showBalance ? `${overBudget ? '+' : '-'}${currency}${absDiff.toFixed(0)}` : '****'} ${overBudget ? 'over' : 'remaining'}`
                                    : formatCurrency(item.actual);

                                return (
                                    <TouchableOpacity
                                        key={idx}
                                        style={[styles.catRow, { backgroundColor: t.surface, borderColor: t.line }]}
                                        activeOpacity={0.7}
                                        onPress={() => {
                                            const month = String(selectedMonth + 1).padStart(2, '0');
                                            const lastDay = new Date(selectedYear, selectedMonth + 1, 0).getDate();
                                            const startDate = periodMode === 'year'
                                                ? `${selectedYear}-01-01`
                                                : `${selectedYear}-${month}-01`;
                                            const endDate = periodMode === 'year'
                                                ? `${selectedYear}-12-31`
                                                : `${selectedYear}-${month}-${lastDay}`;
                                            navigation?.navigate('Transactions', {
                                                filterCategory: item.category,
                                                filterType: typeMode === 'spese' ? 'uscita' : 'entrata',
                                                startDate,
                                                endDate,
                                            });
                                        }}
                                    >
                                        <View style={styles.catHeader}>
                                            <Text style={[styles.catName, { color: t.text }]} numberOfLines={1}>
                                                {item.category}
                                            </Text>
                                            <Text style={[styles.catAmounts, { color: t.text2 }]}>
                                                {showBalance ? `${currency}${item.actual.toFixed(0)}${item.budget > 0 ? ` / ${currency}${item.budget.toFixed(0)}` : ''}` : '****'}
                                            </Text>
                                        </View>
                                        {item.budget > 0 && (
                                            <View style={[styles.progressTrack, { backgroundColor: t.surface2 }]}>
                                                <View style={[styles.progressFill, { width: `${pct * 100}%` as any, backgroundColor: barColor }]} />
                                            </View>
                                        )}
                                        <Text style={[styles.pctLabel, { color: overBudget ? t.neg : t.text3 }]}>
                                            {pctText}{overBudget ? ' ⚠️' : ''}
                                        </Text>
                                        <Text style={[styles.catTapHint, { color: t.text3 }]}>
                                            Tap to view transactions →
                                        </Text>
                                    </TouchableOpacity>
                                );
                            })
                        )}
                    </>
                )}
            </ScrollView>
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

    // Filter section
    filterSection: {
        paddingHorizontal: 16,
        paddingBottom: 12,
        gap: 10,
    },
    typeSelector: { flexDirection: 'row', borderRadius: 12, padding: 4, gap: 4 },
    typeBtn: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 9 },
    typeBtnText: { fontWeight: '600', fontSize: 13 },
    activeTypeBtnText: { color: 'white' },

    periodRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    periodModeToggle: { flexDirection: 'row', gap: 8 },
    smallBtn: {
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 10,
        borderWidth: 1,
    },
    smallBtnText: { fontSize: 13, fontWeight: '500' },
    activeSmallBtnText: { color: '#0c0c0c', fontWeight: '700' },

    periodNav: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    navArrowBtn: { padding: 4 },
    navArrow: { fontSize: 22, fontWeight: '600' },
    periodLabel: { fontSize: 14, fontWeight: '600', minWidth: 110, textAlign: 'center' },

    // Content
    content: { flex: 1, paddingHorizontal: 16 },

    // Summary cards (horizontal)
    summaryRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
    summaryCardH: { flex: 1, padding: 12, borderRadius: 14, borderWidth: 1, alignItems: 'center' },
    cardLabelH: { fontSize: 10, fontWeight: '600', letterSpacing: 0.8, marginBottom: 4, textAlign: 'center', textTransform: 'uppercase' },
    cardValueH: { fontSize: 16, fontWeight: '700', textAlign: 'center' },
    cardInfoH: { fontSize: 9, marginTop: 3, textAlign: 'center' },

    // Monthly trend chart
    trendCard: {
        borderRadius: 16,
        borderWidth: 1,
        padding: 14,
        marginBottom: 12,
    },
    trendTitle: { fontSize: 11, marginBottom: 10 },
    trendBars: { flexDirection: 'row', alignItems: 'flex-end', height: 90 },
    trendBarGroup: { flex: 1, alignItems: 'center' },
    trendBarFill: { width: 14, borderTopLeftRadius: 3, borderTopRightRadius: 3 },
    trendBarLabel: { fontSize: 9, marginTop: 4 },

    // Proportion bar
    proportionCard: {
        borderRadius: 16,
        borderWidth: 1,
        padding: 14,
        marginBottom: 12,
    },
    proportionTitle: { fontSize: 11, marginBottom: 10 },
    proportionBar: { flexDirection: 'row', height: 12, borderRadius: 6, overflow: 'hidden', marginBottom: 12 },
    proportionSegment: { height: 12 },
    proportionLegend: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    proportionLegendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    proportionDot: { width: 8, height: 8, borderRadius: 4 },
    proportionLegendText: { fontSize: 11 },
    proportionMore: { fontSize: 11 },

    // Category rows
    catRow: {
        borderRadius: 16,
        borderWidth: 1,
        padding: 14,
        marginBottom: 10,
    },
    catHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
    catName: { fontSize: 15, fontWeight: '600', flex: 1 },
    catAmounts: { fontSize: 13, marginLeft: 8 },
    progressTrack: { height: 6, borderRadius: 3, overflow: 'hidden', marginBottom: 4 },
    progressFill: { height: 6, borderRadius: 3 },
    pctLabel: { fontSize: 11, textAlign: 'right' },
    catTapHint: { fontSize: 10, textAlign: 'right', marginTop: 4 },

    emptyText: { textAlign: 'center', padding: 40, fontStyle: 'italic' },
});

export default StatsScreen;
