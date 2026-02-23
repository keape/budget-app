import React, { useState, useCallback, useRef } from 'react';
import {
    View,
    Text,
    FlatList,
    StyleSheet,
    TouchableOpacity,
    ActivityIndicator,
    Alert,
    RefreshControl,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import { API_URL } from '../config';

const BASE_URL = API_URL;

interface PeriodicTransaction {
    _id: string;
    importo: number;
    categoria: string;
    descrizione?: string;
    tipo_ripetizione: string;
    attiva: boolean;
    data_inizio: string;
    data_fine?: string | null;
}

const PeriodicTransactionsScreen: React.FC = () => {
    const { userToken } = useAuth();
    const { currency, isDarkMode } = useSettings();
    const navigation = useNavigation<any>();

    const [transactions, setTransactions] = useState<PeriodicTransaction[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const abortControllerRef = useRef<AbortController | null>(null);

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

    const loadData = async (signal?: AbortSignal) => {
        setIsLoading(true);
        try {
            const response = await fetch(`${BASE_URL}/api/transazioni-periodiche`, {
                headers: { 'Authorization': `Bearer ${userToken}` },
                signal,
            });
            if (signal?.aborted) return;
            if (response.ok) {
                const data = await response.json();
                if (signal?.aborted) return;
                setTransactions(data.transazioni || []);
            } else {
                console.error("Failed to load periodic transactions");
            }
        } catch (error: any) {
            if (error?.name !== 'AbortError') {
                console.error("Error loading periodic data:", error);
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
        loadData(abortControllerRef.current.signal);
    };

    const toggleStatus = async (item: PeriodicTransaction) => {
        try {
            const response = await fetch(`${BASE_URL}/api/transazioni-periodiche/${item._id}`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${userToken}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ ...item, attiva: !item.attiva }),
            });

            if (response.ok) {
                setTransactions(prev => prev.map(t => t._id === item._id ? { ...t, attiva: !t.attiva } : t));
            } else {
                Alert.alert('Error', 'Unable to update status');
            }
        } catch (error) {
            Alert.alert('Error', 'Network error');
        }
    };

    const deletePeriodic = async (id: string) => {
        Alert.alert(
            'Confirm Deletion',
            'Are you sure you want to delete this recurring transaction?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            const response = await fetch(`${BASE_URL}/api/transazioni-periodiche/${id}`, {
                                method: 'DELETE',
                                headers: { 'Authorization': `Bearer ${userToken}` }
                            });

                            if (response.ok) {
                                setTransactions(prev => prev.filter(t => t._id !== id));
                            } else {
                                Alert.alert('Error', 'Unable to delete');
                            }
                        } catch (error) {
                            Alert.alert('Error', 'Network error');
                        }
                    }
                }
            ]
        );
    };

    const renderItem = ({ item }: { item: PeriodicTransaction }) => {
        const isIncome = item.importo > 0;
        return (
            <View style={[styles.card, isDarkMode && { backgroundColor: '#1F2937' }, !item.attiva && { opacity: 0.6 }]}>
                <View style={{ flex: 1 }}>
                    <View style={styles.cardHeader}>
                        <Text style={[styles.catText, isDarkMode && { color: '#E5E7EB' }]}>{item.categoria}</Text>
                        <View style={[styles.badge, item.attiva ? styles.badgeActive : styles.badgeInactive]}>
                            <Text style={styles.badgeText}>{item.attiva ? 'Active' : 'Paused'}</Text>
                        </View>
                    </View>

                    <Text style={[styles.amountText, isIncome ? styles.amountIncome : styles.amountExpense]}>
                        {isIncome ? '+' : '-'}{currency}{Math.abs(item.importo).toFixed(2)}
                    </Text>

                    <View style={styles.infoRow}>
                        <Text style={[styles.infoText, isDarkMode && { color: '#9CA3AF' }]}>
                            🔄 {item.tipo_ripetizione.charAt(0).toUpperCase() + item.tipo_ripetizione.slice(1)}
                        </Text>
                        <Text style={[styles.infoText, isDarkMode && { color: '#9CA3AF' }]}>
                            📅 Starts: {new Date(item.data_inizio).toLocaleDateString()}
                        </Text>
                    </View>

                    {item.descrizione ? (
                        <Text style={[styles.descText, isDarkMode && { color: '#6B7280' }]}>"{item.descrizione}"</Text>
                    ) : null}
                </View>

                <View style={styles.actionButtons}>
                    <TouchableOpacity style={styles.actionBtn} onPress={() => toggleStatus(item)}>
                        <Text style={{ fontSize: 18 }}>{item.attiva ? '⏸️' : '▶️'}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.actionBtn} onPress={() => deletePeriodic(item._id)}>
                        <Text style={{ fontSize: 18 }}>🗑️</Text>
                    </TouchableOpacity>
                </View>
            </View>
        );
    };

    return (
        <View style={[styles.container, isDarkMode && { backgroundColor: '#111827' }]}>
            {isLoading ? (
                <ActivityIndicator size="large" color="#4F46E5" style={{ marginTop: 50 }} />
            ) : (
                <FlatList
                    data={transactions}
                    keyExtractor={item => item._id}
                    renderItem={renderItem}
                    contentContainerStyle={{ padding: 16 }}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <Text style={styles.emptyText}>No recurring transactions found.</Text>
                        </View>
                    }
                />
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F9FAFB' },
    card: {
        backgroundColor: 'white',
        borderRadius: 16,
        padding: 16,
        marginBottom: 16,
        flexDirection: 'row',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
    catText: { fontSize: 14, fontWeight: '700', color: '#4F46E5' },
    badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
    badgeActive: { backgroundColor: '#D1FAE5' },
    badgeInactive: { backgroundColor: '#F3F4F6' },
    badgeText: { fontSize: 10, fontWeight: 'bold', color: '#065F46' },
    amountText: { fontSize: 20, fontWeight: 'bold', marginBottom: 8 },
    amountIncome: { color: '#059669' },
    amountExpense: { color: '#DC2626' },
    infoRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
    infoText: { fontSize: 12, color: '#6B7280' },
    descText: { fontSize: 14, color: '#6B7280', fontStyle: 'italic' },
    actionButtons: { marginLeft: 16, gap: 10 },
    actionBtn: { padding: 8, backgroundColor: '#F3F4F6', borderRadius: 8 },
    emptyContainer: { alignItems: 'center', marginTop: 100 },
    emptyText: { color: '#9CA3AF', fontSize: 16 },
});

export default PeriodicTransactionsScreen;
