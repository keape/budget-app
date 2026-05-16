// ============================================================
// EmptyState — vuoti differenziati per contesto
// ============================================================
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useSettings } from '../../context/SettingsContext';

interface EmptyStateProps {
  icon?: string;
  title: string;
  subtitle: string;
  actionLabel?: string;
  onAction?: () => void;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  subtitle,
  actionLabel,
  onAction,
}) => {
  const { isDarkMode } = useSettings();

  return (
    <View style={[styles.card, isDarkMode && styles.cardDark]}>
      {icon && <Text style={styles.icon}>{icon}</Text>}
      <Text style={[styles.title, isDarkMode && styles.textDark]}>{title}</Text>
      <Text style={[styles.subtitle, isDarkMode && styles.subDark]}>{subtitle}</Text>
      {actionLabel && onAction && (
        <TouchableOpacity style={styles.actionBtn} onPress={onAction}>
          <Text style={styles.actionText}>{actionLabel}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

// Pre-built empty states per contesto
export const EmptyMonth = ({ month, year }: { month: string; year: number }) => (
  <EmptyState
    icon="📅"
    title="Nessun dato per questo mese"
    subtitle={`${month} ${year} — Il risparmio non è ancora stato calcolato.\nTorna alla Home per forzare la chiusura del mese.`}
    actionLabel="← Torna alla Home"
    onAction={() => {}}
  />
);

export const EmptyAllocations = ({ onAdd }: { onAdd: () => void }) => (
  <EmptyState
    icon="💰"
    title="Nessuna allocazione"
    subtitle="Inizia ad allocare il risparmio del mese negli strumenti che preferisci."
    actionLabel="+ Aggiungi allocazione"
    onAction={onAdd}
  />
);

export const EmptyPlan = ({ onAdd }: { onAdd: () => void }) => (
  <EmptyState
    icon="🎯"
    title="Nessun piano impostato"
    subtitle="Definisci il tuo piano di allocazione target per distribuire gli investimenti."
    actionLabel="+ Crea piano"
    onAction={onAdd}
  />
);

export const EmptyPortfolio = () => (
  <EmptyState
    icon="📊"
    title="Nessun investimento"
    subtitle="Vai su 'Mese' e inizia ad allocare il risparmio."
  />
);

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 2,
  },
  cardDark: {
    backgroundColor: '#111111',
  },
  icon: {
    fontSize: 32,
    marginBottom: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 6,
  },
  textDark: {
    color: '#E5E7EB',
  },
  subtitle: {
    fontSize: 13,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 16,
  },
  subDark: {
    color: '#555555',
  },
  actionBtn: {
    backgroundColor: '#4F46E5',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  actionText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 14,
  },
});
