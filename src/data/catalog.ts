import raw from './catalog.json';
import { Song } from '../types';

export const catalog: Song[] = (raw.songs as Song[]).slice();

export const songsForPsalm = (n: number): Song[] =>
  catalog.filter((s) => s.psalm === n);

export const songById = (id: string): Song | undefined =>
  catalog.find((s) => s.id === id);

export const songByTrackId = (trackId: string): Song | undefined => {
  const needle = `/track/${trackId}`;
  return catalog.find((s) => s.spotifyUrl?.includes(needle));
};

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

export interface Psalm119Section {
  order: number;
  letter: string;
  glyph: string;
  verseStart: number;
  verseEnd: number;
}

// The 22 Hebrew acrostic sections of Psalm 119, each 8 verses long.
export const PSALM_119_SECTIONS: Psalm119Section[] = [
  { order: 1, letter: 'Aleph', glyph: 'א', verseStart: 1, verseEnd: 8 },
  { order: 2, letter: 'Beth', glyph: 'ב', verseStart: 9, verseEnd: 16 },
  { order: 3, letter: 'Gimel', glyph: 'ג', verseStart: 17, verseEnd: 24 },
  { order: 4, letter: 'Daleth', glyph: 'ד', verseStart: 25, verseEnd: 32 },
  { order: 5, letter: 'He', glyph: 'ה', verseStart: 33, verseEnd: 40 },
  { order: 6, letter: 'Waw', glyph: 'ו', verseStart: 41, verseEnd: 48 },
  { order: 7, letter: 'Zayin', glyph: 'ז', verseStart: 49, verseEnd: 56 },
  { order: 8, letter: 'Heth', glyph: 'ח', verseStart: 57, verseEnd: 64 },
  { order: 9, letter: 'Teth', glyph: 'ט', verseStart: 65, verseEnd: 72 },
  { order: 10, letter: 'Yodh', glyph: 'י', verseStart: 73, verseEnd: 80 },
  { order: 11, letter: 'Kaph', glyph: 'כ', verseStart: 81, verseEnd: 88 },
  { order: 12, letter: 'Lamedh', glyph: 'ל', verseStart: 89, verseEnd: 96 },
  { order: 13, letter: 'Mem', glyph: 'מ', verseStart: 97, verseEnd: 104 },
  { order: 14, letter: 'Nun', glyph: 'נ', verseStart: 105, verseEnd: 112 },
  { order: 15, letter: 'Samekh', glyph: 'ס', verseStart: 113, verseEnd: 120 },
  { order: 16, letter: 'Ayin', glyph: 'ע', verseStart: 121, verseEnd: 128 },
  { order: 17, letter: 'Pe', glyph: 'פ', verseStart: 129, verseEnd: 136 },
  { order: 18, letter: 'Tsadhe', glyph: 'צ', verseStart: 137, verseEnd: 144 },
  { order: 19, letter: 'Qoph', glyph: 'ק', verseStart: 145, verseEnd: 152 },
  { order: 20, letter: 'Resh', glyph: 'ר', verseStart: 153, verseEnd: 160 },
  { order: 21, letter: 'Sin and Shin', glyph: 'ש', verseStart: 161, verseEnd: 168 },
  { order: 22, letter: 'Taw', glyph: 'ת', verseStart: 169, verseEnd: 176 },
];

// Common transliteration variants → canonical letter name. Token-matched against
// the song title, so partial-word collisions (e.g. "He" inside "Help") are avoided.
const PSALM_119_LETTER_ALIASES: Record<string, string> = {
  aleph: 'Aleph', alef: 'Aleph',
  beth: 'Beth', bet: 'Beth',
  gimel: 'Gimel', gimmel: 'Gimel',
  daleth: 'Daleth', dalet: 'Daleth',
  he: 'He', heh: 'He', hey: 'He',
  waw: 'Waw', vav: 'Waw',
  zayin: 'Zayin', zain: 'Zayin',
  heth: 'Heth', chet: 'Heth', cheth: 'Heth', het: 'Heth',
  teth: 'Teth', tet: 'Teth',
  yodh: 'Yodh', yod: 'Yodh', yud: 'Yodh',
  kaph: 'Kaph', kaf: 'Kaph', caph: 'Kaph',
  lamedh: 'Lamedh', lamed: 'Lamedh',
  mem: 'Mem',
  nun: 'Nun',
  samekh: 'Samekh', samech: 'Samekh', samek: 'Samekh',
  ayin: 'Ayin', ain: 'Ayin',
  pe: 'Pe', peh: 'Pe', pey: 'Pe',
  tsadhe: 'Tsadhe', tsade: 'Tsadhe', tsadi: 'Tsadhe', tzadi: 'Tsadhe',
  qoph: 'Qoph', qof: 'Qoph', koph: 'Qoph', kof: 'Qoph',
  resh: 'Resh', reish: 'Resh',
  shin: 'Sin and Shin', sin: 'Sin and Shin',
  taw: 'Taw', tav: 'Taw', tau: 'Taw',
};

export function sectionForPsalm119Song(song: Song): Psalm119Section | null {
  if (song.psalm !== 119) return null;
  const title = song.title ?? '';

  // Prefer explicit letter name in the title (e.g. "Psalm 119: Aleph").
  const tokens = title.match(/[A-Za-z]+/g) ?? [];
  for (const tok of tokens) {
    const canonical = PSALM_119_LETTER_ALIASES[tok.toLowerCase()];
    if (canonical) {
      const section = PSALM_119_SECTIONS.find((s) => s.letter === canonical);
      if (section) return section;
    }
  }

  // Fall back to a verse reference like "(Psalm 119:105-112)".
  const verseMatch = title.match(/119[:\s]*(\d+)/);
  if (verseMatch) {
    const v = parseInt(verseMatch[1], 10);
    const section = PSALM_119_SECTIONS.find(
      (s) => v >= s.verseStart && v <= s.verseEnd,
    );
    if (section) return section;
  }

  return null;
}

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
