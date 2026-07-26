import { Song } from '../types';

const TRACK_ID_RE = /(?:\/track\/|spotify:track:)([A-Za-z0-9]+)/;

export function extractTrackId(url: string | undefined): string | null {
  if (!url) return null;
  const m = url.match(TRACK_ID_RE);
  return m ? m[1] : null;
}

/** Open the song in Spotify (app or web) in a new tab. */
export function openSpotifyTrack(song: Song): void {
  const url =
    song.spotifyUrl ??
    `https://open.spotify.com/search/${encodeURIComponent(
      `${song.artist} ${song.title}`,
    )}`;
  window.open(url, '_blank', 'noopener');
}
