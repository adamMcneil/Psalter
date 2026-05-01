export interface FeaturedPlaylist {
  id: string;
  title: string;
  blurb: string;
  psalms: number[];
}

export const featuredPlaylists: FeaturedPlaylist[] = [
  {
    id: 'songs-of-ascent',
    title: 'Songs of Ascent',
    blurb:
      'Psalms 120–134, sung by pilgrims on the road up to Jerusalem.',
    psalms: [
      120, 121, 122, 123, 124, 125, 126, 127, 128, 129, 130, 131, 132, 133, 134,
    ],
  },
  {
    id: 'morning-psalms',
    title: 'Morning Psalms',
    blurb: 'A liturgy of psalms to start the day.',
    psalms: [3, 5, 19, 63, 92, 100, 118, 143],
  },
  {
    id: 'evening-psalms',
    title: 'Evening Psalms',
    blurb: 'Compline-shaped psalms for night prayer.',
    psalms: [4, 31, 91, 134, 139],
  },
  {
    id: 'psalms-for-mourning',
    title: 'Psalms for Mourning',
    blurb: 'Honest laments for grief, doubt, and the dark.',
    psalms: [6, 13, 22, 42, 51, 77, 88, 102, 130, 137],
  },
  {
    id: 'kingship',
    title: 'The Reign of the Anointed',
    blurb: 'Royal and messianic psalms about the King.',
    psalms: [2, 18, 20, 21, 24, 45, 47, 72, 89, 110, 132],
  },
  {
    id: 'great-thanksgiving',
    title: 'Great Thanksgiving',
    blurb: 'Psalms of declared gratitude and remembered rescue.',
    psalms: [30, 32, 34, 40, 92, 100, 103, 107, 116, 118, 138],
  },
  {
    id: 'praise-the-lord',
    title: 'Praise the Lord',
    blurb: 'Hallel and doxology — the Psalter ends in praise.',
    psalms: [113, 114, 115, 116, 117, 118, 145, 146, 147, 148, 149, 150],
  },
];

export const playlistById = (id: string): FeaturedPlaylist | undefined =>
  featuredPlaylists.find((p) => p.id === id);
