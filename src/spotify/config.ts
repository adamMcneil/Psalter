import Constants from 'expo-constants';

const extra = (Constants.expoConfig?.extra ?? {}) as Record<string, unknown>;

function read(key: string): string | undefined {
  const fromExtra = extra[key];
  if (typeof fromExtra === 'string' && fromExtra.length > 0) return fromExtra;
  const fromEnv = process.env[`EXPO_PUBLIC_${key}`];
  if (typeof fromEnv === 'string' && fromEnv.length > 0) return fromEnv;
  return undefined;
}

export const SPOTIFY_CLIENT_ID = read('SPOTIFY_CLIENT_ID');

export const SPOTIFY_SCOPES = [
  'streaming',
  'user-read-email',
  'user-read-private',
  'user-library-read',
  'user-library-modify',
  'playlist-read-private',
  'playlist-modify-private',
  'user-modify-playback-state',
];

export const SPOTIFY_DISCOVERY = {
  authorizationEndpoint: 'https://accounts.spotify.com/authorize',
  tokenEndpoint: 'https://accounts.spotify.com/api/token',
};

export const isSpotifyConfigured = (): boolean => Boolean(SPOTIFY_CLIENT_ID);
