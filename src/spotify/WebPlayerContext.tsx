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
import { useSpotifyAuth } from './AuthContext';

interface SpotifyPlayer {
  connect(): Promise<boolean>;
  disconnect(): void;
  pause(): Promise<void>;
  resume(): Promise<void>;
  togglePlay(): Promise<void>;
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
  play: (spotifyUriOrQueue: string | string[]) => Promise<void>;
  pause: () => Promise<void>;
  resume: () => Promise<void>;
  toggle: () => Promise<void>;
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
  const { user, tokens, getAccessToken } = useSpotifyAuth();
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
        });
        player.addListener('not_ready', () => setReady(false));
        player.addListener('player_state_changed', (...args: unknown[]) => {
          const state = args[0] as PlayerState | null;
          if (!state) return;
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
      });

    return () => {
      cancelled = true;
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
    async (spotifyUriOrQueue: string | string[]) => {
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
      const res = await fetch(
        `https://api.spotify.com/v1/me/player/play?device_id=${deviceIdRef.current}`,
        {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ uris }),
        },
      );
      if (!res.ok) {
        const txt = await res.text();
        setError(`Play failed (${res.status}): ${txt}`);
      }
    },
    [supported, getAccessToken],
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
    ],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useWebPlayer(): WebPlayerValue {
  return useContext(Ctx);
}
