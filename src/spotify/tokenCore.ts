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
