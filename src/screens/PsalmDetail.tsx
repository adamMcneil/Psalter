import { useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { TopBar } from '../components/TopBar';
import { SongRow } from '../components/SongRow';
import { PlayControls } from '../components/PlayControls';
import { psalmByNumber } from '../data/psalms';
import {
  formatDuration,
  PSALM_119_SECTIONS,
  Psalm119Section,
  sectionForPsalm119Song,
  songsForPsalm,
  totalDurationSec,
} from '../data/catalog';
import { Song } from '../types';

type Row =
  | { kind: 'song'; song: Song }
  | { kind: 'section'; section: Psalm119Section; songCount: number }
  | { kind: 'other'; songCount: number };

export function PsalmDetail() {
  const { id } = useParams<{ id: string }>();
  const num = Number(id);
  const psalm = psalmByNumber(num);
  const songs = useMemo(() => (psalm ? songsForPsalm(num) : []), [psalm, num]);

  const { rows, queue } = useMemo(() => {
    if (num !== 119 || songs.length === 0) {
      return {
        rows: songs.map<Row>((song) => ({ kind: 'song', song })),
        queue: songs,
      };
    }
    const bySection = new Map<string, Song[]>();
    const others: Song[] = [];
    for (const song of songs) {
      const sec = sectionForPsalm119Song(song);
      if (sec) {
        const list = bySection.get(sec.letter);
        if (list) list.push(song);
        else bySection.set(sec.letter, [song]);
      } else {
        others.push(song);
      }
    }
    const builtRows: Row[] = [];
    const builtQueue: Song[] = [];
    for (const sec of PSALM_119_SECTIONS) {
      const list = bySection.get(sec.letter);
      if (!list || list.length === 0) continue;
      builtRows.push({ kind: 'section', section: sec, songCount: list.length });
      for (const song of list) {
        builtRows.push({ kind: 'song', song });
        builtQueue.push(song);
      }
    }
    if (others.length > 0) {
      builtRows.push({ kind: 'other', songCount: others.length });
      for (const song of others) {
        builtRows.push({ kind: 'song', song });
        builtQueue.push(song);
      }
    }
    return { rows: builtRows, queue: builtQueue };
  }, [num, songs]);

  if (!psalm) {
    return (
      <div className="shell">
        <TopBar title="Psalm" />
        <p className="empty-note">Psalm not found.</p>
      </div>
    );
  }

  return (
    <div className="shell">
      <TopBar title={`Psalm ${psalm.number}`} />
      <div className="hero-card">
        <span className="num-badge" style={{ width: 56, height: 56, fontSize: 22 }}>
          {psalm.number}
        </span>
        <div className="kicker" style={{ marginTop: 12 }}>
          PSALM {psalm.number}
        </div>
        <h1
          className="display"
          style={{ fontSize: 28, lineHeight: 1.2, margin: '4px 0 0' }}
        >
          {psalm.title}
        </h1>
        <PlayControls queue={queue} />
      </div>

      <div className="section-row">
        <div className="section-label">Songs</div>
        <div className="count">
          {songs.length}
          {songs.length > 0 ? ` · ${formatDuration(totalDurationSec(songs))}` : ''}
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="card" style={{ padding: 16, textAlign: 'center' }}>
          <div style={{ fontWeight: 600, fontSize: 15 }}>
            No songs yet for this Psalm.
          </div>
        </div>
      ) : (
        rows.map((row, i) => {
          if (row.kind === 'song') {
            return <SongRow key={row.song.id} song={row.song} queue={queue} />;
          }
          if (row.kind === 'section') {
            return (
              <div key={`sec-${row.section.letter}`} className="letter-row">
                <div className="glyph">{row.section.glyph}</div>
                <div>
                  <div className="letter-name">
                    {row.section.letter.toUpperCase()}
                  </div>
                  <div className="letter-meta">
                    vv. {row.section.verseStart}–{row.section.verseEnd} ·{' '}
                    {row.songCount} {row.songCount === 1 ? 'song' : 'songs'}
                  </div>
                </div>
              </div>
            );
          }
          return (
            <div key={`other-${i}`} className="letter-row muted-row">
              <div className="glyph">✦</div>
              <div>
                <div className="letter-name">WHOLE PSALM</div>
                <div className="letter-meta">
                  {row.songCount} {row.songCount === 1 ? 'song' : 'songs'}
                </div>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
