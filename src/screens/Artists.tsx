import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArtistAvatar } from '../components/ArtistAvatar';
import { artists } from '../data/catalog';
import { tintFor } from '../tints';

export function Artists() {
  const list = useMemo(() => artists(), []);
  const [q, setQ] = useState('');

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return list;
    return list.filter((a) => a.name.toLowerCase().includes(term));
  }, [list, q]);

  const totalSongs = list.reduce((acc, a) => acc + a.songCount, 0);

  return (
    <div className="shell">
      <header style={{ paddingTop: 12, marginBottom: 12 }}>
        <h1 className="h1">Artists</h1>
        <div className="muted" style={{ marginTop: 4, fontSize: 13 }}>
          {list.length} artists · {totalSongs} songs
        </div>
        <div className="search-wrap">
          <span className="icon" aria-hidden>
            ⌕
          </span>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Filter artists"
            autoCorrect="off"
            aria-label="Filter artists"
          />
          {q ? (
            <button
              type="button"
              className="clear"
              onClick={() => setQ('')}
              aria-label="Clear filter"
            >
              ✕
            </button>
          ) : null}
        </div>
      </header>

      {filtered.length === 0 ? (
        <p className="empty-note">
          {q ? 'No artists match.' : 'No artists in the catalog yet.'}
        </p>
      ) : (
        filtered.map((a) => {
          const tint = tintFor(a.name);
          return (
            <Link
              key={a.name}
              to={`/artist/${encodeURIComponent(a.name)}`}
              className="row-card press"
            >
              <ArtistAvatar name={a.name} size={44} bg={tint.bg} fg={tint.fg} />
              <span style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontWeight: 600,
                    fontSize: 15,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {a.name}
                </div>
                <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>
                  {a.songCount} song{a.songCount === 1 ? '' : 's'} ·{' '}
                  {a.psalmCount} psalm{a.psalmCount === 1 ? '' : 's'}
                </div>
              </span>
              <span className="chev">›</span>
            </Link>
          );
        })
      )}
    </div>
  );
}
