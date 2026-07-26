import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { TopBar } from '../components/TopBar';
import { SongRow } from '../components/SongRow';
import { ArtistAvatar } from '../components/ArtistAvatar';
import { PlayControls } from '../components/PlayControls';
import {
  formatDuration,
  songsByArtist,
  totalDurationSec,
} from '../data/catalog';
import { Song } from '../types';
import { tintFor } from '../tints';

type SortMode = 'psalm' | 'title' | 'album';

const SORTS: { id: SortMode; label: string }[] = [
  { id: 'psalm', label: 'Psalm #' },
  { id: 'title', label: 'A → Z' },
  { id: 'album', label: 'Album' },
];

function sortSongs(songs: Song[], mode: SortMode): Song[] {
  const copy = songs.slice();
  switch (mode) {
    case 'psalm':
      return copy.sort(
        (a, b) => a.psalm - b.psalm || a.title.localeCompare(b.title),
      );
    case 'title':
      return copy.sort((a, b) => a.title.localeCompare(b.title));
    case 'album':
      return copy.sort((a, b) => {
        const ax = a.album ?? '~';
        const bx = b.album ?? '~';
        return ax.localeCompare(bx) || a.psalm - b.psalm;
      });
  }
}

export function ArtistDetail() {
  const { name } = useParams<{ name: string }>();
  const artistName = decodeURIComponent(name ?? '');
  const allSongs = useMemo(() => songsByArtist(artistName), [artistName]);
  const tint = tintFor(artistName);
  const psalmCount = new Set(allSongs.map((s) => s.psalm)).size;
  const albumCount = new Set(allSongs.map((s) => s.album).filter(Boolean)).size;
  const hasAlbums = albumCount > 0;

  const [sort, setSort] = useState<SortMode>('psalm');
  const songs = useMemo(() => sortSongs(allSongs, sort), [allSongs, sort]);

  const psalmSongCounts = useMemo(() => {
    const m = new Map<number, number>();
    for (const s of allSongs) m.set(s.psalm, (m.get(s.psalm) ?? 0) + 1);
    return m;
  }, [allSongs]);
  const coveragePct = Math.round((psalmCount / 150) * 100);

  const visibleSorts = SORTS.filter((s) => s.id !== 'album' || hasAlbums);
  const sortHint =
    sort === 'psalm' ? 'In Psalm order' : sort === 'title' ? 'Alphabetical' : 'By album';

  return (
    <div className="shell">
      <TopBar title={artistName || 'Artist'} />
      <div
        className="artist-hero"
        style={{ background: tint.bg, borderColor: tint.fg }}
      >
        <div style={{ marginBottom: 12 }}>
          <ArtistAvatar
            name={artistName}
            size={64}
            bg={`${tint.fg}22`}
            fg={tint.fg}
            bordered
          />
        </div>
        <div className="kicker" style={{ color: tint.fg }}>
          ARTIST
        </div>
        <h1 className="h1 display" style={{ marginTop: 4 }}>
          {artistName}
        </h1>
        <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>
          {allSongs.length} song{allSongs.length === 1 ? '' : 's'} · {psalmCount}{' '}
          psalm{psalmCount === 1 ? '' : 's'}
          {hasAlbums ? ` · ${albumCount} album${albumCount === 1 ? '' : 's'}` : ''}
          {allSongs.length > 0
            ? ` · ${formatDuration(totalDurationSec(allSongs))}`
            : ''}
        </div>
        <PlayControls queue={songs} />
      </div>

      <div className="section-row">
        <div className="section-label">Coverage</div>
        <div className="count" style={{ color: tint.fg }}>
          {psalmCount} / 150 · {coveragePct}%
        </div>
      </div>
      <div className="coverage-grid">
        {Array.from({ length: 15 }).map((_, row) => {
          const start = row * 10 + 1;
          return (
            <div key={row} className="grid-row">
              <span className="row-label">{start}</span>
              <div className="cells">
                {Array.from({ length: 10 }).map((_, col) => {
                  const num = start + col;
                  const count = psalmSongCounts.get(num) ?? 0;
                  const covered = count > 0;
                  const intense = count >= 2;
                  return (
                    <Link
                      key={num}
                      to={`/psalm/${num}`}
                      className="cell press"
                      style={
                        covered
                          ? {
                              background: tint.fg,
                              borderColor: tint.fg,
                              color: tint.bg,
                              boxShadow: intense
                                ? `inset 0 0 0 2px ${tint.bg}`
                                : undefined,
                            }
                          : undefined
                      }
                      aria-label={`Psalm ${num}${covered ? `, ${count} song${count === 1 ? '' : 's'}` : ' (no song)'}`}
                    >
                      {count > 1 ? count : ''}
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
      <div className="legend-row">
        <span className="legend-item">
          <span className="legend-swatch" />
          None
        </span>
        <span className="legend-item">
          <span className="legend-swatch" style={{ background: tint.fg, borderColor: tint.fg }} />
          1 song
        </span>
        <span className="legend-item">
          <span
            className="legend-swatch"
            style={{
              background: tint.fg,
              borderColor: tint.fg,
              boxShadow: `inset 0 0 0 2px ${tint.bg}`,
            }}
          />
          2+
        </span>
      </div>

      <div className="section-row">
        <div className="section-label">Songs</div>
        <div className="count" style={{ color: tint.fg }}>
          {sortHint}
        </div>
      </div>
      <div className="chip-row" style={{ marginBottom: 12 }}>
        {visibleSorts.map((s) => {
          const on = sort === s.id;
          return (
            <button
              key={s.id}
              type="button"
              className="chip press"
              style={
                on
                  ? { background: `${tint.fg}22`, borderColor: tint.fg, color: tint.fg }
                  : undefined
              }
              onClick={() => setSort(s.id)}
              aria-label={`Sort by ${s.label}`}
              aria-pressed={on}
            >
              {s.label}
            </button>
          );
        })}
      </div>

      {songs.length === 0 ? (
        <p className="empty-note">No songs found for this artist.</p>
      ) : (
        songs.map((s) => <SongRow key={s.id} song={s} queue={songs} />)
      )}
    </div>
  );
}
