// The one player the UI talks to. Routes playback to the right engine:
//
//   - PreviewEngine (default): DRM-free preview MP3s in a plain <audio>
//     element. Works in every browser — this is the engine that fixes
//     playback in Brave.
//   - SpotifyWebEngine (enhancement): full tracks via the Web Playback SDK,
//     used only when signed in with Premium AND the browser passes the
//     Widevine probe. Any failure falls back to previews automatically.

import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import { Song } from '../types';
import { songById, songByTrackId } from '../data/catalog';
import { buildQueue, PlayerTrack, shuffled } from './queue';
import { PreviewEngine } from './previewEngine';
import { SpotifyWebEngine } from '../spotify/webPlayerEngine';
import { useSpotifyAuth } from '../spotify/AuthContext';
import { widevineAvailable } from '../spotify/eme';
import { isSpotifyConfigured } from '../spotify/config';
import {
  setHandlers,
  setNowPlaying,
  setPlaybackState,
  setPosition,
} from './mediaSession';

const PERSIST_KEY = 'psalter:player:last:v2';
const PERSIST_INTERVAL_MS = 5000;

export type PlayerSource = 'preview' | 'spotify';

export type FullTracksReason =
  | 'ready'
  | 'probing'
  | 'not-configured'
  | 'signed-out'
  | 'not-premium'
  | 'no-drm';

export interface FullTracksInfo {
  ready: boolean;
  reason: FullTracksReason;
}

export interface NowPlayingInfo {
  songId: string | null;
  title: string;
  artist: string;
  album?: string;
  cover: string | null;
  psalm: number | null;
}

export interface PlayerValue {
  source: PlayerSource;
  fullTracks: FullTracksInfo;
  current: NowPlayingInfo | null;
  isPlaying: boolean;
  loading: boolean;
  /** Engine error worth a banner (connection, auth, autoplay-block). */
  error: string | null;
  /** One-shot informational notice (e.g. fell back to previews). */
  notice: string | null;
  hasQueue: boolean;
  playSongs: (
    songs: Song[],
    opts?: { startId?: string; shuffle?: boolean },
  ) => Promise<void>;
  toggle: () => void;
  pause: () => void;
  next: () => void;
  prev: () => void;
  seek: (positionSec: number) => void;
  clearNotice: () => void;
}

export interface PlayerProgress {
  positionSec: number;
  durationSec: number;
}

interface PersistedPlayer {
  v: 2;
  source: PlayerSource;
  songIds: string[];
  index: number;
  positionSec: number;
}

const noop = () => {};
const PlayerCtx = createContext<PlayerValue>({
  source: 'preview',
  fullTracks: { ready: false, reason: 'probing' },
  current: null,
  isPlaying: false,
  loading: false,
  error: null,
  notice: null,
  hasQueue: false,
  playSongs: async () => {},
  toggle: noop,
  pause: noop,
  next: noop,
  prev: noop,
  seek: noop,
  clearNotice: noop,
});
const ProgressCtx = createContext<PlayerProgress>({
  positionSec: 0,
  durationSec: 0,
});

function loadPersisted(): PersistedPlayer | null {
  try {
    const raw = window.localStorage.getItem(PERSIST_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as PersistedPlayer;
    if (p?.v !== 2 || !Array.isArray(p.songIds)) return null;
    return p;
  } catch {
    return null;
  }
}

function storePersisted(p: PersistedPlayer): void {
  try {
    window.localStorage.setItem(PERSIST_KEY, JSON.stringify(p));
  } catch {
    // ignore
  }
}

export function PlayerProvider({ children }: { children: ReactNode }) {
  const { user, tokens } = useSpotifyAuth();

  const previewRef = useRef<PreviewEngine | null>(null);
  if (!previewRef.current) previewRef.current = new PreviewEngine();
  const preview = previewRef.current;

  const spotifyRef = useRef<SpotifyWebEngine | null>(null);
  if (!spotifyRef.current) spotifyRef.current = new SpotifyWebEngine();
  const spotify = spotifyRef.current;

  const previewSnap = useSyncExternalStore(
    useCallback((cb) => preview.subscribe(cb), [preview]),
    () => preview.getSnapshot(),
  );
  const spotifySnap = useSyncExternalStore(
    useCallback((cb) => spotify.subscribe(cb), [spotify]),
    () => spotify.getSnapshot(),
  );

  const [source, setSource] = useState<PlayerSource>('preview');
  const [notice, setNotice] = useState<string | null>(null);
  const [drm, setDrm] = useState<boolean | null>(null);
  // Queue handed to the Spotify engine (it advances tracks server-side, so we
  // keep our own copy for persistence and metadata fallback).
  const spotifyQueueRef = useRef<PlayerTrack[]>([]);
  // One playUris failure per session flips to preview-first so repeated taps
  // don't keep burning the user's gesture on a broken SDK session.
  const spotifyBrokenRef = useRef(false);

  useEffect(() => {
    void widevineAvailable().then(setDrm);
  }, []);

  const fullTracks = useMemo<FullTracksInfo>(() => {
    if (!isSpotifyConfigured()) return { ready: false, reason: 'not-configured' };
    if (!tokens || !user) return { ready: false, reason: 'signed-out' };
    if (user.product !== 'premium') return { ready: false, reason: 'not-premium' };
    if (drm === null) return { ready: false, reason: 'probing' };
    if (!drm) return { ready: false, reason: 'no-drm' };
    return { ready: true, reason: 'ready' };
  }, [tokens, user, drm]);

  // Pre-warm the SDK connection once full tracks become possible, so the
  // first tap starts music instead of a 3s connect.
  useEffect(() => {
    if (fullTracks.ready && !spotifyBrokenRef.current) {
      spotify.ensureConnected().catch(() => {});
    }
  }, [fullTracks.ready, spotify]);

  // Signing out mid-session: drop the SDK and fall back to preview display.
  useEffect(() => {
    if (!tokens) {
      spotify.disconnect();
      spotifyBrokenRef.current = false;
      setSource('preview');
    }
  }, [tokens, spotify]);

  // --- hydration -------------------------------------------------------------

  useEffect(() => {
    const saved = loadPersisted();
    if (!saved || saved.songIds.length === 0) return;
    const songs = saved.songIds
      .map((id) => songById(id))
      .filter((s): s is Song => !!s);
    if (songs.length === 0) return;
    const queue = buildQueue(songs);
    const index = Math.min(Math.max(0, saved.index), queue.length - 1);
    spotifyQueueRef.current = queue;
    void preview.restore(queue, index, saved.positionSec);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- core actions ----------------------------------------------------------

  const startPlayback = useCallback(
    async (
      tracks: PlayerTrack[],
      startIndex: number,
      opts: { positionSec?: number; strict?: boolean } = {},
    ) => {
      // Synchronously unlock both engines' audio elements while we still hold
      // the user's gesture — required for queue auto-advance in either engine.
      spotify.activateElement();

      if (fullTracks.ready && !spotifyBrokenRef.current) {
        const uris = tracks
          .slice(startIndex)
          .map((t) => t.spotifyUri)
          .filter((u): u is string => !!u);
        if (uris.length > 0) {
          try {
            preview.pause();
            await spotify.playUris(uris, {
              positionMs: (opts.positionSec ?? 0) * 1000,
            });
            spotifyQueueRef.current = tracks;
            setSource('spotify');
            return;
          } catch {
            spotifyBrokenRef.current = true;
            setNotice('Full tracks unavailable right now — playing previews instead.');
          }
        }
      }

      const result = await preview.playQueue(tracks, startIndex, {
        positionSec: opts.positionSec,
        strict: opts.strict,
      });
      if (result === 'no-preview') {
        setNotice(
          'No preview is available for this song — use “Open in Spotify” on the song page.',
        );
        return;
      }
      if (source === 'spotify') void spotify.pause().catch(() => {});
      setSource('preview');
      spotifyQueueRef.current = tracks;
    },
    [fullTracks.ready, preview, spotify, source],
  );

  const playSongs = useCallback(
    async (songs: Song[], opts: { startId?: string; shuffle?: boolean } = {}) => {
      if (songs.length === 0) return;
      let list = songs;
      if (opts.shuffle) list = shuffled(songs);
      let startIndex = 0;
      let strict = false;
      if (opts.startId) {
        const idx = list.findIndex((s) => s.id === opts.startId);
        if (idx !== -1) {
          startIndex = idx;
          strict = true;
        }
      }
      await startPlayback(buildQueue(list), startIndex, { strict });
    },
    [startPlayback],
  );

  const pause = useCallback(() => {
    if (source === 'spotify') {
      void spotify.pause().catch(() => {});
    } else {
      preview.pause();
    }
  }, [source, spotify, preview]);

  const toggle = useCallback(() => {
    if (source === 'spotify' && spotifySnap.hasLiveState) {
      spotify.activateElement();
      void spotify.toggle().catch(() => {});
      return;
    }
    const snap = preview.getSnapshot();
    if (!snap.current) return;
    if (snap.isPlaying) {
      preview.pause();
      return;
    }
    // Cold start / resume: pick the best engine for the persisted queue.
    if (fullTracks.ready && !spotifyBrokenRef.current && snap.index >= 0) {
      void startPlayback(snap.queue, snap.index, {
        positionSec: snap.positionSec,
      });
      return;
    }
    spotify.activateElement();
    void preview.resume();
  }, [source, spotifySnap.hasLiveState, spotify, preview, fullTracks.ready, startPlayback]);

  const next = useCallback(() => {
    if (source === 'spotify') {
      void spotify.next().catch(() => {});
    } else {
      void preview.next();
    }
  }, [source, spotify, preview]);

  const prev = useCallback(() => {
    if (source === 'spotify') {
      void spotify.prev().catch(() => {});
    } else {
      void preview.prev();
    }
  }, [source, spotify, preview]);

  const seek = useCallback(
    (positionSec: number) => {
      if (source === 'spotify') {
        void spotify.seek(positionSec * 1000).catch(() => {});
      } else {
        preview.seek(positionSec);
      }
    },
    [source, spotify, preview],
  );

  const clearNotice = useCallback(() => setNotice(null), []);

  // --- derived now-playing info ----------------------------------------------

  const current = useMemo<NowPlayingInfo | null>(() => {
    if (source === 'spotify' && spotifySnap.currentUri) {
      const trackId = spotifySnap.currentUri.replace('spotify:track:', '');
      const song = songByTrackId(trackId);
      return {
        songId: song?.id ?? null,
        title: spotifySnap.trackName ?? song?.title ?? 'Now playing',
        artist: spotifySnap.artistName ?? song?.artist ?? '',
        album: song?.album,
        cover: spotifySnap.albumArt ?? song?.albumCoverUrl ?? null,
        psalm: song?.psalm ?? null,
      };
    }
    const t = previewSnap.current;
    if (!t) return null;
    return {
      songId: t.songId,
      title: t.title,
      artist: t.artist,
      album: t.album,
      cover: t.cover ?? null,
      psalm: t.psalm,
    };
  }, [
    source,
    spotifySnap.currentUri,
    spotifySnap.trackName,
    spotifySnap.artistName,
    spotifySnap.albumArt,
    previewSnap.current,
  ]);

  const isPlaying =
    source === 'spotify' ? spotifySnap.isPlaying : previewSnap.isPlaying;
  const loading =
    source === 'spotify' ? spotifySnap.initializing : previewSnap.loading;
  const error = source === 'spotify' ? spotifySnap.error : previewSnap.error;

  const progress = useMemo<PlayerProgress>(
    () =>
      source === 'spotify'
        ? {
            positionSec: spotifySnap.positionMs / 1000,
            durationSec: spotifySnap.durationMs / 1000,
          }
        : {
            positionSec: previewSnap.positionSec,
            durationSec: previewSnap.durationSec,
          },
    [
      source,
      spotifySnap.positionMs,
      spotifySnap.durationMs,
      previewSnap.positionSec,
      previewSnap.durationSec,
    ],
  );

  // --- media session -----------------------------------------------------------

  const actionsRef = useRef({ toggle, pause, next, prev, seek });
  actionsRef.current = { toggle, pause, next, prev, seek };

  const currentKey = current ? `${source}:${current.songId ?? current.title}` : null;
  useEffect(() => {
    if (!current) {
      setNowPlaying(null);
      setPlaybackState('none');
      return;
    }
    setNowPlaying({
      title: current.title,
      artist: current.artist,
      album: current.album,
      artworkUrl: current.cover ?? undefined,
    });
    setHandlers({
      onPlay: () => actionsRef.current.toggle(),
      onPause: () => actionsRef.current.pause(),
      onNext: () => actionsRef.current.next(),
      onPrev: () => actionsRef.current.prev(),
      onSeek: (sec) => actionsRef.current.seek(sec),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentKey]);

  useEffect(() => {
    setPlaybackState(current ? (isPlaying ? 'playing' : 'paused') : 'none');
  }, [isPlaying, current]);

  useEffect(() => {
    setPosition(progress.positionSec, progress.durationSec);
  }, [progress]);

  // --- persistence -------------------------------------------------------------

  const persistSnapshotRef = useRef<PersistedPlayer | null>(null);
  useEffect(() => {
    if (source === 'preview') {
      const s = previewSnap;
      if (s.index >= 0 && s.queue.length > 0) {
        persistSnapshotRef.current = {
          v: 2,
          source,
          songIds: s.queue.map((t) => t.songId),
          index: s.index,
          positionSec: Math.floor(s.positionSec),
        };
      }
    } else if (spotifySnap.currentUri) {
      const queue = spotifyQueueRef.current;
      const idx = queue.findIndex(
        (t) => t.spotifyUri === spotifySnap.currentUri,
      );
      if (idx !== -1) {
        persistSnapshotRef.current = {
          v: 2,
          source,
          songIds: queue.map((t) => t.songId),
          index: idx,
          positionSec: Math.floor(spotifySnap.positionMs / 1000),
        };
      }
    }
  });

  useEffect(() => {
    const id = setInterval(() => {
      if (persistSnapshotRef.current) storePersisted(persistSnapshotRef.current);
    }, PERSIST_INTERVAL_MS);
    return () => {
      clearInterval(id);
      if (persistSnapshotRef.current) storePersisted(persistSnapshotRef.current);
    };
  }, []);

  // Persist immediately when the track changes (infrequent).
  useEffect(() => {
    if (persistSnapshotRef.current) storePersisted(persistSnapshotRef.current);
  }, [currentKey]);

  // --- context values ----------------------------------------------------------

  const hasQueue =
    source === 'spotify'
      ? spotifyQueueRef.current.length > 1
      : previewSnap.queue.length > 1;

  const value = useMemo<PlayerValue>(
    () => ({
      source,
      fullTracks,
      current,
      isPlaying,
      loading,
      error,
      notice,
      hasQueue,
      playSongs,
      toggle,
      pause,
      next,
      prev,
      seek,
      clearNotice,
    }),
    [
      source,
      fullTracks,
      current,
      isPlaying,
      loading,
      error,
      notice,
      hasQueue,
      playSongs,
      toggle,
      pause,
      next,
      prev,
      seek,
      clearNotice,
    ],
  );

  return (
    <PlayerCtx.Provider value={value}>
      <ProgressCtx.Provider value={progress}>{children}</ProgressCtx.Provider>
    </PlayerCtx.Provider>
  );
}

export function usePlayer(): PlayerValue {
  return useContext(PlayerCtx);
}

export function usePlayerProgress(): PlayerProgress {
  return useContext(ProgressCtx);
}
