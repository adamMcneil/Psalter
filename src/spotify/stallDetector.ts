// Pure, dependency-free stall detector for the Spotify Web Playback SDK.
//
// The SDK can enter a "stalled but not paused" state at a track boundary
// (documented in spotify/web-playback-sdk issue #88): audio stops feeding but
// `paused` stays false. The SDK has no watchdog and does not self-heal, so the
// only signal we have is that the *real* playback position (from
// getCurrentState()) stops advancing while the player still claims to be
// playing. This module turns a stream of position samples into a decision:
// "is it stalled, and should we kick it (pause+resume) now?".
//
// It is intentionally pure (no React, no timers, no SDK) so it can be unit
// tested deterministically — see stallDetector.test.mts.

export interface StallSample {
  /** Real playback position in ms, read from the SDK's getCurrentState(). */
  position: number;
  /** Whether the SDK reports itself paused. */
  paused: boolean;
  /** Wall-clock timestamp in ms (Date.now()) when the sample was taken. */
  timestamp: number;
}

export interface StallConfig {
  /**
   * Minimum ms the position must advance between two samples to count as real
   * progress. Polls are ~1s apart, so anything below this while playing means
   * the audio is frozen.
   */
  minAdvanceMs: number;
  /** Consecutive frozen samples required before we declare a stall. */
  framesToTrigger: number;
  /** Minimum ms between recovery attempts (avoids hammering the SDK). */
  recoveryCooldownMs: number;
  /** Max recovery attempts within a single stall episode before giving up. */
  maxAttempts: number;
}

export const DEFAULT_STALL_CONFIG: StallConfig = {
  minAdvanceMs: 250,
  framesToTrigger: 3,
  recoveryCooldownMs: 8000,
  maxAttempts: 3,
};

export interface StallTrackerState {
  lastPosition: number | null;
  lastTimestamp: number | null;
  /** Consecutive samples where playback should be advancing but isn't. */
  frozenSamples: number;
  /** Timestamp of the last recovery we asked for, for cooldown gating. */
  lastRecoveryAt: number | null;
  /** Recovery attempts in the current (unresolved) stall episode. */
  attemptsThisEpisode: number;
}

export interface StallObservation {
  /** New tracker state — feed this back into the next observeSample call. */
  state: StallTrackerState;
  /** True when we believe audio is currently frozen (paused===false). */
  stalled: boolean;
  /** True on the single sample where a recovery should be performed now. */
  shouldRecover: boolean;
}

export function createStallTracker(): StallTrackerState {
  return {
    lastPosition: null,
    lastTimestamp: null,
    frozenSamples: 0,
    lastRecoveryAt: null,
    attemptsThisEpisode: 0,
  };
}

/**
 * Observe one playback sample and decide whether to recover.
 *
 * Returns a fresh state object (the input is not mutated) plus the stall /
 * recovery decision for this sample.
 */
export function observeSample(
  prev: StallTrackerState,
  sample: StallSample,
  config: StallConfig = DEFAULT_STALL_CONFIG,
): StallObservation {
  const next: StallTrackerState = { ...prev };

  // A legitimately paused player is not a stall. Reset the freeze counters and
  // the episode budget; remember where we are so the next "playing" sample has
  // a baseline to compare against.
  if (sample.paused) {
    next.frozenSamples = 0;
    next.attemptsThisEpisode = 0;
    next.lastPosition = sample.position;
    next.lastTimestamp = sample.timestamp;
    return { state: next, stalled: false, shouldRecover: false };
  }

  // First sample (or first after a pause): nothing to compare yet.
  if (prev.lastPosition === null || prev.lastTimestamp === null) {
    next.lastPosition = sample.position;
    next.lastTimestamp = sample.timestamp;
    return { state: next, stalled: false, shouldRecover: false };
  }

  const posDelta = sample.position - prev.lastPosition;
  const timeDelta = sample.timestamp - prev.lastTimestamp;

  // Guard against samples taken too close together (would falsely look frozen).
  // Only evaluate progress once enough wall-clock time has elapsed.
  if (timeDelta < config.minAdvanceMs) {
    next.lastPosition = sample.position;
    next.lastTimestamp = sample.timestamp;
    return {
      state: next,
      stalled: prev.frozenSamples >= config.framesToTrigger,
      shouldRecover: false,
    };
  }

  // A negative delta means the track changed (position reset toward 0) or the
  // user/SDK seeked — that is real movement, not a freeze.
  const advanced = posDelta < 0 || posDelta >= config.minAdvanceMs;

  next.lastPosition = sample.position;
  next.lastTimestamp = sample.timestamp;

  if (advanced) {
    // Playback is healthy again: clear freeze counters and refill the budget so
    // a future, unrelated stall is treated as its own episode.
    next.frozenSamples = 0;
    next.attemptsThisEpisode = 0;
    return { state: next, stalled: false, shouldRecover: false };
  }

  // Position is frozen while the player claims to be playing.
  next.frozenSamples = prev.frozenSamples + 1;
  const stalled = next.frozenSamples >= config.framesToTrigger;

  if (!stalled) {
    return { state: next, stalled: false, shouldRecover: false };
  }

  const cooldownOk =
    prev.lastRecoveryAt === null ||
    sample.timestamp - prev.lastRecoveryAt >= config.recoveryCooldownMs;
  const budgetOk = prev.attemptsThisEpisode < config.maxAttempts;

  if (cooldownOk && budgetOk) {
    next.lastRecoveryAt = sample.timestamp;
    next.attemptsThisEpisode = prev.attemptsThisEpisode + 1;
    // Reset the frame counter so the next attempt must re-observe a fresh
    // freeze (cooldown still gates timing, budget still caps total attempts).
    next.frozenSamples = 0;
    return { state: next, stalled: true, shouldRecover: true };
  }

  // Stalled, but we're within cooldown or out of attempts — keep reporting the
  // stall (useful for UI/logging) without kicking the SDK again.
  return { state: next, stalled: true, shouldRecover: false };
}
