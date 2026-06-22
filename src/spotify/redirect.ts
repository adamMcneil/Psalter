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
