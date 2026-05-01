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
  'Poor Bishop Hooper',
  'Shane & Shane',
  'Wendell Kimbrough',
  'The Corner Room',
  'Sons of Korah',
  'Sandra McCracken',
  'The Psalms Project',
  'My Soul Among Lions',
  'Cardiphonia',
  'Indelible Grace Music',
  'Streetlights',
  'Caroline Cobb',
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

async function api(token, path) {
  const url = path.startsWith('http')
    ? path
    : `https://api.spotify.com/v1${path}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.status === 429) {
    const retry = parseInt(res.headers.get('retry-after') ?? '2', 10);
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
    const j = await api(token, url);
    out.push(...(j.items ?? []));
    url = j.next ?? null;
  }
  return out;
}

async function getArtistAlbums(token, artistId) {
  return paged(
    token,
    `/artists/${artistId}/albums?include_groups=album,single&limit=50`,
  );
}

async function getAlbumTracks(token, albumId) {
  return paged(token, `/albums/${albumId}/tracks?limit=50`);
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
  const artistId = await findArtistId(token, artistName);
  if (!artistId) {
    console.warn(`  ⚠  artist not found: ${artistName}`);
    return [];
  }
  const albums = await getArtistAlbums(token, artistId);
  const seen = new Set();
  const found = [];
  for (const album of albums) {
    if (seen.has(album.id)) continue;
    seen.add(album.id);
    const tracks = await getAlbumTracks(token, album.id);
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

  const allFound = [];
  for (const artist of ARTISTS) {
    console.log(`Scanning ${artist}…`);
    try {
      const found = await collectArtist(token, artist);
      console.log(`  → ${found.length} Psalm-titled tracks`);
      allFound.push(...found);
    } catch (e) {
      console.warn(`  ⚠  ${artist}: ${e.message ?? e}`);
    }
  }

  const deduped = dedupeByPsalmArtistTrack(allFound);
  const fresh = deduped.map(buildEntry);

  const existing = JSON.parse(readFileSync(CATALOG_PATH, 'utf8'));
  const merged = mergeIntoCatalog(existing, fresh);

  writeFileSync(CATALOG_PATH, JSON.stringify({ songs: merged.songs }, null, 2) + '\n');

  const psalmsCovered = new Set(merged.songs.map((s) => s.psalm));
  console.log(
    `\nWrote ${merged.songs.length} songs (${merged.added} new) — covering ${psalmsCovered.size}/150 Psalms.`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
