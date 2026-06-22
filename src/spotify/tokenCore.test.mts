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
