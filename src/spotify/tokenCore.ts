// Framework-agnostic core of the Spotify auth: typed errors, the stateless
// token-endpoint client, and the stateful token manager (single source of
// truth + single-flight refresh). Intentionally free of React / expo /
// react-native imports and fully self-contained so it runs under Node's
// type stripping — see tokenCore.test.mts. The only dependency is the
// StoredTokens *type*, which is erased at runtime.

import type { StoredTokens } from './tokens';

// --- Errors ----------------------------------------------------------------

export type SpotifyAuthErrorKind =
  | 'config' // client ID missing / called on the wrong platform
  | 'network' // fetch threw (offline / DNS) — transient
  | 'http' // 429 / 5xx / other non-OK token response — transient
  | 'invalid_grant' // refresh token dead — permanent, sign the user out
  | 'oauth'; // authorize step returned an error / no code

export class SpotifyAuthError extends Error {
  readonly kind: SpotifyAuthErrorKind;
  readonly status?: number;

  constructor(kind: SpotifyAuthErrorKind, message: string, status?: number) {
    super(message);
    this.name = 'SpotifyAuthError';
    this.kind = kind;
    this.status = status;
  }

  /** Transient failures the caller may retry without signing out. */
  get retryable(): boolean {
    return this.kind === 'network' || this.kind === 'http';
  }
}

function readString(body: unknown, key: string): string | undefined {
  if (body && typeof body === 'object' && key in body) {
    const value = (body as Record<string, unknown>)[key];
    if (typeof value === 'string') return value;
  }
  return undefined;
}

/**
 * Turn a non-OK /api/token response into a typed error. Spotify signals a dead
 * refresh token with `{ "error": "invalid_grant" }`; everything else becomes a
 * transient `http` error (session kept, eligible for one retry).
 */
export function classifyTokenError(status: number, body: unknown): SpotifyAuthError {
  const error = readString(body, 'error');
  const description = readString(body, 'error_description');
  const message = description ?? error ?? `Spotify token endpoint error ${status}`;
  if (error === 'invalid_grant') {
    return new SpotifyAuthError('invalid_grant', message, status);
  }
  return new SpotifyAuthError('http', message, status);
}

// --- Token client (stateless network + pure transforms) --------------------

export interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope?: string;
  token_type?: string;
}

/**
 * Build StoredTokens from a token-endpoint response. Applies Spotify's rotation
 * rule — when no refresh_token is returned, keep the previous one — and computes
 * the absolute expiry from an injected clock (testable without real time).
 */
export function toStoredTokens(
  resp: TokenResponse,
  nowMs: number,
  prev?: StoredTokens,
): StoredTokens {
  return {
    accessToken: resp.access_token,
    refreshToken: resp.refresh_token ?? prev?.refreshToken ?? '',
    expiresAt: nowMs + resp.expires_in * 1000,
    scope: resp.scope ?? prev?.scope,
  };
}

export interface TokenClientConfig {
  clientId: string;
  tokenEndpoint: string;
  now?: () => number;
}

export interface SpotifyTokenClient {
  exchangeCode(args: { code: string; codeVerifier: string; redirectUri: string }): Promise<StoredTokens>;
  refresh(prev: StoredTokens): Promise<StoredTokens>;
}

export function createTokenClient(config: TokenClientConfig): SpotifyTokenClient {
  const now = config.now ?? (() => Date.now());

  async function post(params: Record<string, string>): Promise<TokenResponse> {
    let res: Response;
    try {
      res = await fetch(config.tokenEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(params).toString(),
      });
    } catch (e) {
      throw new SpotifyAuthError('network', e instanceof Error ? e.message : 'Network error reaching Spotify.');
    }
    const text = await res.text();
    let body: unknown = null;
    if (text) {
      try {
        body = JSON.parse(text);
      } catch {
        body = text;
      }
    }
    if (!res.ok) throw classifyTokenError(res.status, body);
    return body as TokenResponse;
  }

  return {
    async exchangeCode({ code, codeVerifier, redirectUri }) {
      const json = await post({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
        client_id: config.clientId,
        code_verifier: codeVerifier,
      });
      if (!json.refresh_token) {
        throw new SpotifyAuthError('oauth', 'Spotify did not return a refresh token.');
      }
      return toStoredTokens(json, now());
    },

    async refresh(prev) {
      const json = await post({
        grant_type: 'refresh_token',
        refresh_token: prev.refreshToken,
        client_id: config.clientId,
      });
      return toStoredTokens(json, now(), prev);
    },
  };
}

// --- Token manager (stateful single source of truth) -----------------------

export interface TokenStore {
  load(): Promise<StoredTokens | null>;
  save(tokens: StoredTokens): Promise<void>;
  clear(): Promise<void>;
}

export interface TokenRefresher {
  refresh(prev: StoredTokens): Promise<StoredTokens>;
}

export interface TokenManagerDeps {
  store: TokenStore;
  client: TokenRefresher;
  now: () => number;
  /** Refresh this many ms before the real expiry. Defaults to 60s. */
  leewayMs?: number;
}

export type TokenListener = (tokens: StoredTokens | null) => void;

export interface TokenManager {
  hydrate(): Promise<StoredTokens | null>;
  getTokens(): StoredTokens | null;
  getValidAccessToken(): Promise<string | null>;
  forceRefresh(): Promise<StoredTokens | null>;
  set(tokens: StoredTokens): Promise<void>;
  clear(): Promise<void>;
  subscribe(listener: TokenListener): () => void;
}

export const DEFAULT_LEEWAY_MS = 60_000;

export function createTokenManager(deps: TokenManagerDeps): TokenManager {
  const leewayMs = deps.leewayMs ?? DEFAULT_LEEWAY_MS;
  let current: StoredTokens | null = null;
  let inFlight: Promise<StoredTokens> | null = null;
  const listeners = new Set<TokenListener>();

  const notify = () => {
    for (const listener of listeners) listener(current);
  };
  const isFresh = (t: StoredTokens) => t.expiresAt - deps.now() > leewayMs;

  // Collapse concurrent refreshes onto a single network call so a rotating
  // refresh token is never spent twice.
  function refreshOnce(prev: StoredTokens): Promise<StoredTokens> {
    if (!inFlight) {
      inFlight = (async () => {
        try {
          const next = await deps.client.refresh(prev);
          current = next;
          await deps.store.save(next);
          notify();
          return next;
        } finally {
          inFlight = null;
        }
      })();
    }
    return inFlight;
  }

  // Refresh, turning a permanent invalid_grant into a clean sign-out while
  // letting transient errors propagate (the stored tokens are kept).
  async function refreshOrSignOut(prev: StoredTokens): Promise<StoredTokens | null> {
    try {
      return await refreshOnce(prev);
    } catch (e) {
      if (e instanceof SpotifyAuthError && e.kind === 'invalid_grant') {
        current = null;
        await deps.store.clear();
        notify();
        return null;
      }
      throw e;
    }
  }

  return {
    async hydrate() {
      current = await deps.store.load();
      if (current && !isFresh(current)) {
        try {
          await refreshOrSignOut(current);
        } catch {
          // Transient failure at startup: keep the stale token, refresh on demand.
        }
      } else {
        notify();
      }
      return current;
    },

    getTokens: () => current,

    async getValidAccessToken() {
      if (!current) return null;
      if (isFresh(current)) return current.accessToken;
      try {
        const next = await refreshOrSignOut(current);
        return next ? next.accessToken : null;
      } catch {
        // Transient: fall back to the token we still hold rather than starving
        // the caller; the API layer's 401 retry will force another refresh.
        return current ? current.accessToken : null;
      }
    },

    async forceRefresh() {
      if (!current) return null;
      return refreshOrSignOut(current);
    },

    async set(tokens) {
      current = tokens;
      await deps.store.save(tokens);
      notify();
    },

    async clear() {
      current = null;
      await deps.store.clear();
      notify();
    },

    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
