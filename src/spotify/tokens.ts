import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const KEY = 'psalter.spotify.tokens.v1';

export interface StoredTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  scope?: string;
}

async function setItem(value: string): Promise<void> {
  if (Platform.OS === 'web') {
    window.localStorage.setItem(KEY, value);
    return;
  }
  await SecureStore.setItemAsync(KEY, value);
}

async function getItem(): Promise<string | null> {
  if (Platform.OS === 'web') {
    return window.localStorage.getItem(KEY);
  }
  return SecureStore.getItemAsync(KEY);
}

async function deleteItem(): Promise<void> {
  if (Platform.OS === 'web') {
    window.localStorage.removeItem(KEY);
    return;
  }
  await SecureStore.deleteItemAsync(KEY);
}

export async function saveTokens(t: StoredTokens): Promise<void> {
  await setItem(JSON.stringify(t));
}

export async function loadTokens(): Promise<StoredTokens | null> {
  const raw = await getItem();
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as StoredTokens;
    if (
      typeof parsed?.accessToken === 'string' &&
      typeof parsed?.refreshToken === 'string' &&
      typeof parsed?.expiresAt === 'number'
    ) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

export async function clearTokens(): Promise<void> {
  await deleteItem();
}

// --- Transient PKCE handshake (web only) -----------------------------------
// The code_verifier + state are single-transaction secrets, so they live in
// sessionStorage (tab-scoped, auto-cleared, and preserved across the same-tab
// full-page OAuth redirect) rather than localStorage.

export interface PendingWebAuth {
  codeVerifier: string;
  state: string;
  returnTo: string;
}

const PENDING_KEY = 'psalter.spotify.pending';

export function savePendingWebAuth(p: PendingWebAuth): void {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return;
  window.sessionStorage.setItem(PENDING_KEY, JSON.stringify(p));
}

export function loadPendingWebAuth(): PendingWebAuth | null {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return null;
  const raw = window.sessionStorage.getItem(PENDING_KEY);
  if (!raw) return null;
  try {
    const p = JSON.parse(raw) as PendingWebAuth;
    if (
      typeof p?.codeVerifier === 'string' &&
      typeof p?.state === 'string' &&
      typeof p?.returnTo === 'string'
    ) {
      return p;
    }
    return null;
  } catch {
    return null;
  }
}

export function clearPendingWebAuth(): void {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return;
  window.sessionStorage.removeItem(PENDING_KEY);
}
