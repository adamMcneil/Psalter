import raw from './catalog.json';
import { Song } from '../types';

export const catalog: Song[] = (raw.songs as Song[]).slice();

export const songsForPsalm = (n: number): Song[] =>
  catalog.filter((s) => s.psalm === n);

export const songById = (id: string): Song | undefined =>
  catalog.find((s) => s.id === id);
