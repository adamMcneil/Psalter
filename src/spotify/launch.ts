import { Linking } from 'react-native';
import { Song } from '../types';

const TRACK_ID_RE = /(?:\/track\/|spotify:track:)([A-Za-z0-9]+)/;

export function extractTrackId(url: string | undefined): string | null {
  if (!url) return null;
  const m = url.match(TRACK_ID_RE);
  return m ? m[1] : null;
}

function searchUrls(song: Song): string[] {
  const q = encodeURIComponent(`${song.artist} ${song.title}`);
  return [`spotify:search:${q}`, `https://open.spotify.com/search/${q}`];
}

function trackUrls(spotifyUrl: string): string[] {
  const id = extractTrackId(spotifyUrl);
  const urls: string[] = [];
  if (id) urls.push(`spotify:track:${id}`);
  urls.push(spotifyUrl);
  return urls;
}

export async function openSpotifyTrack(song: Song): Promise<void> {
  const candidates = song.spotifyUrl
    ? [...trackUrls(song.spotifyUrl), ...searchUrls(song)]
    : searchUrls(song);

  for (const url of candidates) {
    try {
      await Linking.openURL(url);
      return;
    } catch {
      continue;
    }
  }
}
