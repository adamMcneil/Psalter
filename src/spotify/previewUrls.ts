import AsyncStorage from '@react-native-async-storage/async-storage';
import { spotifyApi, GetToken } from './api';

const STORAGE_KEY = 'psalter:previewUrls:v1';
const TTL_MS = 7 * 24 * 60 * 60 * 1000;
const NEG_TTL_MS = 60 * 60 * 1000;
const BATCH_DELAY_MS = 25;
const MAX_BATCH = 50;

interface Entry {
  url: string | null;
  ts: number;
}

const cache = new Map<string, Entry>();
const inflight = new Map<string, Promise<string | null>>();
let pendingIds: string[] = [];
let pendingResolvers = new Map<
  string,
  Array<{ resolve: (v: string | null) => void; reject: (e: unknown) => void }>
>();
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let hydrated = false;
let hydration: Promise<void> | null = null;
let dirty = false;
let persistTimer: ReturnType<typeof setTimeout> | null = null;

function fresh(e: Entry | undefined): boolean {
  if (!e) return false;
  const ttl = e.url === null ? NEG_TTL_MS : TTL_MS;
  return Date.now() - e.ts < ttl;
}

async function hydrate() {
  if (hydrated) return;
  if (hydration) return hydration;
  hydration = (async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Record<string, Entry>;
        for (const [k, v] of Object.entries(parsed)) {
          if (v && typeof v.ts === 'number') cache.set(k, v);
        }
      }
    } catch {
      // ignore
    } finally {
      hydrated = true;
    }
  })();
  return hydration;
}

function schedulePersist() {
  dirty = true;
  if (persistTimer) return;
  persistTimer = setTimeout(() => {
    persistTimer = null;
    if (!dirty) return;
    dirty = false;
    const obj: Record<string, Entry> = {};
    cache.forEach((v, k) => {
      obj[k] = v;
    });
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(obj)).catch(() => {});
  }, 1000);
}

function flush(getToken: GetToken) {
  if (flushTimer) clearTimeout(flushTimer);
  flushTimer = null;
  const ids = pendingIds.slice();
  const resolvers = pendingResolvers;
  pendingIds = [];
  pendingResolvers = new Map();
  if (ids.length === 0) return;

  const api = spotifyApi(getToken);
  const chunks: string[][] = [];
  for (let i = 0; i < ids.length; i += MAX_BATCH) {
    chunks.push(ids.slice(i, i + MAX_BATCH));
  }
  for (const chunk of chunks) {
    api
      .getTracks(chunk)
      .then((res) => {
        const byId = new Map<string, string | null>();
        for (const t of res.tracks) {
          if (t) byId.set(t.id, t.preview_url ?? null);
        }
        for (const id of chunk) {
          const url = byId.has(id) ? (byId.get(id) ?? null) : null;
          cache.set(id, { url, ts: Date.now() });
          inflight.delete(id);
          const list = resolvers.get(id);
          if (list) list.forEach((r) => r.resolve(url));
        }
        schedulePersist();
      })
      .catch((err) => {
        for (const id of chunk) {
          inflight.delete(id);
          const list = resolvers.get(id);
          if (list) list.forEach((r) => r.reject(err));
        }
      });
  }
}

export async function getPreviewUrl(
  trackId: string,
  getToken: GetToken,
): Promise<string | null> {
  await hydrate();
  const entry = cache.get(trackId);
  if (fresh(entry)) return entry!.url;

  const existing = inflight.get(trackId);
  if (existing) return existing;

  const p = new Promise<string | null>((resolve, reject) => {
    const list = pendingResolvers.get(trackId) ?? [];
    list.push({ resolve, reject });
    pendingResolvers.set(trackId, list);
    if (!pendingIds.includes(trackId)) pendingIds.push(trackId);
    if (!flushTimer) {
      flushTimer = setTimeout(() => flush(getToken), BATCH_DELAY_MS);
    }
  });
  inflight.set(trackId, p);
  return p;
}
