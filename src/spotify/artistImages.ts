import { useEffect, useState } from 'react';
import { useSpotifyAuth } from './AuthContext';
import { spotifyApi } from './api';

const cache = new Map<string, string | null>();
const inflight = new Map<string, Promise<string | null>>();

let queue: Promise<unknown> = Promise.resolve();

function enqueue<T>(fn: () => Promise<T>): Promise<T> {
  const p = queue.then(fn, fn);
  queue = p.catch(() => undefined);
  return p as Promise<T>;
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
  const [url, setUrl] = useState<string | null>(
    cache.has(name) ? (cache.get(name) ?? null) : null,
  );

  useEffect(() => {
    if (!name) return;
    if (cache.has(name)) {
      setUrl(cache.get(name) ?? null);
      return;
    }
    if (!tokens) return;

    let mounted = true;
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
            cache.set(name, u);
            inflight.delete(name);
            return u;
          })
          .catch(() => {
            cache.set(name, null);
            inflight.delete(name);
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
