export type Theme =
  | 'Praise'
  | 'Lament'
  | 'Thanksgiving'
  | 'Confidence'
  | 'Kingship'
  | 'Remembrance'
  | 'Wisdom';

export interface Psalm {
  number: number;
  title: string;
  themes: Theme[];
}

export interface Song {
  id: string;
  psalm: number;
  title: string;
  artist: string;
  album?: string;
  durationSec?: number;
  spotifyUrl?: string;
  themes?: Theme[];
}
