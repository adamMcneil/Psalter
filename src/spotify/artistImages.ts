// Artist photos via the Spotify search API, available only while signed in.
// Cached in localStorage so photos persist across sessions and the API is hit
// at most once per artist per month.

import { useEffect, useState } from 'react';
import { useSpotifyAuth } from './AuthContext';
import { spotifyApi } from './api';

const STORAGE_KEY = 'psalter:artistImages:v1';
const TTL_MS = 30 * 24 * 60 * 60 * 1000;
const NEG_TTL_MS = 24 * 60 * 60 * 1000;

interface CacheEntry {
  url: string | null;
  ts: number;
}

const cache = new Map<string, CacheEntry>();
const inflight = new Map<string, Promise<string | null>>();
let hydrated = false;
let dirty = false;
let flushTimer: ReturnType<typeof setTimeout> | null = null;

// Serialize search calls so a first render of a long artist list doesn't
// burst-fire dozens of requests into Spotify's rate limiter.
let queue: Promise<unknown> = Promise.resolve();
function enqueue<T>(fn: () => Promise<T>): Promise<T> {
  const p = queue.then(fn, fn);
  queue = p.catch(() => undefined);
  return p as Promise<T>;
}

function hydrate(): void {
  if (hydrated) return;
  hydrated = true;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Record<string, CacheEntry>;
      for (const [k, v] of Object.entries(parsed)) {
        if (v && typeof v.ts === 'number') cache.set(k, v);
      }
    }
  } catch {
    // bad cache shouldn't block UI
  }
}

function scheduleFlush() {
  dirty = true;
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    if (!dirty) return;
    dirty = false;
    const obj: Record<string, CacheEntry> = {};
    cache.forEach((v, k) => {
      obj[k] = v;
    });
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(obj));
    } catch {
      // ignore
    }
  }, 1000);
}

function fresh(entry: CacheEntry | undefined): boolean {
  if (!entry) return false;
  const ttl = entry.url === null ? NEG_TTL_MS : TTL_MS;
  return Date.now() - entry.ts < ttl;
}

function pickImage(
  images: { url: string; width?: number; height?: number }[] | undefined,
): string | null {
  if (!images || images.length === 0) return null;
  const sorted = images.slice().sort((a, b) => {
    const aw = a.width ?? 0;
    const bw = b.width ?? 0;
    return Math.abs(aw - 300) - Math.abs(bw - 300);
  });
  return sorted[0]?.url ?? null;
}

export function useArtistImage(name: string): string | null {
  hydrate();
  const { tokens, getAccessToken } = useSpotifyAuth();
  const cached = cache.get(name);
  const [url, setUrl] = useState<string | null>(
    fresh(cached) ? (cached!.url ?? null) : null,
  );

  useEffect(() => {
    if (!name) return;
    let mounted = true;

    const entry = cache.get(name);
    if (fresh(entry)) {
      setUrl(entry!.url ?? null);
      return;
    }
    if (!tokens) return;

    let p = inflight.get(name);
    if (!p) {
      const api = spotifyApi(getAccessToken);
      p = enqueue(() =>
        api
          .searchArtist(name)
          .then((res) => {
            const item = res.artists?.items?.[0];
            const u = pickImage(item?.images);
            cache.set(name, { url: u, ts: Date.now() });
            inflight.delete(name);
            scheduleFlush();
            return u;
          })
          .catch(() => {
            cache.set(name, { url: null, ts: Date.now() });
            inflight.delete(name);
            scheduleFlush();
            return null;
          }),
      );
      inflight.set(name, p);
    }
    p.then((u) => {
      if (mounted) setUrl(u);
    });
    return () => {
      mounted = false;
    };
  }, [name, tokens, getAccessToken]);

  return url;
}
