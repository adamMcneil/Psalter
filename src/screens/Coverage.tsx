import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { TopBar } from '../components/TopBar';
import { catalog } from '../data/catalog';
import { psalms } from '../data/psalms';

const BAR_WIDTH = 10;
const BAR_GAP = 2;
const CHART_HEIGHT = 180;
const SLOT_WIDTH = BAR_WIDTH + BAR_GAP;

const BOOK_DIVIDERS = [42, 73, 90, 107];
const LABELLED = new Set([1, 10, 25, 50, 75, 100, 125, 150]);

const BOOKS = [
  { label: 'Book I', from: 1, to: 41 },
  { label: 'Book II', from: 42, to: 72 },
  { label: 'Book III', from: 73, to: 89 },
  { label: 'Book IV', from: 90, to: 106 },
  { label: 'Book V', from: 107, to: 150 },
];

function StatTile({
  value,
  label,
  emphasis,
}: {
  value: string;
  label: string;
  emphasis?: boolean;
}) {
  return (
    <div className={`tile${emphasis ? ' emphasis' : ''}`}>
      <div className="value">{value}</div>
      <div className="label">{label}</div>
    </div>
  );
}

export function Coverage() {
  const counts = useMemo(() => {
    const map = new Map<number, number>();
    for (const s of catalog) {
      map.set(s.psalm, (map.get(s.psalm) ?? 0) + 1);
    }
    return map;
  }, []);

  const max = Math.max(1, ...Array.from(counts.values()));
  const covered = counts.size;
  const uncovered = 150 - covered;

  const top = useMemo(
    () =>
      Array.from(counts.entries())
        .map(([num, count]) => ({
          num,
          count,
          psalm: psalms.find((p) => p.number === num),
        }))
        .filter((t) => t.psalm)
        .sort((a, b) => b.count - a.count || a.num - b.num)
        .slice(0, 10),
    [counts],
  );

  return (
    <div className="shell">
      <TopBar title="Coverage" />
      <header style={{ paddingTop: 4 }}>
        <div className="kicker">CATALOG</div>
        <h1 className="h1" style={{ marginTop: 4 }}>
          Coverage
        </h1>
        <div className="muted" style={{ marginTop: 4, fontSize: 13 }}>
          Songs per psalm across all 150
        </div>
        <div className="stats">
          <StatTile value={`${covered}`} label="of 150 covered" emphasis />
          <StatTile value={`${uncovered}`} label="still need a song" />
          <StatTile value={`${catalog.length}`} label="songs total" />
          <StatTile value={`${max}`} label="most for one psalm" />
        </div>
      </header>

      <div className="section-label">Distribution</div>
      <div className="dim" style={{ fontSize: 12, margin: '-4px 0 8px' }}>
        Tap any bar to open that psalm
      </div>
      <div className="chart-scroll">
        <div style={{ width: 150 * SLOT_WIDTH }}>
          <div style={{ position: 'relative', height: 14, marginBottom: 2 }}>
            {BOOK_DIVIDERS.map((d) => {
              const x = (d - 1) * SLOT_WIDTH - 1;
              return (
                <span key={d}>
                  <span
                    style={{
                      position: 'absolute',
                      left: x - 19,
                      width: 18,
                      textAlign: 'right',
                      fontSize: 9,
                      fontWeight: 800,
                      color: 'var(--accent-hi)',
                    }}
                  >
                    {d - 1}
                  </span>
                  <span
                    style={{
                      position: 'absolute',
                      left: x + 2,
                      width: 18,
                      fontSize: 9,
                      fontWeight: 800,
                      color: 'var(--accent-hi)',
                    }}
                  >
                    {d}
                  </span>
                </span>
              );
            })}
          </div>
          <div className="chart">
            {BOOK_DIVIDERS.map((d) => (
              <span
                key={d}
                className="divider"
                style={{ left: (d - 1) * SLOT_WIDTH - 1 }}
              />
            ))}
            {psalms.map((p) => {
              const count = counts.get(p.number) ?? 0;
              const h = count > 0 ? Math.max(3, (count / max) * CHART_HEIGHT) : 2;
              return (
                <Link
                  key={p.number}
                  to={`/psalm/${p.number}`}
                  className="bar-wrap"
                  aria-label={`Psalm ${p.number}, ${count} song${count === 1 ? '' : 's'}`}
                >
                  <span className="bar-count">{count > 0 ? count : ''}</span>
                  <span
                    className={`bar ${count === 0 ? 'empty' : 'filled'}`}
                    style={{ height: h }}
                  />
                </Link>
              );
            })}
          </div>
          <div className="chart-axis">
            {psalms.map((p) => (
              <span
                key={p.number}
                className="slot"
                style={LABELLED.has(p.number) ? undefined : { visibility: 'hidden' }}
              >
                {p.number}
              </span>
            ))}
          </div>
          <div className="book-row">
            {BOOKS.map((b) => (
              <span
                key={b.label}
                className="book-seg"
                style={{ width: (b.to - b.from + 1) * SLOT_WIDTH }}
              >
                {b.label}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="section-label">Most Songs</div>
      {top.map((t, i) => (
        <Link key={t.num} to={`/psalm/${t.num}`} className="row-card press">
          <span
            className="dim"
            style={{ width: 22, textAlign: 'center', fontWeight: 800 }}
          >
            {i + 1}
          </span>
          <span
            className="num-badge"
            style={{ width: 40, height: 40, borderRadius: 6, fontSize: 15 }}
          >
            {t.num}
          </span>
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
              {t.psalm!.title}
            </div>
            <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>
              Psalm {t.num}
            </div>
          </span>
          <span className="pill">
            {t.count} {t.count === 1 ? 'song' : 'songs'}
          </span>
        </Link>
      ))}
    </div>
  );
}
