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
