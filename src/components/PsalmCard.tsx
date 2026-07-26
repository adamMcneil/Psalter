import { Link } from 'react-router-dom';
import { Psalm } from '../types';
import { songsForPsalm } from '../data/catalog';

export function PsalmCard({ psalm }: { psalm: Psalm }) {
  const songCount = songsForPsalm(psalm.number).length;

  return (
    <Link to={`/psalm/${psalm.number}`} className="psalm-card press">
      <span className="num-badge">{psalm.number}</span>
      <span className="title">{psalm.title}</span>
      <span className="right">
        {songCount > 0 ? (
          <span className="pill">
            {songCount} {songCount === 1 ? 'song' : 'songs'}
          </span>
        ) : null}
        <span className="chev">›</span>
      </span>
    </Link>
  );
}
