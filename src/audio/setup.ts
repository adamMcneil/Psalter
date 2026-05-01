import TrackPlayer, {
  AppKilledPlaybackBehavior,
  Capability,
  RatingType,
} from 'react-native-track-player';

let setupPromise: Promise<void> | null = null;

export function ensurePlayerSetup(): Promise<void> {
  if (!setupPromise) {
    setupPromise = TrackPlayer.setupPlayer({
      autoHandleInterruptions: true,
    }).then(() =>
      TrackPlayer.updateOptions({
        ratingType: RatingType.Heart,
        android: {
          appKilledPlaybackBehavior:
            AppKilledPlaybackBehavior.StopPlaybackAndRemoveNotification,
        },
        capabilities: [
          Capability.Play,
          Capability.Pause,
          Capability.SkipToNext,
          Capability.SkipToPrevious,
          Capability.SeekTo,
          Capability.Stop,
        ],
        compactCapabilities: [
          Capability.Play,
          Capability.Pause,
          Capability.SkipToNext,
        ],
        progressUpdateEventInterval: 1,
      }),
    );
  }
  return setupPromise;
}
