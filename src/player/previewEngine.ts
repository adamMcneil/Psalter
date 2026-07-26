// Universal playback engine: one persistent HTML5 audio element playing the
// build-time harvested preview MP3s. No DRM, no auth, no SDK — works in every
// browser (including Brave with shields up), which is exactly why it is the
// default engine.
//
// A single reused element matters: browsers grant an <audio> element a lasting
// autoplay unlock once a user gesture has played it, so auto-advancing the
// queue at track boundaries keeps working without fresh taps.

import { firstPlayable, nextPlayable, PlayerTrack } from './queue';

export interface PreviewSnapshot {
  queue: PlayerTrack[];
  index: number; // -1 when idle
  current: PlayerTrack | null;
  isPlaying: boolean;
  loading: boolean;
  positionSec: number;
  durationSec: number;
  /** Reached the end of the queue (UI shows play-from-start affordance). */
  ended: boolean;
  error: string | null;
}

export type PlayQueueResult = 'ok' | 'no-preview' | 'empty' | 'blocked';

type Listener = (s: PreviewSnapshot) => void;

const IDLE: PreviewSnapshot = {
  queue: [],
  index: -1,
  current: null,
  isPlaying: false,
  loading: false,
  positionSec: 0,
  durationSec: 0,
  ended: false,
  error: null,
};

export class PreviewEngine {
  private audio: HTMLAudioElement | null = null;
  private snapshot: PreviewSnapshot = IDLE;
  private listeners = new Set<Listener>();
  private prefetchedUrl: string | null = null;
  // Set while we intentionally change tracks so the transient 'pause' event
  // from swapping src doesn't flap isPlaying in the UI.
  private transitioning = false;
  // Safari ignores seeks issued before loadedmetadata; re-apply there.
  private pendingSeekSec: number | null = null;

  constructor(
    private createAudio: () => HTMLAudioElement = () => new Audio(),
  ) {}

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  getSnapshot(): PreviewSnapshot {
    return this.snapshot;
  }

  private set(patch: Partial<PreviewSnapshot>): void {
    this.snapshot = { ...this.snapshot, ...patch };
    for (const l of this.listeners) l(this.snapshot);
  }

  private ensureAudio(): HTMLAudioElement {
    if (this.audio) return this.audio;
    const a = this.createAudio();
    a.preload = 'auto';
    // Preview MP3s are served with permissive CORS; anonymous mode keeps the
    // responses non-opaque so the service worker can cache them for offline.
    a.crossOrigin = 'anonymous';

    a.addEventListener('play', () => {
      this.set({ isPlaying: true, ended: false, error: null });
    });
    a.addEventListener('playing', () => {
      this.set({ isPlaying: true, loading: false });
      this.prefetchNext();
    });
    a.addEventListener('pause', () => {
      if (!this.transitioning) this.set({ isPlaying: false });
    });
    a.addEventListener('waiting', () => this.set({ loading: true }));
    a.addEventListener('canplay', () => this.set({ loading: false }));
    a.addEventListener('timeupdate', () => {
      this.set({ positionSec: a.currentTime || 0 });
    });
    a.addEventListener('durationchange', () => {
      if (Number.isFinite(a.duration) && a.duration > 0) {
        this.set({ durationSec: a.duration });
      }
    });
    a.addEventListener('loadedmetadata', () => {
      if (this.pendingSeekSec != null) {
        const want = this.pendingSeekSec;
        this.pendingSeekSec = null;
        if (Math.abs(a.currentTime - want) > 1) {
          try {
            a.currentTime = want;
          } catch {
            // leave it at the start
          }
        }
      }
    });
    a.addEventListener('ended', () => {
      void this.autoAdvance();
    });
    a.addEventListener('error', () => {
      if (this.transitioning) return;
      this.set({
        isPlaying: false,
        loading: false,
        error: 'Preview failed to load — check your connection.',
      });
    });

    this.audio = a;
    return a;
  }

  /**
   * Load a queue and start playing at `startIndex` (or the first playable
   * track at/after it). Must be called synchronously from a user gesture the
   * first time so the element gets its autoplay unlock.
   */
  async playQueue(
    queue: PlayerTrack[],
    startIndex = 0,
    opts: { positionSec?: number; autoplay?: boolean; strict?: boolean } = {},
  ): Promise<PlayQueueResult> {
    const { positionSec = 0, autoplay = true, strict = false } = opts;
    if (queue.length === 0) return 'empty';

    const target = firstPlayable(queue, startIndex);
    if (target === -1 || (strict && target !== startIndex)) {
      // The tapped track (or the whole tail of the queue) has no preview.
      return 'no-preview';
    }

    this.set({ queue, index: target, current: queue[target], ended: false });
    return this.loadCurrent({ positionSec, autoplay });
  }

  private async loadCurrent(opts: {
    positionSec?: number;
    autoplay: boolean;
  }): Promise<PlayQueueResult> {
    const a = this.ensureAudio();
    const track = this.snapshot.current;
    if (!track?.previewUrl) return 'no-preview';

    this.transitioning = true;
    try {
      a.src = track.previewUrl;
      // Optimistic duration so seek bars render sanely before metadata loads.
      this.set({
        positionSec: opts.positionSec ?? 0,
        durationSec: 30,
        loading: opts.autoplay,
        error: null,
      });
      if (opts.positionSec && opts.positionSec > 0) {
        this.pendingSeekSec = opts.positionSec;
        try {
          a.currentTime = opts.positionSec;
        } catch {
          // pre-metadata seek unsupported; loadedmetadata re-applies it
        }
      } else {
        this.pendingSeekSec = null;
      }
      if (!opts.autoplay) {
        a.load();
        this.set({ isPlaying: false, loading: false });
        return 'ok';
      }
      await a.play();
      return 'ok';
    } catch {
      // Autoplay policy refused (no user activation yet) or load failure.
      this.set({
        isPlaying: false,
        loading: false,
        error: 'Tap play to start the music.',
      });
      return 'blocked';
    } finally {
      this.transitioning = false;
    }
  }

  private async autoAdvance(): Promise<void> {
    const { queue, index } = this.snapshot;
    const next = nextPlayable(queue, index, 1);
    if (next === -1) {
      this.set({
        isPlaying: false,
        ended: true,
        positionSec: this.snapshot.durationSec,
      });
      return;
    }
    this.set({ index: next, current: queue[next] });
    await this.loadCurrent({ autoplay: true });
  }

  private prefetchNext(): void {
    const { queue, index } = this.snapshot;
    const next = nextPlayable(queue, index, 1);
    const url = next === -1 ? null : queue[next].previewUrl;
    if (!url || url === this.prefetchedUrl) return;
    this.prefetchedUrl = url;
    // Warm the HTTP + service-worker cache so the boundary is near-gapless
    // and previously played queues keep advancing offline.
    fetch(url, { mode: 'cors' }).catch(() => {});
  }

  async toggle(): Promise<void> {
    const a = this.ensureAudio();
    if (!this.snapshot.current) return;
    if (this.snapshot.isPlaying) {
      a.pause();
      return;
    }
    await this.resume();
  }

  pause(): void {
    this.audio?.pause();
  }

  async resume(): Promise<void> {
    const a = this.ensureAudio();
    if (!this.snapshot.current) return;
    try {
      if (this.snapshot.ended) {
        a.currentTime = 0;
        this.set({ ended: false, positionSec: 0 });
      }
      if (!a.src && this.snapshot.current.previewUrl) {
        // Hydrated from persistence: src was never set this session.
        await this.loadCurrent({
          positionSec: this.snapshot.positionSec,
          autoplay: true,
        });
        return;
      }
      await a.play();
    } catch {
      this.set({ error: 'Playback was blocked — tap play again.' });
    }
  }

  seek(positionSec: number): void {
    const a = this.ensureAudio();
    if (!this.snapshot.current) return;
    const target = Math.max(0, positionSec);
    this.pendingSeekSec = null;
    try {
      a.currentTime = target;
    } catch {
      // Not seekable yet; position state will correct on timeupdate.
    }
    this.set({ positionSec: target, ended: false });
  }

  /** Manual skip. Returns false when there is no playable track that way. */
  async next(): Promise<boolean> {
    const { queue, index } = this.snapshot;
    const target = nextPlayable(queue, index, 1);
    if (target === -1) return false;
    const wasPlaying = this.snapshot.isPlaying || this.snapshot.loading;
    this.set({ index: target, current: queue[target] });
    await this.loadCurrent({ autoplay: wasPlaying });
    return true;
  }

  /** Restart the track when >3s in; otherwise go to the previous playable. */
  async prev(): Promise<boolean> {
    const { queue, index, positionSec } = this.snapshot;
    if (positionSec > 3) {
      this.seek(0);
      return true;
    }
    const target = nextPlayable(queue, index, -1);
    if (target === -1) {
      this.seek(0);
      return true;
    }
    const wasPlaying = this.snapshot.isPlaying || this.snapshot.loading;
    this.set({ index: target, current: queue[target] });
    await this.loadCurrent({ autoplay: wasPlaying });
    return true;
  }

  /** Hydrate a queue paused at a position (no autoplay, no gesture needed). */
  async restore(
    queue: PlayerTrack[],
    index: number,
    positionSec: number,
  ): Promise<void> {
    if (queue.length === 0) return;
    const i = Math.min(Math.max(0, index), queue.length - 1);
    if (!queue[i].previewUrl) return;
    this.set({ queue, index: i, current: queue[i], ended: false });
    // Don't touch the audio element yet — creating/loading it isn't needed to
    // *display* the resumable track, and resume() handles the cold start.
    this.set({
      positionSec,
      durationSec: queue[i].durationSec && queue[i].durationSec! <= 31 ? queue[i].durationSec! : 30,
      isPlaying: false,
      loading: false,
    });
  }

  stop(): void {
    const a = this.audio;
    if (a) {
      a.pause();
      a.removeAttribute('src');
      a.load();
    }
    this.set({ ...IDLE });
  }
}
