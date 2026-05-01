import { useEffect, useState } from 'react';
import TrackPlayer, {
  Event,
  State,
  Track,
  useTrackPlayerEvents,
} from 'react-native-track-player';

export interface NowPlaying {
  track: Track | null;
  state: State;
}

export function useNowPlaying(): NowPlaying {
  const [track, setTrack] = useState<Track | null>(null);
  const [state, setState] = useState<State>(State.None);

  useEffect(() => {
    (async () => {
      const idx = await TrackPlayer.getActiveTrackIndex();
      if (idx != null) {
        const t = await TrackPlayer.getTrack(idx);
        setTrack(t ?? null);
      }
      const s = await TrackPlayer.getPlaybackState();
      setState(s.state);
    })().catch(() => {});
  }, []);

  useTrackPlayerEvents(
    [Event.PlaybackActiveTrackChanged, Event.PlaybackState],
    async (event) => {
      if (event.type === Event.PlaybackActiveTrackChanged) {
        setTrack(event.track ?? null);
      } else if (event.type === Event.PlaybackState) {
        setState(event.state);
      }
    },
  );

  return { track, state };
}
