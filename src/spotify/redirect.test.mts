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
