# Spotify Auth Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Harden the existing Spotify Authorization Code + PKCE auth — robust refresh, single-flight, idempotent web redirect, 401 retry — by extracting a unit-tested, framework-agnostic token core, without changing the flow, dependencies, or deploy.

**Architecture:** Pull the security-critical logic out of React into a self-contained `tokenCore.ts` (typed errors + stateless token client + stateful single-flight token manager) and a pure `redirect.ts`. A `spotifyAuth.ts` composition root wires them to real config/storage and exposes singletons. `auth.ts` becomes flow-only, `AuthContext.tsx` a thin subscriber, `api.ts` gains a one-shot 401 refresh-retry.

**Tech Stack:** Expo ~54 / React Native 0.81 + react-native-web, expo-router, expo-auth-session, expo-secure-store. Tests: Node built-in runner (`node --experimental-strip-types --test`), `*.test.mts`.

## Global Constraints

Every task inherits these. Copied verbatim from the design spec
(`docs/superpowers/specs/2026-06-22-spotify-auth-hardening-design.md`):

- Keep Authorization Code + PKCE via `expo-auth-session`. **No backend. No new dependencies.** No change to scopes, client config, or `.github/workflows/deploy.yml`.
- Token storage key **stays `psalter.spotify.tokens.v1`** — no forced re-login.
- **Testable modules (`tokenCore.ts`, `redirect.ts`) must be free of `react-native`, `expo*`, and `react` imports**, and must be **self-contained** — their only internal import is `import type` (erased at runtime). Verified: under `node --experimental-strip-types`, an extensionless internal import throws `ERR_MODULE_NOT_FOUND`, and `.ts`-extension imports in app code would force `allowImportingTsExtensions`/Metro changes. Self-contained modules avoid both.
- Tests: Node built-in runner; files named `*.test.mts`; **import the module under test with an explicit `.ts` extension**; use `node:test` + `node:assert/strict` (match `src/spotify/stallDetector.test.mts`).
- Preserve the `AuthContextValue` interface and the `spotifyApi(getToken)` signature (existing consumers: `WebPlayerContext.tsx`, `artistImages.ts`, `previewUrls.ts`, screens).
- TypeScript `strict`. `npm run typecheck` and `npm test` must pass at **every** commit.
- Do not modify the tuned playback logic in `WebPlayerContext.tsx`.

**Branch:** all work happens on `spotify-auth-hardening` (already created; the spec is committed there).

**File structure (locked):**
- New, self-contained, unit-tested: `src/spotify/tokenCore.ts`, `src/spotify/redirect.ts`
- New, composition root (not unit-tested): `src/spotify/spotifyAuth.ts`
- Modified: `src/spotify/tokens.ts`, `src/spotify/auth.ts`, `src/spotify/AuthContext.tsx`, `src/spotify/api.ts`
- New tests: `src/spotify/tokenCore.test.mts`, `src/spotify/redirect.test.mts`
- Verified-unchanged: `src/spotify/WebPlayerContext.tsx`, `app/spotify-auth.tsx`, `src/spotify/config.ts`

---

### Task 1: Pending-auth store (sessionStorage) in `tokens.ts`

Adds the transient PKCE-handshake store and its type. Additive — existing token
persistence is untouched, so nothing else breaks yet.

**Files:**
- Modify: `src/spotify/tokens.ts` (append after the existing `clearTokens`)

**Interfaces:**
- Consumes: nothing new.
- Produces: `interface PendingWebAuth { codeVerifier: string; state: string; returnTo: string }`; `savePendingWebAuth(p: PendingWebAuth): void`; `loadPendingWebAuth(): PendingWebAuth | null`; `clearPendingWebAuth(): void`. Used by `redirect.ts` (type only) and `auth.ts` (Task 7).

- [ ] **Step 1: Append the pending store to `tokens.ts`**

Add at the end of `src/spotify/tokens.ts` (the file already imports `Platform` from `react-native`):

```ts
// --- Transient PKCE handshake (web only) -----------------------------------
// The code_verifier + state are single-transaction secrets, so they live in
// sessionStorage (tab-scoped, auto-cleared, and preserved across the same-tab
// full-page OAuth redirect) rather than localStorage.

export interface PendingWebAuth {
  codeVerifier: string;
  state: string;
  returnTo: string;
}

const PENDING_KEY = 'psalter.spotify.pending';

export function savePendingWebAuth(p: PendingWebAuth): void {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return;
  window.sessionStorage.setItem(PENDING_KEY, JSON.stringify(p));
}

export function loadPendingWebAuth(): PendingWebAuth | null {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return null;
  const raw = window.sessionStorage.getItem(PENDING_KEY);
  if (!raw) return null;
  try {
    const p = JSON.parse(raw) as PendingWebAuth;
    if (
      typeof p?.codeVerifier === 'string' &&
      typeof p?.state === 'string' &&
      typeof p?.returnTo === 'string'
    ) {
      return p;
    }
    return null;
  } catch {
    return null;
  }
}

export function clearPendingWebAuth(): void {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return;
  window.sessionStorage.removeItem(PENDING_KEY);
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 3: Confirm existing tests still pass**

Run: `npm test`
Expected: `stallDetector.test.mts` passes; 0 failures.

- [ ] **Step 4: Commit**

```bash
git add src/spotify/tokens.ts
git commit -m "feat(spotify): add sessionStorage pending-auth store for PKCE handshake" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Typed errors + classifier (`tokenCore.ts`, part 1)

Creates `tokenCore.ts` with the error layer. Self-contained (no runtime imports).

**Files:**
- Create: `src/spotify/tokenCore.ts`
- Test: `src/spotify/tokenCore.test.mts`

**Interfaces:**
- Consumes: `import type { StoredTokens } from './tokens'` (erased).
- Produces: `type SpotifyAuthErrorKind`; `class SpotifyAuthError(kind, message, status?)` with `.retryable`; `classifyTokenError(status: number, body: unknown): SpotifyAuthError`.

- [ ] **Step 1: Write the failing test**

Create `src/spotify/tokenCore.test.mts`:

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SpotifyAuthError, classifyTokenError } from './tokenCore.ts';

test('classifyTokenError maps an invalid_grant body to the invalid_grant kind', () => {
  const e = classifyTokenError(400, { error: 'invalid_grant', error_description: 'token revoked' });
  assert.equal(e.kind, 'invalid_grant');
  assert.equal(e.retryable, false);
  assert.match(e.message, /revoked/);
  assert.equal(e.status, 400);
});

test('classifyTokenError maps 429 and 5xx to a retryable http error', () => {
  assert.equal(classifyTokenError(429, { error: 'rate' }).kind, 'http');
  assert.equal(classifyTokenError(503, null).kind, 'http');
  assert.equal(classifyTokenError(503, null).retryable, true);
});

test('classifyTokenError maps other 4xx (not invalid_grant) to http', () => {
  assert.equal(classifyTokenError(400, { error: 'invalid_request' }).kind, 'http');
});

test('classifyTokenError falls back to a status message when the body has none', () => {
  assert.match(classifyTokenError(500, null).message, /500/);
});

test('SpotifyAuthError.retryable is true only for network and http', () => {
  assert.equal(new SpotifyAuthError('network', 'x').retryable, true);
  assert.equal(new SpotifyAuthError('http', 'x').retryable, true);
  assert.equal(new SpotifyAuthError('invalid_grant', 'x').retryable, false);
  assert.equal(new SpotifyAuthError('config', 'x').retryable, false);
  assert.equal(new SpotifyAuthError('oauth', 'x').retryable, false);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --experimental-strip-types --test src/spotify/tokenCore.test.mts`
Expected: FAIL — `Cannot find module './tokenCore.ts'` (file not created yet).

- [ ] **Step 3: Create `tokenCore.ts` with the error layer**

Create `src/spotify/tokenCore.ts`:

```ts
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
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --experimental-strip-types --test src/spotify/tokenCore.test.mts`
Expected: PASS — 5 tests, 0 failures.

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/spotify/tokenCore.ts src/spotify/tokenCore.test.mts
git commit -m "feat(spotify): add typed auth errors + token-endpoint error classifier" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Token client + transforms (`tokenCore.ts`, part 2)

Adds the stateless `/api/token` client and the pure `toStoredTokens` transform
(rotation + expiry).

**Files:**
- Modify: `src/spotify/tokenCore.ts` (append)
- Test: `src/spotify/tokenCore.test.mts` (append)

**Interfaces:**
- Consumes: `SpotifyAuthError`, `classifyTokenError` (Task 2); `StoredTokens` type.
- Produces: `interface TokenResponse`; `toStoredTokens(resp, nowMs, prev?): StoredTokens`; `interface TokenClientConfig { clientId; tokenEndpoint; now? }`; `interface SpotifyTokenClient { exchangeCode({code,codeVerifier,redirectUri}); refresh(prev) }`; `createTokenClient(config): SpotifyTokenClient`.

- [ ] **Step 1: Append the failing tests**

Append to `src/spotify/tokenCore.test.mts`:

```ts
import { toStoredTokens, createTokenClient } from './tokenCore.ts';

test('toStoredTokens computes expiry from the injected clock', () => {
  const t = toStoredTokens({ access_token: 'a', refresh_token: 'r', expires_in: 3600 }, 1_000);
  assert.equal(t.accessToken, 'a');
  assert.equal(t.refreshToken, 'r');
  assert.equal(t.expiresAt, 1_000 + 3600 * 1000);
});

test('toStoredTokens keeps the previous refresh token + scope when none returned (rotation)', () => {
  const prev = { accessToken: 'old', refreshToken: 'KEEPME', expiresAt: 0, scope: 'streaming' };
  const t = toStoredTokens({ access_token: 'new', expires_in: 3600 }, 0, prev);
  assert.equal(t.refreshToken, 'KEEPME');
  assert.equal(t.scope, 'streaming');
});

test('toStoredTokens uses a newly returned refresh token when present', () => {
  const prev = { accessToken: 'old', refreshToken: 'OLD', expiresAt: 0 };
  const t = toStoredTokens({ access_token: 'new', refresh_token: 'NEW', expires_in: 10 }, 0, prev);
  assert.equal(t.refreshToken, 'NEW');
});

test('exchangeCode posts the documented body and returns stored tokens', async () => {
  const realFetch = globalThis.fetch;
  let body = '';
  globalThis.fetch = (async (_url: string, init: { body: string }) => {
    body = String(init.body);
    return {
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ access_token: 'AT', refresh_token: 'RT', expires_in: 3600, scope: 'streaming' }),
    };
  }) as unknown as typeof fetch;
  try {
    const client = createTokenClient({ clientId: 'CID', tokenEndpoint: 'https://x/token', now: () => 0 });
    const t = await client.exchangeCode({ code: 'CODE', codeVerifier: 'VER', redirectUri: 'https://app/cb' });
    assert.equal(t.accessToken, 'AT');
    assert.equal(t.refreshToken, 'RT');
    assert.match(body, /grant_type=authorization_code/);
    assert.match(body, /client_id=CID/);
    assert.match(body, /code_verifier=VER/);
    assert.match(body, /code=CODE/);
    assert.ok(!/client_secret/.test(body), 'PKCE flow sends no client secret');
  } finally {
    globalThis.fetch = realFetch;
  }
});

test('refresh sends the refresh_token grant with client_id and no secret, keeping the old token', async () => {
  const realFetch = globalThis.fetch;
  let body = '';
  globalThis.fetch = (async (_url: string, init: { body: string }) => {
    body = String(init.body);
    return { ok: true, status: 200, text: async () => JSON.stringify({ access_token: 'AT2', expires_in: 3600 }) };
  }) as unknown as typeof fetch;
  try {
    const client = createTokenClient({ clientId: 'CID', tokenEndpoint: 'https://x/token', now: () => 5_000 });
    const t = await client.refresh({ accessToken: 'old', refreshToken: 'RT', expiresAt: 0, scope: 'streaming' });
    assert.equal(t.accessToken, 'AT2');
    assert.equal(t.refreshToken, 'RT');
    assert.equal(t.expiresAt, 5_000 + 3600 * 1000);
    assert.match(body, /grant_type=refresh_token/);
    assert.match(body, /refresh_token=RT/);
    assert.match(body, /client_id=CID/);
    assert.ok(!/client_secret/.test(body));
  } finally {
    globalThis.fetch = realFetch;
  }
});

test('a non-OK token response is classified (invalid_grant)', async () => {
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async () => ({
    ok: false,
    status: 400,
    text: async () => JSON.stringify({ error: 'invalid_grant', error_description: 'revoked' }),
  })) as unknown as typeof fetch;
  try {
    const client = createTokenClient({ clientId: 'CID', tokenEndpoint: 'https://x/token' });
    await assert.rejects(
      () => client.refresh({ accessToken: 'a', refreshToken: 'r', expiresAt: 0 }),
      (e: unknown) => e instanceof SpotifyAuthError && e.kind === 'invalid_grant',
    );
  } finally {
    globalThis.fetch = realFetch;
  }
});

test('a network failure becomes a retryable network error', async () => {
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async () => {
    throw new TypeError('Failed to fetch');
  }) as unknown as typeof fetch;
  try {
    const client = createTokenClient({ clientId: 'CID', tokenEndpoint: 'https://x/token' });
    await assert.rejects(
      () => client.refresh({ accessToken: 'a', refreshToken: 'r', expiresAt: 0 }),
      (e: unknown) => e instanceof SpotifyAuthError && e.kind === 'network' && e.retryable === true,
    );
  } finally {
    globalThis.fetch = realFetch;
  }
});

test('exchangeCode rejects when Spotify returns no refresh token', async () => {
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async () => ({
    ok: true,
    status: 200,
    text: async () => JSON.stringify({ access_token: 'AT', expires_in: 3600 }),
  })) as unknown as typeof fetch;
  try {
    const client = createTokenClient({ clientId: 'CID', tokenEndpoint: 'https://x/token' });
    await assert.rejects(() => client.exchangeCode({ code: 'c', codeVerifier: 'v', redirectUri: 'r' }));
  } finally {
    globalThis.fetch = realFetch;
  }
});
```

- [ ] **Step 2: Run the tests to verify the new ones fail**

Run: `node --experimental-strip-types --test src/spotify/tokenCore.test.mts`
Expected: FAIL — `toStoredTokens`/`createTokenClient` are not exported yet.

- [ ] **Step 3: Append the client + transform to `tokenCore.ts`**

Append to `src/spotify/tokenCore.ts`:

```ts
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
        throw new SpotifyAuthError('http', 'Spotify did not return a refresh token.');
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
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --experimental-strip-types --test src/spotify/tokenCore.test.mts`
Expected: PASS — all tests (Task 2 + Task 3), 0 failures.

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/spotify/tokenCore.ts src/spotify/tokenCore.test.mts
git commit -m "feat(spotify): add stateless token client + rotation/expiry transforms" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Single-flight token manager (`tokenCore.ts`, part 3)

Adds the stateful source of truth: single-flight refresh, invalid_grant
sign-out, transient-keeps-session, subscribers.

**Files:**
- Modify: `src/spotify/tokenCore.ts` (append)
- Test: `src/spotify/tokenCore.test.mts` (append)

**Interfaces:**
- Consumes: `SpotifyAuthError`, `StoredTokens` type.
- Produces: `interface TokenStore`; `interface TokenRefresher`; `interface TokenManagerDeps { store; client; now; leewayMs? }`; `type TokenListener`; `interface TokenManager { hydrate; getTokens; getValidAccessToken; forceRefresh; set; clear; subscribe }`; `const DEFAULT_LEEWAY_MS`; `createTokenManager(deps): TokenManager`.

- [ ] **Step 1: Append the failing tests**

Append to `src/spotify/tokenCore.test.mts`:

```ts
import { createTokenManager } from './tokenCore.ts';

type T = { accessToken: string; refreshToken: string; expiresAt: number; scope?: string };

function makeStore(initial: T | null = null) {
  let saved = initial;
  return {
    saved: () => saved,
    load: async () => saved,
    save: async (t: T) => {
      saved = t;
    },
    clear: async () => {
      saved = null;
    },
  };
}

test('getValidAccessToken returns the held token without refreshing when fresh', async () => {
  const now = 1_000_000;
  let refreshCalls = 0;
  const mgr = createTokenManager({
    store: makeStore(),
    client: { refresh: async (p: T) => ((refreshCalls += 1), { ...p, accessToken: 'new' }) },
    now: () => now,
  });
  await mgr.set({ accessToken: 'fresh', refreshToken: 'r', expiresAt: now + 120_000 });
  assert.equal(await mgr.getValidAccessToken(), 'fresh');
  assert.equal(refreshCalls, 0);
});

test('concurrent getValidAccessToken calls trigger a single refresh (single-flight)', async () => {
  const now = 1_000_000;
  let refreshCalls = 0;
  const mgr = createTokenManager({
    store: makeStore(),
    client: {
      refresh: async (p: T) => {
        refreshCalls += 1;
        await new Promise((r) => setTimeout(r, 10));
        return { ...p, accessToken: 'refreshed', expiresAt: now + 3_600_000 };
      },
    },
    now: () => now,
  });
  await mgr.set({ accessToken: 'stale', refreshToken: 'r', expiresAt: now }); // expired (delta 0 < leeway)
  const results = await Promise.all([mgr.getValidAccessToken(), mgr.getValidAccessToken(), mgr.getValidAccessToken()]);
  assert.deepEqual(results, ['refreshed', 'refreshed', 'refreshed']);
  assert.equal(refreshCalls, 1, 'all concurrent callers share one refresh');
});

test('invalid_grant on refresh clears tokens and notifies sign-out', async () => {
  const now = 1_000_000;
  const store = makeStore();
  const seen: (T | null)[] = [];
  const mgr = createTokenManager({
    store,
    client: { refresh: async () => { throw new SpotifyAuthError('invalid_grant', 'bad'); } },
    now: () => now,
  });
  mgr.subscribe((t) => seen.push(t as T | null));
  await mgr.set({ accessToken: 'a', refreshToken: 'r', expiresAt: now }); // expired
  assert.equal(await mgr.getValidAccessToken(), null);
  assert.equal(mgr.getTokens(), null);
  assert.equal(store.saved(), null);
  assert.equal(seen[seen.length - 1], null, 'subscribers told about sign-out');
});

test('a transient refresh error keeps the session and returns the held token', async () => {
  const now = 1_000_000;
  const mgr = createTokenManager({
    store: makeStore(),
    client: { refresh: async () => { throw new SpotifyAuthError('network', 'offline'); } },
    now: () => now,
  });
  await mgr.set({ accessToken: 'stillgood', refreshToken: 'r', expiresAt: now }); // expired by clock
  assert.equal(await mgr.getValidAccessToken(), 'stillgood');
  assert.notEqual(mgr.getTokens(), null, 'session preserved on a transient failure');
});

test('refresh persists rotated tokens and notifies subscribers', async () => {
  const now = 1_000_000;
  const store = makeStore();
  const seen: (T | null)[] = [];
  const mgr = createTokenManager({
    store,
    client: { refresh: async (p: T) => ({ accessToken: 'AT2', refreshToken: 'RT2', expiresAt: now + 3_600_000, scope: p.scope }) },
    now: () => now,
  });
  mgr.subscribe((t) => seen.push(t as T | null));
  await mgr.set({ accessToken: 'AT1', refreshToken: 'RT1', expiresAt: now, scope: 's' });
  assert.equal(await mgr.getValidAccessToken(), 'AT2');
  assert.equal(store.saved()?.refreshToken, 'RT2');
  assert.equal(seen[seen.length - 1]?.accessToken, 'AT2');
});

test('clear wipes memory and storage', async () => {
  const now = 1;
  const store = makeStore();
  const mgr = createTokenManager({ store, client: { refresh: async (p: T) => p }, now: () => now });
  await mgr.set({ accessToken: 'a', refreshToken: 'r', expiresAt: now + 999_999 });
  await mgr.clear();
  assert.equal(mgr.getTokens(), null);
  assert.equal(store.saved(), null);
  assert.equal(await mgr.getValidAccessToken(), null);
});

test('hydrate loads stored tokens and refreshes when near expiry', async () => {
  const now = 1_000_000;
  let refreshCalls = 0;
  const store = makeStore({ accessToken: 'old', refreshToken: 'r', expiresAt: now + 1_000 }); // within 60s leeway
  const mgr = createTokenManager({
    store,
    client: { refresh: async (p: T) => ((refreshCalls += 1), { ...p, accessToken: 'rehydrated', expiresAt: now + 3_600_000 }) },
    now: () => now,
  });
  const hydrated = await mgr.hydrate();
  assert.equal(refreshCalls, 1);
  assert.equal(hydrated?.accessToken, 'rehydrated');
  assert.equal(mgr.getTokens()?.accessToken, 'rehydrated');
});
```

- [ ] **Step 2: Run the tests to verify the new ones fail**

Run: `node --experimental-strip-types --test src/spotify/tokenCore.test.mts`
Expected: FAIL — `createTokenManager` is not exported yet.

- [ ] **Step 3: Append the manager to `tokenCore.ts`**

Append to `src/spotify/tokenCore.ts`:

```ts
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
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --experimental-strip-types --test src/spotify/tokenCore.test.mts`
Expected: PASS — all tokenCore tests, 0 failures.

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/spotify/tokenCore.ts src/spotify/tokenCore.test.mts
git commit -m "feat(spotify): add single-flight token manager with invalid_grant sign-out" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Pure web-redirect decision (`redirect.ts`)

The testable core of the web OAuth return: given URL params + pending state,
decide none / error / exchange. Self-contained (type-only import).

**Files:**
- Create: `src/spotify/redirect.ts`
- Test: `src/spotify/redirect.test.mts`

**Interfaces:**
- Consumes: `import type { PendingWebAuth } from './tokens'` (Task 1, erased).
- Produces: `interface RedirectParams { code; state; error }` (all `string | null`); `type RedirectDecision = {kind:'none'} | {kind:'error'; error; returnTo} | {kind:'exchange'; code; codeVerifier; returnTo}`; `decideRedirect(params, pending): RedirectDecision`. Used by `auth.ts` (Task 7).

- [ ] **Step 1: Write the failing test**

Create `src/spotify/redirect.test.mts`:

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decideRedirect } from './redirect.ts';

const pending = { codeVerifier: 'VER', state: 'STATE', returnTo: '/account' };

test('no code and no error means nothing to consume (idempotent after URL strip)', () => {
  assert.equal(decideRedirect({ code: null, state: null, error: null }, pending).kind, 'none');
});

test('an error param is surfaced as an error decision', () => {
  const d = decideRedirect({ code: null, state: 'STATE', error: 'access_denied' }, pending);
  assert.equal(d.kind, 'error');
  if (d.kind === 'error') {
    assert.match(d.error, /access_denied/);
    assert.equal(d.returnTo, '/account');
  }
});

test('a code with no pending state is an error (cannot verify CSRF)', () => {
  const d = decideRedirect({ code: 'CODE', state: 'STATE', error: null }, null);
  assert.equal(d.kind, 'error');
  if (d.kind === 'error') assert.match(d.error, /pending/i);
});

test('a state mismatch is rejected', () => {
  const d = decideRedirect({ code: 'CODE', state: 'WRONG', error: null }, pending);
  assert.equal(d.kind, 'error');
  if (d.kind === 'error') assert.match(d.error, /state/i);
});

test('a valid code + matching state yields an exchange decision', () => {
  const d = decideRedirect({ code: 'CODE', state: 'STATE', error: null }, pending);
  assert.equal(d.kind, 'exchange');
  if (d.kind === 'exchange') {
    assert.equal(d.code, 'CODE');
    assert.equal(d.codeVerifier, 'VER');
    assert.equal(d.returnTo, '/account');
  }
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --experimental-strip-types --test src/spotify/redirect.test.mts`
Expected: FAIL — `Cannot find module './redirect.ts'`.

- [ ] **Step 3: Create `redirect.ts`**

Create `src/spotify/redirect.ts`:

```ts
// Pure decision logic for the web OAuth redirect return. Kept free of
// react-native/expo imports (PendingWebAuth is a type-only import, erased at
// runtime) so it can be unit-tested under Node — see redirect.test.mts. The
// URL reading/stripping lives in auth.ts; this only decides what to do with
// whatever params were found.

import type { PendingWebAuth } from './tokens';

export interface RedirectParams {
  code: string | null;
  state: string | null;
  error: string | null;
}

export type RedirectDecision =
  | { kind: 'none' }
  | { kind: 'error'; error: string; returnTo: string }
  | { kind: 'exchange'; code: string; codeVerifier: string; returnTo: string };

export function decideRedirect(params: RedirectParams, pending: PendingWebAuth | null): RedirectDecision {
  const { code, state, error } = params;
  // Nothing OAuth-related in the URL (fresh load, or we already stripped it).
  if (!code && !error) return { kind: 'none' };

  const returnTo = pending?.returnTo ?? '/';

  if (error) return { kind: 'error', error, returnTo };
  if (!code) return { kind: 'none' }; // defensive; unreachable given the first guard
  if (!pending) {
    return { kind: 'error', error: 'No pending auth state — try signing in again.', returnTo };
  }
  if (!state || state !== pending.state) {
    return { kind: 'error', error: 'OAuth state mismatch — try signing in again.', returnTo };
  }
  return { kind: 'exchange', code, codeVerifier: pending.codeVerifier, returnTo };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --experimental-strip-types --test src/spotify/redirect.test.mts`
Expected: PASS — 5 tests, 0 failures.

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/spotify/redirect.ts src/spotify/redirect.test.mts
git commit -m "feat(spotify): add pure web-redirect decision logic" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: Composition root (`spotifyAuth.ts`)

Wires the pure core to real config + storage and exposes the app-wide
singletons. Not unit-tested (imports config/tokens, i.e. expo/react-native).

**Files:**
- Create: `src/spotify/spotifyAuth.ts`

**Interfaces:**
- Consumes: `SPOTIFY_CLIENT_ID`, `SPOTIFY_DISCOVERY` (`config.ts`); `loadTokens`, `saveTokens`, `clearTokens` (`tokens.ts`); `createTokenClient`, `createTokenManager` (`tokenCore.ts`).
- Produces: `export const tokenClient: SpotifyTokenClient`; `export const tokenManager: TokenManager`. Used by `auth.ts` (Task 7) and `api.ts` (Task 8).

- [ ] **Step 1: Create `spotifyAuth.ts`**

Create `src/spotify/spotifyAuth.ts`:

```ts
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
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: no errors. (The singletons are unused so far — fine.)

- [ ] **Step 3: Commit**

```bash
git add src/spotify/spotifyAuth.ts
git commit -m "feat(spotify): wire token core composition root" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: Route the flow + context through the core (`auth.ts` + `AuthContext.tsx`)

Rewrite `auth.ts` to flow-only (using `redirect.decideRedirect`, the singletons,
the sessionStorage pending store, URL stripping) and slim `AuthContext.tsx` into
a thin subscriber. **Done together** so no import dangles mid-change (the old
`exchangeCodeForTokens`/`refreshAccessToken` exports are removed from `auth.ts`
and `AuthContext.tsx` is the only consumer).

**Files:**
- Modify (full rewrite): `src/spotify/auth.ts`
- Modify (full rewrite): `src/spotify/AuthContext.tsx`

**Interfaces:**
- Consumes: `decideRedirect` (Task 5); `tokenClient`, `tokenManager` (Task 6); `savePendingWebAuth`/`loadPendingWebAuth`/`clearPendingWebAuth`/`PendingWebAuth`/`StoredTokens` (Task 1 + `tokens.ts`); `SpotifyAuthError` (Task 2); `SPOTIFY_*` (`config.ts`).
- Produces (from `auth.ts`): `getRedirectUri()`; `beginWebRedirectLogin(returnTo)`; `completeWebRedirectLogin(): Promise<WebRedirectResult>`; `nativeLogin(): Promise<void>`; `interface WebRedirectResult { tokens?; error?; returnTo; consumed }`.
- Produces (from `AuthContext.tsx`): unchanged `AuthContextValue`, `SpotifyAuthProvider`, `useSpotifyAuth` (consumed by `WebPlayerContext.tsx`, screens).

- [ ] **Step 1: Rewrite `auth.ts`**

Replace the entire contents of `src/spotify/auth.ts` with:

```ts
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
  if (params.code || params.error || params.state) {
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
```

- [ ] **Step 2: Rewrite `AuthContext.tsx`**

Replace the entire contents of `src/spotify/AuthContext.tsx` with:

```tsx
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
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: no errors. (If it complains that `WebPlayerContext.tsx` references a missing field, the `AuthContextValue` shape drifted — restore the exact fields above.)

- [ ] **Step 4: Run the full test suite**

Run: `npm test`
Expected: all tests pass; 0 failures.

- [ ] **Step 5: Commit**

```bash
git add src/spotify/auth.ts src/spotify/AuthContext.tsx
git commit -m "refactor(spotify): route auth flow + context through the token manager" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 8: 401 refresh-and-retry in the API client (`api.ts`)

On a `401` from the Spotify Web API, force one refresh (single-flight, shared
with everything else) and retry the request once. The `spotifyApi(getToken)`
signature is unchanged — the retry flag is internal.

**Files:**
- Modify: `src/spotify/api.ts` (add an import; change the private `request` function)

**Interfaces:**
- Consumes: `tokenManager` (Task 6).
- Produces: no signature changes. `spotifyApi(getToken)` and `SpotifyApiError` unchanged.

- [ ] **Step 1: Add the import**

At the top of `src/spotify/api.ts`, add below `const BASE = ...`:

```ts
import { tokenManager } from './spotifyAuth';
```

- [ ] **Step 2: Replace the `request` function**

Replace the existing `async function request<T>(...) { ... }` in `src/spotify/api.ts` with:

```ts
async function request<T>(
  getToken: GetToken,
  path: string,
  init: RequestInit = {},
  retried = false,
): Promise<T> {
  const token = await getToken();
  if (!token) throw new Error('Not authenticated with Spotify.');
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      ...(init.headers ?? {}),
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });
  // The token was rejected (revoked / scope change / clock skew). Force one
  // refresh and retry once; getToken() then returns the freshly-minted token.
  if (res.status === 401 && !retried) {
    const refreshed = await tokenManager.forceRefresh().catch(() => null);
    if (refreshed) return request<T>(getToken, path, init, true);
  }
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  let body: any = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }
  if (!res.ok) {
    const msg = body?.error?.message ?? res.statusText ?? `HTTP ${res.status}`;
    if (typeof console !== 'undefined') {
      console.warn(`[Spotify] ${init.method ?? 'GET'} ${path} → ${res.status}`, body);
    }
    throw new SpotifyApiError(res.status, `Spotify API ${res.status}: ${msg}`, body);
  }
  return body as T;
}
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 4: Run the full test suite**

Run: `npm test`
Expected: all tests pass; 0 failures.

- [ ] **Step 5: Commit**

```bash
git add src/spotify/api.ts
git commit -m "fix(spotify): refresh once and retry on a 401 from the Web API" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 9: Final integration verification

No code changes expected. Confirm the verified-unchanged files still compile
against the new context/singletons, run the full gates, and walk the acceptance
criteria. Only commit if a fix turns out to be needed.

**Files:**
- Verify (read, do not edit): `src/spotify/WebPlayerContext.tsx`, `app/spotify-auth.tsx`, `src/spotify/config.ts`

- [ ] **Step 1: Confirm no dangling references to removed `auth.ts` exports**

Run: `git grep -n "exchangeCodeForTokens\|refreshAccessToken" -- "src" "app"`
Expected: **no matches** in `src/`/`app/` (only the design spec under `docs/` may mention them). Any hit in code is a leftover import — fix it before continuing.

- [ ] **Step 2: Confirm `WebPlayerContext.tsx` still type-aligns with `AuthContextValue`**

Confirm `WebPlayerContext.tsx` reads only `user`, `tokens`, `getAccessToken`, `logout` from `useSpotifyAuth()` — all still present and same-typed. No edit needed.

- [ ] **Step 3: Full gates**

Run: `npm run typecheck`
Expected: no errors.

Run: `npm test`
Expected: all `*.test.mts` pass (`stallDetector`, `tokenCore`, `redirect`); 0 failures.

- [ ] **Step 4: Walk the acceptance criteria (from the spec)**

Confirm by code reading (these paths are not unit-tested; they are RN/web wiring):

1. **Transient refresh ≠ logout; invalid_grant = logout.** `tokenCore.createTokenManager.refreshOrSignOut` clears only on `kind === 'invalid_grant'`; transient rethrows and `getValidAccessToken` falls back to the held token. ✔ (covered by tokenCore tests)
2. **One refresh for concurrent consumers.** `refreshOnce` single-flight. ✔ (covered by tokenCore test)
3. **`/spotify-auth` reload is safe.** `completeWebRedirectLogin` strips `code`/`state`/`error` via `history.replaceState` before exchange; a second pass has no `code`, so `decideRedirect` → `none`. ✔
4. **401 → one refresh + retry.** `api.ts request()` retries once via `tokenManager.forceRefresh()`. ✔
5. **Gates green + new tests cover errors/client/manager/redirect.** ✔ (Steps 3)
6. **No forced re-login.** Storage key `psalter.spotify.tokens.v1` unchanged in `tokens.ts`. ✔

- [ ] **Step 5: Manual smoke test (web, on the deployed-style build)**

These require a running app and a Spotify account; perform before opening a PR:
- Sign in on web → returns to the app; the address bar has **no** `?code=`/`&state=`.
- Reload `/spotify-auth` directly → shows no error, lands on `/account`, no duplicate exchange.
- (Premium) Start playback → unchanged; let a track end → auto-advance still works.
- Simulate offline briefly while a token is near expiry (DevTools offline) → you stay signed in; playback/API recovers when back online (no surprise logout).

- [ ] **Step 6 (only if a fix was needed): Commit**

```bash
git add -A
git commit -m "fix(spotify): address integration findings from auth-hardening verification" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Plan-level notes

- **Why `tokenCore.ts` is one file:** Node's `--experimental-strip-types` cannot resolve extensionless internal imports (verified: `ERR_MODULE_NOT_FOUND`), and using `.ts`-extension imports in app code would force `allowImportingTsExtensions` + Metro resolver changes — risky for the GitHub Pages build. Self-contained testable modules sidestep both, matching the existing `stallDetector.ts` pattern.
- **WebPlayerContext is deliberately untouched.** Its `getOAuthToken` already calls the context's `getAccessToken` (now backed by the manager) behind a 5s timeout + last-known-token fallback, and its init effect already guards against rebuilding the player on a token refresh. Reusing it avoids destabilizing tuned playback logic.
