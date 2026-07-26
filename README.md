# Psalter

A progressive web app for singing the Psalms: all 150 psalms, ~1,200 songs
from artists who set them to music, searchable and playable in any browser.

**Live:** deployed to GitHub Pages by `.github/workflows/deploy.yml` on every
push to `main`.

## How playback works

Playback is the reason this app was remade, so the design is explicit:

1. **Previews (default, works everywhere).** Every song plays a 30-second
   MP3 preview through a plain HTML5 `<audio>` element — no DRM, no login, no
   SDK. Preview URLs are harvested at build time from Spotify's public embed
   pages into `src/data/previews.json` (1,186 of 1,195 tracks have one).
   Queues auto-advance, shuffle, seek, and integrate with the OS media
   controls (Media Session API). This is the engine that works in Brave,
   Firefox, Safari, and anything else.

2. **Full tracks (optional enhancement).** Signed in with Spotify Premium in
   a browser that passes a Widevine EME probe (`src/spotify/eme.ts`), the app
   streams full tracks through the Spotify Web Playback SDK, keeping the
   previous app's hardening: single-flight token refresh, bounded
   auth-error recovery, and a stall watchdog. Any failure falls back to
   previews automatically.

   Brave disables Widevine by default (`brave://settings/extensions`), and
   the Web API's `preview_url` was deprecated by Spotify in late 2024 — which
   is why the old app's playback was broken there. The remake never depends
   on either: previews are the baseline, full tracks are a bonus.

3. **Open in Spotify.** Every song page links out for full-length listening
   without Premium/DRM.

## Stack

- [Vite](https://vitejs.dev) + React 19 + TypeScript, plain CSS
  (`src/styles.css` holds the design system).
- `react-router-dom` with the same URL scheme as before
  (`/psalm/23`, `/song/:id`, `/artist/:name`, `/coverage`, …).
- [`vite-plugin-pwa`](https://vite-pwa-org.netlify.app/) (Workbox):
  precached app shell (works offline), runtime cache-first for album art and
  preview audio (with range-request support), auto-updating service worker,
  installable with maskable icons.
- Vitest for unit + component tests (`npm test`).

## Develop

```sh
npm install
npm run dev        # http://localhost:2222
npm test           # vitest
npm run typecheck  # tsc --noEmit
npm run build      # production build into dist/ (BASE_URL=/subpath/ to match Pages)
npm run preview    # serve the production build
```

## Data pipeline (all output is committed)

```sh
npm run seed       # scripts/seed-from-embeds.mjs → src/data/catalog.json
                   #   scrapes Spotify album/playlist embeds listed in SOURCES
npm run previews   # scripts/fetch-previews.mjs → src/data/previews.json
                   #   harvests preview MP3 urls for every catalog track
                   #   (resumable; --all re-fetches everything)
npm run icons      # scripts/make-icons.mjs → public/icons/*.png (needs sharp)
```

After adding sources to `SOURCES` in `seed-from-embeds.mjs`, run `seed` then
`previews` and commit the JSON.

## Spotify app configuration

The OAuth client id ships in `src/spotify/config.ts` (PKCE flow — it is
public by design) and can be overridden with `VITE_SPOTIFY_CLIENT_ID` at
build time. The redirect URI `<origin><base>/spotify-auth` (e.g.
`https://<user>.github.io/Psalter/spotify-auth` and
`http://localhost:2222/spotify-auth` for dev) must be registered in the
Spotify developer dashboard.
