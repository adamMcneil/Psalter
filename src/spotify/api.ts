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
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  let body: any = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }
  if (!res.ok) {
    const msg = body?.error?.message ?? res.statusText ?? `HTTP ${res.status}`;
    if (typeof console !== 'undefined') {
      console.warn(`[Spotify] ${init.method ?? 'GET'} ${path} → ${res.status}`, body);
    }
    throw new SpotifyApiError(res.status, `Spotify API ${res.status}: ${msg}`, body);
  }
  return body as T;
}

export interface ApiTrack {
  id: string;
  uri: string;
  name: string;
  artists: { id: string; name: string }[];
  album: { id: string; name: string; images: { url: string }[] };
  duration_ms: number;
  preview_url: string | null;
  external_urls: { spotify?: string };
}

export const spotifyApi = (getToken: GetToken) => ({
  getTracks: (ids: string[]): Promise<{ tracks: (ApiTrack | null)[] }> => {
    if (ids.length === 0) return Promise.resolve({ tracks: [] });
    return request(getToken, `/tracks?ids=${ids.join(',')}`);
  },

  searchArtist: (q: string) =>
    request<{
      artists: {
        items: Array<{
          id: string;
          name: string;
          images: { url: string; width?: number; height?: number }[];
        }>;
      };
    }>(
      getToken,
      `/search?type=artist&limit=1&q=${encodeURIComponent(q)}`,
    ),
});
