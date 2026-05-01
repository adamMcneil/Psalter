#!/usr/bin/env node
// Builds src/data/catalog.json by scraping Spotify embed HTML pages.
// Zero auth, no Spotify API calls — just parses the public iframe pages.
//
// Usage:
//   node scripts/seed-from-embeds.mjs
//
// Edit the SOURCES array below to add Spotify playlist or album URLs.
// Each URL is converted to its embed equivalent, fetched, and the
// alternating "uri"/"title" JSON fields are paired up. Tracks whose title
// matches "Psalm N" become catalog entries. Existing entries (matched by
// id) are preserved.

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const CATALOG_PATH = join(ROOT, 'src', 'data', 'catalog.json');

// Each entry: { url, artist }. The artist is what gets stored in the
// catalog and is used for the id slug; we don't trust the embed's
// per-track subtitle since playlists can mix artists.
const SOURCES = [
  {
    url: 'https://open.spotify.com/playlist/4MUmKmfeLmfdGwO3j1eoYI',
    artist: 'Poor Bishop Hooper',
    album: 'EveryPsalm',
  },
  {
    url: 'https://open.spotify.com/album/7AVga88rqPT3HJbI9GPNxE',
    artist: 'My Soul Among Lions',
    album: 'Psalms 1-10',
  },
  {
    url: 'https://open.spotify.com/album/68sqZboiWSKZh4Hc5p2wSJ',
    artist: 'My Soul Among Lions',
    album: 'Psalms 11-20',
  },
  {
    url: 'https://open.spotify.com/album/0DmcuIULGbzZfvTCAXhqAq',
    artist: 'My Soul Among Lions',
    album: 'Song of the King: Psalms 21-30',
  },
  {
    url: 'https://open.spotify.com/album/4yYPJ5dAnpHHpSuuM4BwEC',
    artist: 'The Corner Room',
    album: 'Psalm Songs, Vol. 1',
  },
  {
    url: 'https://open.spotify.com/album/1s8v8YDwfWW6C1DTU7lWNm',
    artist: 'The Corner Room',
    album: 'Psalm Songs, Vol. 2',
  },
  {
    url: 'https://open.spotify.com/album/59YlrtdeCylPYUx3nySjpQ',
    artist: 'The Corner Room',
    album: 'Psalm Songs, Vol. 3',
  },
  {
    url: 'https://open.spotify.com/album/2txnSTlLVxNNcKXOtPPaNC',
    artist: 'Brian Sauvé',
    album: 'Sing Psalms, Let Joy Resound',
  },
  {
    url: 'https://open.spotify.com/album/11O32ryCROwtPulOI507kT',
    artist: 'Brian Sauvé',
    album: 'Psalm 37: He Fades Away',
  },
  {
    url: 'https://open.spotify.com/album/40TAbJ7suyjLqC4JUB4sRb',
    artist: 'Brian Sauvé',
    album: 'Even Dragons Shall Him Praise',
  },
  {
    url: 'https://open.spotify.com/album/2ddneuCWNq4qA5kcFQ9iYB',
    artist: 'Brian Sauvé',
    album: 'Awake the Dawn',
  },
  {
    url: 'https://open.spotify.com/album/5HVNaUhLBFltGFilZRrk37',
    artist: 'The Psalms Project',
    album: 'Vol. 1: Psalms 1-10',
  },
  {
    url: 'https://open.spotify.com/album/0p8djwXWV9uvNHdxiWGY0e',
    artist: 'The Psalms Project',
    album: 'Vol. 2: Psalms 11-20',
  },
  {
    url: 'https://open.spotify.com/album/2UcABwMV2pU68jIvvhCon4',
    artist: 'The Psalms Project',
    album: 'Vol. 3: Psalms 21-30',
  },
  {
    url: 'https://open.spotify.com/album/7vH54uv9YP6T4gl8LfqwHw',
    artist: 'The Psalms Project',
    album: 'Vol. 4: Psalms 31-38',
  },
  {
    url: 'https://open.spotify.com/album/4XVvUtbCWZIxLyIDpaoeDZ',
    artist: 'The Psalms Project',
    album: 'Vol. 5: Psalms 39-46',
  },
  {
    url: 'https://open.spotify.com/album/1S1d7AwlrKHFYIMmj8ENKZ',
    artist: 'The Psalms Project',
    album: 'Vol. 6: Psalms 47-55',
  },
  {
    url: 'https://open.spotify.com/album/70isKNwpXZtXdLbkSedL2X',
    artist: 'Exodus Music',
    album: 'Psalm 119, Vol. 1',
    psalmOverride: 119,
    titlePrefix: 'Psalm 119: ',
  },
  {
    url: 'https://open.spotify.com/album/7c63ZBFiPQdPaSflsUOXsR',
    artist: 'Exodus Music',
    album: 'Psalm 119, Vol. 2',
    psalmOverride: 119,
    titlePrefix: 'Psalm 119: ',
  },
  {
    url: 'https://open.spotify.com/album/4myjPLU0qhd4xUkM4XSsST',
    artist: 'Exodus Music',
    album: 'Psalm 119, Vol. 3',
    psalmOverride: 119,
    titlePrefix: 'Psalm 119: ',
  },
  {
    url: 'https://open.spotify.com/album/70jjH6qIewVs9B7UjZTHAL',
    artist: 'Cardiphonia Music',
    album: 'Psalm 119',
    psalmOverride: 119,
    titlePrefix: 'Psalm 119: ',
  },
  {
    url: 'https://open.spotify.com/album/7i9DsBj4P0ZSdF2rnK8UqT',
    artist: 'Cardiphonia Music',
    album: 'Hallel Psalms',
  },
  {
    url: 'https://open.spotify.com/album/0CQv1WwDy34JpPSdslsAkX',
    artist: 'Cardiphonia Music',
    album: 'The Songs of the Psalter, Vol. 5.1',
  },
  {
    url: 'https://open.spotify.com/album/3VkNpwz8SRAij5yVdkpVsM',
    artist: 'Scripture Hymnal',
    album: 'Scripture Hymnal, Vol. 1',
  },
  {
    url: 'https://open.spotify.com/album/3RkaqgPBP3XoyiTVqgT1u2',
    artist: 'Scripture Hymnal',
    album: 'Scripture Hymnal, Vol. 2',
  },
  {
    url: 'https://open.spotify.com/album/1AOjikQ4lazNXn9A5LE1TO',
    artist: 'Scripture Hymnal',
    album: 'Scripture Hymnal EP',
  },
  {
    url: 'https://open.spotify.com/album/0JNwWl1jD9fvbaMb4BnAvg',
    artist: 'The Verses Project',
    album: 'Psalm 139',
  },
  {
    url: 'https://open.spotify.com/album/6PrHJNopwXS4w5aWdkMleM',
    artist: 'The Verses Project',
    album: 'Psalm 91',
  },
  {
    url: 'https://open.spotify.com/album/3NTzlr6c294C4HmGp5W6i3',
    artist: 'Liturgical Folk',
    album: 'Psalm Settings',
  },
  {
    url: 'https://open.spotify.com/album/7c1lrrTYnvqugBkp7pWoJL',
    artist: 'Joe Stout',
    album: 'Blest Is the Man Who Does Not Walk (Psalm 1)',
  },
  {
    url: 'https://open.spotify.com/album/29I7yJwkpxzPzE6ATBN9Zc',
    artist: 'Joe Stout',
    album: 'In Anger LORD, Rebuke Me Not (Psalm 6)',
  },
  {
    url: 'https://open.spotify.com/album/6kCGiWhb5Z2n92kwejGKcH',
    artist: 'Joe Stout',
    album: 'LORD, Our Lord, In All the Earth (Psalm 8)',
  },
  {
    url: 'https://open.spotify.com/album/2R8rb08LRfc5vSodyJklwH',
    artist: 'Brother Down',
    album: 'Old Paths New Feet',
  },
  {
    url: 'https://open.spotify.com/album/5VUcWWkxHniJ4yqtoNBTjS',
    artist: 'Brother Down',
    album: 'Old Paths New Feet (alt)',
  },
  {
    url: 'https://open.spotify.com/album/3tq4c23SfCWn8YYDKsXXNu',
    artist: 'Sandra McCracken',
    album: 'Psalms',
  },
  {
    url: 'https://open.spotify.com/album/3PqHK6bD9A8Wuo7kRAXNfU',
    artist: 'Coram Deo Church',
    album: 'Psalms',
  },
  {
    url: 'https://open.spotify.com/album/1bbqw1yjUv65tu6nuSZESx',
    artist: 'Coram Deo Church',
    album: 'Songs for the Sojourn, Volume 2',
  },
  {
    url: 'https://open.spotify.com/album/4WsURPoVBeTy3grMlyXPDC',
    artist: 'Coram Deo Church',
    album: 'Doxology',
  },
];

const PSALM_RE = /\bPsalm\s+(\d{1,3})\b/i;
const URI_RE = /"uri":"spotify:track:([A-Za-z0-9]{22})"/g;
const TITLE_RE = /"title":"((?:[^"\\]|\\.)*)"/g;

function toEmbedUrl(spotifyUrl) {
  const m = spotifyUrl.match(/open\.spotify\.com\/(playlist|album|track)\/([A-Za-z0-9]+)/);
  if (!m) throw new Error(`Not a recognised Spotify URL: ${spotifyUrl}`);
  return `https://open.spotify.com/embed/${m[1]}/${m[2]}`;
}

function slug(s) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 12);
}

function unescapeJson(s) {
  // Minimal JSON string unescape for \", \\, \n, \uXXXX
  return s.replace(/\\(["\\/bfnrt])|\\u([0-9a-fA-F]{4})/g, (_, c, u) => {
    if (u) return String.fromCharCode(parseInt(u, 16));
    return { '"': '"', '\\': '\\', '/': '/', b: '\b', f: '\f', n: '\n', r: '\r', t: '\t' }[c];
  });
}

async function fetchEmbed(url) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 30000);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.text();
  } finally {
    clearTimeout(timer);
  }
}

function parseTracks(html) {
  // The embed renders an alternating stream of "uri" then "title" entries
  // for each track. We collect both arrays in document order and pair them.
  const uris = [];
  let m;
  URI_RE.lastIndex = 0;
  while ((m = URI_RE.exec(html))) uris.push(m[1]);

  const titles = [];
  TITLE_RE.lastIndex = 0;
  while ((m = TITLE_RE.exec(html))) titles.push(unescapeJson(m[1]));

  // First "title" is the playlist/album title — drop it.
  if (titles.length > uris.length) titles.shift();

  const tracks = [];
  for (let i = 0; i < Math.min(uris.length, titles.length); i++) {
    tracks.push({ id: uris[i], title: titles[i] });
  }
  return tracks;
}

function isVocalPsalmTrack(title) {
  if (!title) return null;
  if (/instrumental/i.test(title)) return null;
  if (/karaoke|accompaniment|piano version|guitar version/i.test(title))
    return null;
  const m = title.match(PSALM_RE);
  if (!m) return null;
  const n = parseInt(m[1], 10);
  if (n < 1 || n > 150) return null;
  return n;
}

// Some sources (e.g. an album that's all of Psalm 119 split by Hebrew
// letter) don't have "Psalm N" in track titles. The source config can set
// psalmOverride to force-tag every track in the source with that psalm.
function shouldKeepTrackForSource(track, source) {
  if (!track || !track.title) return null;
  if (/instrumental/i.test(track.title)) return null;
  if (/karaoke|accompaniment|piano version|guitar version/i.test(track.title))
    return null;
  if (typeof source.psalmOverride === 'number') {
    return source.psalmOverride;
  }
  return isVocalPsalmTrack(track.title);
}

function buildEntry({ track, psalm, artist, album }) {
  const id = `${slug(artist)}-${String(psalm).padStart(3, '0')}-${track.id.slice(0, 6)}`;
  return {
    id,
    psalm,
    title: track.title,
    artist,
    album,
    spotifyUrl: `https://open.spotify.com/track/${track.id}`,
  };
}

function dedupeBySpotifyUrl(songs) {
  // When two entries point to the same Spotify track, prefer the one
  // with the shorter id (typically the hand-curated "pbh-001" form)
  // over the auto-generated "poor-bishop--001-1ipqa2" form.
  const byUrl = new Map();
  let removed = 0;
  for (const s of songs) {
    if (!s.spotifyUrl) {
      byUrl.set(`__no-url__${s.id}`, s);
      continue;
    }
    const existing = byUrl.get(s.spotifyUrl);
    if (!existing) {
      byUrl.set(s.spotifyUrl, s);
      continue;
    }
    removed += 1;
    if (s.id.length < existing.id.length) byUrl.set(s.spotifyUrl, s);
  }
  return { songs: Array.from(byUrl.values()), removed };
}

function mergeIntoCatalog(existing, freshEntries) {
  const byId = new Map();
  for (const s of existing.songs) byId.set(s.id, s);
  let added = 0;
  for (const entry of freshEntries) {
    if (!byId.has(entry.id)) {
      byId.set(entry.id, entry);
      added += 1;
    }
  }
  const all = Array.from(byId.values());
  const { songs: deduped, removed } = dedupeBySpotifyUrl(all);
  deduped.sort(
    (a, b) =>
      a.psalm - b.psalm ||
      a.artist.localeCompare(b.artist) ||
      a.title.localeCompare(b.title),
  );
  return { songs: deduped, added, removed };
}

async function main() {
  const allEntries = [];
  for (const src of SOURCES) {
    const embed = toEmbedUrl(src.url);
    console.log(`Fetching ${embed}…`);
    let html;
    try {
      html = await fetchEmbed(embed);
    } catch (e) {
      console.warn(`  ⚠  ${src.url}: ${e.message ?? e}`);
      continue;
    }
    const tracks = parseTracks(html);
    console.log(`  parsed ${tracks.length} tracks`);
    let kept = 0;
    for (const t of tracks) {
      const psalm = shouldKeepTrackForSource(t, src);
      if (psalm == null) continue;
      const titled = src.titlePrefix
        ? { ...t, title: `${src.titlePrefix}${t.title}` }
        : t;
      allEntries.push(
        buildEntry({ track: titled, psalm, artist: src.artist, album: src.album }),
      );
      kept += 1;
    }
    console.log(`  → ${kept} Psalm-titled tracks`);
  }

  const existing = JSON.parse(readFileSync(CATALOG_PATH, 'utf8'));
  const merged = mergeIntoCatalog(existing, allEntries);
  writeFileSync(
    CATALOG_PATH,
    JSON.stringify({ songs: merged.songs }, null, 2) + '\n',
  );
  const psalmsCovered = new Set(merged.songs.map((s) => s.psalm)).size;
  console.log(
    `\nWrote ${merged.songs.length} songs (+${merged.added} new, -${merged.removed} dupes) — ${psalmsCovered}/150 Psalms covered.`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
