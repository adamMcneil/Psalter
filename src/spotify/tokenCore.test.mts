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
    await assert.rejects(
      () => client.exchangeCode({ code: 'c', codeVerifier: 'v', redirectUri: 'r' }),
      (e: unknown) => e instanceof SpotifyAuthError && e.kind === 'oauth' && e.retryable === false,
    );
  } finally {
    globalThis.fetch = realFetch;
  }
});

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

test('clear() during an in-flight refresh keeps the session signed out', async () => {
  const now = 1_000_000;
  let release: (t: T) => void = () => {};
  const gate = new Promise<T>((resolve) => {
    release = resolve;
  });
  const store = makeStore();
  const mgr = createTokenManager({
    store,
    client: { refresh: async () => gate },
    now: () => now,
  });
  await mgr.set({ accessToken: 'old', refreshToken: 'r', expiresAt: now }); // expired -> will refresh
  const pending = mgr.getValidAccessToken(); // starts the gated refresh
  await mgr.clear(); // user logs out mid-refresh
  release({ accessToken: 'refreshed', refreshToken: 'r2', expiresAt: now + 3_600_000 });
  await pending; // let the refresh settle
  assert.equal(mgr.getTokens(), null, 'logout is not resurrected by the in-flight refresh');
  assert.equal(store.saved(), null, 'storage stays cleared');
  assert.equal(await mgr.getValidAccessToken(), null);
});

test('forceRefresh returns refreshed tokens when a session exists', async () => {
  const now = 1_000_000;
  const mgr = createTokenManager({
    store: makeStore(),
    client: { refresh: async (p: T) => ({ ...p, accessToken: 'forced', expiresAt: now + 3_600_000 }) },
    now: () => now,
  });
  await mgr.set({ accessToken: 'a', refreshToken: 'r', expiresAt: now + 999_999 });
  const next = await mgr.forceRefresh();
  assert.equal(next?.accessToken, 'forced');
  assert.equal(mgr.getTokens()?.accessToken, 'forced');
});

test('forceRefresh returns null when there is no session', async () => {
  const now = 1;
  const mgr = createTokenManager({ store: makeStore(), client: { refresh: async (p: T) => p }, now: () => now });
  assert.equal(await mgr.forceRefresh(), null);
});
