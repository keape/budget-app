// ============================================================
// TickerBadge — badge contestuale per tipo di strumento
// ============================================================
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

// Mappa tipo → colore OKLch (ETF=blu, stock=verde, crypto=arancione, bond=viola, fondo=ciano)
const TYPE_COLORS: Record<string, string> = {
  etf: '#4F46E5',
  stock: '#059669',
  crypto: '#D97706',
  bond: '#7C3AED',
  fund: '#0891B2',
  commodity: '#65A30D',
  etn: '#BE185D',
  reit: '#EA580C',
};

const FALLBACK_COLORS = [
  '#4F46E5', '#059669', '#DC2626', '#D97706', '#7C3AED',
  '#0891B2', '#BE185D', '#65A30D', '#EA580C', '#0284C7',
];

function getColor(ticker: string, type?: string): string {
  if (type) {
    const lower = type.toLowerCase();
    if (TYPE_COLORS[lower]) return TYPE_COLORS[lower];
  }
  let hash = 0;
  for (let i = 0; i < ticker.length; i++) {
    hash = ticker.charCodeAt(i) + ((hash << 5) - hash);
  }
  return FALLBACK_COLORS[Math.abs(hash) % FALLBACK_COLORS.length];
}

interface TickerBadgeProps {
  ticker: string;
  type?: string;
  size?: 'sm' | 'md';
}

export const TickerBadge: React.FC<TickerBadgeProps> = ({ ticker, type, size = 'md' }) => {
  const bgColor = getColor(ticker ?? '?', type);
  const isSmall = size === 'sm';
  return (
    <View
      style={[
        styles.badge,
        { backgroundColor: bgColor },
        isSmall && styles.badgeSm,
      ]}
    >
      <Text style={[styles.text, isSmall && styles.textSm]} numberOfLines={1}>
        {(ticker ?? '?').toUpperCase().slice(0, isSmall ? 4 : 5)}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    width: 44,
    height: 44,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  badgeSm: {
    width: 32,
    height: 32,
    borderRadius: 6,
  },
  text: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  textSm: {
    fontSize: 8,
  },
});
