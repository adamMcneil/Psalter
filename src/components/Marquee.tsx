import { CSSProperties, useLayoutEffect, useRef, useState } from 'react';

/**
 * Horizontal marquee that scrolls only when the text overflows its container
 * (long song titles in the MiniPlayer). Pure CSS animation; distance and
 * duration are computed from the measured overflow.
 */
export function Marquee({
  text,
  className,
  speed = 30,
}: {
  text: string;
  className?: string;
  speed?: number; // px per second
}) {
  const outerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLSpanElement>(null);
  const [overflow, setOverflow] = useState(0);

  useLayoutEffect(() => {
    const outer = outerRef.current;
    const inner = innerRef.current;
    if (!outer || !inner) return;
    const measure = () => {
      setOverflow(Math.max(0, inner.scrollWidth - outer.clientWidth));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(outer);
    return () => ro.disconnect();
  }, [text]);

  const scrolling = overflow > 0;
  const style: CSSProperties | undefined = scrolling
    ? ({
        '--marquee-distance': `${-overflow}px`,
        '--marquee-duration': `${Math.max(4, (overflow / speed) * 1.3 + 2.4)}s`,
      } as CSSProperties)
    : undefined;

  return (
    <div
      ref={outerRef}
      className={`marquee${scrolling ? ' scrolling' : ''}${className ? ` ${className}` : ''}`}
      style={style}
    >
      <span ref={innerRef} className="inner">
        {text}
      </span>
    </div>
  );
}
