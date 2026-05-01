import TrackPlayer, { State, Track } from 'react-native-track-player';
import { Song } from '../types';
import { ensurePlayerSetup } from './setup';

const toTrack = (s: Song): Track => ({
  id: s.id,
  url: s.url,
  title: s.title,
  artist: s.artist,
  album: s.album ?? `Psalm ${s.psalm}`,
  duration: s.durationSec,
  artwork: s.artworkUrl,
});

export async function playSong(song: Song, queue: Song[] = [song]) {
  await ensurePlayerSetup();
  await TrackPlayer.reset();
  await TrackPlayer.add(queue.map(toTrack));
  const idx = Math.max(
    0,
    queue.findIndex((s) => s.id === song.id),
  );
  if (idx > 0) await TrackPlayer.skip(idx);
  await TrackPlayer.play();
}

export async function togglePlayPause() {
  const state = await TrackPlayer.getPlaybackState();
  if (state.state === State.Playing) await TrackPlayer.pause();
  else await TrackPlayer.play();
}
