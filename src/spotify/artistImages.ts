import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
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
let hydration: Promise<void> | null = null;
let dirty = false;
let flushTimer: ReturnType<typeof setTimeout> | null = null;

let queue: Promise<unknown> = Promise.resolve();

function enqueue<T>(fn: () => Promise<T>): Promise<T> {
  const p = queue.then(fn, fn);
  queue = p.catch(() => undefined);
  return p as Promise<T>;
}

async function hydrate(): Promise<void> {
  if (hydrated) return;
  if (hydration) return hydration;
  hydration = (async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Record<string, CacheEntry>;
        for (const [k, v] of Object.entries(parsed)) {
          if (v && typeof v.ts === 'number') cache.set(k, v);
        }
      }
    } catch {
      // ignore — bad cache shouldn't block UI
    } finally {
      hydrated = true;
    }
  })();
  return hydration;
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
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(obj)).catch(() => {});
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
  const { tokens, getAccessToken } = useSpotifyAuth();
  const cached = cache.get(name);
  const [url, setUrl] = useState<string | null>(
    fresh(cached) ? (cached!.url ?? null) : null,
  );

  useEffect(() => {
    if (!name) return;
    let mounted = true;

    const run = async () => {
      if (!hydrated) await hydrate();
      if (!mounted) return;
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
              const u =
                item && item.name.toLowerCase() === name.toLowerCase()
                  ? pickImage(item.images)
                  : pickImage(item?.images);
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
      const u = await p;
      if (mounted) setUrl(u);
    };

    run();
    return () => {
      mounted = false;
    };
  }, [name, tokens, getAccessToken]);

  return url;
}
