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

export const totalDurationSec = (songs: Song[]): number =>
  songs.reduce((sum, s) => sum + (s.durationSec ?? 0), 0);

// Compact, human-readable duration. Picks units based on magnitude so
// 3-minute songs ("3:42"), hour-long playlists ("1h 12m"), and day-long
// catalogs ("2d 14h") all read naturally.
export function formatDuration(sec: number): string {
  if (!Number.isFinite(sec) || sec <= 0) return '0:00';
  const total = Math.round(sec);
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  if (days >= 1) {
    return hours > 0 ? `${days}d ${hours}h` : `${days}d`;
  }
  if (hours >= 1) {
    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  }
  if (minutes >= 1) {
    return seconds > 0 ? `${minutes}:${String(seconds).padStart(2, '0')}` : `${minutes}:00`;
  }
  return `0:${String(seconds).padStart(2, '0')}`;
}
