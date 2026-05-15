// tokenSync.ts — ponte tra AuthContext (AsyncStorage) e widget iOS (App Group)
// Dopo ogni login/logout, sincronizza il token con il widget.
// Il NativeModule scrive in UserDefaults con App Group, leggibile dal widget Swift.

import { NativeModules } from 'react-native';

const { TokenSyncModule } = NativeModules;

export interface SyncResult {
  success: boolean;
  username?: string;
}

export interface TokenData {
  hasToken: boolean;
  token?: string;
  username?: string;
}

/**
 * Copia il token JWT e username nell'App Group condiviso con il widget.
 * Chiamare dopo login o dopo aver ricevuto un nuovo token.
 */
export async function syncToken(token: string, username: string): Promise<SyncResult> {
  if (!TokenSyncModule) {
    console.warn('[tokenSync] TokenSyncModule non disponibile — widget non aggiornato');
    return { success: false };
  }
  try {
    const result = await TokenSyncModule.syncToken(token, username);
    console.log('[tokenSync] Token sincronizzato con widget');
    return result;
  } catch (err: any) {
    console.warn('[tokenSync] Errore sync:', err?.message);
    return { success: false };
  }
}

/**
 * Rimuove il token dall'App Group (logout).
 */
export async function clearToken(): Promise<SyncResult> {
  if (!TokenSyncModule) {
    return { success: false };
  }
  try {
    return await TokenSyncModule.clearToken();
  } catch (err: any) {
    console.warn('[tokenSync] Errore clear:', err?.message);
    return { success: false };
  }
}

/**
 * Legge il token dall'App Group (utile per debug).
 */
export async function getStoredToken(): Promise<TokenData> {
  if (!TokenSyncModule) {
    return { hasToken: false };
  }
  try {
    return await TokenSyncModule.getToken();
  } catch {
    return { hasToken: false };
  }
}
