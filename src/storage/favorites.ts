import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSpotifyAuth } from '../spotify/AuthContext';
import { spotifyApi } from '../spotify/api';
import { catalog } from '../data/catalog';
import { extractTrackId } from '../spotify/launch';
import { Song } from '../types';

const LOCAL_KEY = 'psalter:favorites:v1';
const SPOTIFY_CACHE_KEY = 'psalter:favorites:spotifyContains:v1';
const SPOTIFY_TTL_MS = 60 * 60 * 1000;

async function readLocal(): Promise<string[]> {
  const raw = await AsyncStorage.getItem(LOCAL_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

async function writeLocal(ids: string[]): Promise<void> {
  await AsyncStorage.setItem(LOCAL_KEY, JSON.stringify(ids));
}

const localListeners = new Set<(ids: string[]) => void>();
let localCache: string[] | null = null;

async function loadLocal(): Promise<string[]> {
  if (localCache) return localCache;
  localCache = await readLocal();
  return localCache;
}

async function emitLocal(next: string[]) {
  localCache = next;
  await writeLocal(next);
  localListeners.forEach((fn) => fn(next));
}

interface SpotifyCache {
  ts: number;
  ids: string[];
}

const spotifyListeners = new Set<(ids: Set<string>) => void>();
let spotifyCache: Set<string> | null = null;
let spotifyHydration: Promise<Set<string> | null> | null = null;
let spotifyFetchInflight: Promise<Set<string>> | null = null;

async function readSpotifyCache(): Promise<Set<string> | null> {
  try {
    const raw = await AsyncStorage.getItem(SPOTIFY_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SpotifyCache;
    if (!parsed || typeof parsed.ts !== 'number' || !Array.isArray(parsed.ids)) {
      return null;
    }
    if (Date.now() - parsed.ts > SPOTIFY_TTL_MS) return null;
    return new Set(parsed.ids);
  } catch {
    return null;
  }
}

async function writeSpotifyCache(ids: Set<string>): Promise<void> {
  const payload: SpotifyCache = { ts: Date.now(), ids: Array.from(ids) };
  try {
    await AsyncStorage.setItem(SPOTIFY_CACHE_KEY, JSON.stringify(payload));
  } catch {
    // ignore
  }
}

function emitSpotify(next: Set<string>) {
  spotifyCache = next;
  spotifyListeners.forEach((fn) => fn(next));
  void writeSpotifyCache(next);
}

function songTrackId(song: Song): string | null {
  return extractTrackId(song.spotifyUrl);
}

interface FavoritesValue {
  ids: string[];
  isFavorite: (songId: string) => boolean;
  toggle: (song: Song) => Promise<void>;
  source: 'spotify' | 'local';
  loading: boolean;
}

export function useFavorites(): FavoritesValue {
  const { tokens, getAccessToken } = useSpotifyAuth();
  const isAuthed = !!tokens;
  const api = useMemo(() => spotifyApi(getAccessToken), [getAccessToken]);

  const [localIds, setLocalIds] = useState<string[]>(localCache ?? []);
  const [spotifyTrackIds, setSpotifyTrackIds] = useState<Set<string>>(
    spotifyCache ?? new Set(),
  );
  const [loading, setLoading] = useState(isAuthed && !spotifyCache);

  useEffect(() => {
    let mounted = true;
    loadLocal().then((v) => {
      if (mounted) setLocalIds(v);
    });
    const fn = (v: string[]) => setLocalIds(v);
    localListeners.add(fn);
    return () => {
      mounted = false;
      localListeners.delete(fn);
    };
  }, []);

  useEffect(() => {
    if (!isAuthed) {
      setSpotifyTrackIds(new Set());
      setLoading(false);
      return;
    }
    let mounted = true;
    const fn = (next: Set<string>) => {
      if (mounted) setSpotifyTrackIds(next);
    };
    spotifyListeners.add(fn);

    const run = async () => {
      if (!spotifyHydration) {
        spotifyHydration = readSpotifyCache().then((v) => {
          if (v) spotifyCache = v;
          return v;
        });
      }
      const fromDisk = await spotifyHydration;
      if (!mounted) return;
      if (fromDisk) {
        setSpotifyTrackIds(fromDisk);
        setLoading(false);
        return;
      }

      if (!spotifyFetchInflight) {
        const candidateIds = catalog
          .map(songTrackId)
          .filter((id): id is string => !!id);
        spotifyFetchInflight = api
          .containsMySavedTracks(candidateIds)
          .then((flags) => {
            const next = new Set<string>();
            flags.forEach((on, idx) => {
              if (on) next.add(candidateIds[idx]);
            });
            emitSpotify(next);
            return next;
          })
          .catch(() => {
            const empty = new Set<string>();
            return empty;
          })
          .finally(() => {
            spotifyFetchInflight = null;
          });
      }
      try {
        const next = await spotifyFetchInflight;
        if (mounted) {
          setSpotifyTrackIds(next);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };

    setLoading(!spotifyCache);
    if (spotifyCache) setSpotifyTrackIds(spotifyCache);
    void run();

    return () => {
      mounted = false;
      spotifyListeners.delete(fn);
    };
  }, [isAuthed, api]);

  const songIdToTrackId = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of catalog) {
      const t = songTrackId(s);
      if (t) map.set(s.id, t);
    }
    return map;
  }, []);

  const ids = useMemo(() => {
    if (isAuthed) {
      return catalog
        .filter((s) => {
          const t = songIdToTrackId.get(s.id);
          return t ? spotifyTrackIds.has(t) : false;
        })
        .map((s) => s.id);
    }
    return localIds;
  }, [isAuthed, spotifyTrackIds, localIds, songIdToTrackId]);

  const isFavorite = useCallback(
    (songId: string) => {
      if (isAuthed) {
        const t = songIdToTrackId.get(songId);
        return t ? spotifyTrackIds.has(t) : false;
      }
      return localIds.includes(songId);
    },
    [isAuthed, spotifyTrackIds, localIds, songIdToTrackId],
  );

  const toggle = useCallback(
    async (song: Song) => {
      if (isAuthed) {
        const trackId = songTrackId(song);
        if (!trackId) {
          const next = localIds.includes(song.id)
            ? localIds.filter((x) => x !== song.id)
            : [...localIds, song.id];
          await emitLocal(next);
          return;
        }
        const isOn = spotifyTrackIds.has(trackId);
        const optimistic = new Set(spotifyTrackIds);
        if (isOn) optimistic.delete(trackId);
        else optimistic.add(trackId);
        emitSpotify(optimistic);
        try {
          if (isOn) await api.removeTracks([trackId]);
          else await api.saveTracks([trackId]);
        } catch {
          emitSpotify(new Set(spotifyTrackIds));
        }
        return;
      }
      const current = localCache ?? (await loadLocal());
      const next = current.includes(song.id)
        ? current.filter((x) => x !== song.id)
        : [...current, song.id];
      await emitLocal(next);
    },
    [isAuthed, spotifyTrackIds, localIds, api],
  );

  return {
    ids,
    isFavorite,
    toggle,
    source: isAuthed ? 'spotify' : 'local',
    loading,
  };
}
