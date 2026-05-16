import * as AuthSession from 'expo-auth-session';
import { Platform } from 'react-native';
import { SPOTIFY_CLIENT_ID, SPOTIFY_DISCOVERY, SPOTIFY_SCOPES } from './config';
import { saveTokens, StoredTokens } from './tokens';

const REDIRECT_PATH = 'spotify-auth';
const PENDING_AUTH_KEY = 'psalter.spotify.pending';

interface PendingWebAuth {
  codeVerifier: string;
  state: string;
  returnTo: string;
}

export interface WebRedirectResult {
  tokens?: StoredTokens;
  error?: string;
  returnTo: string;
  consumed: boolean;
}

export function getRedirectUri(): string {
  if (Platform.OS === 'web') {
    const baseUrl = (process.env.EXPO_BASE_URL ?? '').replace(/\/$/, '');
    return `${window.location.origin}${baseUrl}/${REDIRECT_PATH}`;
  }
  return AuthSession.makeRedirectUri({
    scheme: 'psalter',
    path: REDIRECT_PATH,
  });
}

function expiryFromNow(expiresInSec: number): number {
  return Date.now() + expiresInSec * 1000;
}

interface TokenResponseShape {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope?: string;
  token_type?: string;
}

export async function exchangeCodeForTokens(
  code: string,
  codeVerifier: string,
): Promise<StoredTokens> {
  if (!SPOTIFY_CLIENT_ID) throw new Error('Spotify client ID is not configured.');
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: getRedirectUri(),
    client_id: SPOTIFY_CLIENT_ID,
    code_verifier: codeVerifier,
  });

  const res = await fetch(SPOTIFY_DISCOVERY.tokenEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Spotify token exchange failed: ${res.status} ${text}`);
  }
  const json = (await res.json()) as TokenResponseShape;
  if (!json.refresh_token) {
    throw new Error('Spotify did not return a refresh token.');
  }
  const tokens: StoredTokens = {
    accessToken: json.access_token,
    refreshToken: json.refresh_token,
    expiresAt: expiryFromNow(json.expires_in),
    scope: json.scope,
  };
  await saveTokens(tokens);
  return tokens;
}

export async function beginWebRedirectLogin(returnTo: string): Promise<void> {
  if (Platform.OS !== 'web' || typeof window === 'undefined') {
    throw new Error('beginWebRedirectLogin is web-only.');
  }
  if (!SPOTIFY_CLIENT_ID) {
    throw new Error('Spotify client ID is not configured.');
  }

  const request = new AuthSession.AuthRequest({
    clientId: SPOTIFY_CLIENT_ID,
    scopes: SPOTIFY_SCOPES,
    redirectUri: getRedirectUri(),
    usePKCE: true,
    responseType: AuthSession.ResponseType.Code,
  });
  const authUrl = await request.makeAuthUrlAsync(SPOTIFY_DISCOVERY);

  const pending: PendingWebAuth = {
    codeVerifier: request.codeVerifier ?? '',
    state: request.state,
    returnTo,
  };
  window.localStorage.setItem(PENDING_AUTH_KEY, JSON.stringify(pending));
  window.location.assign(authUrl);
}

export async function completeWebRedirectLogin(): Promise<WebRedirectResult> {
  if (Platform.OS !== 'web' || typeof window === 'undefined') {
    return { returnTo: '/', consumed: false };
  }

  const url = new URL(window.location.href);
  const code = url.searchParams.get('code');
  const error = url.searchParams.get('error');
  const stateParam = url.searchParams.get('state');

  const raw = window.localStorage.getItem(PENDING_AUTH_KEY);
  let pending: PendingWebAuth | null = null;
  if (raw) {
    try {
      pending = JSON.parse(raw) as PendingWebAuth;
    } catch {
      pending = null;
    }
  }
  const returnTo = pending?.returnTo ?? '/';

  if (!code && !error) {
    return { returnTo, consumed: false };
  }

  if (pending) window.localStorage.removeItem(PENDING_AUTH_KEY);

  if (error) {
    return { error, returnTo, consumed: true };
  }
  if (!pending) {
    return { error: 'No pending auth state — try signing in again.', returnTo, consumed: true };
  }
  if (stateParam !== pending.state) {
    return { error: 'OAuth state mismatch — try signing in again.', returnTo, consumed: true };
  }

  try {
    const tokens = await exchangeCodeForTokens(code!, pending.codeVerifier);
    return { tokens, returnTo, consumed: true };
  } catch (e) {
    return {
      error: e instanceof Error ? e.message : String(e),
      returnTo,
      consumed: true,
    };
  }
}

export async function refreshAccessToken(
  refreshToken: string,
): Promise<StoredTokens> {
  if (!SPOTIFY_CLIENT_ID) throw new Error('Spotify client ID is not configured.');
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    client_id: SPOTIFY_CLIENT_ID,
  });

  const res = await fetch(SPOTIFY_DISCOVERY.tokenEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Spotify token refresh failed: ${res.status} ${text}`);
  }
  const json = (await res.json()) as TokenResponseShape;
  const tokens: StoredTokens = {
    accessToken: json.access_token,
    refreshToken: json.refresh_token ?? refreshToken,
    expiresAt: expiryFromNow(json.expires_in),
    scope: json.scope,
  };
  await saveTokens(tokens);
  return tokens;
}
