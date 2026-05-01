import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';

const KEY = 'psalter:favorites:v1';

async function read(): Promise<string[]> {
  const raw = await AsyncStorage.getItem(KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

async function write(ids: string[]): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(ids));
}

const listeners = new Set<(ids: string[]) => void>();
let cache: string[] | null = null;

async function load(): Promise<string[]> {
  if (cache) return cache;
  cache = await read();
  return cache;
}

async function emit(next: string[]) {
  cache = next;
  await write(next);
  listeners.forEach((fn) => fn(next));
}

export function useFavorites() {
  const [ids, setIds] = useState<string[]>(cache ?? []);

  useEffect(() => {
    let mounted = true;
    load().then((v) => {
      if (mounted) setIds(v);
    });
    const fn = (v: string[]) => setIds(v);
    listeners.add(fn);
    return () => {
      mounted = false;
      listeners.delete(fn);
    };
  }, []);

  const isFavorite = useCallback((id: string) => ids.includes(id), [ids]);

  const toggle = useCallback(
    async (id: string) => {
      const current = cache ?? (await load());
      const next = current.includes(id)
        ? current.filter((x) => x !== id)
        : [...current, id];
      await emit(next);
    },
    [],
  );

  return { ids, isFavorite, toggle };
}
