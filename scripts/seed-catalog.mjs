#!/usr/bin/env node
// Seeds src/data/catalog.json with Psalm-titled tracks from a list of artists.
//
// Usage:
//   set SPOTIFY_CLIENT_SECRET=...   (PowerShell: $env:SPOTIFY_CLIENT_SECRET="...")
//   node scripts/seed-catalog.mjs
//
// SPOTIFY_CLIENT_ID is read from app.json (extra.SPOTIFY_CLIENT_ID) or env.
// SPOTIFY_CLIENT_SECRET must be in env. Get it from your Spotify Developer
// dashboard → app → "View client secret".
//
// The script preserves existing catalog entries (matched by id). New entries
// from Spotify get auto-generated ids of the form "<artist-slug>-<psalm>-<trackid>".

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const CATALOG_PATH = join(ROOT, 'src', 'data', 'catalog.json');
const APP_JSON = join(ROOT, 'app.json');

// Edit this list to control who gets seeded.
const ARTISTS = [
  'Shane & Shane',
  'Wendell Kimbrough',
  'The Corner Room',
  'Sons of Korah',
  'Sandra McCracken',
  'The Psalms Project',
  'My Soul Among Lions',
  'Cardiphonia',
  'Indelible Grace Music',
];

const PSALM_RE = /\bPsalm\s+(\d{1,3})\b/i;

function readClientId() {
  if (process.env.SPOTIFY_CLIENT_ID) return process.env.SPOTIFY_CLIENT_ID;
  const cfg = JSON.parse(readFileSync(APP_JSON, 'utf8'));
  return cfg?.expo?.extra?.SPOTIFY_CLIENT_ID;
}

function slug(s) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 12);
}

async function getAppToken(clientId, clientSecret) {
  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization:
        'Basic ' +
        Buffer.from(`${clientId}:${clientSecret}`).toString('base64'),
    },
    body: 'grant_type=client_credentials',
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Token request failed (${res.status}): ${text}`);
  }
  const j = await res.json();
  return j.access_token;
}

// If Spotify returns Retry-After greater than this many seconds, abort
// rather than sleep — a multi-hour wait means our app's daily quota is
// exhausted and we should stop.
const MAX_RETRY_AFTER_SEC = 60;

class RateLimitedError extends Error {
  constructor(retryAfter) {
    super(`Rate limited; Spotify says retry after ${retryAfter}s`);
    this.retryAfter = retryAfter;
  }
}

async function api(token, path) {
  const url = path.startsWith('http')
    ? path
    : `https://api.spotify.com/v1${path}`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 15000);
  let res;
  try {
    res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      signal: ctrl.signal,
    });
  } finally {
    clearTimeout(timer);
  }
  if (res.status === 429) {
    const retry = parseInt(res.headers.get('retry-after') ?? '2', 10);
    if (retry > MAX_RETRY_AFTER_SEC) {
      throw new RateLimitedError(retry);
    }
    await new Promise((r) => setTimeout(r, (retry + 1) * 1000));
    return api(token, path);
  }
  if (!res.ok) {
    throw new Error(`Spotify ${res.status} on ${path}: ${await res.text()}`);
  }
  return res.json();
}

async function findArtistId(token, name) {
  const q = encodeURIComponent(`artist:"${name}"`);
  const j = await api(token, `/search?q=${q}&type=artist&limit=10`);
  const items = j.artists?.items ?? [];
  const lower = name.toLowerCase();
  return (
    items.find((a) => a.name.toLowerCase() === lower)?.id ??
    items[0]?.id ??
    null
  );
}

async function paged(token, path) {
  let url = path;
  const out = [];
  while (url) {
    console.log(`    fetching ${url}…`);
    const j = await api(token, url);
    out.push(...(j.items ?? []));
    url = j.next ?? null;
  }
  return out;
}

async function getArtistAlbums(token, artistId) {
  // Spotify quirk: passing include_groups + limit together returns
  // 400 "Invalid limit". Omit limit; default page size + next-link
  // pagination via paged() still walks the full discography.
  const qs = new URLSearchParams({ include_groups: 'album,single' });
  return paged(token, `/artists/${artistId}/albums?${qs}`);
}

async function getAlbumTracks(token, albumId) {
  const qs = new URLSearchParams({ limit: '50' });
  return paged(token, `/albums/${albumId}/tracks?${qs}`);
}

function isVocalPsalmTrack(track) {
  if (!track || !track.name) return null;
  const name = track.name;
  if (/instrumental/i.test(name)) return null;
  if (/karaoke|accompaniment|piano version|guitar version/i.test(name))
    return null;
  const m = name.match(PSALM_RE);
  if (!m) return null;
  const n = parseInt(m[1], 10);
  if (n < 1 || n > 150) return null;
  return n;
}

async function collectArtist(token, artistName) {
  console.log(`  looking up artist ID for "${artistName}"…`);
  const artistId = await findArtistId(token, artistName);
  console.log(`    found artist ID: ${artistId ?? 'none'}`);
  if (!artistId) {
    console.warn(`  ⚠  artist not found: ${artistName}`);
    return [];
  }
  console.log(`  fetching albums for artist ID ${artistId}…`);
  const albums = await getArtistAlbums(token, artistId);
  console.log(`    (${albums.length} albums to scan)`);
  const seen = new Set();
  const found = [];
  let scanned = 0;
  for (const album of albums) {
    if (seen.has(album.id)) continue;
    seen.add(album.id);
    scanned += 1;
    let tracks;
    try {
      tracks = await getAlbumTracks(token, album.id);
    } catch (e) {
      console.warn(`    ⚠  album ${album.name}: ${e.message ?? e}`);
      continue;
    }
    if (scanned % 10 === 0) {
      console.log(`    scanned ${scanned}/${albums.length} albums…`);
    }
    for (const t of tracks) {
      const psalm = isVocalPsalmTrack(t);
      if (psalm == null) continue;
      const isOurArtist = t.artists?.some(
        (a) => a.name.toLowerCase() === artistName.toLowerCase(),
      );
      if (!isOurArtist) continue;
      found.push({
        psalm,
        track: t,
        album,
        artist: artistName,
      });
    }
  }
  return found;
}

function buildEntry({ psalm, track, album, artist }) {
  const id = `${slug(artist)}-${String(psalm).padStart(3, '0')}-${track.id.slice(0, 6)}`;
  return {
    id,
    psalm,
    title: track.name,
    artist,
    album: album?.name,
    spotifyUrl: `https://open.spotify.com/track/${track.id}`,
  };
}

function dedupeByPsalmArtistTrack(found) {
  const byKey = new Map();
  for (const f of found) {
    const key = `${f.psalm}|${f.artist.toLowerCase()}|${f.track.name.toLowerCase().replace(/\s+/g, ' ').trim()}`;
    if (!byKey.has(key)) byKey.set(key, f);
  }
  return Array.from(byKey.values());
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
  const songs = Array.from(byId.values()).sort(
    (a, b) =>
      a.psalm - b.psalm ||
      a.artist.localeCompare(b.artist) ||
      a.title.localeCompare(b.title),
  );
  return { songs, added };
}

async function main() {
  const clientId = readClientId();
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  // Optional CLI args: artist names to scan. e.g.
  //   node scripts/seed-catalog.mjs "Shane & Shane"
  // Falls back to ARTISTS if none given.
  const cliArtists = process.argv.slice(2).filter(Boolean);
  const artists = cliArtists.length > 0 ? cliArtists : ARTISTS;
  if (!clientId) {
    console.error('Missing SPOTIFY_CLIENT_ID (env or app.json extra)');
    process.exit(1);
  }
  if (!clientSecret) {
    console.error(
      'Missing SPOTIFY_CLIENT_SECRET. Get it from your Spotify Developer\n' +
      'dashboard → app → "View client secret", then run e.g.\n' +
      '  PowerShell:  $env:SPOTIFY_CLIENT_SECRET="xxx"; node scripts/seed-catalog.mjs',
    );
    process.exit(1);
  }

  console.log('Fetching app token…');
  const token = await getAppToken(clientId, clientSecret);

  let totalAdded = 0;
  let totalSongs = 0;
  let coveredPsalms = 0;
  let rateLimited = null;

  for (const artist of artists) {
    console.log(`Scanning ${artist}…`);
    let found;
    try {
      found = await collectArtist(token, artist);
      console.log(`  → ${found.length} Psalm-titled tracks`);
    } catch (e) {
      if (e instanceof RateLimitedError) {
        rateLimited = e;
        console.warn(
          `  ⛔  ${artist}: ${e.message} — stopping; partial results saved.`,
        );
        break;
      }
      console.warn(`  ⚠  ${artist}: ${e.message ?? e}`);
      continue;
    }

    // Persist after each artist so partial progress survives crashes/limits.
    const fresh = dedupeByPsalmArtistTrack(found).map(buildEntry);
    const existing = JSON.parse(readFileSync(CATALOG_PATH, 'utf8'));
    const merged = mergeIntoCatalog(existing, fresh);
    writeFileSync(
      CATALOG_PATH,
      JSON.stringify({ songs: merged.songs }, null, 2) + '\n',
    );
    totalAdded += merged.added;
    totalSongs = merged.songs.length;
    coveredPsalms = new Set(merged.songs.map((s) => s.psalm)).size;
    console.log(
      `  ✔  catalog now ${totalSongs} songs (+${merged.added} this artist) — ${coveredPsalms}/150 Psalms covered`,
    );
  }

  console.log(
    `\nDone. ${totalSongs} songs (${totalAdded} new) — ${coveredPsalms}/150 Psalms.`,
  );
  if (rateLimited) {
    const hrs = Math.round(rateLimited.retryAfter / 3600);
    console.log(
      `\n⛔  Spotify rate-limited the app — try again in ~${hrs} hour(s).`,
    );
    process.exit(2);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
