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
