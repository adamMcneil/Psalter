// One-off regression test for the pure stall-detection logic.
// No test runner is configured in this project, so this runs on Node's
// built-in test runner with native TypeScript type-stripping:
//
//   node --experimental-strip-types --test src/spotify/stallDetector.test.mts
//
// It imports the app module directly (with an explicit .ts extension, which
// Node's type-stripping requires). The file is named .mts so the app's
// `tsc --noEmit` (which globs **/*.ts) does not try to type-check a test that
// imports with an extension.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createStallTracker,
  observeSample,
  DEFAULT_STALL_CONFIG,
  type StallSample,
  type StallObservation,
} from './stallDetector.ts';

/** Feed a sequence of samples through a fresh tracker, returning every observation. */
function run(samples: StallSample[]): StallObservation[] {
  let state = createStallTracker();
  const out: StallObservation[] = [];
  for (const s of samples) {
    const obs = observeSample(state, s, DEFAULT_STALL_CONFIG);
    state = obs.state;
    out.push(obs);
  }
  return out;
}

/** Build an evenly-spaced sample sequence. */
function seq(
  specs: Array<{ position: number; paused?: boolean }>,
  stepMs = 1000,
  startTs = 1000,
): StallSample[] {
  return specs.map((spec, i) => ({
    position: spec.position,
    paused: spec.paused ?? false,
    timestamp: startTs + i * stepMs,
  }));
}

test('normal advancing playback never reports a stall or recovery', () => {
  const samples = seq(
    Array.from({ length: 30 }, (_, i) => ({ position: i * 1000 })),
  );
  const obs = run(samples);
  assert.equal(obs.some((o) => o.stalled), false, 'should never be stalled');
  assert.equal(obs.some((o) => o.shouldRecover), false, 'should never recover');
});

test('frozen position while playing triggers exactly one recovery after the threshold', () => {
  // advance once, then freeze at 6000 forever.
  const samples = seq([
    { position: 5000 }, // s0: first sample, no decision
    { position: 6000 }, // s1: advanced
    { position: 6000 }, // s2: frozen #1
    { position: 6000 }, // s3: frozen #2
    { position: 6000 }, // s4: frozen #3 -> trigger
    { position: 6000 }, // s5: cooldown blocks re-trigger
    { position: 6000 }, // s6
  ]);
  const obs = run(samples);
  const recoverIdx = obs
    .map((o, i) => (o.shouldRecover ? i : -1))
    .filter((i) => i >= 0);
  assert.deepEqual(recoverIdx, [4], 'recovery should fire once, at the 3rd frozen frame');
  assert.equal(obs[4].stalled, true);
});

test('a legitimately paused player is never treated as a stall', () => {
  const samples = seq(
    Array.from({ length: 20 }, () => ({ position: 6000, paused: true })),
  );
  const obs = run(samples);
  assert.equal(obs.some((o) => o.stalled), false);
  assert.equal(obs.some((o) => o.shouldRecover), false);
});

test('a track change (position resets to ~0) is not mistaken for a stall', () => {
  const samples = seq([
    { position: 200_000 }, // near end of track 1
    { position: 201_000 }, // advancing
    { position: 500 }, // track 2 started — big negative delta
    { position: 1500 }, // advancing in track 2
    { position: 2500 },
    { position: 3500 },
  ]);
  const obs = run(samples);
  assert.equal(obs.some((o) => o.stalled), false);
  assert.equal(obs.some((o) => o.shouldRecover), false);
});

test('recovery respects the cooldown window between attempts', () => {
  // Freeze indefinitely; sample once per second. cooldown is 8s.
  const samples = seq(
    Array.from({ length: 20 }, () => ({ position: 6000 })),
    1000,
    1000,
  );
  // first real position is at index 0; freeze detection needs framesToTrigger
  // frames after the first sample. Prepend one advancing sample so freezing starts cleanly.
  const withLead: StallSample[] = [
    { position: 5000, paused: false, timestamp: 0 },
    ...samples,
  ];
  const obs = run(withLead);
  const recoverTimes = withLead
    .map((s, i) => (obs[i].shouldRecover ? s.timestamp : -1))
    .filter((t) => t >= 0);
  // Consecutive recoveries must be at least cooldown apart.
  for (let i = 1; i < recoverTimes.length; i++) {
    assert.ok(
      recoverTimes[i] - recoverTimes[i - 1] >= DEFAULT_STALL_CONFIG.recoveryCooldownMs,
      `recoveries ${recoverTimes[i - 1]} and ${recoverTimes[i]} violate cooldown`,
    );
  }
  assert.ok(recoverTimes.length >= 1, 'should recover at least once');
});

test('recovery attempts are capped per stall episode', () => {
  // Freeze forever, spacing samples far enough apart that cooldown never blocks.
  const samples = seq(
    Array.from({ length: 60 }, () => ({ position: 6000 })),
    DEFAULT_STALL_CONFIG.recoveryCooldownMs + 1000, // each sample well past cooldown
  );
  const withLead: StallSample[] = [
    { position: 5000, paused: false, timestamp: 0 },
    ...samples,
  ];
  const obs = run(withLead);
  const recoverCount = obs.filter((o) => o.shouldRecover).length;
  assert.equal(
    recoverCount,
    DEFAULT_STALL_CONFIG.maxAttempts,
    'a never-recovering stall must stop after maxAttempts',
  );
});

test('playback resuming resets the attempt budget for a future, separate stall', () => {
  const cfg = DEFAULT_STALL_CONFIG;
  // Episode 1: freeze, get one recovery.
  const ep1 = seq([
    { position: 5000 },
    { position: 6000 },
    { position: 6000 },
    { position: 6000 },
    { position: 6000 }, // -> recover #1
  ]);
  // Then playback advances again (recovery "worked").
  const advancing = seq(
    Array.from({ length: 5 }, (_, i) => ({ position: 7000 + i * 1000 })),
    1000,
    1000 + ep1.length * 1000,
  );
  // Episode 2 much later: freeze again, should recover again despite maxAttempts.
  const ep2Start = 1000 + (ep1.length + advancing.length) * 1000 + cfg.recoveryCooldownMs * 2;
  const ep2 = seq(
    [
      { position: 12_000 },
      { position: 12_000 },
      { position: 12_000 },
      { position: 12_000 }, // -> recover #2
    ],
    1000,
    ep2Start,
  );
  const obs = run([...ep1, ...advancing, ...ep2]);
  const recoverCount = obs.filter((o) => o.shouldRecover).length;
  assert.equal(recoverCount, 2, 'each independent stall episode gets its own recovery');
});

test('first sample alone never triggers a recovery', () => {
  const obs = run([{ position: 6000, paused: false, timestamp: 1000 }]);
  assert.equal(obs[0].shouldRecover, false);
  assert.equal(obs[0].stalled, false);
});
