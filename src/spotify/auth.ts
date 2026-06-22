import * as AuthSession from 'expo-auth-session';
import { Platform } from 'react-native';
import { SPOTIFY_CLIENT_ID, SPOTIFY_DISCOVERY, SPOTIFY_SCOPES } from './config';
import { SpotifyAuthError } from './tokenCore';
import { decideRedirect } from './redirect';
import { tokenClient, tokenManager } from './spotifyAuth';
import {
  clearPendingWebAuth,
  loadPendingWebAuth,
  savePendingWebAuth,
  StoredTokens,
} from './tokens';

const REDIRECT_PATH = 'spotify-auth';

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
  return AuthSession.makeRedirectUri({ scheme: 'psalter', path: REDIRECT_PATH });
}

function buildAuthRequest(): AuthSession.AuthRequest {
  return new AuthSession.AuthRequest({
    clientId: SPOTIFY_CLIENT_ID!,
    scopes: SPOTIFY_SCOPES,
    redirectUri: getRedirectUri(),
    usePKCE: true,
    responseType: AuthSession.ResponseType.Code,
  });
}

export async function beginWebRedirectLogin(returnTo: string): Promise<void> {
  if (Platform.OS !== 'web' || typeof window === 'undefined') {
    throw new SpotifyAuthError('config', 'beginWebRedirectLogin is web-only.');
  }
  if (!SPOTIFY_CLIENT_ID) {
    throw new SpotifyAuthError('config', 'Spotify client ID is not configured.');
  }
  const request = buildAuthRequest();
  const authUrl = await request.makeAuthUrlAsync(SPOTIFY_DISCOVERY);
  savePendingWebAuth({
    codeVerifier: request.codeVerifier ?? '',
    state: request.state,
    returnTo,
  });
  window.location.assign(authUrl);
}

export async function completeWebRedirectLogin(): Promise<WebRedirectResult> {
  if (Platform.OS !== 'web' || typeof window === 'undefined') {
    return { returnTo: '/', consumed: false };
  }
  const url = new URL(window.location.href);
  const params = {
    code: url.searchParams.get('code'),
    state: url.searchParams.get('state'),
    error: url.searchParams.get('error'),
  };
  // Strip OAuth params from the URL up front so a reload, Back navigation, or a
  // double-mount can never replay the single-use authorization code.
  if (params.code || params.error) {
    url.searchParams.delete('code');
    url.searchParams.delete('state');
    url.searchParams.delete('error');
    window.history.replaceState(window.history.state, '', url.toString());
  }

  const pending = loadPendingWebAuth();
  const decision = decideRedirect(params, pending);
  if (decision.kind === 'none') {
    return { returnTo: pending?.returnTo ?? '/', consumed: false };
  }
  clearPendingWebAuth();
  if (decision.kind === 'error') {
    return { error: decision.error, returnTo: decision.returnTo, consumed: true };
  }
  try {
    const tokens = await tokenClient.exchangeCode({
      code: decision.code,
      codeVerifier: decision.codeVerifier,
      redirectUri: getRedirectUri(),
    });
    await tokenManager.set(tokens);
    return { tokens, returnTo: decision.returnTo, consumed: true };
  } catch (e) {
    return {
      error: e instanceof Error ? e.message : String(e),
      returnTo: decision.returnTo,
      consumed: true,
    };
  }
}

export async function nativeLogin(): Promise<void> {
  if (!SPOTIFY_CLIENT_ID) {
    throw new SpotifyAuthError('config', 'Spotify client ID is not configured.');
  }
  const redirectUri = getRedirectUri();
  const request = buildAuthRequest();
  await request.makeAuthUrlAsync(SPOTIFY_DISCOVERY);
  const result = await request.promptAsync(SPOTIFY_DISCOVERY);
  if (result.type !== 'success') {
    if (result.type === 'error') {
      throw new SpotifyAuthError('oauth', result.error?.message ?? 'Spotify login failed.');
    }
    return; // dismissed / cancelled
  }
  const code = result.params.code;
  const verifier = request.codeVerifier;
  if (!code || !verifier) {
    throw new SpotifyAuthError('oauth', 'Spotify login did not return a code.');
  }
  const tokens = await tokenClient.exchangeCode({ code, codeVerifier: verifier, redirectUri });
  await tokenManager.set(tokens);
}
