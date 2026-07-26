// Deterministic per-artist accent tints, shared by the artists list and the
// artist detail hero.

export interface Tint {
  bg: string;
  fg: string;
}

const AVATAR_TINTS: Tint[] = [
  { bg: '#3a2912', fg: '#d4a24a' },
  { bg: '#1a2438', fg: '#6b8cd1' },
  { bg: '#1a2c20', fg: '#7fb38a' },
  { bg: '#321e15', fg: '#c98a6e' },
  { bg: '#241934', fg: '#a987d1' },
  { bg: '#16262d', fg: '#7ab1c4' },
  { bg: '#2e2a14', fg: '#c9bf6a' },
];

export function tintFor(name: string): Tint {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) | 0;
  return AVATAR_TINTS[Math.abs(h) % AVATAR_TINTS.length];
}
