import { Theme } from './types';

export const colors = {
  bg: '#0f1115',
  bgElevated: '#13161d',
  surface: '#161a22',
  surfaceAlt: '#1d222c',
  surfaceHi: '#222837',
  border: '#262c38',
  borderSoft: '#1f2532',
  text: '#e8ebf1',
  textMuted: '#8a93a6',
  textDim: '#5b6378',
  accent: '#c9a56a',
  accentHi: '#e2c089',
  accentSoft: '#3a2e1c',
  danger: '#e57373',
};

export const radius = { sm: 6, md: 10, lg: 16, xl: 24, pill: 999 };
export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };

export const fontSize = {
  xs: 11,
  sm: 12,
  md: 13,
  lg: 15,
  xl: 18,
  h3: 20,
  h2: 24,
  h1: 28,
  display: 34,
};

export interface ThemePalette {
  base: string;
  soft: string;
  ink: string;
  glyph: string;
}

export const themePalettes: Record<Theme, ThemePalette> = {
  Praise: {
    base: '#d4a24a',
    soft: '#3a2912',
    ink: '#1a1207',
    glyph: '✦',
  },
  Lament: {
    base: '#6b8cd1',
    soft: '#1a2438',
    ink: '#0a0f1a',
    glyph: '❀',
  },
  Thanksgiving: {
    base: '#7fb38a',
    soft: '#1a2c20',
    ink: '#08130c',
    glyph: '✿',
  },
  Confidence: {
    base: '#c98a6e',
    soft: '#321e15',
    ink: '#1a0d07',
    glyph: '◈',
  },
  Kingship: {
    base: '#a987d1',
    soft: '#241934',
    ink: '#100819',
    glyph: '♚',
  },
  Remembrance: {
    base: '#7ab1c4',
    soft: '#16262d',
    ink: '#08111a',
    glyph: '☼',
  },
  Wisdom: {
    base: '#c9bf6a',
    soft: '#2e2a14',
    ink: '#16140a',
    glyph: '❋',
  },
};

export function paletteForThemes(themes: Theme[] | undefined): ThemePalette {
  if (!themes || themes.length === 0) return themePalettes.Praise;
  return themePalettes[themes[0]];
}
