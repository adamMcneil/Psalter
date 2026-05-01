import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSpotifyAuth } from '../spotify/AuthContext';
import { spotifyApi } from '../spotify/api';
import { catalog } from '../data/catalog';
import { extractTrackId } from '../spotify/launch';
import { Song } from '../types';

const LOCAL_KEY = 'psalter:favorites:v1';

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
    new Set(),
  );
  const [loading, setLoading] = useState(isAuthed);

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
    setLoading(true);
    const candidateIds = catalog
      .map(songTrackId)
      .filter((id): id is string => !!id);
    api
      .containsMySavedTracks(candidateIds)
      .then((flags) => {
        if (!mounted) return;
        const next = new Set<string>();
        flags.forEach((on, idx) => {
          if (on) next.add(candidateIds[idx]);
        });
        setSpotifyTrackIds(next);
      })
      .catch(() => {
        if (mounted) setSpotifyTrackIds(new Set());
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
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
        setSpotifyTrackIds(optimistic);
        try {
          if (isOn) await api.removeTracks([trackId]);
          else await api.saveTracks([trackId]);
        } catch {
          setSpotifyTrackIds(new Set(spotifyTrackIds));
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
