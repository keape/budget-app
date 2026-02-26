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
import { API_URL } from '../config';

const BASE_URL = API_URL;

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
    const { currency, isDarkMode } = useSettings();

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

    const diffBgColor = typeMode === 'spese'
        ? (totals.diff >= 0 ? '#14532D' : '#7F1D1D')
        : (totals.diff <= 0 ? '#14532D' : '#7F1D1D');
    const diffLabel = typeMode === 'spese'
        ? (totals.diff >= 0 ? 'Savings' : 'Overbudget')
        : (totals.diff <= 0 ? 'Exceeded Goal' : 'Below Goal');

    const net = netData.income - netData.expenses;
    const savingsRate = netData.income > 0 ? Math.round((net / netData.income) * 100) : 0;
    const netPositive = net >= 0;

    const maxMonthlyVal = Math.max(...monthlyTotals, 1);
    const currentMonthIdx = new Date().getMonth();
    const currentYear = new Date().getFullYear();

    const proportionData = statsData.filter(d => d.actual > 0);
    const proportionTotal = proportionData.reduce((s, d) => s + d.actual, 0);

    return (
        <View style={[styles.container, isDarkMode && { backgroundColor: '#111827' }]}>
            {/* Header Filters */}
            <View style={[styles.filterSection, isDarkMode && { backgroundColor: '#111827', borderBottomColor: '#374151' }]}>

                {/* Expenses / Income toggle */}
                <View style={[styles.typeSelector, isDarkMode && { borderColor: '#374151' }]}>
                    <TouchableOpacity
                        style={[styles.typeBtn, isDarkMode && { backgroundColor: '#1F2937' }, typeMode === 'spese' && styles.activeTypeBtnUscite]}
                        onPress={() => setTypeMode('spese')}
                    >
                        <Text style={[styles.typeBtnText, isDarkMode && { color: '#D1D5DB' }, typeMode === 'spese' && styles.activeTypeBtnText]}>💸 Expenses</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.typeBtn, isDarkMode && { backgroundColor: '#1F2937' }, typeMode === 'entrate' && styles.activeTypeBtnEntrate]}
                        onPress={() => setTypeMode('entrate')}
                    >
                        <Text style={[styles.typeBtnText, isDarkMode && { color: '#D1D5DB' }, typeMode === 'entrate' && styles.activeTypeBtnText]}>💰 Income</Text>
                    </TouchableOpacity>
                </View>

                {/* Period toggle + navigator */}
                <View style={styles.periodRow}>
                    <View style={styles.periodModeToggle}>
                        <TouchableOpacity
                            style={[styles.smallBtn, isDarkMode && { backgroundColor: '#1F2937', borderColor: '#374151' }, periodMode === 'year' && styles.activeSmallBtn]}
                            onPress={() => setPeriodMode('year')}
                        >
                            <Text style={[styles.smallBtnText, isDarkMode && { color: '#D1D5DB' }, periodMode === 'year' && styles.activeSmallBtnText]}>Year</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.smallBtn, isDarkMode && { backgroundColor: '#1F2937', borderColor: '#374151' }, periodMode === 'month' && styles.activeSmallBtn]}
                            onPress={() => setPeriodMode('month')}
                        >
                            <Text style={[styles.smallBtnText, isDarkMode && { color: '#D1D5DB' }, periodMode === 'month' && styles.activeSmallBtnText]}>Month</Text>
                        </TouchableOpacity>
                    </View>
                    <View style={styles.periodNav}>
                        <TouchableOpacity onPress={goBack} style={styles.navArrowBtn}>
                            <Text style={[styles.navArrow, isDarkMode && { color: '#D1D5DB' }]}>‹</Text>
                        </TouchableOpacity>
                        <Text style={[styles.periodLabel, isDarkMode && { color: '#F9FAFB' }]}>
                            {periodMode === 'year' ? `${selectedYear}` : `${months[selectedMonth]} ${selectedYear}`}
                        </Text>
                        <TouchableOpacity onPress={goForward} style={styles.navArrowBtn}>
                            <Text style={[styles.navArrow, isDarkMode && { color: '#D1D5DB' }]}>›</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>

            <ScrollView style={styles.content}>
                {isLoading ? (
                    <ActivityIndicator size="large" color="#4F46E5" style={{ marginTop: 40 }} />
                ) : (
                    <>
                        {/* Net Balance row */}
                        <View style={[styles.netRow, isDarkMode && { backgroundColor: '#1F2937' }, { borderLeftColor: netPositive ? '#10B981' : '#EF4444' }]}>
                            <View style={styles.netItem}>
                                <Text style={[styles.netLabel, isDarkMode && { color: '#9CA3AF' }]}>💰 Income</Text>
                                <Text style={[styles.netValue, { color: '#10B981' }]}>{currency}{netData.income.toFixed(0)}</Text>
                            </View>
                            <Text style={[styles.netSep, isDarkMode && { color: '#4B5563' }]}>·</Text>
                            <View style={styles.netItem}>
                                <Text style={[styles.netLabel, isDarkMode && { color: '#9CA3AF' }]}>💸 Expenses</Text>
                                <Text style={[styles.netValue, { color: '#EF4444' }]}>{currency}{netData.expenses.toFixed(0)}</Text>
                            </View>
                            <Text style={[styles.netSep, isDarkMode && { color: '#4B5563' }]}>→</Text>
                            <View style={styles.netItem}>
                                <Text style={[styles.netLabel, isDarkMode && { color: '#9CA3AF' }]}>Net</Text>
                                <Text style={[styles.netValue, { color: netPositive ? '#10B981' : '#EF4444' }]}>
                                    {netPositive ? '+' : ''}{currency}{Math.abs(net).toFixed(0)}
                                </Text>
                                {netData.income > 0 && (
                                    <Text style={[styles.netRate, { color: netPositive ? '#10B981' : '#EF4444' }]}>
                                        {savingsRate}% saved
                                    </Text>
                                )}
                            </View>
                        </View>

                        {/* Summary cards — Budget / Spent / Diff */}
                        <View style={styles.summaryRow}>
                            <View style={[styles.summaryCardH, { backgroundColor: '#1E3A8A' }]}>
                                <Text style={styles.cardLabelH}>Budget</Text>
                                <Text style={styles.cardValueH}>{currency}{totals.budget.toFixed(0)}</Text>
                            </View>
                            <View style={[styles.summaryCardH, { backgroundColor: '#6B21A8' }]}>
                                <Text style={styles.cardLabelH}>{typeMode === 'spese' ? 'Spent' : 'Earned'}</Text>
                                <Text style={styles.cardValueH}>{currency}{totals.actual.toFixed(0)}</Text>
                            </View>
                            <View style={[styles.summaryCardH, { backgroundColor: diffBgColor }]}>
                                <Text style={styles.cardLabelH}>Diff</Text>
                                <Text style={styles.cardValueH}>{currency}{Math.abs(totals.diff).toFixed(0)}</Text>
                                <Text style={styles.cardInfoH}>{diffLabel}</Text>
                            </View>
                        </View>

                        {/* Monthly trend chart — year mode only */}
                        {periodMode === 'year' && (
                            <View style={[styles.trendCard, isDarkMode && { backgroundColor: '#1F2937' }]}>
                                <Text style={[styles.trendTitle, isDarkMode && { color: '#6B7280' }]}>
                                    Monthly trend · tap a bar to view that month
                                </Text>
                                <View style={styles.trendBars}>
                                    {monthlyTotals.map((val, idx) => {
                                        const barH = val > 0 ? Math.max((val / maxMonthlyVal) * TREND_BAR_MAX_H, 4) : 0;
                                        const isCurrent = idx === currentMonthIdx && selectedYear === currentYear;
                                        const barColor = isCurrent
                                            ? '#4F46E5'
                                            : (typeMode === 'spese' ? '#EF4444' : '#10B981');
                                        return (
                                            <TouchableOpacity
                                                key={idx}
                                                style={styles.trendBarGroup}
                                                onPress={() => { setPeriodMode('month'); setSelectedMonth(idx); }}
                                            >
                                                <View style={[styles.trendBarFill, { height: barH, backgroundColor: barColor }]} />
                                                <Text style={[
                                                    styles.trendBarLabel,
                                                    isDarkMode && { color: '#6B7280' },
                                                    isCurrent && { color: '#4F46E5', fontWeight: '700' }
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
                            <View style={[styles.proportionCard, isDarkMode && { backgroundColor: '#1F2937' }]}>
                                <Text style={[styles.proportionTitle, isDarkMode && { color: '#6B7280' }]}>
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
                                            <Text style={[styles.proportionLegendText, isDarkMode && { color: '#9CA3AF' }]} numberOfLines={1}>
                                                {item.category} {Math.round((item.actual / proportionTotal) * 100)}%
                                            </Text>
                                        </View>
                                    ))}
                                    {proportionData.length > 5 && (
                                        <Text style={[styles.proportionMore, isDarkMode && { color: '#6B7280' }]}>
                                            +{proportionData.length - 5} more
                                        </Text>
                                    )}
                                </View>
                            </View>
                        )}

                        {/* Category breakdown with progress bars */}
                        {statsData.length === 0 ? (
                            <Text style={styles.emptyText}>No data available for this period.</Text>
                        ) : (
                            statsData.map((item, idx) => {
                                const pct = item.budget > 0 ? Math.min(item.actual / item.budget, 1) : 0;
                                const overBudget = typeMode === 'spese' ? item.actual > item.budget : false;
                                const barColor = overBudget ? '#EF4444' : '#10B981';
                                const absDiff = Math.abs(item.budget - item.actual);
                                const pctText = item.budget > 0
                                    ? `${Math.round((item.actual / item.budget) * 100)}%  ·  ${overBudget ? '+' : '-'}${currency}${absDiff.toFixed(0)} ${overBudget ? 'over' : 'remaining'}`
                                    : `${currency}${item.actual.toFixed(0)}`;

                                return (
                                    <View key={idx} style={[styles.catRow, isDarkMode && { backgroundColor: '#1F2937' }]}>
                                        <View style={styles.catHeader}>
                                            <Text style={[styles.catName, isDarkMode && { color: '#F9FAFB' }]} numberOfLines={1}>
                                                {item.category}
                                            </Text>
                                            <Text style={[styles.catAmounts, isDarkMode && { color: '#9CA3AF' }]}>
                                                {currency}{item.actual.toFixed(0)}{item.budget > 0 ? ` / ${currency}${item.budget.toFixed(0)}` : ''}
                                            </Text>
                                        </View>
                                        {item.budget > 0 && (
                                            <View style={[styles.progressTrack, isDarkMode && { backgroundColor: '#374151' }]}>
                                                <View style={[styles.progressFill, { width: `${pct * 100}%` as any, backgroundColor: barColor }]} />
                                            </View>
                                        )}
                                        <Text style={[styles.pctLabel, { color: overBudget ? '#EF4444' : (isDarkMode ? '#6B7280' : '#9CA3AF') }]}>
                                            {pctText}{overBudget ? ' ⚠️' : ''}
                                        </Text>
                                    </View>
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
    container: { flex: 1, backgroundColor: '#F9FAFB' },

    // Filter section
    filterSection: {
        backgroundColor: 'white',
        paddingHorizontal: 16,
        paddingTop: 12,
        paddingBottom: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
        gap: 10,
    },
    typeSelector: { flexDirection: 'row', borderRadius: 8, overflow: 'hidden', borderWidth: 1, borderColor: '#D1D5DB' },
    typeBtn: { flex: 1, paddingVertical: 10, alignItems: 'center', backgroundColor: '#F9FAFB' },
    activeTypeBtnUscite: { backgroundColor: '#EF4444' },
    activeTypeBtnEntrate: { backgroundColor: '#10B981' },
    typeBtnText: { fontWeight: '600', color: '#374151' },
    activeTypeBtnText: { color: 'white' },

    periodRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    periodModeToggle: { flexDirection: 'row', gap: 8 },
    smallBtn: {
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 8,
        backgroundColor: '#F3F4F6',
        borderWidth: 1,
        borderColor: '#D1D5DB',
    },
    activeSmallBtn: { backgroundColor: '#4F46E5', borderColor: '#4F46E5' },
    smallBtnText: { color: '#374151', fontSize: 13, fontWeight: '500' },
    activeSmallBtnText: { color: 'white' },

    periodNav: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    navArrowBtn: { padding: 4 },
    navArrow: { fontSize: 22, color: '#374151', fontWeight: '600' },
    periodLabel: { fontSize: 14, fontWeight: '600', color: '#111827', minWidth: 110, textAlign: 'center' },

    // Content
    content: { flex: 1, padding: 16 },

    // Net balance row
    netRow: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'white',
        borderRadius: 12,
        padding: 14,
        marginBottom: 12,
        borderLeftWidth: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.06,
        shadowRadius: 3,
        elevation: 2,
    },
    netItem: { flex: 1, alignItems: 'center' },
    netLabel: { fontSize: 10, color: '#6B7280', marginBottom: 2 },
    netValue: { fontSize: 15, fontWeight: '700' },
    netRate: { fontSize: 10, marginTop: 1 },
    netSep: { fontSize: 16, color: '#D1D5DB', marginHorizontal: 2 },

    // Summary cards (horizontal)
    summaryRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
    summaryCardH: { flex: 1, padding: 12, borderRadius: 12, alignItems: 'center' },
    cardLabelH: { fontSize: 10, color: 'rgba(255,255,255,0.85)', marginBottom: 4, textAlign: 'center' },
    cardValueH: { fontSize: 16, fontWeight: 'bold', color: 'white', textAlign: 'center' },
    cardInfoH: { fontSize: 9, color: 'rgba(255,255,255,0.75)', marginTop: 3, textAlign: 'center' },

    // Monthly trend chart
    trendCard: {
        backgroundColor: 'white',
        borderRadius: 12,
        padding: 14,
        marginBottom: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.06,
        shadowRadius: 3,
        elevation: 2,
    },
    trendTitle: { fontSize: 11, color: '#9CA3AF', marginBottom: 10 },
    trendBars: { flexDirection: 'row', alignItems: 'flex-end', height: 90 },
    trendBarGroup: { flex: 1, alignItems: 'center' },
    trendBarFill: { width: 14, borderTopLeftRadius: 3, borderTopRightRadius: 3 },
    trendBarLabel: { fontSize: 9, color: '#9CA3AF', marginTop: 4 },

    // Proportion bar
    proportionCard: {
        backgroundColor: 'white',
        borderRadius: 12,
        padding: 14,
        marginBottom: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.06,
        shadowRadius: 3,
        elevation: 2,
    },
    proportionTitle: { fontSize: 11, color: '#9CA3AF', marginBottom: 10 },
    proportionBar: { flexDirection: 'row', height: 12, borderRadius: 6, overflow: 'hidden', marginBottom: 12 },
    proportionSegment: { height: 12 },
    proportionLegend: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    proportionLegendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    proportionDot: { width: 8, height: 8, borderRadius: 4 },
    proportionLegendText: { fontSize: 11, color: '#6B7280' },
    proportionMore: { fontSize: 11, color: '#9CA3AF' },

    // Category rows
    catRow: {
        backgroundColor: 'white',
        borderRadius: 12,
        padding: 14,
        marginBottom: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.06,
        shadowRadius: 3,
        elevation: 2,
    },
    catHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
    catName: { fontSize: 15, fontWeight: '600', color: '#111827', flex: 1 },
    catAmounts: { fontSize: 13, color: '#6B7280', marginLeft: 8 },
    progressTrack: { height: 6, backgroundColor: '#F3F4F6', borderRadius: 3, overflow: 'hidden', marginBottom: 4 },
    progressFill: { height: 6, borderRadius: 3 },
    pctLabel: { fontSize: 11, textAlign: 'right' },

    emptyText: { textAlign: 'center', padding: 40, color: '#94A3B8', fontStyle: 'italic' },
});

export default StatsScreen;
