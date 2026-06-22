// Pure-logic tests for the Web Playback SDK auth helpers.
//   node --experimental-strip-types --test src/spotify/sdkAuth.test.mts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  selectSdkToken,
  createAuthRecovery,
  onAuthError,
  DEFAULT_AUTH_RECOVERY_CONFIG,
} from './sdkAuth.ts';

test('selectSdkToken returns a token that is still valid', () => {
  const c = selectSdkToken({ accessToken: 'AT', refreshToken: 'r', expiresAt: 1000 }, 500);
  assert.equal(c.token, 'AT');
  assert.equal(c.needsForceRefresh, false);
});

test('selectSdkToken never returns an expired token (the mobile auth bug)', () => {
  // expiresAt == now counts as expired (no margin to authenticate the next track).
  const c = selectSdkToken({ accessToken: 'AT', refreshToken: 'r', expiresAt: 1000 }, 1000);
  assert.equal(c.token, null);
  assert.equal(c.needsForceRefresh, true);
});

test('selectSdkToken with no token asks for a refresh', () => {
  const c = selectSdkToken(null, 0);
  assert.equal(c.token, null);
  assert.equal(c.needsForceRefresh, true);
});

test('onAuthError recovers on the first error, then respects the cooldown', () => {
  let s = createAuthRecovery();
  const d1 = onAuthError(s, 1000);
  assert.equal(d1.shouldRecover, true);
  assert.equal(d1.exhausted, false);
  s = d1.state;
  // A second error within the cooldown window must not re-trigger recovery.
  const d2 = onAuthError(s, 1500);
  assert.equal(d2.shouldRecover, false);
  assert.equal(d2.exhausted, false);
});

test('onAuthError gives up after maxAttempts and reports exhausted', () => {
  const cfg = DEFAULT_AUTH_RECOVERY_CONFIG;
  let s = createAuthRecovery();
  let now = 0;
  for (let i = 0; i < cfg.maxAttempts; i++) {
    const d = onAuthError(s, now, cfg);
    assert.equal(d.shouldRecover, true, `attempt ${i + 1} should recover`);
    s = d.state;
    now += cfg.cooldownMs; // wait out the cooldown before the next error
  }
  const d = onAuthError(s, now, cfg);
  assert.equal(d.shouldRecover, false);
  assert.equal(d.exhausted, true);
});

test('a fresh recovery tracker (after reset) recovers again', () => {
  const s = createAuthRecovery();
  assert.equal(onAuthError(s, 10_000).shouldRecover, true);
});
