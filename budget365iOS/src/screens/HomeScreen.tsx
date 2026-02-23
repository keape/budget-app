import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    View,
    Text,
    ScrollView,
    StyleSheet,
    TouchableOpacity,
    ActivityIndicator,
    RefreshControl,
    Dimensions,
    Image,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import { API_URL } from '../config';
import { useFocusEffect } from '@react-navigation/native';

const BASE_URL = API_URL;

const HomeScreen = ({ navigation }: { navigation: any }) => {
    const { userToken, logout } = useAuth();
    const { currency, showBalance, isDarkMode } = useSettings();
    const [isLoading, setIsLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const abortControllerRef = useRef<AbortController | null>(null);
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

    useEffect(() => {
        navigation.setOptions({
            headerRight: () => (
                <TouchableOpacity onPress={() => navigation.navigate('Settings')} style={{ marginRight: 15 }}>
                    <Text style={{ fontSize: 22 }}>⚙️</Text>
                </TouchableOpacity>
            ),
        });
    }, [navigation, logout]);

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

    const caricaDati = async (signal?: AbortSignal) => {
        try {
            const oggi = new Date();
            const meseCorrente = oggi.getMonth();
            const annoCorrente = oggi.getFullYear();

            const [speseRes, entrateRes, budgetRes] = await Promise.all([
                fetch(`${BASE_URL}/api/spese?limit=1000`, { headers: { 'Authorization': `Bearer ${userToken}` }, signal }),
                fetch(`${BASE_URL}/api/entrate?limit=1000`, { headers: { 'Authorization': `Bearer ${userToken}` }, signal }),
                fetch(`${BASE_URL}/api/budget-settings?anno=${annoCorrente}&mese=${meseCorrente}`, {
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
            const tutte_transazioni = [
                ...tutte_spese.map((s: any) => ({ ...s, type: 'uscita', importo: -Math.abs(s.importo) })),
                ...tutte_entrate.map((e: any) => ({ ...e, type: 'entrata', importo: Math.abs(e.importo) }))
            ].sort((a, b) =>
                new Date(b.data || b.createdAt).getTime() - new Date(a.data || a.createdAt).getTime()
            );

            // Totali Mese
            const inizioMese = new Date(oggi.getFullYear(), oggi.getMonth(), 1);
            const speseMese = tutte_spese.filter((s: any) => new Date(s.data).getTime() >= inizioMese.getTime());
            const entrateMese = tutte_entrate.filter((e: any) => new Date(e.data).getTime() >= inizioMese.getTime());

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

            // Budget (somma valori configurati)
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

    const onRefresh = () => {
        abortControllerRef.current?.abort();
        abortControllerRef.current = new AbortController();
        setRefreshing(true);
        caricaDati(abortControllerRef.current.signal);
    };

    const SimpleBarChart = ({ label, value, max, color }: { label: string, value: number, max: number, color: string }) => {
        const widthPercentage = max > 0 ? (value / max) * 100 : 0;
        return (
            <View style={{ marginBottom: 12 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                    <Text style={{ fontSize: 14, fontWeight: '500', color: isDarkMode ? '#E5E7EB' : '#374151' }}>{label}</Text>
                    <Text style={{ fontSize: 14, fontWeight: 'bold', color: color }}>
                        {showBalance ? `${currency}${value.toFixed(2)}` : '****'}
                    </Text>
                </View>
                <View style={{ height: 10, backgroundColor: isDarkMode ? '#374151' : '#E5E7EB', borderRadius: 5, overflow: 'hidden' }}>
                    <View style={{ height: '100%', width: `${Math.min(widthPercentage, 100)}%`, backgroundColor: color, borderRadius: 5 }} />
                </View>
            </View>
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
        <ScrollView
            style={[styles.container, isDarkMode && { backgroundColor: '#111827' }]}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
            <View style={[styles.header, isDarkMode && { backgroundColor: '#111827', borderBottomColor: '#374151' }]}>
                <Image
                    source={require('../assets/logo.png')}
                    style={{ width: 40, height: 40, marginRight: 12, borderRadius: 8 }}
                />
                <Text style={[styles.title, isDarkMode && { color: '#F9FAFB' }]}>Budget Dashboard</Text>
            </View>

            {/* Quick Actions */}
            <View style={styles.actionsContainer}>
                <TouchableOpacity
                    style={[styles.actionButton, { backgroundColor: '#4F46E5', flex: 1, marginRight: 8 }]}
                    onPress={() => navigation.navigate('AddTransaction')}
                >
                    <Text style={styles.actionButtonText}>💸 Expense</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.actionButton, { backgroundColor: '#059669', flex: 1, marginHorizontal: 4 }]}
                    onPress={() => navigation.navigate('AddTransaction', { type: 'entrata' })}
                >
                    <Text style={styles.actionButtonText}>💰 Income</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.actionButton, { backgroundColor: '#818CF8', flex: 1, marginLeft: 8 }]}
                    onPress={() => navigation.navigate('PeriodicTransactions')}
                >
                    <Text style={styles.actionButtonText}>🔄 Recurring</Text>
                </TouchableOpacity>
            </View>

            {/* Cards Riepilogo */}
            <View style={styles.cardsGrid}>
                <View style={[styles.card, isDarkMode && { backgroundColor: '#1F2937' }]}>
                    <Text style={[styles.cardLabel, isDarkMode && { color: '#9CA3AF' }]}>Income</Text>
                    <Text style={[styles.cardValue, { color: '#059669' }]}>
                        {showBalance ? `+${currency}${riepilogoData.totaleEntrateMese.toFixed(2)}` : '****'}
                    </Text>
                </View>
                <View style={[styles.card, isDarkMode && { backgroundColor: '#1F2937' }]}>
                    <Text style={[styles.cardLabel, isDarkMode && { color: '#9CA3AF' }]}>Expenses</Text>
                    <Text style={[styles.cardValue, { color: '#DC2626' }]}>
                        {showBalance ? `-${currency}${riepilogoData.totaleSpeseMese.toFixed(2)}` : '****'}
                    </Text>
                </View>
                <View style={[styles.card, isDarkMode && { backgroundColor: '#1F2937' }]}>
                    <Text style={[styles.cardLabel, isDarkMode && { color: '#9CA3AF' }]}>Balance</Text>
                    <Text style={[styles.cardValue, { color: riepilogoData.bilancioMese >= 0 ? '#059669' : '#DC2626' }]}>
                        {showBalance ? `${riepilogoData.bilancioMese >= 0 ? '+' : ''}${currency}${riepilogoData.bilancioMese.toFixed(2)}` : '****'}
                    </Text>
                </View>
                <View style={[styles.card, isDarkMode && { backgroundColor: '#1F2937' }]}>
                    <Text style={[styles.cardLabel, isDarkMode && { color: '#9CA3AF' }]}>Transactions</Text>
                    <Text style={[styles.cardValue, { color: '#3B82F6' }]}>{riepilogoData.numeroTransazioniMese}</Text>
                </View>
            </View>

            {/* Budget Summary Charts */}
            <View style={[styles.sectionContainer, isDarkMode && { backgroundColor: '#1F2937' }]}>
                <Text style={[styles.sectionTitle, isDarkMode && { color: '#F3F4F6' }]}>📉 Performance vs Budget</Text>
                <View style={styles.sectionContent}>
                    <SimpleBarChart
                        label="Expenses vs Budget"
                        value={riepilogoData.totaleSpeseMese}
                        max={budgetData.budgetSpeseMese || riepilogoData.totaleSpeseMese * 1.2}
                        color="#DC2626"
                    />
                    <Text style={styles.subText}>
                        Expense Budget: {showBalance ? `${currency}${budgetData.budgetSpeseMese.toFixed(2)}` : '****'}
                    </Text>

                    <View style={{ height: 16 }} />

                    <SimpleBarChart
                        label="Income vs Budget"
                        value={riepilogoData.totaleEntrateMese}
                        max={budgetData.budgetEntrateMese || riepilogoData.totaleEntrateMese * 1.2}
                        color="#059669"
                    />
                    <Text style={styles.subText}>
                        Income Budget: {showBalance ? `${currency}${budgetData.budgetEntrateMese.toFixed(2)}` : '****'}
                    </Text>
                </View>
            </View>

            {/* Categorie Top */}
            <View style={styles.row}>
                <View style={[styles.sectionContainer, { flex: 1, marginRight: 8 }, isDarkMode && { backgroundColor: '#1F2937' }]}>
                    <Text style={[styles.sectionTitle, isDarkMode && { color: '#F3F4F6' }]}>Top Expenses</Text>
                    <View style={styles.sectionContent}>
                        {riepilogoData.dettagliCategorie.spese.length === 0 ? (
                            <Text style={styles.emptyText}>No expenses</Text>
                        ) : (
                            riepilogoData.dettagliCategorie.spese.map(([cat, val], idx) => (
                                <View key={idx} style={[styles.catRow, isDarkMode && { borderBottomColor: '#374151' }]}>
                                    <Text style={[styles.catName, isDarkMode && { color: '#E5E7EB' }]} numberOfLines={1}>{cat}</Text>
                                    <Text style={styles.catValueSpesa}>
                                        {showBalance ? `${currency}${val.toFixed(0)}` : '****'}
                                    </Text>
                                </View>
                            ))
                        )}
                    </View>
                </View>

                <View style={[styles.sectionContainer, { flex: 1, marginLeft: 8 }, isDarkMode && { backgroundColor: '#1F2937' }]}>
                    <Text style={[styles.sectionTitle, isDarkMode && { color: '#F3F4F6' }]}>Top Income</Text>
                    <View style={styles.sectionContent}>
                        {riepilogoData.dettagliCategorie.entrate.length === 0 ? (
                            <Text style={styles.emptyText}>No income</Text>
                        ) : (
                            riepilogoData.dettagliCategorie.entrate.map(([cat, val], idx) => (
                                <View key={idx} style={[styles.catRow, isDarkMode && { borderBottomColor: '#374151' }]}>
                                    <Text style={[styles.catName, isDarkMode && { color: '#E5E7EB' }]} numberOfLines={1}>{cat}</Text>
                                    <Text style={styles.catValueEntrata}>
                                        {showBalance ? `${currency}${val.toFixed(0)}` : '****'}
                                    </Text>
                                </View>
                            ))
                        )}
                    </View>
                </View>
            </View>

            {/* Ultime Transazioni */}
            <View style={[styles.sectionContainer, isDarkMode && { backgroundColor: '#1F2937' }]}>
                <Text style={[styles.sectionTitle, isDarkMode && { color: '#F3F4F6' }]}>🕐 Recent Activity</Text>
                <View style={styles.sectionContent}>
                    {riepilogoData.ultime5Transazioni.map((t, i) => (
                        <View key={i} style={[styles.transactionRow, isDarkMode && { borderBottomColor: '#374151' }]}>
                            <View>
                                <Text style={[styles.transDesc, isDarkMode && { color: '#F9FAFB' }]}>{t.descrizione || t.categoria}</Text>
                                <Text style={[styles.transDate, isDarkMode && { color: '#9CA3AF' }]}>{new Date(t.data).toLocaleDateString('it-IT')}</Text>
                            </View>
                            <Text style={[styles.transAmount, { color: t.importo >= 0 ? '#059669' : '#DC2626' }]}>
                                {showBalance ? `${t.importo >= 0 ? '+' : ''}${currency}${Math.abs(t.importo).toFixed(2)}` : '****'}
                            </Text>
                        </View>
                    ))}
                </View>
            </View>

            <View style={{ height: 40 }} />
        </ScrollView>
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
        backgroundColor: '#FFFFFF',
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
    title: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#111827',
        textAlign: 'center',
    },
    actionsContainer: {
        flexDirection: 'row',
        padding: 16,
        justifyContent: 'space-around',
    },
    actionButton: {
        paddingVertical: 12,
        paddingHorizontal: 20,
        borderRadius: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 3,
        elevation: 3,
        alignItems: 'center',
    },
    actionButtonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: 'bold',
    },
    cardsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        padding: 12,
        justifyContent: 'space-between',
    },
    card: {
        width: '48%',
        backgroundColor: '#FFFFFF',
        padding: 16,
        borderRadius: 12,
        marginBottom: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 2,
    },
    cardLabel: {
        fontSize: 14,
        color: '#6B7280',
        marginBottom: 4,
    },
    cardValue: {
        fontSize: 18,
        fontWeight: 'bold',
    },
    sectionContainer: {
        margin: 16,
        marginBottom: 0,
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        padding: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 2,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#111827',
        marginBottom: 16,
    },
    sectionContent: {},
    subText: {
        fontSize: 12,
        color: '#6B7280',
        textAlign: 'right',
    },
    row: {
        flexDirection: 'row',
        marginHorizontal: 8,
    },
    catRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 8,
        paddingBottom: 8,
        borderBottomWidth: 1,
        borderBottomColor: '#F3F4F6',
    },
    catName: {
        fontSize: 14,
        color: '#374151',
        flex: 1,
    },
    catValueSpesa: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#DC2626',
    },
    catValueEntrata: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#059669',
    },
    emptyText: {
        fontStyle: 'italic',
        color: '#9CA3AF',
        textAlign: 'center',
    },
    transactionRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#F3F4F6',
    },
    transDesc: {
        fontSize: 16,
        color: '#111827',
        fontWeight: '500',
    },
    transDate: {
        fontSize: 12,
        color: '#9CA3AF',
    },
    transAmount: {
        fontSize: 16,
        fontWeight: 'bold',
    },
});

export default HomeScreen;
