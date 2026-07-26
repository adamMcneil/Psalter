import { test } from 'vitest';
import assert from 'node:assert/strict';
import {
  buildQueue,
  firstPlayable,
  nextPlayable,
  shuffled,
  toPlayerTrack,
  PlayerTrack,
} from './queue';
import { Song } from '../types';

const song = (id: string, url?: string): Song => ({
  id,
  psalm: 1,
  title: `Song ${id}`,
  artist: 'Tester',
  spotifyUrl: url,
});

const resolver = (previews: Record<string, string | null>) =>
  (trackId: string | null) => (trackId ? (previews[trackId] ?? null) : null);

test('toPlayerTrack extracts the track id and resolves the preview', () => {
  const t = toPlayerTrack(
    song('a', 'https://open.spotify.com/track/AAAAAAAAAAAAAAAAAAAAAA'),
    resolver({ AAAAAAAAAAAAAAAAAAAAAA: 'https://p/x.mp3' }),
  );
  assert.equal(t.trackId, 'AAAAAAAAAAAAAAAAAAAAAA');
  assert.equal(t.spotifyUri, 'spotify:track:AAAAAAAAAAAAAAAAAAAAAA');
  assert.equal(t.previewUrl, 'https://p/x.mp3');
});

test('toPlayerTrack handles songs with no spotify url', () => {
  const t = toPlayerTrack(song('a'), resolver({}));
  assert.equal(t.trackId, null);
  assert.equal(t.spotifyUri, null);
  assert.equal(t.previewUrl, null);
});

function queueWithPreviews(flags: (string | null)[]): PlayerTrack[] {
  const previews: Record<string, string | null> = {};
  const songs = flags.map((flag, i) => {
    const trackId = String(i).repeat(22).slice(0, 22);
    previews[trackId] = flag;
    return song(`s${i}`, `https://open.spotify.com/track/${trackId}`);
  });
  return buildQueue(songs, resolver(previews));
}

test('firstPlayable finds the tapped track when it has a preview', () => {
  const q = queueWithPreviews(['u0', 'u1', 'u2']);
  assert.equal(firstPlayable(q, 1), 1);
});

test('firstPlayable skips forward over tracks without previews', () => {
  const q = queueWithPreviews([null, null, 'u2', 'u3']);
  assert.equal(firstPlayable(q, 0), 2);
});

test('firstPlayable returns -1 when nothing after from is playable', () => {
  const q = queueWithPreviews(['u0', null, null]);
  assert.equal(firstPlayable(q, 1), -1);
});

test('nextPlayable advances over gaps in both directions', () => {
  const q = queueWithPreviews(['u0', null, 'u2', null, 'u4']);
  assert.equal(nextPlayable(q, 0, 1), 2);
  assert.equal(nextPlayable(q, 2, 1), 4);
  assert.equal(nextPlayable(q, 4, 1), -1);
  assert.equal(nextPlayable(q, 4, -1), 2);
  assert.equal(nextPlayable(q, 2, -1), 0);
  assert.equal(nextPlayable(q, 0, -1), -1);
});

test('shuffled is a permutation and deterministic under a seeded rng', () => {
  const items = [1, 2, 3, 4, 5, 6, 7, 8];
  let seed = 42;
  const rng = () => {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return seed / 2147483648;
  };
  const a = shuffled(items, rng);
  assert.deepEqual([...a].sort((x, y) => x - y), items);
  assert.notDeepEqual(a, items); // astronomically unlikely to be identity here
  assert.equal(items[0], 1); // input untouched
});
