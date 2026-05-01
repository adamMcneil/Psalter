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

export type LicenseKind =
  | 'Permission'
  | 'CC-BY'
  | 'CC-BY-SA'
  | 'CC-BY-NC'
  | 'CC0'
  | 'PublicDomain';

export interface License {
  kind: LicenseKind;
  notes?: string;
}

export interface Song {
  id: string;
  psalm: number;
  title: string;
  artist: string;
  album?: string;
  durationSec: number;
  url: string;
  artworkUrl?: string;
  license: License;
}
