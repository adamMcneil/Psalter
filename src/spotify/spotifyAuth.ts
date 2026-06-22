// Composition root: wires the framework-agnostic token core (tokenCore.ts) to
// the real config and persistence, and exposes the app-wide singletons. The
// only module that knows both the pure core and the platform side — hence it
// imports config/tokens and is NOT unit-tested under Node.

import { SPOTIFY_CLIENT_ID, SPOTIFY_DISCOVERY } from './config';
import { clearTokens, loadTokens, saveTokens } from './tokens';
import { createTokenClient, createTokenManager } from './tokenCore';

export const tokenClient = createTokenClient({
  clientId: SPOTIFY_CLIENT_ID ?? '',
  tokenEndpoint: SPOTIFY_DISCOVERY.tokenEndpoint,
  now: () => Date.now(),
});

export const tokenManager = createTokenManager({
  store: { load: loadTokens, save: saveTokens, clear: clearTokens },
  client: { refresh: (prev) => tokenClient.refresh(prev) },
  now: () => Date.now(),
});
