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
import { getPreviewUrl } from './previewUrls';

interface PreviewPlayerValue {
  supported: boolean;
  currentTrackId: string | null;
  isPlaying: boolean;
  loading: boolean;
  position: number;
  duration: number;
  error: string | null;
  play: (trackId: string) => Promise<void>;
  pause: () => void;
  toggle: (trackId: string) => Promise<void>;
  stop: () => void;
}

const noopAsync = async () => {};
const noop = () => {};

const initial: PreviewPlayerValue = {
  supported: false,
  currentTrackId: null,
  isPlaying: false,
  loading: false,
  position: 0,
  duration: 0,
  error: null,
  play: noopAsync,
  pause: noop,
  toggle: noopAsync,
  stop: noop,
};

const Ctx = createContext<PreviewPlayerValue>(initial);

export function PreviewPlayerProvider({ children }: { children: ReactNode }) {
  const isWeb = Platform.OS === 'web';
  const { getAccessToken } = useSpotifyAuth();

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [currentTrackId, setCurrentTrackId] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isWeb) return;
    if (audioRef.current) return;
    if (typeof window === 'undefined') return;
    const a = new Audio();
    a.preload = 'none';
    a.crossOrigin = 'anonymous';
    audioRef.current = a;

    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onEnded = () => {
      setIsPlaying(false);
      setPosition(a.duration || 0);
    };
    const onTime = () => setPosition(a.currentTime || 0);
    const onLoaded = () => setDuration(a.duration || 0);
    const onError = () => {
      setError('Preview failed to load.');
      setIsPlaying(false);
      setLoading(false);
    };

    a.addEventListener('play', onPlay);
    a.addEventListener('pause', onPause);
    a.addEventListener('ended', onEnded);
    a.addEventListener('timeupdate', onTime);
    a.addEventListener('loadedmetadata', onLoaded);
    a.addEventListener('error', onError);

    return () => {
      a.removeEventListener('play', onPlay);
      a.removeEventListener('pause', onPause);
      a.removeEventListener('ended', onEnded);
      a.removeEventListener('timeupdate', onTime);
      a.removeEventListener('loadedmetadata', onLoaded);
      a.removeEventListener('error', onError);
      a.pause();
      a.src = '';
      audioRef.current = null;
    };
  }, [isWeb]);

  const play = useCallback(
    async (trackId: string) => {
      if (!isWeb) return;
      const a = audioRef.current;
      if (!a) return;
      setError(null);
      if (currentTrackId === trackId && a.src) {
        try {
          await a.play();
        } catch (e) {
          setError(e instanceof Error ? e.message : 'Playback blocked.');
        }
        return;
      }
      setLoading(true);
      setCurrentTrackId(trackId);
      setPosition(0);
      setDuration(0);
      try {
        const url = await getPreviewUrl(trackId, getAccessToken);
        if (!url) {
          setError('No preview available for this track.');
          setLoading(false);
          setCurrentTrackId(null);
          return;
        }
        a.src = url;
        a.currentTime = 0;
        await a.play();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Preview failed.');
      } finally {
        setLoading(false);
      }
    },
    [isWeb, currentTrackId, getAccessToken],
  );

  const pause = useCallback(() => {
    audioRef.current?.pause();
  }, []);

  const stop = useCallback(() => {
    const a = audioRef.current;
    if (!a) return;
    a.pause();
    a.currentTime = 0;
    setPosition(0);
    setCurrentTrackId(null);
  }, []);

  const toggle = useCallback(
    async (trackId: string) => {
      const a = audioRef.current;
      if (!a) return;
      if (currentTrackId === trackId) {
        if (a.paused) {
          try {
            await a.play();
          } catch (e) {
            setError(e instanceof Error ? e.message : 'Playback blocked.');
          }
        } else {
          a.pause();
        }
        return;
      }
      await play(trackId);
    },
    [currentTrackId, play],
  );

  const value = useMemo<PreviewPlayerValue>(
    () => ({
      supported: isWeb,
      currentTrackId,
      isPlaying,
      loading,
      position,
      duration,
      error,
      play,
      pause,
      toggle,
      stop,
    }),
    [
      isWeb,
      currentTrackId,
      isPlaying,
      loading,
      position,
      duration,
      error,
      play,
      pause,
      toggle,
      stop,
    ],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function usePreviewPlayer(): PreviewPlayerValue {
  return useContext(Ctx);
}
