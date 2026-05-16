import { useMemo } from 'react';
import { useSettings } from '../context/SettingsContext';

export interface AppThemeTokens {
  bg: string;
  surface: string;
  surface2: string;
  line: string;
  line2: string;
  text: string;
  text2: string;
  text3: string;
  pos: string;
  neg: string;
}

/**
 * Shared app palette — single source of truth for all screens.
 * Mirrors the token system originally defined in SavingsScreen.tsx.
 *
 * Usage:
 *   const t = useAppTheme();
 *   <View style={[styles.card, { backgroundColor: t.surface, borderColor: t.line }]}>
 */
export function useAppTheme(): AppThemeTokens {
  const { isDarkMode } = useSettings();

  return useMemo(() => ({
    bg:       isDarkMode ? '#0a0a0a' : '#f6f6f4',
    surface:  isDarkMode ? '#131313' : '#ffffff',
    surface2: isDarkMode ? '#1a1a1a' : '#f0f0ec',
    line:     isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(15,15,18,0.06)',
    line2:    isDarkMode ? 'rgba(255,255,255,0.10)' : 'rgba(15,15,18,0.10)',
    text:     isDarkMode ? '#f4f4f5' : '#0c0c0c',
    text2:    isDarkMode ? '#a1a1aa' : '#5b5b66',
    text3:    isDarkMode ? '#6b6b73' : '#8b8b95',
    pos:      isDarkMode ? '#4ade80' : '#16a34a',
    neg:      isDarkMode ? '#ff6b6b' : '#dc2626',
  }), [isDarkMode]);
}
