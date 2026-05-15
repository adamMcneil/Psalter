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

const STATE_KEY = 'psalter:webPlayer:lastState:v1';

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
  position: number;
  duration: number;
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

const noop = async () => {};
const initial: WebPlayerValue = {
  supported: false,
  ready: false,
  initializing: false,
  isPremium: false,
  isPlaying: false,
  position: 0,
  duration: 0,
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
        if (cancelled || playerRef.current || !window.Spotify) return;
        const player = new window.Spotify.Player({
          name: 'Psalter',
          getOAuthToken: async (cb: (t: string) => void) => {
            const t = await getAccessToken();
            if (t) cb(t);
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

  useEffect(() => {
    if (!isPlaying || duration === 0) return;
    const id = setInterval(() => {
      setPosition((p) => Math.min(p + 500, duration));
    }, 500);
    return () => clearInterval(id);
  }, [isPlaying, duration]);

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
  // otherwise start fresh from the persisted position.
  const playOrResume = useCallback(async () => {
    if (hasLiveState) {
      await playerRef.current?.resume();
      return;
    }
    if (currentUri) {
      await play(currentUri, { positionMs: position });
    }
  }, [hasLiveState, currentUri, position, play]);

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

  // Persist current state whenever it meaningfully changes.
  useEffect(() => {
    if (!currentUri) return;
    void writePersisted({
      uri: currentUri,
      position,
      trackName: trackName ?? undefined,
      artistName: artistName ?? undefined,
      albumArt: albumArt ?? undefined,
    });
  }, [currentUri, position, trackName, artistName, albumArt]);

  const value = useMemo<WebPlayerValue>(
    () => ({
      supported,
      ready,
      initializing,
      isPremium: !!isPremium,
      isPlaying,
      position,
      duration,
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
      position,
      duration,
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

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useWebPlayer(): WebPlayerValue {
  return useContext(Ctx);
}
