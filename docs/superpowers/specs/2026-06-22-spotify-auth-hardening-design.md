# Spotify Auth Hardening — Design

- **Date:** 2026-06-22
- **Status:** Approved (ready for implementation plan)
- **Scope:** `src/spotify/*`, `app/spotify-auth.tsx`
- **Approach:** Client-side hardening only (Approach B). No backend, no deploy-pipeline change.

## Summary

The app's Spotify integration already uses the flow Spotify recommends —
**Authorization Code with PKCE**, public client (client ID only, no secret) — via
`expo-auth-session`. The *flow* is correct; this work hardens the **edges** around
it: refresh-error handling, refresh concurrency, the web redirect handshake, the
API 401 path, and testability. No user-visible feature changes; existing signed-in
users keep their session.

## Background — current state

Stack: Expo ~54 / React Native 0.81 with `react-native-web`, expo-router. Targets
iOS, Android, and **Web (PWA)**. The web build is a **static export**
(`npx expo export --platform web`) deployed to **GitHub Pages** from the `/Psalter`
subpath (`.github/workflows/deploy.yml`). There is **no backend**.

Spotify client ID is public and embedded in `app.config.js`
(`750204e46dfa414988d5776ad9196988`). Scopes: `streaming`, `user-read-email`,
`user-read-private`, `user-modify-playback-state`.

Current auth files:

- `src/spotify/config.ts` — reads client ID, scopes, discovery endpoints.
- `src/spotify/auth.ts` — PKCE request build, token exchange, refresh, web
  begin/complete redirect, `getRedirectUri`.
- `src/spotify/AuthContext.tsx` — React provider; holds tokens in state, startup
  hydrate+refresh, `getAccessToken` with a single-flight guard, login/logout.
- `src/spotify/tokens.ts` — persistence (SecureStore native / localStorage web).
- `src/spotify/api.ts` — REST client; `getToken()` once per call, no 401 retry.
- `src/spotify/WebPlayerContext.tsx` — Web Playback SDK; `getOAuthToken` already
  wraps `getAccessToken` with a 5s timeout + last-known-token fallback.
- `app/spotify-auth.tsx` — web OAuth callback screen.

### What already matches Spotify's docs (kept unchanged)

Verified against Spotify's *Authorization Code with PKCE* and *Refreshing tokens*
tutorials:

- Authorization Code + PKCE, public client, `code_challenge_method=S256`, `state`
  for CSRF.
- Token exchange and refresh bodies correct: `client_id` in the body, **no client
  secret** for the PKCE/public-client case.
- Refresh-token **rotation** handled: `refreshToken: json.refresh_token ?? refreshToken`
  — matches Spotify's "when a refresh token is not returned, continue using the
  existing token."

## Findings being fixed

1. **Refresh failures are too aggressive.** `AuthContext.tsx:93,125` clears tokens
   and signs the user out on *any* refresh failure — including a transient network
   blip, `429`, or `5xx`. Spotify says discard the refresh token **only on
   `invalid_grant`**; otherwise keep it. This is the primary correctness bug.
2. **Concurrent refresh can double-spend a rotating refresh token.** The startup
   effect (`AuthContext.tsx:88`) calls `refreshAccessToken` directly, bypassing the
   single-flight guard used by `getAccessToken` (`:114`). Two overlapping refreshes
   can invalidate each other under rotation.
3. **OAuth params left in the URL after the web redirect.** `code`/`state` are not
   stripped, so a refresh/back re-runs a single-use code (error flash) and the code
   lingers in browser history. Needs `history.replaceState` + idempotent consume.
4. **No 401 refresh-and-retry in the API client** (`api.ts:16`). A server-rejected
   token just throws; each call site copes differently.
5. **PKCE verifier/state stored in `localStorage`** (`auth.ts:104`) — single-
   transaction secrets that belong in `sessionStorage`.
6. **Stringly-typed errors** prevent callers from branching, blocking #1 and #4.
7. **Token logic is entangled with React**, so the security-critical paths are hard
   to unit-test.

## Decisions (locked)

- Keep Authorization Code + PKCE via `expo-auth-session`. No backend. No new
  dependencies. No change to scopes, config, or the deploy pipeline.
- Token storage key stays `psalter.spotify.tokens.v1` → **no forced re-login**.
- Pull the security-critical logic out of React into a framework-agnostic,
  dependency-injected core so it can be unit-tested with the existing
  `node --test` / `.mts` setup.

## Design

### Module map (before → after)

| File | Change | Responsibility |
|---|---|---|
| `src/spotify/errors.ts` | **new** | `SpotifyAuthError { kind }` + classifier reading Spotify `{ error }` bodies |
| `src/spotify/tokenClient.ts` | **new** | Stateless `/api/token` calls (exchange + refresh) + pure transforms |
| `src/spotify/tokenManager.ts` | **new** | Source of truth: in-memory tokens, single-flight refresh, classification, `subscribe()` |
| `src/spotify/tokens.ts` | refactor | Persistence only; adds a `sessionStorage` pending store |
| `src/spotify/auth.ts` | refactor | OAuth *flow* orchestration only (redirect URI, begin/complete web redirect, native prompt) |
| `src/spotify/AuthContext.tsx` | slim | Thin React shell subscribing to `tokenManager` |
| `src/spotify/api.ts` | edit | 401 → refresh once → retry once |
| `src/spotify/WebPlayerContext.tsx` | minimal | Point `getOAuthToken` at the manager; keep tuned playback logic |
| `app/spotify-auth.tsx` | minimal | Same flow, now idempotent |

Three new small single-purpose files; everything else is a refactor.

### `errors.ts`

```ts
export type SpotifyAuthErrorKind =
  | 'config'        // client ID missing
  | 'network'       // fetch threw / offline — transient
  | 'http'          // 5xx / 429 — transient
  | 'invalid_grant' // refresh token dead — permanent, sign out
  | 'oauth'         // authorize-side error param
  | 'state_mismatch'
  | 'no_pending';

export class SpotifyAuthError extends Error {
  constructor(readonly kind: SpotifyAuthErrorKind, message: string, readonly status?: number) { ... }
  get retryable(): boolean { return this.kind === 'network' || this.kind === 'http'; }
}

// Classify a failed /api/token response (status + parsed body) into a kind.
export function classifyTokenError(status: number, body: unknown): SpotifyAuthError;
```

`invalid_grant` is detected from Spotify's `{ "error": "invalid_grant" }` body
(typically HTTP 400). `429`/`5xx` → `http` (retryable). A thrown fetch → `network`.

### `tokenClient.ts` (stateless network + pure transforms)

```ts
exchangeCode({ code, codeVerifier, redirectUri }): Promise<StoredTokens>
refresh({ refreshToken }): Promise<StoredTokens>
```

- Build the documented bodies (`grant_type`, `client_id`, etc.), POST to
  `SPOTIFY_DISCOVERY.tokenEndpoint`, throw `SpotifyAuthError` via `classifyTokenError`
  on non-2xx.
- Pure helpers (exported for tests): `toStoredTokens(resp, prev?)` applies the
  rotation merge (keep `prev.refreshToken` when none returned) and computes
  `expiresAt = now() + expires_in*1000`. `now` is injectable.
- No storage side effects — network only.

### `tokenManager.ts` (the core)

`createTokenManager({ store, client, now })` returns:

- `hydrate(): Promise<void>` — load tokens from `store`; if within leeway, refresh.
- `getValidAccessToken(): Promise<string | null>` — return access token; if within
  the 60s leeway, refresh. **Single-flight**: all concurrent callers (startup, API,
  Web Playback SDK) await one shared in-flight refresh. Fixes findings #1 and #2.
- `forceRefresh(): Promise<StoredTokens | null>` — used by the api.ts 401 path;
  also single-flight (shares the same in-flight promise).
- `set(tokens): Promise<void>` — store freshly-exchanged login tokens, update
  memory, notify subscribers (called by the login flows after `exchangeCode`).
- `clear(): Promise<void>` — wipe store + memory, notify subscribers.
- `subscribe(cb: (t: StoredTokens | null) => void): () => void` — so a refresh
  triggered outside React still propagates to the UI and re-arms the player.

Refresh outcome handling:

- Success → save to store, update memory, notify.
- `SpotifyAuthError` with `kind === 'invalid_grant'` → **clear + notify** (sign out).
- Retryable (`network`/`http`) → **keep tokens**, rethrow; `getValidAccessToken`
  returns the existing (possibly still-valid) access token if present, else rethrows.

App wiring: a singleton `tokenManager` built with the real `tokens` store,
`tokenClient`, and `() => Date.now()`. Tests build their own with fakes.

### `auth.ts` (flow orchestration only)

- `getRedirectUri()` — unchanged (web origin+baseUrl+`/spotify-auth`; native scheme).
- `beginWebRedirectLogin(returnTo)` — build PKCE `AuthRequest`, stash
  `{ codeVerifier, state, returnTo }` in **`sessionStorage`** (via `tokens.ts`),
  `window.location.assign(authUrl)`.
- `completeWebRedirectLogin()` — **idempotent**: read `code`/`state`/`error` from the
  URL, immediately strip them with `history.replaceState`, validate `state` vs the
  pending value, then `tokenClient.exchangeCode` → `tokenManager.set`. Returns
  `{ consumed:false }` when there is nothing to consume (double-invoke / refresh).
- `nativeLogin()` — `promptAsync` + `exchangeCode` (today's native path).

### `api.ts` (401 retry)

`request()` gets a token from `tokenManager.getValidAccessToken()`. On `401`, call
`tokenManager.forceRefresh()` once and retry the request once with the new token; a
second `401` throws a typed auth error (the manager has already signed out if it was
`invalid_grant`). A `retried` flag prevents loops.

### `WebPlayerContext.tsx`

`getOAuthToken` calls `tokenManager.getValidAccessToken()` behind the existing 5s
timeout + last-known-token fallback. The `play()` 401/403 path routes through the
manager's classification. No changes to the stall watchdog, autoplay unlock, or
persistence logic.

## Data flow

- **Startup:** `AuthContext` mounts → `tokenManager.hydrate()` → (refresh if near
  expiry) → `fetchUser`.
- **Login (native):** `login()` → `nativeLogin()` → `promptAsync` → `exchangeCode` →
  `tokenManager.set` → `fetchUser`.
- **Login (web):** `login()` → `beginWebRedirectLogin()` (pending in `sessionStorage`)
  → full-page redirect → `/spotify-auth` → `completeWebRedirectLogin()` (strip URL,
  validate state, exchange) → `tokenManager.set` → `fetchUser` → route back to
  `returnTo`.
- **API call:** `spotifyApi.X()` → `getValidAccessToken()` → fetch → on 401,
  `forceRefresh` + one retry.
- **Web Playback SDK:** `getOAuthToken` → `getValidAccessToken()` (timeout-guarded).

## Testing

Pure / dependency-injected; runs under the existing `npm test`
(`node --experimental-strip-types --test "src/**/*.test.mts"`).

- `errors.test.mts` — `classifyTokenError`: `invalid_grant` vs `network` vs `http`.
- `tokenClient.test.mts` — request body construction; response→`StoredTokens`;
  rotation merge (keep old refresh token when none returned); expiry math with an
  injected clock.
- `tokenManager.test.mts` — single-flight (two concurrent `getValidAccessToken` →
  one `client.refresh` call); refresh within leeway; `invalid_grant` → cleared +
  subscriber notified of sign-out; transient error → tokens retained, signed in.
- Redirect consume idempotency — `completeWebRedirectLogin` with a faked
  `location`/`history`: strips params, second call is a no-op, `state` mismatch path.

## Security tradeoff (documented, not hidden)

On web the long-lived **refresh token lives in `localStorage`**, exposed to any XSS.
This is inherent to a no-backend SPA and is what Spotify's own SPA tutorial does.
Mitigations applied: PKCE verifier/state in `sessionStorage`, OAuth params stripped
from the URL, tokens never logged. The only complete fix is a server-side token
broker, which cannot run on GitHub Pages (static-only) and was ruled out for this
work. Native targets store tokens in `expo-secure-store` (Keychain/Keystore).

## Non-goals (YAGNI)

- No backend / token broker.
- No proactive 6-month reauth timer — graceful `invalid_grant` recovery covers
  refresh-token expiry.
- No change to scopes, client config, or the deploy pipeline.
- No rewrite of the tuned playback logic in `WebPlayerContext`.

## Migration & risk

- Storage key unchanged → existing sessions survive; no forced re-login.
- The pending-handshake store moves `localStorage` → `sessionStorage`; only affects a
  login already in flight during deploy — negligible.
- Behavior parity: login / logout / refresh / playback unchanged from the user's
  point of view, only more resilient.

## Acceptance criteria

1. A transient network error during refresh does **not** sign the user out; a real
   `invalid_grant` does, cleanly prompting re-auth.
2. Two concurrent token consumers trigger **one** refresh network call.
3. Reloading `/spotify-auth` after a successful login does not error or re-exchange;
   the URL has no `code`/`state`.
4. An API call that gets a `401` transparently refreshes and retries once.
5. `npm test` and `npm run typecheck` pass; new unit tests cover the four areas above.
6. Existing signed-in users are not logged out by the upgrade.
