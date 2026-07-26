// Optional full-track engine: Spotify's Web Playback SDK. Only used when the
// user is signed in with Premium AND the browser can do Widevine EME (see
// eme.ts) — everywhere else the preview engine plays. This is a straight port
// of the battle-tested provider from the previous app: the SDK auth glue
// (sdkAuth.ts), the stall watchdog (stallDetector.ts), and the bounded
// auth-error recovery all carry over unchanged.

import {
  createStallTracker,
  observeSample,
  StallSample,
  StallTrackerState,
} from './stallDetector';
import { tokenManager } from './spotifyAuth';
import {
  selectSdkToken,
  createAuthRecovery,
  onAuthError,
  type AuthRecoveryState,
} from './sdkAuth';
import { spotifyApi, SpotifyApiError } from './api';

// How often the stall watchdog samples real playback position.
const WATCHDOG_INTERVAL_MS = 1000;
// Max time we let a token fetch run before falling back, so a slow refresh
// never hangs the SDK's streaming (re)authentication.
const OAUTH_TIMEOUT_MS = 5000;
const CONNECT_TIMEOUT_MS = 15000;

interface SpotifyPlayer {
  connect(): Promise<boolean>;
  disconnect(): void;
  activateElement(): Promise<void>;
  pause(): Promise<void>;
  resume(): Promise<void>;
  togglePlay(): Promise<void>;
  seek(positionMs: number): Promise<void>;
  nextTrack(): Promise<void>;
  previousTrack(): Promise<void>;
  getCurrentState(): Promise<SdkPlayerState | null>;
  addListener(event: string, cb: (...args: unknown[]) => void): boolean;
}

interface SdkPlayerState {
  paused: boolean;
  position: number;
  duration: number;
  track_window?: {
    current_track?: {
      uri: string;
      name: string;
      artists?: { name: string }[];
      album?: { images?: { url: string }[] };
    };
  };
}

declare global {
  interface Window {
    Spotify?: { Player: new (opts: Record<string, unknown>) => SpotifyPlayer };
    onSpotifyWebPlaybackSDKReady?: () => void;
  }
}

const SDK_SRC = 'https://sdk.scdn.co/spotify-player.js';
let sdkPromise: Promise<void> | null = null;

function loadSdk(): Promise<void> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('No window'));
  }
  if (window.Spotify) return Promise.resolve();
  if (sdkPromise) return sdkPromise;
  sdkPromise = new Promise<void>((resolve, reject) => {
    window.onSpotifyWebPlaybackSDKReady = () => resolve();
    const s = document.createElement('script');
    s.src = SDK_SRC;
    s.async = true;
    s.onerror = () => {
      sdkPromise = null;
      reject(new Error('Failed to load the Spotify player.'));
    };
    document.body.appendChild(s);
  });
  return sdkPromise;
}

export interface SpotifySnapshot {
  ready: boolean;
  initializing: boolean;
  isPlaying: boolean;
  /** True once the SDK reported real playback state this session. */
  hasLiveState: boolean;
  currentUri: string | null;
  trackName: string | null;
  artistName: string | null;
  albumArt: string | null;
  positionMs: number;
  durationMs: number;
  error: string | null;
}

type Listener = (s: SpotifySnapshot) => void;

const INITIAL: SpotifySnapshot = {
  ready: false,
  initializing: false,
  isPlaying: false,
  hasLiveState: false,
  currentUri: null,
  trackName: null,
  artistName: null,
  albumArt: null,
  positionMs: 0,
  durationMs: 0,
  error: null,
};

export class SpotifyWebEngine {
  private snapshot: SpotifySnapshot = INITIAL;
  private listeners = new Set<Listener>();
  private player: SpotifyPlayer | null = null;
  private deviceId: string | null = null;
  private connecting: Promise<void> | null = null;
  private activated = false;

  private watchdogTimer: ReturnType<typeof setInterval> | null = null;
  private tickTimer: ReturnType<typeof setInterval> | null = null;
  private stallTracker: StallTrackerState = createStallTracker();
  private stalled = false;
  private authRecovery: AuthRecoveryState = createAuthRecovery();

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  getSnapshot(): SpotifySnapshot {
    return this.snapshot;
  }

  private set(patch: Partial<SpotifySnapshot>): void {
    this.snapshot = { ...this.snapshot, ...patch };
    for (const l of this.listeners) l(this.snapshot);
    this.syncTimers();
  }

  /**
   * Unlock the SDK's hidden audio element from within a user gesture so the
   * browser's autoplay policy permits auto-advancing the queue. MUST be called
   * synchronously from a tap handler, before any await. Fire-and-forget.
   */
  activateElement(): void {
    if (this.activated) return;
    const p = this.player;
    if (!p || typeof p.activateElement !== 'function') return;
    this.activated = true;
    try {
      void p.activateElement();
    } catch {
      // Older SDK builds may lack it; let a later gesture re-arm.
      this.activated = false;
    }
  }

  /** Load the SDK, create the player and wait until it is ready. */
  ensureConnected(): Promise<void> {
    if (this.deviceId && this.player) return Promise.resolve();
    if (this.connecting) return this.connecting;
    this.connecting = this.connect().finally(() => {
      this.connecting = null;
    });
    return this.connecting;
  }

  private connect(): Promise<void> {
    this.set({ initializing: true, error: null });
    return new Promise<void>((resolve, reject) => {
      let settled = false;
      const fail = (message: string) => {
        if (settled) return;
        settled = true;
        this.set({ initializing: false, error: message });
        reject(new Error(message));
      };
      const timer = setTimeout(
        () => fail('Spotify player failed to connect — try again.'),
        CONNECT_TIMEOUT_MS,
      );

      loadSdk()
        .then(() => {
          if (this.player || !window.Spotify) {
            // Already built (a concurrent call won the race).
            if (this.deviceId) {
              clearTimeout(timer);
              settled = true;
              resolve();
            }
            return;
          }
          const player = new window.Spotify.Player({
            name: 'Psalter',
            getOAuthToken: async (cb: (t: string) => void) => {
              // Hand the SDK a *currently valid* token: an expired one makes
              // the SDK raise authentication_error and pause at the next
              // track boundary. Every wait is bounded so a hung network can't
              // starve the SDK callback.
              const timeout = () =>
                new Promise<null>((r) => setTimeout(() => r(null), OAUTH_TIMEOUT_MS));
              try {
                await Promise.race([tokenManager.getValidAccessToken(), timeout()]);
              } catch {
                // fall through to the validity check below
              }
              let choice = selectSdkToken(tokenManager.getTokens(), Date.now());
              if (choice.needsForceRefresh) {
                try {
                  const refreshed = await Promise.race([
                    tokenManager.forceRefresh(),
                    timeout(),
                  ]);
                  choice = selectSdkToken(
                    refreshed ?? tokenManager.getTokens(),
                    Date.now(),
                  );
                } catch {
                  // refresh failed; fall back below
                }
              }
              if (choice.token) {
                cb(choice.token);
                return;
              }
              // Last resort: hand over whatever we hold rather than leave the
              // SDK callback hanging (which silently starves playback).
              const last = tokenManager.getTokens();
              if (last?.accessToken) cb(last.accessToken);
            },
            volume: 0.8,
          });

          player.addListener('ready', (...args: unknown[]) => {
            const { device_id } = args[0] as { device_id: string };
            this.deviceId = device_id;
            clearTimeout(timer);
            this.set({ ready: true, initializing: false });
            if (!settled) {
              settled = true;
              resolve();
            }
          });
          player.addListener('not_ready', () => this.set({ ready: false }));
          player.addListener('player_state_changed', (...args: unknown[]) => {
            const state = args[0] as SdkPlayerState | null;
            if (!state) return;
            // Healthy playback means auth works — refill the recovery budget.
            if (!state.paused) this.authRecovery = createAuthRecovery();
            const t = state.track_window?.current_track;
            this.set({
              hasLiveState: true,
              isPlaying: !state.paused,
              positionMs: state.position,
              durationMs: state.duration,
              ...(t
                ? {
                    currentUri: t.uri,
                    trackName: t.name,
                    artistName: t.artists?.map((a) => a.name).join(', ') ?? null,
                    albumArt: t.album?.images?.[0]?.url ?? null,
                  }
                : {}),
            });
          });

          const errHandler = (label: string) => (...args: unknown[]) => {
            const { message } = (args[0] as { message?: string }) ?? {};
            clearTimeout(timer);
            this.set({ initializing: false, error: `${label}: ${message ?? 'unknown'}` });
          };
          player.addListener('initialization_error', errHandler('Init'));
          player.addListener('account_error', errHandler('Account'));
          player.addListener('playback_error', errHandler('Playback'));
          // The token the SDK held was rejected. Auto-recover — force a
          // brand-new token and reconnect — bounded so a genuinely dead
          // session surfaces the error instead of looping forever.
          player.addListener('authentication_error', (...args: unknown[]) => {
            const { message } = (args[0] as { message?: string }) ?? {};
            const decision = onAuthError(this.authRecovery, Date.now());
            this.authRecovery = decision.state;
            if (decision.shouldRecover) {
              console.warn(
                `[SpotifyEngine] SDK auth failed (${message ?? 'unknown'}) — forcing refresh + reconnect`,
              );
              void (async () => {
                try {
                  await tokenManager.forceRefresh();
                  await this.player?.connect();
                } catch {
                  // a later error re-enters (budget permitting)
                }
              })();
              return;
            }
            clearTimeout(timer);
            this.set({
              initializing: false,
              error: `Auth: ${message ?? 'authentication failed'}`,
            });
          });
          // Autoplay policy blocked the auto-advance at a track boundary.
          player.addListener('autoplay_failed', () => {
            console.warn(
              '[SpotifyEngine] autoplay blocked at track boundary — tap play to continue',
            );
            this.set({
              isPlaying: false,
              error: 'Tap play to keep the music going.',
            });
          });

          void player.connect();
          this.player = player;
        })
        .catch((e) => {
          clearTimeout(timer);
          fail(e instanceof Error ? e.message : 'Failed to load the Spotify player.');
        });
    });
  }

  /** Start playback of a uri queue on this device. Throws on API failure. */
  async playUris(uris: string[], opts?: { positionMs?: number }): Promise<void> {
    await this.ensureConnected();
    if (!this.deviceId) throw new Error('Spotify player is not ready.');
    const clean = uris.filter(Boolean);
    if (clean.length === 0) return;
    // A fresh play command starts a new playback episode — reset the watchdog.
    this.stallTracker = createStallTracker();
    this.stalled = false;
    const body: { uris: string[]; position_ms?: number } = { uris: clean };
    if (opts?.positionMs && opts.positionMs > 0) {
      body.position_ms = Math.floor(opts.positionMs);
    }
    try {
      await spotifyApi(() => tokenManager.getValidAccessToken()).play(
        this.deviceId,
        body,
      );
      this.set({ error: null });
    } catch (e) {
      if (e instanceof SpotifyApiError && (e.status === 401 || e.status === 403)) {
        this.set({ error: 'Spotify session expired — sign in again.' });
      } else {
        this.set({
          error: e instanceof Error ? e.message : 'Spotify play failed.',
        });
      }
      throw e;
    }
  }

  async toggle(): Promise<void> {
    this.set({ error: null });
    await this.player?.togglePlay();
  }

  async pause(): Promise<void> {
    await this.player?.pause();
  }

  async resume(): Promise<void> {
    this.set({ error: null });
    await this.player?.resume();
  }

  async seek(positionMs: number): Promise<void> {
    if (!this.player) return;
    await this.player.seek(Math.max(0, Math.floor(positionMs)));
    this.set({ positionMs: Math.max(0, positionMs) });
  }

  async next(): Promise<void> {
    await this.player?.nextTrack();
  }

  async prev(): Promise<void> {
    await this.player?.previousTrack();
  }

  disconnect(): void {
    this.player?.disconnect();
    this.player = null;
    this.deviceId = null;
    this.activated = false;
    this.set({ ...INITIAL });
  }

  // --- timers: dead-reckoned progress + stall watchdog ----------------------

  private syncTimers(): void {
    const shouldRun = this.snapshot.isPlaying && !!this.player;

    if (shouldRun && !this.tickTimer) {
      // Smooth the UI position between SDK updates; freeze while stalled so
      // the bar stops lying.
      this.tickTimer = setInterval(() => {
        if (this.stalled || !this.snapshot.isPlaying) return;
        const next = Math.min(
          this.snapshot.positionMs + 500,
          this.snapshot.durationMs || Number.MAX_SAFE_INTEGER,
        );
        this.snapshot = { ...this.snapshot, positionMs: next };
        for (const l of this.listeners) l(this.snapshot);
      }, 500);
    } else if (!shouldRun && this.tickTimer) {
      clearInterval(this.tickTimer);
      this.tickTimer = null;
    }

    if (shouldRun && !this.watchdogTimer) {
      this.watchdogTimer = setInterval(() => void this.watchdogSample(), WATCHDOG_INTERVAL_MS);
    } else if (!shouldRun && this.watchdogTimer) {
      clearInterval(this.watchdogTimer);
      this.watchdogTimer = null;
    }
  }

  private async watchdogSample(): Promise<void> {
    const player = this.player;
    if (!player) return;
    let state: SdkPlayerState | null = null;
    try {
      state = await player.getCurrentState();
    } catch {
      return;
    }
    if (!state) return;

    const sample: StallSample = {
      position: state.position,
      paused: state.paused,
      timestamp: Date.now(),
    };
    const obs = observeSample(this.stallTracker, sample);
    this.stallTracker = obs.state;
    this.stalled = obs.stalled;

    // Trust the SDK's real position over the interpolated guess.
    this.set({
      positionMs: state.position,
      ...(state.duration ? { durationMs: state.duration } : {}),
    });

    if (obs.shouldRecover) {
      console.warn(
        `[SpotifyEngine] playback stalled (position frozen at ${state.position}ms) — auto-recovering with pause/resume`,
      );
      try {
        await player.pause();
        await new Promise((r) => setTimeout(r, 250));
        await player.resume();
      } catch {
        // Recovery failed; the watchdog will try again within its budget.
      }
    }
  }
}
