// Media Session API glue: lock-screen / notification / hardware-key controls.
// Every call is guarded — the API is optional and this must never throw.

export interface MediaSessionHandlers {
  onPlay: () => void;
  onPause: () => void;
  onNext?: () => void;
  onPrev?: () => void;
  onSeek?: (positionSec: number) => void;
}

function ms(): MediaSession | null {
  return typeof navigator !== 'undefined' && 'mediaSession' in navigator
    ? navigator.mediaSession
    : null;
}

export function setNowPlaying(
  meta: { title: string; artist: string; album?: string; artworkUrl?: string } | null,
): void {
  const session = ms();
  if (!session) return;
  try {
    if (!meta) {
      session.metadata = null;
      return;
    }
    session.metadata = new MediaMetadata({
      title: meta.title,
      artist: meta.artist,
      album: meta.album ?? '',
      artwork: meta.artworkUrl
        ? [{ src: meta.artworkUrl, sizes: '640x640', type: 'image/jpeg' }]
        : [],
    });
  } catch {
    // ignore
  }
}

export function setHandlers(handlers: MediaSessionHandlers): void {
  const session = ms();
  if (!session) return;
  const bind = (
    action: MediaSessionAction,
    fn: ((details: MediaSessionActionDetails) => void) | null,
  ) => {
    try {
      session.setActionHandler(action, fn);
    } catch {
      // action unsupported on this platform
    }
  };
  bind('play', () => handlers.onPlay());
  bind('pause', () => handlers.onPause());
  bind('nexttrack', handlers.onNext ? () => handlers.onNext!() : null);
  bind('previoustrack', handlers.onPrev ? () => handlers.onPrev!() : null);
  bind(
    'seekto',
    handlers.onSeek
      ? (d) => {
          if (typeof d.seekTime === 'number') handlers.onSeek!(d.seekTime);
        }
      : null,
  );
}

export function setPlaybackState(state: 'playing' | 'paused' | 'none'): void {
  const session = ms();
  if (!session) return;
  try {
    session.playbackState = state;
  } catch {
    // ignore
  }
}

export function setPosition(positionSec: number, durationSec: number): void {
  const session = ms();
  if (!session || typeof session.setPositionState !== 'function') return;
  if (!Number.isFinite(durationSec) || durationSec <= 0) return;
  try {
    session.setPositionState({
      duration: durationSec,
      position: Math.min(Math.max(0, positionSec), durationSec),
      playbackRate: 1,
    });
  } catch {
    // ignore
  }
}
