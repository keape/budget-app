import React, { useState, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
    Dimensions,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { API_URL } from '../config';

const BASE_URL = API_URL;
const SCREEN_WIDTH = Dimensions.get('window').width;

interface CategoryStats {
    category: string;
    budget: number;
    actual: number;
}

const StatsScreen: React.FC = () => {
    const { userToken } = useAuth();

    // Selection State
    const [periodMode, setPeriodMode] = useState<'year' | 'month'>('year');
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
    const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
    const [typeMode, setTypeMode] = useState<'spese' | 'entrate'>('spese');

    // Data State
    const [statsData, setStatsData] = useState<CategoryStats[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    const months = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
    ];

    const years = [2024, 2025, 2026, 2027];

    useFocusEffect(
        useCallback(() => {
            if (userToken) {
                loadStats();
            }
        }, [userToken, periodMode, selectedYear, selectedMonth, typeMode])
    );

    const loadStats = async () => {
        setIsLoading(true);
        try {
            // 1. Fetch Budget Settings
            let combinedBudget: Record<string, number> = {};

            if (periodMode === 'year') {
                // Fetch ALL months for this year to aggregate
                // Ideally we'd have a backend endpoint for this, but for now we'll sum all existing setting docs
                // Actually, let's fetch individual months to be accurate, or just one call if we assume 
                // there's a specialized "yearly" document (which budgetSettings.js supports as mese: null)
                const res = await fetch(`${BASE_URL}/api/budget-settings?anno=${selectedYear}`, {
                    headers: { 'Authorization': `Bearer ${userToken}` }
                });
                if (res.ok) {
                    const data = await res.json();
                    // The current backend GET / without mese returns the document where mese is null
                    // If the app saves yearly budget there, we use it.
                    combinedBudget = typeMode === 'spese' ? data.spese || {} : data.entrate || {};
                }
            } else {
                const res = await fetch(`${BASE_URL}/api/budget-settings?anno=${selectedYear}&mese=${selectedMonth}`, {
                    headers: { 'Authorization': `Bearer ${userToken}` }
                });
                if (res.ok) {
                    const data = await res.json();
                    combinedBudget = typeMode === 'spese' ? data.spese || {} : data.entrate || {};
                }
            }

            // 2. Fetch Transactions
            const txEndpoint = typeMode === 'spese' ? 'spese' : 'entrate';
            const txRes = await fetch(`${BASE_URL}/api/${txEndpoint}?limit=2000`, {
                headers: { 'Authorization': `Bearer ${userToken}` }
            });

            const txData = await txRes.json();
            const transactions = typeMode === 'spese' ? txData.spese || [] : txData.entrate || [];

            // 3. Filter transactions by selected period
            const filteredTx = transactions.filter((t: any) => {
                const d = new Date(t.data);
                const y = d.getFullYear();
                const m = d.getMonth();

                if (periodMode === 'year') {
                    return y === selectedYear;
                } else {
                    return y === selectedYear && m === selectedMonth;
                }
            });

            // 4. Aggregate Actuals by Category
            const actuals: Record<string, number> = {};
            filteredTx.forEach((t: any) => {
                const cat = t.categoria || 'Uncategorized';
                actuals[cat] = (actuals[cat] || 0) + Math.abs(t.importo);
            });

            // 5. Merge all unique categories from budget and transactions
            const allCats = new Set([...Object.keys(combinedBudget), ...Object.keys(actuals)]);
            const finalStats: CategoryStats[] = Array.from(allCats).map(cat => ({
                category: cat,
                budget: combinedBudget[cat] || 0,
                actual: actuals[cat] || 0
            })).sort((a, b) => b.actual - a.actual); // Sort by highest spending

            setStatsData(finalStats);
        } catch (error) {
            console.error("Error loading stats:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const calculateTotals = () => {
        return statsData.reduce((acc, curr) => ({
            budget: acc.budget + curr.budget,
            actual: acc.actual + curr.actual,
            diff: acc.diff + (curr.budget - curr.actual)
        }), { budget: 0, actual: 0, diff: 0 });
    };

    const totals = calculateTotals();

    // Helper to render bars
    const renderBarChart = () => {
        if (statsData.length === 0) return null;

        const maxVal = Math.max(...statsData.map(d => Math.max(d.budget, d.actual)), 1);
        const CHART_MAX_HEIGHT = 150;

        return (
            <View style={styles.chartContainer}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <View style={styles.chartInner}>
                        {statsData.map((d, i) => (
                            <View key={i} style={styles.barGroup}>
                                <View style={styles.barsRow}>
                                    {/* Budget Bar */}
                                    <View style={[
                                        styles.bar,
                                        { height: (d.budget / maxVal) * CHART_MAX_HEIGHT, backgroundColor: '#3B82F6' }
                                    ]} />
                                    {/* Actual Bar */}
                                    <View style={[
                                        styles.bar,
                                        {
                                            height: (d.actual / maxVal) * CHART_MAX_HEIGHT,
                                            backgroundColor: typeMode === 'spese' ? '#EF4444' : '#10B981'
                                        }
                                    ]} />
                                </View>
                                <Text style={styles.barLabel} numberOfLines={1}>{d.category}</Text>
                            </View>
                        ))}
                    </View>
                </ScrollView>
                {/* Legend */}
                <View style={styles.legend}>
                    <View style={styles.legendItem}>
                        <View style={[styles.legendColor, { backgroundColor: '#3B82F6' }]} />
                        <Text style={styles.legendText}>Budget</Text>
                    </View>
                    <View style={styles.legendItem}>
                        <View style={[styles.legendColor, { backgroundColor: typeMode === 'spese' ? '#EF4444' : '#10B981' }]} />
                        <Text style={styles.legendText}>{typeMode === 'spese' ? 'Expenses' : 'Income'}</Text>
                    </View>
                </View>
            </View>
        );
    };

    return (
        <View style={styles.container}>
            {/* Header Filters */}
            <View style={styles.filterSection}>
                <View style={styles.filterRow}>
                    <TouchableOpacity
                        style={[styles.smallBtn, periodMode === 'year' && styles.activeSmallBtn]}
                        onPress={() => setPeriodMode('year')}
                    >
                        <Text style={[styles.smallBtnText, periodMode === 'year' && styles.activeSmallBtnText]}>Full Year</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.smallBtn, periodMode === 'month' && styles.activeSmallBtn]}
                        onPress={() => setPeriodMode('month')}
                    >
                        <Text style={[styles.smallBtnText, periodMode === 'month' && styles.activeSmallBtnText]}>Month</Text>
                    </TouchableOpacity>
                </View>

                <View style={styles.filterRow}>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                        {years.map(y => (
                            <TouchableOpacity
                                key={y}
                                style={[styles.chip, selectedYear === y && styles.activeChip]}
                                onPress={() => setSelectedYear(y)}
                            >
                                <Text style={[styles.chipText, selectedYear === y && styles.activeChipText]}>{y}</Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </View>

                {periodMode === 'month' && (
                    <View style={styles.filterRow}>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                            {months.map((m, idx) => (
                                <TouchableOpacity
                                    key={m}
                                    style={[styles.chip, selectedMonth === idx && styles.activeChip]}
                                    onPress={() => setSelectedMonth(idx)}
                                >
                                    <Text style={[styles.chipText, selectedMonth === idx && styles.activeChipText]}>{m}</Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>
                )}

                <View style={styles.typeSelector}>
                    <TouchableOpacity
                        style={[styles.typeBtn, typeMode === 'spese' && styles.activeTypeBtnUscite]}
                        onPress={() => setTypeMode('spese')}
                    >
                        <Text style={[styles.typeBtnText, typeMode === 'spese' && styles.activeTypeBtnText]}>Expenses</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.typeBtn, typeMode === 'entrate' && styles.activeTypeBtnEntrate]}
                        onPress={() => setTypeMode('entrate')}
                    >
                        <Text style={[styles.typeBtnText, typeMode === 'entrate' && styles.activeTypeBtnText]}>Income</Text>
                    </TouchableOpacity>
                </View>
            </View>

            <ScrollView style={styles.content}>
                {isLoading ? (
                    <ActivityIndicator size="large" color="#4F46E5" style={{ marginTop: 40 }} />
                ) : (
                    <>
                        <Text style={styles.sectionTitle}>
                            Budget {periodMode === 'year' ? `Full year ${selectedYear}` : `${months[selectedMonth]} ${selectedYear}`}
                        </Text>

                        {/* Summary Cards */}
                        <View style={styles.summaryContainer}>
                            <View style={[styles.summaryCard, { backgroundColor: '#1E3A8A' }]}>
                                <Text style={styles.cardLabel}>Planned Budget</Text>
                                <Text style={styles.cardValue}>€{totals.budget.toFixed(2)}</Text>
                            </View>
                            <View style={[styles.summaryCard, { backgroundColor: '#064E3B' }]}>
                                <Text style={styles.cardLabel}>{typeMode === 'spese' ? 'Actual Spending' : 'Actual Income'}</Text>
                                <Text style={styles.cardValue}>€{totals.actual.toFixed(2)}</Text>
                            </View>
                            <View style={[
                                styles.summaryCard,
                                {
                                    backgroundColor: typeMode === 'spese'
                                        ? (totals.diff >= 0 ? '#14532D' : '#7F1D1D')
                                        : (totals.diff <= 0 ? '#14532D' : '#7F1D1D')
                                }
                            ]}>
                                <Text style={styles.cardLabel}>Difference</Text>
                                <Text style={styles.cardValue}>€{Math.abs(totals.diff).toFixed(2)}</Text>
                                <Text style={styles.cardInfo}>
                                    {typeMode === 'spese'
                                        ? (totals.diff >= 0 ? 'Savings' : 'Overbudget')
                                        : (totals.diff <= 0 ? 'Exceeded Goal' : 'Below Goal')}
                                </Text>
                            </View>
                        </View>

                        {/* Chart */}
                        {renderBarChart()}

                        {/* Table */}
                        <View style={styles.tableContainer}>
                            <View style={styles.tableHeader}>
                                <Text style={[styles.tableHeaderText, { flex: 2 }]}>CATEGORY</Text>
                                <Text style={styles.tableHeaderText}>BUDGET</Text>
                                <Text style={styles.tableHeaderText}>ACTUAL</Text>
                                <Text style={styles.tableHeaderText}>DIFF.</Text>
                            </View>
                            {statsData.map((item, idx) => {
                                const diff = item.budget - item.actual;
                                return (
                                    <View key={idx} style={styles.tableRow}>
                                        <Text style={[styles.tableCell, { flex: 2, fontWeight: 'bold' }]} numberOfLines={1}>
                                            {item.category}
                                        </Text>
                                        <Text style={styles.tableCell}>€{item.budget.toFixed(0)}</Text>
                                        <Text style={styles.tableCell}>€{item.actual.toFixed(0)}</Text>
                                        <Text style={[
                                            styles.tableCell,
                                            {
                                                color: typeMode === 'spese'
                                                    ? (diff >= 0 ? '#059669' : '#DC2626')
                                                    : (diff <= 0 ? '#059669' : '#DC2626')
                                            }
                                        ]}>
                                            €{Math.abs(diff).toFixed(0)}
                                        </Text>
                                    </View>
                                );
                            })}
                            {statsData.length === 0 && (
                                <Text style={styles.emptyText}>No data available for this period.</Text>
                            )}
                        </View>
                    </>
                )}
            </ScrollView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F9FAFB' },
    filterSection: {
        backgroundColor: 'white',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
        gap: 12
    },
    filterRow: { flexDirection: 'row', gap: 8 },
    smallBtn: {
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 8,
        backgroundColor: '#F3F4F6',
        borderWidth: 1,
        borderColor: '#D1D5DB'
    },
    activeSmallBtn: { backgroundColor: '#4F46E5', borderColor: '#4F46E5' },
    smallBtnText: { color: '#374151', fontSize: 13, fontWeight: '500' },
    activeSmallBtnText: { color: 'white' },

    chip: {
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 20,
        backgroundColor: '#F3F4F6',
        marginRight: 8,
        borderWidth: 1,
        borderColor: '#D1D5DB'
    },
    activeChip: { backgroundColor: '#4F46E5', borderColor: '#4F46E5' },
    chipText: { fontSize: 12, color: '#374151' },
    activeChipText: { color: 'white' },

    typeSelector: { flexDirection: 'row', borderRadius: 8, overflow: 'hidden', borderWidth: 1, borderColor: '#D1D5DB' },
    typeBtn: { flex: 1, paddingVertical: 10, alignItems: 'center', backgroundColor: '#F9FAFB' },
    activeTypeBtnUscite: { backgroundColor: '#EF4444' },
    activeTypeBtnEntrate: { backgroundColor: '#10B981' },
    typeBtnText: { fontWeight: '600', color: '#374151' },
    activeTypeBtnText: { color: 'white' },

    content: { flex: 1, padding: 16 },
    sectionTitle: { fontSize: 22, fontWeight: 'bold', color: '#111827', marginBottom: 20 },

    summaryContainer: { gap: 12, marginBottom: 24 },
    summaryCard: { padding: 16, borderRadius: 12, minHeight: 90 },
    cardLabel: { fontSize: 13, color: '#E0E7FF', opacity: 0.9, marginBottom: 4 },
    cardValue: { fontSize: 24, fontWeight: 'bold', color: 'white' },
    cardInfo: { fontSize: 11, color: 'white', opacity: 0.8, marginTop: 4 },

    chartContainer: {
        backgroundColor: 'white',
        borderRadius: 16,
        padding: 16,
        marginBottom: 24,
        shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3
    },
    chartInner: { flexDirection: 'row', alignItems: 'flex-end', paddingBottom: 20, gap: 20 },
    barGroup: { alignItems: 'center', width: 60 },
    barsRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 4 },
    bar: { width: 15, borderTopLeftRadius: 4, borderTopRightRadius: 4 },
    barLabel: { fontSize: 10, color: '#6B7280', marginTop: 8, width: 60, textAlign: 'center' },

    legend: { flexDirection: 'row', justifyContent: 'center', gap: 20, borderTopWidth: 1, borderTopColor: '#F3F4F6', paddingTop: 12 },
    legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    legendColor: { width: 12, height: 12, borderRadius: 3 },
    legendText: { fontSize: 12, color: '#4B5563' },

    tableContainer: { backgroundColor: 'white', borderRadius: 12, overflow: 'hidden', marginBottom: 40 },
    tableHeader: { flexDirection: 'row', backgroundColor: '#F8FAFC', padding: 12, borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
    tableHeaderText: { flex: 1, fontSize: 11, fontWeight: 'bold', color: '#64748B', textAlign: 'center' },
    tableRow: { flexDirection: 'row', padding: 12, borderBottomWidth: 1, borderBottomColor: '#F1F5F9', alignItems: 'center' },
    tableCell: { flex: 1, fontSize: 12, color: '#334155', textAlign: 'center' },
    emptyText: { textAlign: 'center', padding: 20, color: '#94A3B8', fontStyle: 'italic' }
});

export default StatsScreen;
