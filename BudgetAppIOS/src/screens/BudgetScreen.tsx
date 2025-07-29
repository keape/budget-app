import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const BASE_URL = 'https://budget-app-cd5o.onrender.com';

interface BudgetItem {
  categoria: string;
  importo: number;
  tipo: 'entrata' | 'uscita';
}

interface BudgetScreenProps {
  navigation: any;
}

const BudgetScreen: React.FC<BudgetScreenProps> = ({ navigation }) => {
  const [budgetData, setBudgetData] = useState<BudgetItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState<'mensile' | 'annuale'>('mensile');

  useEffect(() => {
    loadBudgetData();
  }, [selectedPeriod]);

  const loadBudgetData = async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      if (!token) {
        navigation.navigate('Login');
        return;
      }

      setIsLoading(true);
      
      const currentDate = new Date();
      let startDate: Date;
      let endDate: Date;

      if (selectedPeriod === 'mensile') {
        startDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
        endDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
      } else {
        startDate = new Date(currentDate.getFullYear(), 0, 1);
        endDate = new Date(currentDate.getFullYear(), 11, 31);
      }

      const [speseResponse, entrateResponse] = await Promise.all([
        fetch(`${BASE_URL}/api/spese?dataInizio=${startDate.toISOString().split('T')[0]}&dataFine=${endDate.toISOString().split('T')[0]}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch(`${BASE_URL}/api/entrate?dataInizio=${startDate.toISOString().split('T')[0]}&dataFine=${endDate.toISOString().split('T')[0]}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        })
      ]);

      const speseData = await speseResponse.json();
      const entrateData = await entrateResponse.json();

      const spese = speseData.spese || [];
      const entrate = entrateData.entrate || [];

      // Raggruppa per categoria
      const budgetMap = new Map<string, { importo: number; tipo: 'entrata' | 'uscita' }>();

      spese.forEach((spesa: any) => {
        const key = `uscita-${spesa.categoria}`;
        const existing = budgetMap.get(key) || { importo: 0, tipo: 'uscita' as const };
        budgetMap.set(key, {
          ...existing,
          importo: existing.importo + Math.abs(spesa.importo)
        });
      });

      entrate.forEach((entrata: any) => {
        const key = `entrata-${entrata.categoria}`;
        const existing = budgetMap.get(key) || { importo: 0, tipo: 'entrata' as const };
        budgetMap.set(key, {
          ...existing,
          importo: existing.importo + Math.abs(entrata.importo)
        });
      });

      const budgetArray: BudgetItem[] = Array.from(budgetMap.entries()).map(([key, value]) => ({
        categoria: key.split('-')[1],
        importo: value.importo,
        tipo: value.tipo
      }));

      setBudgetData(budgetArray);
    } catch (error) {
      console.error('Errore nel caricamento del budget:', error);
      Alert.alert('Errore', 'Impossibile caricare i dati del budget');
    } finally {
      setIsLoading(false);
    }
  };

  const calculateTotals = () => {
    const totaleEntrate = budgetData
      .filter(item => item.tipo === 'entrata')
      .reduce((sum, item) => sum + item.importo, 0);
    
    const totaleUscite = budgetData
      .filter(item => item.tipo === 'uscita')
      .reduce((sum, item) => sum + item.importo, 0);
    
    return {
      entrate: totaleEntrate,
      uscite: totaleUscite,
      bilancio: totaleEntrate - totaleUscite
    };
  };

  const renderBudgetItem = ({ item }: { item: BudgetItem }) => {
    const isEntrata = item.tipo === 'entrata';
    
    return (
      <View style={styles.budgetCard}>
        <View style={styles.budgetHeader}>
          <Text style={styles.categoria}>{item.categoria}</Text>
          <View style={[
            styles.tipoBadge,
            isEntrata ? styles.tipoBadgeEntrata : styles.tipoBadgeUscita
          ]}>
            <Text style={[
              styles.tipoBadgeText,
              isEntrata ? styles.tipoBadgeTextEntrata : styles.tipoBadgeTextUscita
            ]}>
              {isEntrata ? 'Entrata' : 'Uscita'}
            </Text>
          </View>
        </View>
        
        <Text style={[
          styles.importo,
          isEntrata ? styles.importoEntrata : styles.importoUscita
        ]}>
          {isEntrata ? '+' : '-'}{item.importo.toFixed(2)} €
        </Text>
      </View>
    );
  };

  const totals = calculateTotals();

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4F46E5" />
        <Text style={styles.loadingText}>Caricamento budget...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Budget</Text>
        
        <View style={styles.periodSelector}>
          <TouchableOpacity
            style={[
              styles.periodButton,
              selectedPeriod === 'mensile' && styles.periodButtonActive
            ]}
            onPress={() => setSelectedPeriod('mensile')}
          >
            <Text style={[
              styles.periodButtonText,
              selectedPeriod === 'mensile' && styles.periodButtonTextActive
            ]}>
              Mensile
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[
              styles.periodButton,
              selectedPeriod === 'annuale' && styles.periodButtonActive
            ]}
            onPress={() => setSelectedPeriod('annuale')}
          >
            <Text style={[
              styles.periodButtonText,
              selectedPeriod === 'annuale' && styles.periodButtonTextActive
            ]}>
              Annuale
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={styles.content}>
        {/* Riepilogo Totali */}
        <View style={styles.summaryContainer}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Entrate Totali</Text>
            <Text style={styles.summaryValueEntrata}>+{totals.entrate.toFixed(2)} €</Text>
          </View>
          
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Uscite Totali</Text>
            <Text style={styles.summaryValueUscita}>-{totals.uscite.toFixed(2)} €</Text>
          </View>
          
          <View style={[
            styles.summaryCard,
            styles.summaryCardBilancio,
            totals.bilancio >= 0 ? styles.summaryCardPositivo : styles.summaryCardNegativo
          ]}>
            <Text style={styles.summaryLabel}>Bilancio</Text>
            <Text style={[
              styles.summaryValueBilancio,
              totals.bilancio >= 0 ? styles.bilancioPositivo : styles.bilancioNegativo
            ]}>
              {totals.bilancio >= 0 ? '+' : ''}{totals.bilancio.toFixed(2)} €
            </Text>
          </View>
        </View>

        {/* Lista Budget per Categoria */}
        <View style={styles.categoriesSection}>
          <Text style={styles.sectionTitle}>Dettaglio per Categoria</Text>
          
          {budgetData.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyTitle}>Nessun dato disponibile</Text>
              <Text style={styles.emptySubtitle}>
                Aggiungi delle transazioni per vedere il budget
              </Text>
            </View>
          ) : (
            <FlatList
              data={budgetData}
              keyExtractor={(item, index) => `${item.tipo}-${item.categoria}-${index}`}
              renderItem={renderBudgetItem}
              scrollEnabled={false}
              showsVerticalScrollIndicator={false}
            />
          )}
        </View>
      </ScrollView>
    </View>
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
    backgroundColor: '#F9FAFB',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#6B7280',
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 16,
    textAlign: 'center',
  },
  periodSelector: {
    flexDirection: 'row',
    backgroundColor: '#E5E7EB',
    borderRadius: 12,
    padding: 4,
  },
  periodButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  periodButtonActive: {
    backgroundColor: '#4F46E5',
  },
  periodButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  periodButtonTextActive: {
    color: '#FFFFFF',
  },
  content: {
    flex: 1,
  },
  summaryContainer: {
    padding: 16,
    gap: 12,
  },
  summaryCard: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  summaryCardBilancio: {
    borderWidth: 2,
  },
  summaryCardPositivo: {
    borderColor: '#059669',
  },
  summaryCardNegativo: {
    borderColor: '#DC2626',
  },
  summaryLabel: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 4,
  },
  summaryValueEntrata: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#059669',
  },
  summaryValueUscita: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#DC2626',
  },
  summaryValueBilancio: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  bilancioPositivo: {
    color: '#059669',
  },
  bilancioNegativo: {
    color: '#DC2626',
  },
  categoriesSection: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 16,
  },
  budgetCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  budgetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  categoria: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    flex: 1,
  },
  tipoBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  tipoBadgeEntrata: {
    backgroundColor: '#D1FAE5',
  },
  tipoBadgeUscita: {
    backgroundColor: '#FEE2E2',
  },
  tipoBadgeText: {
    fontSize: 12,
    fontWeight: '500',
  },
  tipoBadgeTextEntrata: {
    color: '#065F46',
  },
  tipoBadgeTextUscita: {
    color: '#991B1B',
  },
  importo: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  importoEntrata: {
    color: '#059669',
  },
  importoUscita: {
    color: '#DC2626',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#374151',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
  },
});

export default BudgetScreen;