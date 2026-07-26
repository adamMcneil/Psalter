import { useArtistImage } from '../spotify/artistImages';

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return (
    parts
      .map((p) => p[0] ?? '')
      .join('')
      .toUpperCase() || '♪'
  );
}

interface Props {
  name: string;
  size: number;
  bg: string;
  fg: string;
  bordered?: boolean;
}

export function ArtistAvatar({ name, size, bg, fg, bordered }: Props) {
  const url = useArtistImage(name);
  const base = {
    width: size,
    height: size,
    background: bg,
    border: bordered ? `1.5px solid ${fg}` : undefined,
  };

  if (url) {
    return (
      <img
        className="avatar"
        src={url}
        alt={`${name} artist photo`}
        style={base}
        loading="lazy"
      />
    );
  }

  return (
    <div
      className="avatar"
      style={{
        ...base,
        color: fg,
        fontSize: Math.max(11, Math.round(size * 0.34)),
      }}
      aria-label={`${name} initials`}
    >
      {initials(name)}
    </div>
  );
}
