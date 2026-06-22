import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { Platform } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { isSpotifyConfigured, SPOTIFY_CLIENT_ID } from './config';
import {
  beginWebRedirectLogin,
  completeWebRedirectLogin,
  nativeLogin,
  WebRedirectResult,
} from './auth';
import { tokenManager } from './spotifyAuth';
import { StoredTokens } from './tokens';

WebBrowser.maybeCompleteAuthSession();

export interface SpotifyUser {
  id: string;
  displayName: string | null;
  email: string | null;
  product: 'free' | 'premium' | 'open' | string | null;
  country: string | null;
}

interface AuthContextValue {
  configured: boolean;
  loading: boolean;
  tokens: StoredTokens | null;
  user: SpotifyUser | null;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  getAccessToken: () => Promise<string | null>;
  completeWebRedirect: () => Promise<WebRedirectResult>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

async function fetchUser(accessToken: string): Promise<SpotifyUser> {
  const res = await fetch('https://api.spotify.com/v1/me', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`GET /me failed: ${res.status}`);
  const json = await res.json();
  return {
    id: json.id,
    displayName: json.display_name ?? null,
    email: json.email ?? null,
    product: json.product ?? null,
    country: json.country ?? null,
  };
}

export function SpotifyAuthProvider({ children }: { children: ReactNode }) {
  const [tokens, setTokens] = useState<StoredTokens | null>(null);
  const [user, setUser] = useState<SpotifyUser | null>(null);
  const [loading, setLoading] = useState(true);

  // Single source of truth: mirror the token manager into React state, then
  // hydrate from storage (which may refresh a near-expiry token).
  useEffect(() => {
    const unsubscribe = tokenManager.subscribe(setTokens);
    let mounted = true;
    (async () => {
      const initial = await tokenManager.hydrate();
      if (mounted) {
        setTokens(initial);
        setLoading(false);
      }
    })();
    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  // Fetch the Spotify profile on the no-token -> token transition; clear it on
  // sign-out. Token *refreshes* (which keep hasToken true) don't refetch.
  const hasToken = !!tokens;
  useEffect(() => {
    if (!hasToken) {
      setUser(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const at = await tokenManager.getValidAccessToken();
      if (!at || cancelled) return;
      try {
        const u = await fetchUser(at);
        if (!cancelled) setUser(u);
      } catch {
        // /me failed; leave user null and let a later render retry.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [hasToken]);

  const getAccessToken = useCallback(() => tokenManager.getValidAccessToken(), []);

  const login = useCallback(async () => {
    if (!isSpotifyConfigured() || !SPOTIFY_CLIENT_ID) {
      throw new Error('Spotify client ID is not configured. Set EXPO_PUBLIC_SPOTIFY_CLIENT_ID.');
    }
    if (Platform.OS === 'web') {
      const returnTo = window.location.pathname + window.location.search + window.location.hash;
      await beginWebRedirectLogin(returnTo);
      return;
    }
    await nativeLogin();
  }, []);

  const logout = useCallback(() => tokenManager.clear(), []);
  const completeWebRedirect = useCallback(() => completeWebRedirectLogin(), []);

  const value = useMemo<AuthContextValue>(
    () => ({
      configured: isSpotifyConfigured(),
      loading,
      tokens,
      user,
      login,
      logout,
      getAccessToken,
      completeWebRedirect,
    }),
    [loading, tokens, user, login, logout, getAccessToken, completeWebRedirect],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useSpotifyAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useSpotifyAuth must be used inside SpotifyAuthProvider');
  }
  return ctx;
}
