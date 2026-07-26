import { Song } from '../types';
import { usePlayer } from '../player/PlayerContext';

export function PlayControls({ queue }: { queue: Song[] }) {
  const player = usePlayer();
  if (queue.length === 0) return null;

  return (
    <div className="play-controls">
      <button
        type="button"
        className="btn btn-primary press"
        onClick={() => void player.playSongs(queue)}
        aria-label="Play all"
      >
        ▶ Play
      </button>
      <button
        type="button"
        className="btn press"
        onClick={() => void player.playSongs(queue, { shuffle: true })}
        aria-label="Shuffle"
      >
        ⇄ Shuffle
      </button>
    </div>
  );
}
