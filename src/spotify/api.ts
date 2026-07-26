import { tokenManager } from './spotifyAuth';

const BASE = 'https://api.spotify.com/v1';

export type GetToken = () => Promise<string | null>;

export class SpotifyApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly body?: unknown,
  ) {
    super(message);
    this.name = 'SpotifyApiError';
  }
}

async function request<T>(
  getToken: GetToken,
  path: string,
  init: RequestInit = {},
  retried = false,
): Promise<T> {
  const token = await getToken();
  if (!token) throw new Error('Not authenticated with Spotify.');
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      ...(init.headers ?? {}),
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });
  // The token was rejected (revoked / scope change / clock skew). Force one
  // refresh and retry once; getToken() then returns the freshly-minted token.
  if (res.status === 401 && !retried) {
    const refreshed = await tokenManager.forceRefresh().catch(() => null);
    if (refreshed) return request<T>(getToken, path, init, true);
  }
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  let body: unknown = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }
  if (!res.ok) {
    const msg =
      (body as { error?: { message?: string } } | null)?.error?.message ??
      res.statusText ??
      `HTTP ${res.status}`;
    console.warn(`[Spotify] ${init.method ?? 'GET'} ${path} → ${res.status}`, body);
    throw new SpotifyApiError(res.status, `Spotify API ${res.status}: ${msg}`, body);
  }
  return body as T;
}

export const spotifyApi = (getToken: GetToken) => ({
  searchArtist: (q: string) =>
    request<{
      artists: {
        items: Array<{
          id: string;
          name: string;
          images: { url: string; width?: number; height?: number }[];
        }>;
      };
    }>(getToken, `/search?type=artist&limit=1&q=${encodeURIComponent(q)}`),

  play: (
    deviceId: string,
    body: { uris: string[]; position_ms?: number },
  ): Promise<void> =>
    request<void>(getToken, `/me/player/play?device_id=${deviceId}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    }),
});
