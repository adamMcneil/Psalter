import { MouseEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Song } from '../types';
import { usePlayer } from '../player/PlayerContext';

export function SongRow({ song, queue }: { song: Song; queue?: Song[] }) {
  const player = usePlayer();
  const navigate = useNavigate();

  const isCurrent = player.current?.songId === song.id;
  const isPlayingThis = isCurrent && player.isPlaying;

  const onPress = () => {
    if (isCurrent) {
      player.toggle();
      return;
    }
    void player.playSongs(queue && queue.length > 0 ? queue : [song], {
      startId: song.id,
    });
  };

  const onArtist = (e: MouseEvent) => {
    e.stopPropagation();
    navigate(`/artist/${encodeURIComponent(song.artist)}`);
  };

  return (
    <button
      type="button"
      className={`song-row press${isCurrent ? ' current' : ''}`}
      onClick={onPress}
      aria-label={
        isPlayingThis ? `Pause ${song.title}` : `Play ${song.title}`
      }
    >
      {song.albumCoverUrl ? (
        <img className="cover" src={song.albumCoverUrl} alt="" loading="lazy" />
      ) : (
        <span className="cover placeholder">♪</span>
      )}
      <span className="body">
        <span className="title">{song.title}</span>
        {/* Mouse/touch shortcut to the artist page; keyboard users reach it
            via the song page or the Artists tab (nesting a focusable link
            inside this button would be invalid HTML). */}
        <span className="artist" onClick={onArtist}>
          {song.artist} <span className="arrow">›</span>
        </span>
        {song.album ? <span className="album">{song.album}</span> : null}
      </span>
      <span className="state">{isPlayingThis ? '❚❚' : isCurrent ? '▶' : ''}</span>
    </button>
  );
}
