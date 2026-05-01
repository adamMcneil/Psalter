const BASE = 'https://api.spotify.com/v1';

export type GetToken = () => Promise<string | null>;

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
  const body = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const msg = body?.error?.message ?? res.statusText;
    throw new Error(`Spotify API ${res.status}: ${msg}`);
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

export interface ApiPlaylist {
  id: string;
  name: string;
  collaborative: boolean;
  public: boolean | null;
  owner: { id: string; display_name: string | null };
  tracks: { total: number };
  images: { url: string }[];
}

interface Paged<T> {
  items: T[];
  next: string | null;
  total: number;
}

export const spotifyApi = (getToken: GetToken) => ({
  getMe: () =>
    request<{
      id: string;
      display_name: string | null;
      email: string | null;
      product: string | null;
      country: string | null;
    }>(getToken, '/me'),

  getTracks: (ids: string[]): Promise<{ tracks: (ApiTrack | null)[] }> => {
    if (ids.length === 0) return Promise.resolve({ tracks: [] });
    return request(getToken, `/tracks?ids=${ids.join(',')}`);
  },

  search: (q: string, limit = 20) =>
    request<{ tracks: { items: ApiTrack[] } }>(
      getToken,
      `/search?type=track&limit=${limit}&q=${encodeURIComponent(q)}`,
    ),

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

  containsMySavedTracks: async (ids: string[]): Promise<boolean[]> => {
    if (ids.length === 0) return [];
    const out: boolean[] = [];
    for (let i = 0; i < ids.length; i += 50) {
      const chunk = ids.slice(i, i + 50);
      const res = await request<boolean[]>(
        getToken,
        `/me/tracks/contains?ids=${chunk.join(',')}`,
      );
      out.push(...res);
    }
    return out;
  },

  saveTracks: async (ids: string[]): Promise<void> => {
    for (let i = 0; i < ids.length; i += 50) {
      const chunk = ids.slice(i, i + 50);
      await request(getToken, '/me/tracks', {
        method: 'PUT',
        body: JSON.stringify({ ids: chunk }),
      });
    }
  },

  removeTracks: async (ids: string[]): Promise<void> => {
    for (let i = 0; i < ids.length; i += 50) {
      const chunk = ids.slice(i, i + 50);
      await request(getToken, '/me/tracks', {
        method: 'DELETE',
        body: JSON.stringify({ ids: chunk }),
      });
    }
  },

  getMySavedTrackIds: async (): Promise<string[]> => {
    const ids: string[] = [];
    let url = '/me/tracks?limit=50';
    while (url) {
      const page = await request<
        Paged<{ track: { id: string } | null }> & { next: string | null }
      >(getToken, url);
      for (const item of page.items) {
        if (item.track?.id) ids.push(item.track.id);
      }
      if (!page.next) break;
      url = page.next.replace(BASE, '');
    }
    return ids;
  },

  getMyPlaylists: async (): Promise<ApiPlaylist[]> => {
    const all: ApiPlaylist[] = [];
    let url = '/me/playlists?limit=50';
    while (url) {
      const page = await request<Paged<ApiPlaylist>>(getToken, url);
      all.push(...page.items);
      if (!page.next) break;
      url = page.next.replace(BASE, '');
    }
    return all;
  },

  createPlaylist: (
    userId: string,
    name: string,
    opts: { description?: string; public?: boolean } = {},
  ) =>
    request<ApiPlaylist>(getToken, `/users/${userId}/playlists`, {
      method: 'POST',
      body: JSON.stringify({
        name,
        description: opts.description ?? '',
        public: opts.public ?? false,
      }),
    }),

  addTracksToPlaylist: (playlistId: string, uris: string[]) =>
    request<{ snapshot_id: string }>(
      getToken,
      `/playlists/${playlistId}/tracks`,
      {
        method: 'POST',
        body: JSON.stringify({ uris }),
      },
    ),
});

export type SpotifyApi = ReturnType<typeof spotifyApi>;
