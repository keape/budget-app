// ============================================================
// MonthYearPicker — selettore mese/anno unificato
// ============================================================
import React from 'react';
import {
  View,
  Text,
  Modal,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { useSettings } from '../../context/SettingsContext';

const MONTHS_IT = [
  'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
  'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre',
];
const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 12 }, (_, i) => CURRENT_YEAR - 4 + i);

interface MonthYearPickerProps {
  visible: boolean;
  onClose: () => void;
  selectedMonth: number;
  selectedYear: number;
  onSelect: (month: number, year: number) => void;
}

export const MonthYearPicker: React.FC<MonthYearPickerProps> = ({
  visible,
  onClose,
  selectedMonth,
  selectedYear,
  onSelect,
}) => {
  const { isDarkMode } = useSettings();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.container, isDarkMode && styles.containerDark]}>
          <Text style={[styles.title, isDarkMode && styles.textLight]}>
            Seleziona periodo
          </Text>

          <ScrollView style={styles.monthList} showsVerticalScrollIndicator={false}>
            {MONTHS_IT.map((m, idx) => (
              <TouchableOpacity
                key={idx}
                style={[
                  styles.row,
                  isDarkMode && styles.rowDark,
                  selectedMonth === idx && (isDarkMode ? styles.rowActiveDark : styles.rowActive),
                ]}
                onPress={() => {
                  onSelect(idx, selectedYear);
                  onClose();
                }}
              >
                <Text
                  style={[
                    styles.monthName,
                    isDarkMode && styles.textMuted,
                    selectedMonth === idx && (isDarkMode ? styles.textActiveDark : styles.textActive),
                  ]}
                >
                  {m}
                </Text>
                {/* Year indicator inline */}
                <Text
                  style={[
                    styles.yearInline,
                    isDarkMode && styles.textMuted,
                    selectedMonth === idx && (isDarkMode ? styles.textActiveDark : styles.textActive),
                  ]}
                >
                  {selectedYear}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Year row — scorrimento orizzontale */}
          <View style={styles.yearStrip}>
            <Text style={[styles.yearLabel, isDarkMode && styles.textMuted]}>Anno:</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {YEARS.map(y => (
                <TouchableOpacity
                  key={y}
                  style={[
                    styles.yearChip,
                    selectedYear === y && styles.yearChipActive,
                  ]}
                  onPress={() => onSelect(selectedMonth, y)}
                >
                  <Text
                    style={[
                      styles.yearChipText,
                      selectedYear === y && styles.yearChipTextActive,
                    ]}
                  >
                    {y}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
            <Text style={styles.closeBtnText}>Chiudi</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 36,
    maxHeight: '75%',
  },
  containerDark: {
    backgroundColor: '#1C1C1E',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 16,
  },
  textLight: { color: '#F9FAFB' },
  textMuted: { color: '#9CA3AF' },

  monthList: {
    maxHeight: 320,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 10,
    marginBottom: 2,
  },
  rowDark: { backgroundColor: '#1C1C1E' },
  rowActive: { backgroundColor: '#EEF2FF' },
  rowActiveDark: { backgroundColor: '#2C2C2E' },
  monthName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#374151',
  },
  yearInline: {
    fontSize: 14,
    color: '#9CA3AF',
    fontWeight: '600',
  },
  textActive: { color: '#4F46E5', fontWeight: '700' },
  textActiveDark: { color: '#c4f23a', fontWeight: '700' },

  yearStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  yearLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
    marginRight: 8,
  },
  yearChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
    marginRight: 6,
  },
  yearChipActive: {
    backgroundColor: '#4F46E5',
  },
  yearChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
  },
  yearChipTextActive: {
    color: '#FFFFFF',
  },

  closeBtn: {
    marginTop: 16,
    backgroundColor: '#4F46E5',
    padding: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  closeBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});
