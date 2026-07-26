#!/usr/bin/env node
// Builds src/data/previews.json: a map of Spotify track id -> 30s preview MP3
// hash, harvested from Spotify's public embed pages (open.spotify.com/embed).
//
// Why: the Web API stopped returning preview_url (deprecated Nov 2024) and the
// Web Playback SDK needs Widevine DRM, which some browsers (Brave by default)
// disable. The embed pages still expose a plain, DRM-free MP3 preview for each
// track at https://p.scdn.co/mp3-preview/<hash>. Fetching them at build time
// gives the app playback that works in any browser with zero auth.
//
// Usage:
//   node scripts/fetch-previews.mjs            # refresh missing entries only
//   node scripts/fetch-previews.mjs --all      # re-fetch every track
//
// The script is resumable: existing entries in previews.json are kept unless
// --all is passed, so reruns only fetch what's missing.

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const CATALOG_PATH = join(ROOT, 'src', 'data', 'catalog.json');
const OUT_PATH = join(ROOT, 'src', 'data', 'previews.json');

const CONCURRENCY = 4;
const MAX_RETRIES = 3;
const PREVIEW_HOST = 'https://p.scdn.co/mp3-preview/';
const TRACK_ID_RE = /\/track\/([A-Za-z0-9]{22})/;

function trackIdOf(song) {
  const m = (song.spotifyUrl ?? '').match(TRACK_ID_RE);
  return m ? m[1] : null;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchEmbedHtml(trackId, attempt = 0) {
  const url = `https://open.spotify.com/embed/track/${trackId}`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 30000);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (res.status === 429 || res.status >= 500) {
      throw new Error(`HTTP ${res.status}`);
    }
    if (!res.ok) return null; // 404 etc — track gone, not retryable
    return await res.text();
  } catch (e) {
    if (attempt < MAX_RETRIES) {
      await sleep(1000 * 2 ** attempt + Math.random() * 500);
      return fetchEmbedHtml(trackId, attempt + 1);
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

// The embed page carries a __NEXT_DATA__ JSON blob whose entity has
// audioPreview.url. A plain regex is enough and avoids depending on the
// exact JSON shape.
const PREVIEW_RE = /"audioPreview"\s*:\s*\{[^}]*?"url"\s*:\s*"https:\/\/p\.scdn\.co\/mp3-preview\/([a-f0-9]{40})[^"]*"/;

function parsePreviewHash(html) {
  const m = html.match(PREVIEW_RE);
  return m ? m[1] : null;
}

async function main() {
  const refetchAll = process.argv.includes('--all');
  const catalog = JSON.parse(readFileSync(CATALOG_PATH, 'utf8'));
  const ids = [...new Set(catalog.songs.map(trackIdOf).filter(Boolean))];

  let previews = {};
  if (!refetchAll && existsSync(OUT_PATH)) {
    try {
      previews = JSON.parse(readFileSync(OUT_PATH, 'utf8')).previews ?? {};
    } catch {
      previews = {};
    }
  }

  const todo = ids.filter((id) => !(id in previews));
  console.log(
    `${ids.length} tracks in catalog, ${ids.length - todo.length} already fetched, ${todo.length} to fetch`,
  );

  let done = 0;
  let found = 0;
  let missing = 0;
  let failed = 0;

  const queue = todo.slice();
  async function worker() {
    for (;;) {
      const id = queue.shift();
      if (!id) return;
      try {
        const html = await fetchEmbedHtml(id);
        const hash = html ? parsePreviewHash(html) : null;
        if (hash) {
          previews[id] = hash;
          found += 1;
        } else {
          // Record the miss so reruns don't re-fetch it; empty string = no preview.
          previews[id] = '';
          missing += 1;
        }
      } catch (e) {
        failed += 1;
        console.warn(`  ⚠ ${id}: ${e.message ?? e}`);
      }
      done += 1;
      if (done % 50 === 0) {
        console.log(`  …${done}/${todo.length} (${found} found, ${missing} without preview, ${failed} failed)`);
        persist();
      }
      await sleep(50 + Math.random() * 100);
    }
  }

  function persist() {
    const sorted = Object.fromEntries(
      Object.entries(previews).sort(([a], [b]) => a.localeCompare(b)),
    );
    writeFileSync(
      OUT_PATH,
      JSON.stringify({ version: 1, host: PREVIEW_HOST, previews: sorted }, null, 0) + '\n',
    );
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  persist();

  const total = Object.values(previews).filter(Boolean).length;
  const noPrev = Object.values(previews).filter((v) => v === '').length;
  console.log(
    `\nWrote ${OUT_PATH}: ${total} previews for ${ids.length} tracks (${noPrev} tracks have no preview, ${failed} fetch failures this run).`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
