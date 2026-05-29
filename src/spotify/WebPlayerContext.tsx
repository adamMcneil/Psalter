import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSpotifyAuth } from './AuthContext';
import {
  createStallTracker,
  observeSample,
  StallSample,
  StallTrackerState,
} from './stallDetector';

const STATE_KEY = 'psalter:webPlayer:lastState:v1';
// Persist position at most this often while playing (it changes ~2x/sec).
const PERSIST_INTERVAL_MS = 7000;
// How often the stall watchdog samples real playback position.
const WATCHDOG_INTERVAL_MS = 1000;
// Max time we let getAccessToken() run before falling back, so a slow refresh
// never hangs the SDK's streaming (re)authentication.
const OAUTH_TIMEOUT_MS = 5000;

interface PersistedState {
  uri: string;
  position: number;
  trackName?: string;
  artistName?: string;
  albumArt?: string;
}

async function readPersisted(): Promise<PersistedState | null> {
  try {
    const raw = await AsyncStorage.getItem(STATE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed.uri !== 'string') return null;
    return parsed as PersistedState;
  } catch {
    return null;
  }
}

async function writePersisted(state: PersistedState): Promise<void> {
  try {
    await AsyncStorage.setItem(STATE_KEY, JSON.stringify(state));
  } catch {
    // ignore
  }
}

interface SpotifyPlayer {
  connect(): Promise<boolean>;
  disconnect(): void;
  pause(): Promise<void>;
  resume(): Promise<void>;
  togglePlay(): Promise<void>;
  seek(positionMs: number): Promise<void>;
  nextTrack(): Promise<void>;
  previousTrack(): Promise<void>;
  getCurrentState(): Promise<PlayerState | null>;
  addListener(event: string, cb: (...args: unknown[]) => void): boolean;
  removeListener(event: string, cb?: (...args: unknown[]) => void): boolean;
}

interface PlayerState {
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

interface WebPlayerValue {
  supported: boolean;
  ready: boolean;
  initializing: boolean;
  isPremium: boolean;
  isPlaying: boolean;
  currentUri: string | null;
  trackName: string | null;
  artistName: string | null;
  albumArt: string | null;
  error: string | null;
  play: (
    spotifyUriOrQueue: string | string[],
    opts?: { positionMs?: number },
  ) => Promise<void>;
  pause: () => Promise<void>;
  resume: () => Promise<void>;
  toggle: () => Promise<void>;
  seek: (positionMs: number) => Promise<void>;
  nextTrack: () => Promise<void>;
  previousTrack: () => Promise<void>;
  // Smart play: in-place resume if SDK has live state, else play from persisted position.
  playOrResume: () => Promise<void>;
}

// High-frequency playback progress lives in its own context so that updating it
// ~2x/sec does not re-render every useWebPlayer() consumer (e.g. each SongRow).
interface WebPlayerProgressValue {
  position: number;
  duration: number;
}

const noop = async () => {};
const initial: WebPlayerValue = {
  supported: false,
  ready: false,
  initializing: false,
  isPremium: false,
  isPlaying: false,
  currentUri: null,
  trackName: null,
  artistName: null,
  albumArt: null,
  error: null,
  play: noop,
  pause: noop,
  resume: noop,
  toggle: noop,
  seek: noop,
  nextTrack: noop,
  previousTrack: noop,
  playOrResume: noop,
};

const Ctx = createContext<WebPlayerValue>(initial);
const ProgressCtx = createContext<WebPlayerProgressValue>({
  position: 0,
  duration: 0,
});

const SDK_SRC = 'https://sdk.scdn.co/spotify-player.js';
let sdkPromise: Promise<void> | null = null;

function loadSdk(): Promise<void> {
  if (typeof window === 'undefined') return Promise.reject(new Error('No window'));
  if (window.Spotify) return Promise.resolve();
  if (sdkPromise) return sdkPromise;
  sdkPromise = new Promise<void>((resolve) => {
    window.onSpotifyWebPlaybackSDKReady = () => resolve();
    const s = document.createElement('script');
    s.src = SDK_SRC;
    s.async = true;
    document.body.appendChild(s);
  });
  return sdkPromise;
}

export function WebPlayerProvider({ children }: { children: ReactNode }) {
  const { user, tokens, getAccessToken, logout } = useSpotifyAuth();
  const isWeb = Platform.OS === 'web';
  const isPremium = user?.product === 'premium';
  const supported = isWeb && isPremium;

  const playerRef = useRef<SpotifyPlayer | null>(null);
  const deviceIdRef = useRef<string | null>(null);
  const [ready, setReady] = useState(false);
  const [initializing, setInitializing] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [currentUri, setCurrentUri] = useState<string | null>(null);
  const [trackName, setTrackName] = useState<string | null>(null);
  const [artistName, setArtistName] = useState<string | null>(null);
  const [albumArt, setAlbumArt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // True once the SDK has reported real playback state for this session.
  // Lets us distinguish "paused live track" (resume locally) from "hydrated
  // from disk, never played this session" (need to send play to the API).
  const [hasLiveState, setHasLiveState] = useState(false);

  // Render-time mirrors so callbacks/effects can read the latest value without
  // taking it as a dependency (and re-subscribing every tick).
  const tokensRef = useRef(tokens);
  tokensRef.current = tokens;
  const positionRef = useRef(0);
  positionRef.current = position;

  // Stall watchdog bookkeeping (kept in refs so it survives re-renders and the
  // brief isPlaying flip our own pause/resume recovery causes).
  const stallTrackerRef = useRef<StallTrackerState>(createStallTracker());
  const stalledRef = useRef(false);

  useEffect(() => {
    if (!supported || !tokens) {
      if (playerRef.current) {
        playerRef.current.disconnect();
        playerRef.current = null;
        deviceIdRef.current = null;
        setReady(false);
        setIsPlaying(false);
        setCurrentUri(null);
      }
      return;
    }
    let cancelled = false;
    setInitializing(true);
    setError(null);
    // If `ready` never fires within this window, surface a recoverable error
    // instead of leaving the UI stuck on "initializing" forever.
    const connectTimer = setTimeout(() => {
      if (cancelled) return;
      setError('Spotify player failed to connect — try refreshing.');
      setInitializing(false);
    }, 15000);
    loadSdk()
      .then(() => {
        // If the player already exists (e.g. this effect re-ran because the
        // auth token refreshed), do NOT build a second one — but DO clear the
        // freshly-armed connect timer, or it will later fire a spurious
        // "failed to connect" banner on a healthy, playing session.
        if (cancelled || playerRef.current || !window.Spotify) {
          clearTimeout(connectTimer);
          return;
        }
        const player = new window.Spotify.Player({
          name: 'Psalter',
          getOAuthToken: async (cb: (t: string) => void) => {
            // Always hand the SDK a token if we possibly can — and never let a
            // slow refresh hang the streaming (re)auth. A hung callback here
            // silently starves playback with no error surfaced.
            try {
              const t = await Promise.race([
                getAccessToken(),
                new Promise<null>((resolve) =>
                  setTimeout(() => resolve(null), OAUTH_TIMEOUT_MS),
                ),
              ]);
              if (t) {
                cb(t);
                return;
              }
            } catch {
              // fall through to the last-known token
            }
            const fallback = tokensRef.current?.accessToken;
            if (fallback) cb(fallback);
          },
          volume: 0.8,
        });

        player.addListener('ready', (...args: unknown[]) => {
          const { device_id } = args[0] as { device_id: string };
          deviceIdRef.current = device_id;
          setReady(true);
          setInitializing(false);
          clearTimeout(connectTimer);
        });
        player.addListener('not_ready', () => setReady(false));
        player.addListener('player_state_changed', (...args: unknown[]) => {
          const state = args[0] as PlayerState | null;
          if (!state) return;
          setHasLiveState(true);
          setIsPlaying(!state.paused);
          setPosition(state.position);
          setDuration(state.duration);
          const t = state.track_window?.current_track;
          if (t) {
            setCurrentUri(t.uri);
            setTrackName(t.name);
            setArtistName(t.artists?.map((a) => a.name).join(', ') ?? null);
            setAlbumArt(t.album?.images?.[0]?.url ?? null);
          }
        });
        const errHandler = (label: string) => (...args: unknown[]) => {
          const { message } = (args[0] as { message?: string }) ?? {};
          setError(`${label}: ${message ?? 'unknown'}`);
          setInitializing(false);
          clearTimeout(connectTimer);
        };
        player.addListener('initialization_error', errHandler('Init'));
        player.addListener('authentication_error', errHandler('Auth'));
        player.addListener('account_error', errHandler('Account'));
        player.addListener('playback_error', errHandler('Playback'));

        player.connect();
        playerRef.current = player;
      })
      .catch((e) => {
        setError(e instanceof Error ? e.message : 'Failed to load Spotify SDK');
        setInitializing(false);
        clearTimeout(connectTimer);
      });

    return () => {
      cancelled = true;
      clearTimeout(connectTimer);
    };
  }, [supported, tokens, getAccessToken]);

  // Disconnect the SDK player only on true unmount (empty deps), never on a
  // token-refresh re-run of the init effect — disconnecting there would kill
  // active playback.
  useEffect(() => {
    return () => {
      playerRef.current?.disconnect();
      playerRef.current = null;
    };
  }, []);

  // Smooth UI position between SDK updates by dead-reckoning. Freeze it while
  // the watchdog believes audio is stalled, so the bar stops lying.
  useEffect(() => {
    if (!isPlaying || duration === 0) return;
    const id = setInterval(() => {
      if (stalledRef.current) return;
      setPosition((p) => Math.min(p + 500, duration));
    }, 500);
    return () => clearInterval(id);
  }, [isPlaying, duration]);

  // Stall watchdog: while playing, sample the SDK's real position. If it stops
  // advancing while the player still claims to be playing (the documented
  // "stalled but not paused" state), automate the manual pause+resume the user
  // would otherwise have to do. Also corrects the dead-reckoned UI position.
  useEffect(() => {
    if (!ready || !isPlaying) return;
    const player = playerRef.current;
    if (!player) return;
    let cancelled = false;
    const id = setInterval(async () => {
      let state: PlayerState | null = null;
      try {
        state = await player.getCurrentState();
      } catch {
        return;
      }
      if (cancelled || !state) return;

      const sample: StallSample = {
        position: state.position,
        paused: state.paused,
        timestamp: Date.now(),
      };
      const obs = observeSample(stallTrackerRef.current, sample);
      stallTrackerRef.current = obs.state;
      stalledRef.current = obs.stalled;

      // Trust the SDK's real position over the interpolated guess.
      setPosition(state.position);
      if (state.duration) setDuration(state.duration);

      if (obs.shouldRecover) {
        console.warn(
          `[WebPlayer] playback stalled (position frozen at ${state.position}ms) — auto-recovering with pause/resume`,
        );
        try {
          // NOTE: do not gate the resume on `cancelled`. Our own pause() flips
          // isPlaying to false, which tears down this effect and sets
          // cancelled=true — but we still must resume, or recovery would leave
          // playback paused. resume() on a disconnected player is a harmless
          // no-op (caught below).
          await player.pause();
          await new Promise((resolve) => setTimeout(resolve, 250));
          await player.resume();
        } catch {
          // Recovery failed; the watchdog will try again within its budget.
        }
      }
    }, WATCHDOG_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [ready, isPlaying]);

  const play = useCallback(
    async (
      spotifyUriOrQueue: string | string[],
      opts?: { positionMs?: number },
    ) => {
      if (!supported) {
        setError('Spotify Premium required for full playback.');
        return;
      }
      if (!deviceIdRef.current) {
        setError('Player not ready yet — try again in a moment.');
        return;
      }
      const uris = Array.isArray(spotifyUriOrQueue)
        ? spotifyUriOrQueue.filter((u) => !!u)
        : [spotifyUriOrQueue];
      if (uris.length === 0) return;
      const token = await getAccessToken();
      if (!token) {
        setError('Sign in with Spotify first.');
        return;
      }
      setError(null);
      // A fresh play command starts a new playback episode — reset the watchdog
      // so leftover state from a previous track can't trigger a false recovery.
      stallTrackerRef.current = createStallTracker();
      stalledRef.current = false;
      const body: Record<string, unknown> = { uris };
      if (opts?.positionMs && opts.positionMs > 0) {
        body.position_ms = Math.floor(opts.positionMs);
      }
      const res = await fetch(
        `https://api.spotify.com/v1/me/player/play?device_id=${deviceIdRef.current}`,
        {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
        },
      );
      if (!res.ok) {
        const txt = await res.text();
        if (res.status === 401 || res.status === 403) {
          setError('Spotify session expired — sign in again.');
          await logout();
        } else {
          setError(`Play failed (${res.status}): ${txt}`);
        }
      }
    },
    [supported, getAccessToken, logout],
  );

  const pause = useCallback(async () => {
    await playerRef.current?.pause();
  }, []);
  const resume = useCallback(async () => {
    await playerRef.current?.resume();
  }, []);
  const toggle = useCallback(async () => {
    await playerRef.current?.togglePlay();
  }, []);
  const seek = useCallback(
    async (positionMs: number) => {
      if (!playerRef.current) return;
      await playerRef.current.seek(Math.max(0, Math.floor(positionMs)));
      setPosition(positionMs);
    },
    [],
  );
  const nextTrack = useCallback(async () => {
    await playerRef.current?.nextTrack();
  }, []);
  const previousTrack = useCallback(async () => {
    await playerRef.current?.previousTrack();
  }, []);

  // Smart play action for UI: resume in-place if the SDK is mid-track,
  // otherwise start fresh from the persisted position. Reads positionRef so its
  // identity stays stable across the ~2x/sec position updates.
  const playOrResume = useCallback(async () => {
    if (hasLiveState) {
      await playerRef.current?.resume();
      return;
    }
    if (currentUri) {
      await play(currentUri, { positionMs: positionRef.current });
    }
  }, [hasLiveState, currentUri, play]);

  // Hydrate last-known track so the MiniPlayer can show it before the user hits play.
  useEffect(() => {
    if (currentUri) return;
    let cancelled = false;
    readPersisted().then((saved) => {
      if (cancelled || !saved) return;
      // Only fill in if we haven't started playing something new.
      setCurrentUri((u) => u ?? saved.uri);
      setPosition((p) => (p > 0 ? p : saved.position));
      setTrackName((n) => n ?? saved.trackName ?? null);
      setArtistName((n) => n ?? saved.artistName ?? null);
      setAlbumArt((a) => a ?? saved.albumArt ?? null);
    });
    return () => {
      cancelled = true;
    };
  }, [currentUri]);

  // Keep a cheap snapshot of what we'd persist, refreshed on every change
  // (including the ~2x/sec position tick) — but this only assigns a ref, it
  // does not touch storage.
  const persistSnapshotRef = useRef<PersistedState | null>(null);
  useEffect(() => {
    persistSnapshotRef.current = currentUri
      ? {
          uri: currentUri,
          position,
          trackName: trackName ?? undefined,
          artistName: artistName ?? undefined,
          albumArt: albumArt ?? undefined,
        }
      : null;
  }, [currentUri, position, trackName, artistName, albumArt]);

  // Persist immediately when the track or its metadata changes (infrequent).
  useEffect(() => {
    if (persistSnapshotRef.current) void writePersisted(persistSnapshotRef.current);
  }, [currentUri, trackName, artistName, albumArt]);

  // Persist position on a throttle (not on every tick), plus a final write when
  // the track changes or the provider unmounts.
  useEffect(() => {
    if (!currentUri) return;
    const id = setInterval(() => {
      if (persistSnapshotRef.current) void writePersisted(persistSnapshotRef.current);
    }, PERSIST_INTERVAL_MS);
    return () => {
      clearInterval(id);
      if (persistSnapshotRef.current) void writePersisted(persistSnapshotRef.current);
    };
  }, [currentUri]);

  const value = useMemo<WebPlayerValue>(
    () => ({
      supported,
      ready,
      initializing,
      isPremium: !!isPremium,
      isPlaying,
      currentUri,
      trackName,
      artistName,
      albumArt,
      error,
      play,
      pause,
      resume,
      toggle,
      seek,
      nextTrack,
      previousTrack,
      playOrResume,
    }),
    [
      supported,
      ready,
      initializing,
      isPremium,
      isPlaying,
      currentUri,
      trackName,
      artistName,
      albumArt,
      error,
      play,
      pause,
      resume,
      toggle,
      seek,
      nextTrack,
      previousTrack,
      playOrResume,
    ],
  );

  const progressValue = useMemo<WebPlayerProgressValue>(
    () => ({ position, duration }),
    [position, duration],
  );

  return (
    <Ctx.Provider value={value}>
      <ProgressCtx.Provider value={progressValue}>
        {children}
      </ProgressCtx.Provider>
    </Ctx.Provider>
  );
}

export function useWebPlayer(): WebPlayerValue {
  return useContext(Ctx);
}

export function useWebPlayerProgress(): WebPlayerProgressValue {
  return useContext(ProgressCtx);
}
