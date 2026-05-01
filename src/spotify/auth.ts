import * as AuthSession from 'expo-auth-session';
import { Platform } from 'react-native';
import {
  SPOTIFY_CLIENT_ID,
  SPOTIFY_DISCOVERY,
  SPOTIFY_SCOPES,
} from './config';
import { saveTokens, StoredTokens } from './tokens';

const REDIRECT_PATH = 'spotify-auth';

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
