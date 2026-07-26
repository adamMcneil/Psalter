import { KeyboardEvent, PointerEvent, useRef, useState } from 'react';

interface SeekBarProps {
  positionSec: number;
  durationSec: number;
  onSeek: (positionSec: number) => void;
  disabled?: boolean;
  large?: boolean;
}

/**
 * Tap/drag seek bar. Uses pointer capture so a drag that leaves the bar keeps
 * tracking, and only commits the seek on release (live preview via local
 * drag state — the classic "don't fight the timeupdate stream" pattern).
 */
export function SeekBar({
  positionSec,
  durationSec,
  onSeek,
  disabled,
  large,
}: SeekBarProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [dragPct, setDragPct] = useState<number | null>(null);

  const pctFromEvent = (e: PointerEvent): number => {
    const el = trackRef.current;
    if (!el) return 0;
    const rect = el.getBoundingClientRect();
    if (rect.width <= 0) return 0;
    return Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
  };

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (disabled) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragPct(pctFromEvent(e));
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (disabled || dragPct === null) return;
    setDragPct(pctFromEvent(e));
  };
  const onPointerUp = (e: PointerEvent<HTMLDivElement>) => {
    if (disabled || dragPct === null) return;
    const pct = pctFromEvent(e);
    setDragPct(null);
    if (durationSec > 0) onSeek(pct * durationSec);
  };
  const onPointerCancel = () => setDragPct(null);

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (disabled || durationSec <= 0) return;
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault();
      const delta = e.key === 'ArrowRight' ? 5 : -5;
      onSeek(Math.max(0, Math.min(durationSec, positionSec + delta)));
    }
  };

  const livePct =
    durationSec > 0 ? Math.max(0, Math.min(1, positionSec / durationSec)) : 0;
  const pct = dragPct ?? livePct;

  return (
    <div
      className={`seekbar${large ? ' large' : ''}${disabled ? ' disabled' : ''}`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      onKeyDown={onKeyDown}
      role="slider"
      tabIndex={disabled ? -1 : 0}
      aria-label="Seek"
      aria-valuemin={0}
      aria-valuemax={Math.round(durationSec)}
      aria-valuenow={Math.round(pct * durationSec)}
    >
      <div className="track" ref={trackRef}>
        <div className="fill" style={{ width: `${pct * 100}%` }} />
        <div className="thumb" style={{ left: `${pct * 100}%` }} />
      </div>
    </div>
  );
}
