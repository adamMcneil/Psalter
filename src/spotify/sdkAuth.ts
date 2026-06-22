// Pure helpers for the Spotify Web Playback SDK's auth glue. Self-contained (the
// only import is the StoredTokens *type*, erased at runtime) so it runs under
// Node's type stripping — see sdkAuth.test.mts.
//
// Two concerns, both about the SDK's getOAuthToken / authentication_error path:
//
//  1. selectSdkToken — never hand the SDK an *expired* access token. If the
//     getOAuthToken callback returns an expired token, the SDK raises an
//     authentication_error and pauses playback at the next track. On mobile a
//     slow refresh let an expired token slip through the old 5s fallback, which
//     is the "Auth: Authentication failed at the next song" symptom.
//
//  2. auth-recovery budget — when the SDK *does* raise authentication_error,
//     bound how often we force-refresh-and-reconnect (cooldown + max attempts,
//     reset once playback is healthy again) so a genuinely dead session can't
//     loop forever. Mirrors the stall-detector's recovery budget.

import type { StoredTokens } from './tokens';

export interface SdkTokenChoice {
  /** The token to hand the SDK now, or null if we hold nothing valid. */
  token: string | null;
  /** True when the held token is missing/expired and the caller should force a refresh. */
  needsForceRefresh: boolean;
}

/**
 * Decide which token to give the SDK. Returns the held token only if it is still
 * valid; an expired (or absent) token yields `needsForceRefresh` so the caller
 * fetches a fresh one instead of handing over a token that is guaranteed to fail.
 */
export function selectSdkToken(current: StoredTokens | null, nowMs: number): SdkTokenChoice {
  if (current && current.expiresAt > nowMs) {
    return { token: current.accessToken, needsForceRefresh: false };
  }
  return { token: null, needsForceRefresh: true };
}

export interface AuthRecoveryConfig {
  /** Minimum ms between recovery attempts. */
  cooldownMs: number;
  /** Max recovery attempts before giving up and surfacing the error. */
  maxAttempts: number;
}

export const DEFAULT_AUTH_RECOVERY_CONFIG: AuthRecoveryConfig = {
  cooldownMs: 5_000,
  maxAttempts: 3,
};

export interface AuthRecoveryState {
  attempts: number;
  lastAttemptAt: number | null;
}

export interface AuthRecoveryDecision {
  /** New tracker state — feed back into the next onAuthError call. */
  state: AuthRecoveryState;
  /** Attempt a force-refresh + reconnect now. */
  shouldRecover: boolean;
  /** Budget exhausted — stop retrying and surface the auth error to the user. */
  exhausted: boolean;
}

export function createAuthRecovery(): AuthRecoveryState {
  return { attempts: 0, lastAttemptAt: null };
}

/**
 * Decide whether to auto-recover from an SDK authentication_error at time `now`.
 * Recovers while within the attempt budget and past the cooldown; once the
 * budget is spent it reports `exhausted` so the caller can surface the error.
 * Reset the state (createAuthRecovery) when playback becomes healthy again so a
 * later, unrelated auth error gets a fresh budget.
 */
export function onAuthError(
  prev: AuthRecoveryState,
  now: number,
  config: AuthRecoveryConfig = DEFAULT_AUTH_RECOVERY_CONFIG,
): AuthRecoveryDecision {
  const cooldownOk =
    prev.lastAttemptAt === null || now - prev.lastAttemptAt >= config.cooldownMs;
  const budgetOk = prev.attempts < config.maxAttempts;
  if (cooldownOk && budgetOk) {
    return {
      state: { attempts: prev.attempts + 1, lastAttemptAt: now },
      shouldRecover: true,
      exhausted: false,
    };
  }
  return { state: prev, shouldRecover: false, exhausted: !budgetOk };
}
