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
