// Spotify OAuth app configuration. The client ID is public by design (PKCE
// flow, no secret); override with VITE_SPOTIFY_CLIENT_ID when deploying a fork
// with your own Spotify app.

const fromEnv = import.meta.env.VITE_SPOTIFY_CLIENT_ID as string | undefined;

export const SPOTIFY_CLIENT_ID: string | undefined =
  fromEnv && fromEnv.length > 0 ? fromEnv : '750204e46dfa414988d5776ad9196988';

export const SPOTIFY_SCOPES = [
  'streaming',
  'user-read-email',
  'user-read-private',
  'user-modify-playback-state',
];

export const SPOTIFY_DISCOVERY = {
  authorizationEndpoint: 'https://accounts.spotify.com/authorize',
  tokenEndpoint: 'https://accounts.spotify.com/api/token',
};

export const isSpotifyConfigured = (): boolean => Boolean(SPOTIFY_CLIENT_ID);
