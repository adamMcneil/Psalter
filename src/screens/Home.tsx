import { Link } from 'react-router-dom';
import { PsalmCard } from '../components/PsalmCard';
import { psalms } from '../data/psalms';
import {
  catalog,
  formatDuration,
  songsForPsalm,
  totalDurationSec,
} from '../data/catalog';
import { useSpotifyAuth } from '../spotify/AuthContext';

function greeting(): string {
  const h = new Date().getHours();
  if (h < 5) return 'A quiet hour';
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  if (h < 21) return 'Good evening';
  return 'Peace tonight';
}

function dayOfYear(d = new Date()): number {
  const start = new Date(d.getFullYear(), 0, 0);
  return Math.floor((d.getTime() - start.getTime()) / 86400000);
}

const psalmOfTheDay = () => psalms[(dayOfYear() * 7) % psalms.length];

export function Home() {
  const { user } = useSpotifyAuth();
  const featured = psalmOfTheDay();
  const featuredSongCount = songsForPsalm(featured.number).length;

  return (
    <div className="shell">
      <header style={{ paddingTop: 12, marginBottom: 16 }}>
        <div className="muted" style={{ fontWeight: 600, letterSpacing: 0.3 }}>
          {greeting()}
          {user?.displayName ? `, ${user.displayName.split(' ')[0]}` : ''}
        </div>
        <h1 className="h1 display" style={{ fontSize: 32 }}>
          Psalter
        </h1>
        <div className="muted" style={{ marginTop: 4, fontSize: 13 }}>
          All 150 Psalms · {catalog.length} songs ·{' '}
          {formatDuration(totalDurationSec(catalog))}
        </div>
      </header>

      <div className="section-label">Psalm of the Day</div>
      <Link to={`/psalm/${featured.number}`} className="hero-card press" style={{ display: 'block', marginTop: 0 }}>
        <div className="kicker">PSALM {featured.number}</div>
        <div
          className="display"
          style={{ fontSize: 24, lineHeight: 1.25, marginTop: 8 }}
        >
          {featured.title}
        </div>
        <div className="muted" style={{ fontWeight: 700, fontSize: 12, marginTop: 12 }}>
          {featuredSongCount > 0
            ? `${featuredSongCount} ${featuredSongCount === 1 ? 'song' : 'songs'} →`
            : 'Open →'}
        </div>
      </Link>

      <div className="section-label">All Psalms</div>
      {psalms.map((p) => (
        <PsalmCard key={p.number} psalm={p} />
      ))}
    </div>
  );
}
