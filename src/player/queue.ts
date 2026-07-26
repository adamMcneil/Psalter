// Pure queue construction + navigation for the player. No DOM, no React —
// unit tested in queue.test.ts.

import { Song } from '../types';
import { extractTrackId } from '../spotify/launch';
import { previewUrlForTrack } from '../data/previews';

export interface PlayerTrack {
  songId: string;
  trackId: string | null;
  spotifyUri: string | null;
  title: string;
  artist: string;
  album?: string;
  psalm: number;
  cover?: string;
  durationSec?: number;
  previewUrl: string | null;
}

export function toPlayerTrack(
  song: Song,
  resolvePreview: (trackId: string | null) => string | null = previewUrlForTrack,
): PlayerTrack {
  const trackId = extractTrackId(song.spotifyUrl);
  return {
    songId: song.id,
    trackId,
    spotifyUri: trackId ? `spotify:track:${trackId}` : null,
    title: song.title,
    artist: song.artist,
    album: song.album,
    psalm: song.psalm,
    cover: song.albumCoverUrl,
    durationSec: song.durationSec,
    previewUrl: resolvePreview(trackId),
  };
}

export function buildQueue(
  songs: Song[],
  resolvePreview?: (trackId: string | null) => string | null,
): PlayerTrack[] {
  return songs.map((s) => toPlayerTrack(s, resolvePreview));
}

/** Fisher–Yates; rng injectable for deterministic tests. */
export function shuffled<T>(arr: T[], rng: () => number = Math.random): T[] {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Index of the first track at or after `from` that has a preview, or -1.
 * Used when starting playback ("play all" skips unplayable tracks).
 */
export function firstPlayable(queue: PlayerTrack[], from: number): number {
  for (let i = Math.max(0, from); i < queue.length; i++) {
    if (queue[i].previewUrl) return i;
  }
  return -1;
}

/**
 * Index of the next/previous playable track strictly beyond `from` in
 * direction `dir`, or -1 when there is none (end of queue).
 */
export function nextPlayable(
  queue: PlayerTrack[],
  from: number,
  dir: 1 | -1,
): number {
  for (let i = from + dir; i >= 0 && i < queue.length; i += dir) {
    if (queue[i].previewUrl) return i;
  }
  return -1;
}
