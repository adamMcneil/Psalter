import { useLocation, useNavigate } from 'react-router-dom';
import { usePlayer, usePlayerProgress } from '../player/PlayerContext';
import { formatDuration } from '../data/catalog';
import { Marquee } from './Marquee';
import { SeekBar } from './SeekBar';

export function MiniPlayer() {
  const player = usePlayer();
  const progress = usePlayerProgress();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  // The full-screen song page already shows cover, title and seek bar.
  const onSongPage = pathname.startsWith('/song/');

  const banner = player.error ?? player.notice;
  const isNotice = !player.error && !!player.notice;
  const info = player.current;

  if (onSongPage) return null;
  if (!info && !banner) return null;

  return (
    <div className="mini">
      <div className="mini-inner">
        {banner ? (
          <div className="banner" role="status">
            <span>{banner}</span>
            {isNotice ? (
              <button
                type="button"
                onClick={player.clearNotice}
                aria-label="Dismiss"
              >
                ✕
              </button>
            ) : null}
          </div>
        ) : null}
        {info ? (
          <>
            <div className="bar">
              {player.hasQueue ? (
                <button
                  type="button"
                  className="icon-btn press"
                  onClick={player.prev}
                  aria-label="Previous track"
                >
                  ⏮
                </button>
              ) : null}
              <button
                type="button"
                className="meta press"
                onClick={() => {
                  if (info.songId) navigate(`/song/${info.songId}`);
                }}
                aria-label="Open song page"
              >
                {info.cover ? (
                  <img className="cover" src={info.cover} alt="" />
                ) : (
                  <span className="cover" />
                )}
                <span className="text">
                  <Marquee text={info.title} className="title" />
                  {info.artist ? (
                    <span className="artist">{info.artist}</span>
                  ) : null}
                </span>
              </button>
              {player.source === 'preview' ? (
                <span
                  className="pill mode-pill"
                  title="Playing 30-second previews — works in any browser"
                >
                  PREVIEW
                </span>
              ) : null}
              <span className="time">
                {formatDuration(progress.positionSec)} /{' '}
                {formatDuration(progress.durationSec)}
              </span>
              <button
                type="button"
                className="play-btn press"
                onClick={player.toggle}
                aria-label={player.isPlaying ? 'Pause' : 'Play'}
              >
                {player.isPlaying ? '❚❚' : '▶'}
              </button>
              {player.hasQueue ? (
                <button
                  type="button"
                  className="icon-btn press"
                  onClick={player.next}
                  aria-label="Next track"
                >
                  ⏭
                </button>
              ) : null}
            </div>
            <SeekBar
              positionSec={progress.positionSec}
              durationSec={progress.durationSec}
              onSeek={player.seek}
            />
          </>
        ) : null}
      </div>
    </div>
  );
}
