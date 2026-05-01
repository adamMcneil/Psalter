import raw from './catalog.json';
import { Song } from '../types';

export const catalog: Song[] = (raw.songs as Song[]).slice();

export const songsForPsalm = (n: number): Song[] =>
  catalog.filter((s) => s.psalm === n);

export const songById = (id: string): Song | undefined =>
  catalog.find((s) => s.id === id);

export interface ArtistEntry {
  name: string;
  songCount: number;
  psalmCount: number;
}

export const artists = (): ArtistEntry[] => {
  const byName = new Map<string, { songs: Set<string>; psalms: Set<number> }>();
  for (const song of catalog) {
    let entry = byName.get(song.artist);
    if (!entry) {
      entry = { songs: new Set(), psalms: new Set() };
      byName.set(song.artist, entry);
    }
    entry.songs.add(song.id);
    entry.psalms.add(song.psalm);
  }
  return Array.from(byName.entries())
    .map(([name, e]) => ({
      name,
      songCount: e.songs.size,
      psalmCount: e.psalms.size,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
};

export const songsByArtist = (name: string): Song[] =>
  catalog
    .filter((s) => s.artist === name)
    .sort((a, b) => a.psalm - b.psalm);
