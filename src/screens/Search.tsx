import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { PsalmCard } from '../components/PsalmCard';
import { psalms } from '../data/psalms';
import { catalog } from '../data/catalog';
import { Psalm, Song } from '../types';

const SUGGESTIONS = ['23', 'Lament', 'shepherd', 'Confidence', 'Praise'];

export function Search() {
  const [q, setQ] = useState('');

  const { psalmHits, songHits } = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return { psalmHits: [] as Psalm[], songHits: [] as Song[] };

    const asNum = Number(term);
    const psalmHits = psalms
      .filter((p) => {
        if (!Number.isNaN(asNum) && term.length <= 3) {
          return p.number === asNum;
        }
        return (
          p.title.toLowerCase().includes(term) ||
          p.themes.some((t) => t.toLowerCase().includes(term))
        );
      })
      .slice(0, 30);

    const songHits = catalog
      .filter(
        (s) =>
          s.title.toLowerCase().includes(term) ||
          s.artist.toLowerCase().includes(term),
      )
      .slice(0, 30);

    return { psalmHits, songHits };
  }, [q]);

  const hasQuery = q.trim().length > 0;

  return (
    <div className="shell">
      <header style={{ paddingTop: 12 }}>
        <h1 className="h1">Search</h1>
        <div className="search-wrap">
          <span className="icon" aria-hidden>
            ⌕
          </span>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Psalm number, theme, artist, or title"
            autoCorrect="off"
            autoCapitalize="none"
            aria-label="Search"
          />
          {q ? (
            <button
              type="button"
              className="clear"
              onClick={() => setQ('')}
              aria-label="Clear search"
            >
              ✕
            </button>
          ) : null}
        </div>
      </header>

      {!hasQuery ? (
        <div className="center-note">
          <div
            className="dim"
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: 1.5,
              textTransform: 'uppercase',
            }}
          >
            Try
          </div>
          <div className="chip-row" style={{ justifyContent: 'center' }}>
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                type="button"
                className="chip accent press"
                onClick={() => setQ(s)}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      ) : psalmHits.length === 0 && songHits.length === 0 ? (
        <p className="empty-note">No matches.</p>
      ) : (
        <>
          {psalmHits.length > 0 ? (
            <>
              <div className="section-row">
                <div className="section-label">Psalms</div>
                <div className="count">{psalmHits.length}</div>
              </div>
              {psalmHits.map((p) => (
                <PsalmCard key={p.number} psalm={p} />
              ))}
            </>
          ) : null}
          {songHits.length > 0 ? (
            <>
              <div className="section-row">
                <div className="section-label">Songs</div>
                <div className="count">{songHits.length}</div>
              </div>
              {songHits.map((s) => (
                <Link
                  key={s.id}
                  to={`/psalm/${s.psalm}`}
                  className="row-card press"
                >
                  <span
                    className="num-badge"
                    style={{ width: 40, height: 40, borderRadius: 6, fontSize: 13 }}
                  >
                    {s.psalm}
                  </span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 15 }}>{s.title}</div>
                    <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>
                      {s.artist} · Psalm {s.psalm}
                    </div>
                  </span>
                  <span className="chev">›</span>
                </Link>
              ))}
            </>
          ) : null}
        </>
      )}
    </div>
  );
}
