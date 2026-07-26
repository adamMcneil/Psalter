import { useEffect, useRef } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { TopBar } from '../components/TopBar';
import { SeekBar } from '../components/SeekBar';
import { formatDuration, songById, songsForPsalm } from '../data/catalog';
import { usePlayer, usePlayerProgress } from '../player/PlayerContext';
import { openSpotifyTrack } from '../spotify/launch';

export function SongDetail() {
  const { id } = useParams<{ id: string }>();
  const song = id ? songById(id) : undefined;
  const player = usePlayer();
  const progress = usePlayerProgress();
  const navigate = useNavigate();
  const followRef = useRef(false);

  const isCurrent = !!song && player.current?.songId === song.id;
  const isPlaying = isCurrent && player.isPlaying;

  const positionSec = isCurrent ? progress.positionSec : 0;
  const durationSec = isCurrent
    ? progress.durationSec || song?.durationSec || 0
    : (song?.durationSec ?? 0);

  // After next/prev on this page, follow the queue to the new song's route
  // once the player reports it.
  const currentSongId = player.current?.songId ?? null;
  useEffect(() => {
    if (!followRef.current) return;
    if (!currentSongId || !song || currentSongId === song.id) return;
    followRef.current = false;
    navigate(`/song/${currentSongId}`, { replace: true });
  }, [currentSongId, song, navigate]);

  if (!song) {
    return (
      <div className="shell">
        <TopBar title="Song" />
        <p className="empty-note">Song not found.</p>
      </div>
    );
  }

  const handleToggle = () => {
    if (isCurrent) {
      player.toggle();
      return;
    }
    const queue = songsForPsalm(song.psalm);
    void player.playSongs(queue.length > 0 ? queue : [song], {
      startId: song.id,
    });
  };

  const skip = (dir: 'next' | 'prev') => {
    followRef.current = true;
    if (dir === 'next') player.next();
    else player.prev();
  };

  return (
    <div className="shell">
      <TopBar title="Now Playing" />
      {player.error || player.notice ? (
        <div className="banner" role="status" style={{ marginTop: 8 }}>
          <span>{player.error ?? player.notice}</span>
          {!player.error && player.notice ? (
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
      <div className="song-page">
        <div className="cover-wrap">
          {song.albumCoverUrl ? (
            <img src={song.albumCoverUrl} alt={`${song.album ?? song.title} cover`} />
          ) : null}
        </div>

        <h1 className="song-title display">{song.title}</h1>
        <Link
          to={`/artist/${encodeURIComponent(song.artist)}`}
          className="artist-link"
        >
          {song.artist} <span className="dim">›</span>
        </Link>
        {song.album ? <div className="album">{song.album}</div> : null}

        <div style={{ marginTop: 24 }}>
          <SeekBar
            positionSec={positionSec}
            durationSec={durationSec}
            onSeek={player.seek}
            disabled={!isCurrent}
            large
          />
        </div>
        <div className="time-row">
          <span>{formatDuration(positionSec)}</span>
          <span>{formatDuration(durationSec)}</span>
        </div>

        <div className="controls">
          <button
            type="button"
            className="skip press"
            onClick={() => skip('prev')}
            disabled={!isCurrent || !player.hasQueue}
            aria-label="Previous track"
          >
            ⏮
          </button>
          <button
            type="button"
            className="play press"
            onClick={handleToggle}
            aria-label={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? '❚❚' : '▶'}
          </button>
          <button
            type="button"
            className="skip press"
            onClick={() => skip('next')}
            disabled={!isCurrent || !player.hasQueue}
            aria-label="Next track"
          >
            ⏭
          </button>
        </div>

        {isCurrent && player.source === 'preview' ? (
          <div
            className="dim"
            style={{ textAlign: 'center', fontSize: 12, marginTop: 16 }}
          >
            30-second preview
            {player.fullTracks.reason === 'no-drm'
              ? ' — full tracks need Widevine (see Account)'
              : ''}
          </div>
        ) : null}

        <div className="foot-links">
          <button type="button" onClick={() => openSpotifyTrack(song)}>
            Open in Spotify ↗
          </button>
          <Link to={`/psalm/${song.psalm}`}>‹ Psalm {song.psalm}</Link>
        </div>
      </div>
    </div>
  );
}
