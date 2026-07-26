import { beforeEach, test, vi } from 'vitest';
import assert from 'node:assert/strict';
import { PreviewEngine } from './previewEngine';
import { PlayerTrack } from './queue';

class FakeAudio extends EventTarget {
  preload = '';
  crossOrigin: string | null = null;
  src = '';
  currentTime = 0;
  duration = NaN;
  paused = true;
  playCalls = 0;
  blockNextPlay = false;

  async play(): Promise<void> {
    this.playCalls += 1;
    if (this.blockNextPlay) {
      this.blockNextPlay = false;
      throw new DOMException('blocked', 'NotAllowedError');
    }
    this.paused = false;
    this.duration = 30;
    this.dispatchEvent(new Event('durationchange'));
    this.dispatchEvent(new Event('loadedmetadata'));
    this.dispatchEvent(new Event('play'));
    this.dispatchEvent(new Event('playing'));
  }

  pause(): void {
    this.paused = true;
    this.dispatchEvent(new Event('pause'));
  }

  load(): void {}

  removeAttribute(name: string): void {
    if (name === 'src') this.src = '';
  }

  /** Simulate the track finishing. */
  end(): void {
    this.paused = true;
    this.currentTime = this.duration;
    this.dispatchEvent(new Event('ended'));
  }
}

const track = (id: string, previewUrl: string | null): PlayerTrack => ({
  songId: id,
  trackId: id.padEnd(22, 'x'),
  spotifyUri: `spotify:track:${id.padEnd(22, 'x')}`,
  title: `Track ${id}`,
  artist: 'Tester',
  psalm: 1,
  previewUrl,
});

let audio: FakeAudio;
let engine: PreviewEngine;

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response())));
  audio = new FakeAudio();
  engine = new PreviewEngine(() => audio as unknown as HTMLAudioElement);
});

test('playQueue plays the tapped track and reports ok', async () => {
  const q = [track('a', 'https://p/a'), track('b', 'https://p/b')];
  const result = await engine.playQueue(q, 0);
  assert.equal(result, 'ok');
  const s = engine.getSnapshot();
  assert.equal(s.current?.songId, 'a');
  assert.equal(s.isPlaying, true);
  assert.equal(audio.src, 'https://p/a');
});

test('playQueue skips ahead over previewless tracks when not strict', async () => {
  const q = [track('a', null), track('b', 'https://p/b')];
  const result = await engine.playQueue(q, 0);
  assert.equal(result, 'ok');
  assert.equal(engine.getSnapshot().current?.songId, 'b');
});

test('strict playQueue refuses when the tapped track has no preview', async () => {
  const q = [track('a', null), track('b', 'https://p/b')];
  const result = await engine.playQueue(q, 0, { strict: true });
  assert.equal(result, 'no-preview');
  assert.equal(engine.getSnapshot().current, null);
  assert.equal(audio.playCalls, 0);
});

test('auto-advances to the next playable track when one ends', async () => {
  const q = [track('a', 'https://p/a'), track('b', null), track('c', 'https://p/c')];
  await engine.playQueue(q, 0);
  audio.end();
  await vi.waitFor(() => {
    assert.equal(engine.getSnapshot().current?.songId, 'c');
  });
  assert.equal(engine.getSnapshot().isPlaying, true);
  assert.equal(audio.src, 'https://p/c');
});

test('marks the queue ended after the last track finishes', async () => {
  const q = [track('a', 'https://p/a')];
  await engine.playQueue(q, 0);
  audio.end();
  await vi.waitFor(() => {
    assert.equal(engine.getSnapshot().ended, true);
  });
  assert.equal(engine.getSnapshot().isPlaying, false);
  // resume() restarts from the top
  await engine.resume();
  assert.equal(engine.getSnapshot().ended, false);
  assert.equal(engine.getSnapshot().isPlaying, true);
});

test('prev restarts the current track when more than 3s in', async () => {
  const q = [track('a', 'https://p/a'), track('b', 'https://p/b')];
  await engine.playQueue(q, 1);
  audio.currentTime = 10;
  audio.dispatchEvent(new Event('timeupdate'));
  await engine.prev();
  assert.equal(engine.getSnapshot().current?.songId, 'b');
  assert.equal(audio.currentTime, 0);
});

test('prev goes to the previous track early in a song', async () => {
  const q = [track('a', 'https://p/a'), track('b', 'https://p/b')];
  await engine.playQueue(q, 1);
  audio.currentTime = 1;
  audio.dispatchEvent(new Event('timeupdate'));
  await engine.prev();
  assert.equal(engine.getSnapshot().current?.songId, 'a');
});

test('a blocked autoplay reports blocked and asks for a tap', async () => {
  const q = [track('a', 'https://p/a')];
  audio.blockNextPlay = true;
  const result = await engine.playQueue(q, 0);
  assert.equal(result, 'blocked');
  const s = engine.getSnapshot();
  assert.equal(s.isPlaying, false);
  assert.match(s.error ?? '', /tap play/i);
});

test('restore shows a paused resumable track without touching audio', async () => {
  const q = [track('a', 'https://p/a'), track('b', 'https://p/b')];
  await engine.restore(q, 1, 12);
  const s = engine.getSnapshot();
  assert.equal(s.current?.songId, 'b');
  assert.equal(s.isPlaying, false);
  assert.equal(s.positionSec, 12);
  assert.equal(audio.playCalls, 0);
  assert.equal(audio.src, '');
  // resuming from cold loads the src and seeks to the persisted position
  await engine.resume();
  assert.equal(audio.src, 'https://p/b');
  assert.equal(engine.getSnapshot().isPlaying, true);
});
