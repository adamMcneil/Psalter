// Web OAuth (authorization code + PKCE) via full-page redirect. The pure
// decision logic for the redirect return lives in redirect.ts; this file owns
// the URL reading/stripping and the token exchange.

import { SPOTIFY_CLIENT_ID, SPOTIFY_DISCOVERY, SPOTIFY_SCOPES } from './config';
import { SpotifyAuthError } from './tokenCore';
import { decideRedirect } from './redirect';
import { makeCodeChallenge, makeCodeVerifier, makeState } from './pkce';
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

// e.g. https://example.github.io/Psalter/spotify-auth — BASE_URL always ends
// with a slash. This must be registered in the Spotify developer dashboard.
export function getRedirectUri(): string {
  return `${window.location.origin}${import.meta.env.BASE_URL}${REDIRECT_PATH}`;
}

export async function beginWebRedirectLogin(returnTo: string): Promise<void> {
  if (!SPOTIFY_CLIENT_ID) {
    throw new SpotifyAuthError('config', 'Spotify client ID is not configured.');
  }
  const codeVerifier = makeCodeVerifier();
  const state = makeState();
  const challenge = await makeCodeChallenge(codeVerifier);
  savePendingWebAuth({ codeVerifier, state, returnTo });

  const url = new URL(SPOTIFY_DISCOVERY.authorizationEndpoint);
  url.search = new URLSearchParams({
    client_id: SPOTIFY_CLIENT_ID,
    response_type: 'code',
    redirect_uri: getRedirectUri(),
    scope: SPOTIFY_SCOPES.join(' '),
    state,
    code_challenge_method: 'S256',
    code_challenge: challenge,
  }).toString();
  window.location.assign(url.toString());
}

export async function completeWebRedirectLogin(): Promise<WebRedirectResult> {
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
