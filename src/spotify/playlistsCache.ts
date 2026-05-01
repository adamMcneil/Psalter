import AsyncStorage from '@react-native-async-storage/async-storage';
import { ApiPlaylist, SpotifyApi } from './api';

const KEY = 'psalter:playlists:v1';
const TTL_MS = 5 * 60 * 1000;

interface Snapshot {
  ts: number;
  items: ApiPlaylist[];
}

let memory: Snapshot | null = null;
let inflight: Promise<ApiPlaylist[]> | null = null;
let hydration: Promise<void> | null = null;

async function hydrate() {
  if (memory) return;
  if (hydration) return hydration;
  hydration = (async () => {
    try {
      const raw = await AsyncStorage.getItem(KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Snapshot;
      if (parsed && typeof parsed.ts === 'number' && Array.isArray(parsed.items)) {
        memory = parsed;
      }
    } catch {
      // ignore
    }
  })();
  return hydration;
}

function fresh(snap: Snapshot | null): boolean {
  return !!snap && Date.now() - snap.ts < TTL_MS;
}

async function persist(snap: Snapshot) {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(snap));
  } catch {
    // ignore
  }
}

export async function loadMyPlaylists(
  api: SpotifyApi,
  opts: { force?: boolean } = {},
): Promise<ApiPlaylist[]> {
  await hydrate();
  if (!opts.force && fresh(memory)) return memory!.items;
  if (inflight) return inflight;
  inflight = api
    .getMyPlaylists()
    .then((items) => {
      memory = { ts: Date.now(), items };
      void persist(memory);
      return items;
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

export function invalidatePlaylistsCache() {
  memory = null;
  void AsyncStorage.removeItem(KEY).catch(() => {});
}

export function patchPlaylistsCache(mutator: (items: ApiPlaylist[]) => ApiPlaylist[]) {
  if (!memory) return;
  const next = { ts: memory.ts, items: mutator(memory.items) };
  memory = next;
  void persist(next);
}
