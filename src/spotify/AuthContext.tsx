import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import {
  SPOTIFY_CLIENT_ID,
  SPOTIFY_DISCOVERY,
  SPOTIFY_SCOPES,
  isSpotifyConfigured,
} from './config';
import {
  exchangeCodeForTokens,
  getRedirectUri,
  refreshAccessToken,
} from './auth';
import { clearTokens, loadTokens, StoredTokens } from './tokens';

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
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const REFRESH_LEEWAY_MS = 60_000;

export function SpotifyAuthProvider({ children }: { children: ReactNode }) {
  const [tokens, setTokens] = useState<StoredTokens | null>(null);
  const [user, setUser] = useState<SpotifyUser | null>(null);
  const [loading, setLoading] = useState(true);
  const refreshing = useRef<Promise<StoredTokens> | null>(null);
  const tokensRef = useRef<StoredTokens | null>(null);
  tokensRef.current = tokens;

  const fetchUser = useCallback(async (accessToken: string) => {
    const res = await fetch('https://api.spotify.com/v1/me', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) throw new Error(`GET /me failed: ${res.status}`);
    const json = await res.json();
    setUser({
      id: json.id,
      displayName: json.display_name ?? null,
      email: json.email ?? null,
      product: json.product ?? null,
      country: json.country ?? null,
    });
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const stored = await loadTokens();
      if (!mounted) return;
      if (stored) {
        setTokens(stored);
        try {
          const fresh =
            stored.expiresAt - Date.now() < REFRESH_LEEWAY_MS
              ? await refreshAccessToken(stored.refreshToken)
              : stored;
          if (!mounted) return;
          setTokens(fresh);
          await fetchUser(fresh.accessToken);
        } catch {
          await clearTokens();
          if (mounted) {
            setTokens(null);
            setUser(null);
          }
        }
      }
      if (mounted) setLoading(false);
    })();
    return () => {
      mounted = false;
    };
  }, [fetchUser]);

  const getAccessToken = useCallback(async (): Promise<string | null> => {
    const current = tokensRef.current;
    if (!current) return null;
    if (current.expiresAt - Date.now() > REFRESH_LEEWAY_MS) {
      return current.accessToken;
    }
    if (!refreshing.current) {
      refreshing.current = refreshAccessToken(current.refreshToken).finally(
        () => {
          refreshing.current = null;
        },
      );
    }
    try {
      const next = await refreshing.current;
      setTokens(next);
      return next.accessToken;
    } catch {
      await clearTokens();
      setTokens(null);
      setUser(null);
      return null;
    }
  }, []);

  const login = useCallback(async () => {
    if (!isSpotifyConfigured() || !SPOTIFY_CLIENT_ID) {
      throw new Error(
        'Spotify client ID is not configured. Set EXPO_PUBLIC_SPOTIFY_CLIENT_ID.',
      );
    }
    const redirectUri = getRedirectUri();
    const request = new AuthSession.AuthRequest({
      clientId: SPOTIFY_CLIENT_ID,
      scopes: SPOTIFY_SCOPES,
      redirectUri,
      usePKCE: true,
      responseType: AuthSession.ResponseType.Code,
    });
    await request.makeAuthUrlAsync(SPOTIFY_DISCOVERY);
    const result = await request.promptAsync(SPOTIFY_DISCOVERY);
    if (result.type !== 'success') {
      if (result.type === 'error') {
        throw new Error(result.error?.message ?? 'Spotify login failed.');
      }
      return;
    }
    const code = result.params.code;
    const verifier = request.codeVerifier;
    if (!code || !verifier) {
      throw new Error('Spotify login did not return a code.');
    }
    const next = await exchangeCodeForTokens(code, verifier);
    setTokens(next);
    await fetchUser(next.accessToken);
  }, [fetchUser]);

  const logout = useCallback(async () => {
    await clearTokens();
    setTokens(null);
    setUser(null);
  }, []);

  const refreshUser = useCallback(async () => {
    const token = await getAccessToken();
    if (!token) return;
    await fetchUser(token);
  }, [fetchUser, getAccessToken]);

  const value = useMemo<AuthContextValue>(
    () => ({
      configured: isSpotifyConfigured(),
      loading,
      tokens,
      user,
      login,
      logout,
      getAccessToken,
      refreshUser,
    }),
    [loading, tokens, user, login, logout, getAccessToken, refreshUser],
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
