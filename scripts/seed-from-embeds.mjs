#!/usr/bin/env node
// Builds src/data/catalog.json by scraping Spotify embed HTML pages.
// Zero auth, no Spotify API calls — just parses the public iframe pages.
//
// Usage:
//   node scripts/seed-from-embeds.mjs
//
// Edit the SOURCES array below to add Spotify playlist or album URLs.
// Each URL is converted to its embed equivalent, fetched, and the
// alternating "uri"/"title" JSON fields are paired up. Tracks whose title
// matches "Psalm N" become catalog entries. Existing entries (matched by
// id) are preserved.

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const CATALOG_PATH = join(ROOT, 'src', 'data', 'catalog.json');

// Each entry: { url, artist }. The artist is what gets stored in the
// catalog and is used for the id slug; we don't trust the embed's
// per-track subtitle since playlists can mix artists.
const SOURCES = [
  {
    url: 'https://open.spotify.com/playlist/4MUmKmfeLmfdGwO3j1eoYI',
    artist: 'Poor Bishop Hooper',
    album: 'EveryPsalm',
  },
  {
    url: 'https://open.spotify.com/album/7AVga88rqPT3HJbI9GPNxE',
    artist: 'My Soul Among Lions',
    album: 'Psalms 1-10',
  },
  {
    url: 'https://open.spotify.com/album/68sqZboiWSKZh4Hc5p2wSJ',
    artist: 'My Soul Among Lions',
    album: 'Psalms 11-20',
  },
  {
    url: 'https://open.spotify.com/album/0DmcuIULGbzZfvTCAXhqAq',
    artist: 'My Soul Among Lions',
    album: 'Song of the King: Psalms 21-30',
  },
  {
    url: 'https://open.spotify.com/album/4yYPJ5dAnpHHpSuuM4BwEC',
    artist: 'The Corner Room',
    album: 'Psalm Songs, Vol. 1',
  },
  {
    url: 'https://open.spotify.com/album/1s8v8YDwfWW6C1DTU7lWNm',
    artist: 'The Corner Room',
    album: 'Psalm Songs, Vol. 2',
  },
  {
    url: 'https://open.spotify.com/album/59YlrtdeCylPYUx3nySjpQ',
    artist: 'The Corner Room',
    album: 'Psalm Songs, Vol. 3',
  },
  {
    url: 'https://open.spotify.com/album/2txnSTlLVxNNcKXOtPPaNC',
    artist: 'Brian Sauvé',
    album: 'Sing Psalms, Let Joy Resound',
  },
  {
    url: 'https://open.spotify.com/album/11O32ryCROwtPulOI507kT',
    artist: 'Brian Sauvé',
    album: 'Psalm 37: He Fades Away',
  },
  {
    url: 'https://open.spotify.com/album/40TAbJ7suyjLqC4JUB4sRb',
    artist: 'Brian Sauvé',
    album: 'Even Dragons Shall Him Praise',
  },
  {
    url: 'https://open.spotify.com/album/2ddneuCWNq4qA5kcFQ9iYB',
    artist: 'Brian Sauvé',
    album: 'Awake the Dawn',
  },
  {
    url: 'https://open.spotify.com/album/5HVNaUhLBFltGFilZRrk37',
    artist: 'The Psalms Project',
    album: 'Vol. 1: Psalms 1-10',
  },
  {
    url: 'https://open.spotify.com/album/0p8djwXWV9uvNHdxiWGY0e',
    artist: 'The Psalms Project',
    album: 'Vol. 2: Psalms 11-20',
  },
  {
    url: 'https://open.spotify.com/album/2UcABwMV2pU68jIvvhCon4',
    artist: 'The Psalms Project',
    album: 'Vol. 3: Psalms 21-30',
  },
  {
    url: 'https://open.spotify.com/album/7vH54uv9YP6T4gl8LfqwHw',
    artist: 'The Psalms Project',
    album: 'Vol. 4: Psalms 31-38',
  },
  {
    url: 'https://open.spotify.com/album/4XVvUtbCWZIxLyIDpaoeDZ',
    artist: 'The Psalms Project',
    album: 'Vol. 5: Psalms 39-46',
  },
  {
    url: 'https://open.spotify.com/album/1S1d7AwlrKHFYIMmj8ENKZ',
    artist: 'The Psalms Project',
    album: 'Vol. 6: Psalms 47-55',
  },
  {
    url: 'https://open.spotify.com/album/70isKNwpXZtXdLbkSedL2X',
    artist: 'Exodus Music',
    album: 'Psalm 119, Vol. 1',
    psalmOverride: 119,
    titlePrefix: 'Psalm 119: ',
  },
  {
    url: 'https://open.spotify.com/album/7c63ZBFiPQdPaSflsUOXsR',
    artist: 'Exodus Music',
    album: 'Psalm 119, Vol. 2',
    psalmOverride: 119,
    titlePrefix: 'Psalm 119: ',
  },
  {
    url: 'https://open.spotify.com/album/4myjPLU0qhd4xUkM4XSsST',
    artist: 'Exodus Music',
    album: 'Psalm 119, Vol. 3',
    psalmOverride: 119,
    titlePrefix: 'Psalm 119: ',
  },
  {
    url: 'https://open.spotify.com/album/70jjH6qIewVs9B7UjZTHAL',
    artist: 'Cardiphonia Music',
    album: 'Psalm 119',
    psalmOverride: 119,
    titlePrefix: 'Psalm 119: ',
  },
  {
    url: 'https://open.spotify.com/album/7i9DsBj4P0ZSdF2rnK8UqT',
    artist: 'Cardiphonia Music',
    album: 'Hallel Psalms',
  },
  {
    url: 'https://open.spotify.com/album/0CQv1WwDy34JpPSdslsAkX',
    artist: 'Cardiphonia Music',
    album: 'The Songs of the Psalter, Vol. 5.1',
  },
  {
    url: 'https://open.spotify.com/album/3VkNpwz8SRAij5yVdkpVsM',
    artist: 'Scripture Hymnal',
    album: 'Scripture Hymnal, Vol. 1',
  },
  {
    url: 'https://open.spotify.com/album/3RkaqgPBP3XoyiTVqgT1u2',
    artist: 'Scripture Hymnal',
    album: 'Scripture Hymnal, Vol. 2',
  },
  {
    url: 'https://open.spotify.com/album/1AOjikQ4lazNXn9A5LE1TO',
    artist: 'Scripture Hymnal',
    album: 'Scripture Hymnal EP',
  },
  {
    url: 'https://open.spotify.com/album/0JNwWl1jD9fvbaMb4BnAvg',
    artist: 'The Verses Project',
    album: 'Psalm 139',
  },
  {
    url: 'https://open.spotify.com/album/6PrHJNopwXS4w5aWdkMleM',
    artist: 'The Verses Project',
    album: 'Psalm 91',
  },
  {
    url: 'https://open.spotify.com/album/2VBwVkXwL3GPOml7e6ceLF',
    artist: 'Verses',
    album: 'Psalm 20:6-8',
    psalmOverride: 20,
  },
  {
    url: 'https://open.spotify.com/album/1dYfTj3l7cE4z6iYSAZmVl',
    artist: 'Verses',
    album: 'Psalm 23:1-2',
    psalmOverride: 23,
  },
  {
    url: 'https://open.spotify.com/album/2POMvCRUyJ9rpnWKaMJc7F',
    artist: 'Verses',
    album: 'Psalm 34:9-11',
    psalmOverride: 34,
  },
  {
    url: 'https://open.spotify.com/album/2X6lwFjOeTvbtZ9g3dnTje',
    artist: 'Verses',
    album: 'Psalm 103:17-19',
    psalmOverride: 103,
  },
  {
    url: 'https://open.spotify.com/album/59KoCY5l3zZHoHOCzEzwSy',
    artist: 'Verses',
    album: 'Psalm 116:1-4',
    psalmOverride: 116,
  },
  {
    url: 'https://open.spotify.com/album/6eg3rNdvwYKWKYk7NMSeRJ',
    artist: 'Verses',
    album: 'Psalm 116:5-9',
    psalmOverride: 116,
  },
  {
    url: 'https://open.spotify.com/album/3NTzlr6c294C4HmGp5W6i3',
    artist: 'Liturgical Folk',
    album: 'Psalm Settings',
  },
  {
    url: 'https://open.spotify.com/album/7c1lrrTYnvqugBkp7pWoJL',
    artist: 'Joe Stout',
    album: 'Blest Is the Man Who Does Not Walk (Psalm 1)',
  },
  {
    url: 'https://open.spotify.com/album/29I7yJwkpxzPzE6ATBN9Zc',
    artist: 'Joe Stout',
    album: 'In Anger LORD, Rebuke Me Not (Psalm 6)',
  },
  {
    url: 'https://open.spotify.com/album/6kCGiWhb5Z2n92kwejGKcH',
    artist: 'Joe Stout',
    album: 'LORD, Our Lord, In All the Earth (Psalm 8)',
  },
  {
    url: 'https://open.spotify.com/album/2R8rb08LRfc5vSodyJklwH',
    artist: 'Brother Down',
    album: 'Old Paths New Feet',
  },
  {
    url: 'https://open.spotify.com/album/5VUcWWkxHniJ4yqtoNBTjS',
    artist: 'Brother Down',
    album: 'Old Paths New Feet (alt)',
  },
  {
    url: 'https://open.spotify.com/album/3tq4c23SfCWn8YYDKsXXNu',
    artist: 'Sandra McCracken',
    album: 'Psalms',
  },
  {
    url: 'https://open.spotify.com/album/3PqHK6bD9A8Wuo7kRAXNfU',
    artist: 'Coram Deo Church',
    album: 'Psalms',
  },
  {
    url: 'https://open.spotify.com/album/1bbqw1yjUv65tu6nuSZESx',
    artist: 'Coram Deo Church',
    album: 'Songs for the Sojourn, Volume 2',
  },
  {
    url: 'https://open.spotify.com/album/4WsURPoVBeTy3grMlyXPDC',
    artist: 'Coram Deo Church',
    album: 'Doxology',
  },
  {
    url: 'https://open.spotify.com/album/6znHMBtyZwbyqWyB0CAPkW',
    artist: 'Robbie Seay Band',
    album: 'Psalms LP',
  },
  {
    url: 'https://open.spotify.com/album/6VFy6mcp6qDQjhFdB6h8NB',
    artist: 'Shane & Shane',
    album: 'Psalms',
  },
  {
    url: 'https://open.spotify.com/album/6pwAGIb6tyzhbsxmEeoTYu',
    artist: 'Shane & Shane',
    album: 'Psalms, Vol. 2',
  },
  {
    url: 'https://open.spotify.com/album/3UzKQzSKz9lo1rGBDm7iFv',
    artist: 'Shane & Shane',
    album: 'Psalms Live',
  },
  {
    url: 'https://open.spotify.com/album/0zQOH5kEUD7CDho30wHTjf',
    artist: 'Shane & Shane',
    album: 'Psalms, Hymns, and Spiritual Songs, Vol. 1',
  },
  {
    url: 'https://open.spotify.com/album/5HQ1DoBSvOsNK0hTw0NvPv',
    artist: 'Shane & Shane',
    album: 'Psalms, Hymns, and Spiritual Songs (Live)',
  },
  {
    url: 'https://open.spotify.com/album/1ZDW5Zhwiq8E84QPoCNitK',
    artist: 'Nathan Clark George',
    album: 'Rise and Worship',
  },
  {
    url: 'https://open.spotify.com/album/4RAIcxwZ6pRmHm581Sjpz8',
    artist: 'Nathan Clark George',
    album: 'The Voice of the Lord (Psalm 29)',
  },
  {
    url: 'https://open.spotify.com/album/6tlbDGo6GbZ7M2w154Ha0e',
    artist: 'Zac Fitzsimmons',
    album: 'Psalms: Word for Word',
  },
  {
    url: 'https://open.spotify.com/album/05cezELBUXHxrjQJ31k3vV',
    artist: 'Zac Fitzsimmons',
    album: 'Psalms Word For Word: Volume 2',
  },
  {
    url: 'https://open.spotify.com/album/3MmqHaJzeV4AmaLgV5fSw3',
    artist: 'Zac Fitzsimmons',
    album: 'Psalm 5 Word For Word',
  },
  {
    url: 'https://open.spotify.com/album/19k0cNfcvMTJqEY0w3N3oh',
    artist: 'Zac Fitzsimmons',
    album: 'Psalm 4 Word For Word',
  },
  {
    url: 'https://open.spotify.com/album/5VI0oRN6YMdBjryTp3IVPT',
    artist: 'Zac Fitzsimmons',
    album: 'Psalm 84 Word For Word',
  },
  {
    url: 'https://open.spotify.com/album/7ESJp5Yy4kCFe5F2lHhpI5',
    artist: 'Tim Bushong',
    album: 'Battle Hymns for Weary Souls',
  },
  {
    url: 'https://open.spotify.com/album/79eaMz1V8RaMy21I5QKW9o',
    artist: 'Tim Bushong',
    album: 'Battle Hymns for Weary Souls II: Hail to Jesus',
  },
  {
    url: 'https://open.spotify.com/album/68JJU9Vxh4kLIBMyftKuNi',
    artist: 'Tim Bushong',
    album: 'Psalm 2: Why Do the Heathen Nations Vainly Rage?',
  },
  {
    url: 'https://open.spotify.com/album/43hJz2yvCf6BfObGTz3SKj',
    artist: 'Gregory Wilbur',
    album: 'My Cry Ascends: New Parish Psalms',
  },
  {
    url: 'https://open.spotify.com/album/5yiGb1rHNTs3nzJAwhOJTf',
    artist: 'Gregory Wilbur',
    album: 'Remember Not, O God: Psalm 79',
  },
  {
    url: 'https://open.spotify.com/album/1q3qe2SOuApOqxLxX4SWNC',
    artist: 'Wendell Kimbrough',
    album: 'Psalms We Sing Together',
  },
  {
    url: 'https://open.spotify.com/album/4nyv3LKJL0eb1Bh2tiYKX3',
    artist: 'Wendell Kimbrough',
    album: 'Let the Earth Be Glad (Psalm 96)',
  },
  {
    url: 'https://open.spotify.com/album/1ky9fgDdUQAdaMsVPs2E8l',
    artist: 'Caroline Cobb',
    album: 'Psalms: The Poetry of Prayer',
  },
  {
    url: 'https://open.spotify.com/album/4c4cEn07dXS7q9l4mwk5Ic',
    artist: 'Writers Well',
    album: 'Psalms from the Well',
  },
  {
    url: 'https://open.spotify.com/album/6kzgbvdFrR5oQ592604RTv',
    artist: 'Writers Well',
    album: 'Psalms from the Well (Deluxe Edition)',
  },
  {
    url: 'https://open.spotify.com/album/03xfhaO6ghABY2fBfcw0yi',
    artist: 'Writers Well',
    album: 'Psalms from the Well, Vol. 2 (Live)',
  },
  {
    url: 'https://open.spotify.com/album/0Klev9Xrmok3JnDpAn5OtD',
    artist: 'Writers Well',
    album: 'Psalms from the Well, Vol. 3',
  },
  {
    url: 'https://open.spotify.com/album/0qHno9rzk7aLAE4KOR57Ah',
    artist: 'Advent Birmingham',
    album: 'Our Strivings Cease',
  },
  {
    url: 'https://open.spotify.com/album/0e8zHs0emx0Gi23pXe7zMw',
    artist: 'Advent Birmingham',
    album: 'Hunger, Thirst, and Altar Fire',
  },
  {
    url: 'https://open.spotify.com/track/4C2Mtrzc33OmjPFt2QGtXH',
    artist: 'Keith Green',
    album: 'Songs for the Shepherd',
  },
  {
    url: 'https://open.spotify.com/track/2b5hbrwwjpKuQUJRCZVec3',
    artist: 'Keith Green',
    album: 'The Ministry Years, Volume 2',
    psalmOverride: 23,
  },
  {
    url: 'https://open.spotify.com/track/5uxacKc9x3xMRnCzP0CxHG',
    artist: 'Keith Green',
    album: 'For Him Who Has Ears to Hear',
    psalmOverride: 51,
  },
  { url: 'https://open.spotify.com/album/2ULRUZkzTz8z0nB5pscbur', artist: 'Sons of Korah', album: 'Psalm 1' },
  { url: 'https://open.spotify.com/album/4qNl1fzBEfHPBBZTHdSqNd', artist: 'Sons of Korah', album: 'Psalm 23' },
  { url: 'https://open.spotify.com/album/3065cOLiTlTxcZAb9xVvdQ', artist: 'Sons of Korah', album: 'Psalm 46b' },
  { url: 'https://open.spotify.com/album/6KnddBElOTjyoaCsGXNPRr', artist: 'Sons of Korah', album: 'Psalm 51' },
  { url: 'https://open.spotify.com/album/3pg5KRMtvhNU0sDfOqtx00', artist: 'Sons of Korah', album: 'Psalm 68c' },
  { url: 'https://open.spotify.com/album/0BFCfV9AdVA3j6qT9ZqdJZ', artist: 'Sons of Korah', album: 'Psalm 80' },
  { url: 'https://open.spotify.com/album/5VaAB3RtG3obN4V1g5vI9J', artist: 'Sons of Korah', album: 'Psalm 88c' },
  { url: 'https://open.spotify.com/album/2alH2AAHFSP38506JIXGxi', artist: 'Sons of Korah', album: 'Psalm 91' },
  { url: 'https://open.spotify.com/album/7x8Bxn8eDGd9GQsUWWb87L', artist: 'Sons of Korah', album: 'Psalm 94' },
  { url: 'https://open.spotify.com/album/1tBQ09rKaaOCgLUB2ojfFO', artist: 'Sons of Korah', album: 'Psalm 95' },
  { url: 'https://open.spotify.com/album/7ALzG0zoNumsp78nsdCjWs', artist: 'Sons of Korah', album: 'Psalm 110' },
  { url: 'https://open.spotify.com/album/3XmZPEBnM0PtDahRDCzxRr', artist: 'Sons of Korah', album: 'Psalm 119 (Nun)' },
  { url: 'https://open.spotify.com/album/1orvUcFmeKgVO85RYkMi3w', artist: 'Sons of Korah', album: 'Psalm 121' },
  { url: 'https://open.spotify.com/album/4E46F0nfe49LaewYE1Q6W0', artist: 'Sons of Korah', album: 'Psalm 139' },
  { url: 'https://open.spotify.com/album/7H7aTjlNu58mMD9XtFnmZ1', artist: 'Sons of Korah', album: 'Psalm 16' },
  { url: 'https://open.spotify.com/album/02XrjHvvv8zCulClMCWJOY', artist: 'Sons of Korah', album: 'Psalm 27b' },
  { url: 'https://open.spotify.com/album/3smLoYwJHHyKpF56Up3fc2', artist: 'Sons of Korah', album: 'Psalm 68e' },
  { url: 'https://open.spotify.com/album/25zYhCZ2TKQfBJna8G92n5', artist: 'Sons of Korah', album: 'Psalm 116' },
  {
    url: 'https://open.spotify.com/album/1hNcP5wPDySPz9FiThpBy7',
    artist: 'Cardiphonia Music',
    album: 'Joy to the World (Psalms 90-106)',
  },
  {
    url: 'https://open.spotify.com/album/5KVIT3Z6HSaaTQjy0ZOOMA',
    artist: 'Cardiphonia Music',
    album: 'Stewarding Praise (Psalms 107-112)',
  },
  {
    url: 'https://open.spotify.com/album/56IfebZLZzx41ameKTQiW0',
    artist: 'Cardiphonia Music',
    album: 'Restore Us O God, Volume 1 (Psalms 73-89)',
  },
  {
    url: 'https://open.spotify.com/album/639j8NtluMUEV38YYdYHcj',
    artist: 'Brian Sauvé',
    album: 'Bright, the Rider',
  },
  {
    url: 'https://open.spotify.com/album/7v5CzJxRFOcwp0tg5eLxof',
    artist: 'Brian Sauvé',
    album: 'Songs Worth Singing',
  },
  {
    url: 'https://open.spotify.com/album/4VXVNyB00sCrZKxGfJdzOS',
    artist: 'Wendell Kimbrough',
    album: 'Come to Me',
  },
  {
    url: 'https://open.spotify.com/album/1GTQiSY1PpsgeHaNQaf0vz',
    artist: 'Wendell Kimbrough',
    album: 'You Belong',
  },
  {
    url: 'https://open.spotify.com/album/2ktdd3j5ou13mMlPmcJ0zR',
    artist: 'Wendell Kimbrough',
    album: 'Planted Like Trees',
  },
  {
    url: 'https://open.spotify.com/album/2pFMjs1wqF8eOJwGMXj3V7',
    artist: 'Wendell Kimbrough',
    album: 'Hymns and Friends',
  },
  {
    url: 'https://open.spotify.com/album/2YTAVqMrTQNBFg1dRwsGp1',
    artist: 'Wendell Kimbrough',
    album: 'See How Good It Is (Psalm 133)',
    psalmOverride: 133,
  },
  {
    url: 'https://open.spotify.com/album/2lBHQT5RAcQjd5Dni0Uc1B',
    artist: 'Wendell Kimbrough',
    album: 'Advent',
  },
  {
    url: 'https://open.spotify.com/album/5JOqqxuTbP7pFyjcPS6v6j',
    artist: 'Sandra McCracken',
    album: "God's Highway",
  },
  {
    url: 'https://open.spotify.com/album/7tmxXlKEXhR3ZecVAEGwwD',
    artist: 'Robbie Seay Band',
    album: 'Psalms, Vol. 2 - EP',
  },
  {
    url: 'https://open.spotify.com/album/4DAHk7atebpr0XM5mGE63d',
    artist: 'Scripture Hymnal',
    album: 'Scripture Hymnal, Vol. 3',
  },
  {
    url: 'https://open.spotify.com/album/74zJvUgEVnZmSzNLJTVxxQ',
    artist: 'Scripture Hymnal',
    album: 'Scripture Hymnal, Vol. 4',
  },
  {
    url: 'https://open.spotify.com/album/3hZmM8u2THShCW4PIIR7dA',
    artist: 'Scripture Hymnal',
    album: 'Scripture Hymnal, Vol. 5',
  },
  {
    url: 'https://open.spotify.com/album/5XGTvjNvL0ZWxsgm5s45bD',
    artist: 'Scripture Hymnal',
    album: 'Scripture Hymnal, Vol. 6',
  },
  {
    url: 'https://open.spotify.com/album/0lrb78FZhsmv5b8LHmQSIQ',
    artist: 'Scripture Hymnal',
    album: 'Scripture Hymnal, Vol. 7',
  },
  {
    url: 'https://open.spotify.com/album/7IMeLI6c6HnTK2WjyWyQmf',
    artist: 'Nathan Clark George',
    album: 'To Live Is Christ',
  },
  {
    url: 'https://open.spotify.com/album/5grgr1JPaH35QwDT8BiAK9',
    artist: 'Nathan Clark George',
    album: 'Words for Everyday',
  },
  {
    url: 'https://open.spotify.com/album/1a3I8PF6a2ULuoqVJQjPWn',
    artist: 'Nathan Clark George',
    album: 'Pull Up a Chair',
  },
  {
    url: 'https://open.spotify.com/album/007kFIMjObPtdwCmbMYcTy',
    artist: 'Nathan Clark George',
    album: 'Rise in the Darkness',
  },
  {
    url: 'https://open.spotify.com/album/0AwjaY7BnvGLbz696GZVsu',
    artist: 'Nathan Clark George',
    album: 'Turn Your Ear and Answer (Psalm 86)',
    psalmOverride: 86,
  },
  {
    url: 'https://open.spotify.com/album/3qIlNgDIL0ccJHfZY3cADf',
    artist: 'Nathan Clark George',
    album: 'Unto You O Lord (Psalm 25)',
    psalmOverride: 25,
  },
  {
    url: 'https://open.spotify.com/album/5aieFBjeSSlN3bTmbM394x',
    artist: 'Joe Stout',
    album: 'Praise the LORD, All You Gentiles (Psalm 117)',
    psalmOverride: 117,
  },
  {
    url: 'https://open.spotify.com/album/4bCkRSx5J0RwTVnx4nZkDS',
    artist: 'Tim Bushong',
    album: 'Battle Hymns III: Rise Again, Ye Lion Hearted',
  },
  {
    url: 'https://open.spotify.com/album/36H6Ewrg2M8vlNrmcOrhV2',
    artist: 'Gregory Wilbur',
    album: 'Securely I Will Dwell',
  },
  {
    url: 'https://open.spotify.com/album/2xauMyMcVDmGtQVPt5R5uA',
    artist: 'Gregory Wilbur',
    album: 'Praise Your Maker',
  },
  {
    url: 'https://open.spotify.com/album/1n25m337vTlJ4ccxJzqCPW',
    artist: 'Gregory Wilbur',
    album: 'In Beauty of Holiness (Remastered)',
  },
  {
    url: 'https://open.spotify.com/album/2tGqMl4FiikcPvMlWdrXtX',
    artist: 'Sovereign Grace Music',
    album: 'Unchanging God: Songs from the Book of Psalms, Vol. 1',
  },
  {
    url: 'https://open.spotify.com/album/6LM6JFK07PBR23fXtI0mSt',
    artist: 'Sovereign Grace Music',
    album: 'Unchanging God: Songs from the Book of Psalms, Vol. 2',
  },
  {
    url: 'https://open.spotify.com/album/1N9I0ZHf2nvzJfJXBCIqa4',
    artist: 'Crown & Covenant',
    album: 'Covenant: Selections From the Book of Psalms for Worship',
  },
  {
    url: 'https://open.spotify.com/album/3A5tQVFVfhHHQsls7xabco',
    artist: 'Crown & Covenant',
    album: 'Glory: Selections from the Book of Psalms for Worship',
  },
  {
    url: 'https://open.spotify.com/album/0POWlvCBU7LpVXly2c3Xca',
    artist: 'Crown & Covenant',
    album: 'Trust: Selections from the Book of Psalms for Worship',
  },
  {
    url: 'https://open.spotify.com/album/6QOLDAZjIIhSlhW98fkOnw',
    artist: 'Crown & Covenant',
    album: 'Refuge: Selections from the Book of Psalms for Worship',
  },
  {
    url: 'https://open.spotify.com/album/2wfLG9ufqsZl0sUJrvpCFw',
    artist: 'Crown & Covenant',
    album: 'Abundance: Selections from the Book of Psalms for Worship',
  },
  {
    url: 'https://open.spotify.com/album/7jEh3lqq5u5YVIjvSLZgIm',
    artist: 'Crown & Covenant',
    album: 'Restoration: Selections from the Book of Psalms for Worship',
  },
  {
    url: 'https://open.spotify.com/album/3rjE1Deb6yl971bf3JAn8R',
    artist: 'Crown & Covenant',
    album: 'Zion: Selections from the Book of Psalms for Worship',
  },
  {
    url: 'https://open.spotify.com/album/7fiWVAi8rhRy3185Fb3uJb',
    artist: 'Crown & Covenant',
    album: 'Communion: Selections from the Book of Psalms for Worship',
  },
  {
    url: 'https://open.spotify.com/album/4x70LhtInanAi1d2muXoT2',
    artist: 'Crown & Covenant',
    album: 'Sing a New Song: Selections from the Book of Psalms for Singing',
  },
  {
    url: 'https://open.spotify.com/album/1AcxyQsATsRuDf2jYKTrHh',
    artist: 'Crown & Covenant',
    album: 'I Am: Kids Sing Psalms!',
  },
];

const PSALM_RE = /\bPsalm\s+(\d{1,3})[A-Za-z]?\b/i;
// Psalter notation used by Crown & Covenant et al.: "Some Title (33B)" where
// the digits are the psalm and the optional trailing letter is the tune variant.
const PSALM_PARENS_RE = /\((\d{1,3})[A-Z]?\)/;
// Same notation as a leading prefix: "32a: What Blessedness".
const PSALM_PREFIX_RE = /^(\d{1,3})[a-z]?:\s/i;
const URI_RE = /"uri":"spotify:track:([A-Za-z0-9]{22})"/g;
const TITLE_RE = /"title":"((?:[^"\\]|\\.)*)"/g;
const DUR_RE = /"duration":(\d+)/g;
// Spotify embeds preload the cover image at a CDN URL. The hash suffix is the
// same across sizes; the `b273` prefix is the 640x640 variant we want.
const COVER_RE = /(?:i\.scdn\.co|image-cdn-[a-z]+\.spotifycdn\.com)\/image\/([a-f0-9]{40})/g;

function toEmbedUrl(spotifyUrl) {
  const m = spotifyUrl.match(/open\.spotify\.com\/(playlist|album|track)\/([A-Za-z0-9]+)/);
  if (!m) throw new Error(`Not a recognised Spotify URL: ${spotifyUrl}`);
  return `https://open.spotify.com/embed/${m[1]}/${m[2]}`;
}

function slug(s) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 12);
}

function unescapeJson(s) {
  // Minimal JSON string unescape for \", \\, \n, \uXXXX
  return s.replace(/\\(["\\/bfnrt])|\\u([0-9a-fA-F]{4})/g, (_, c, u) => {
    if (u) return String.fromCharCode(parseInt(u, 16));
    return { '"': '"', '\\': '\\', '/': '/', b: '\b', f: '\f', n: '\n', r: '\r', t: '\t' }[c];
  });
}

async function fetchEmbed(url) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 30000);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.text();
  } finally {
    clearTimeout(timer);
  }
}

function parseTracks(html) {
  // The embed renders an alternating stream of "uri" then "title" entries
  // for each track. We collect both arrays in document order and pair them.
  const uris = [];
  let m;
  URI_RE.lastIndex = 0;
  while ((m = URI_RE.exec(html))) uris.push(m[1]);

  const titles = [];
  TITLE_RE.lastIndex = 0;
  while ((m = TITLE_RE.exec(html))) titles.push(unescapeJson(m[1]));

  // First "title" is the playlist/album title — drop it.
  if (titles.length > uris.length) titles.shift();

  const durs = [];
  DUR_RE.lastIndex = 0;
  while ((m = DUR_RE.exec(html))) durs.push(parseInt(m[1], 10));
  // First "duration" is the collection-level summary (often 0) — drop it so
  // the remaining list aligns with uris.
  if (durs.length > uris.length) durs.shift();

  const tracks = [];
  for (let i = 0; i < Math.min(uris.length, titles.length); i++) {
    tracks.push({
      id: uris[i],
      title: titles[i],
      durationSec: durs[i] ? Math.round(durs[i] / 1000) : undefined,
    });
  }
  return tracks;
}

function parseCoverUrl(html) {
  // Embed pages reference the cover at 3 sizes that share a hash suffix.
  // Strip the size prefix (first 8 hex chars) and rebuild with `ab67616d0000b273`
  // (640x640 for albums) or `ab67706c0000bebb` (640x640 for playlists).
  COVER_RE.lastIndex = 0;
  const hashes = new Set();
  let m;
  while ((m = COVER_RE.exec(html))) hashes.add(m[1]);
  if (hashes.size === 0) return null;
  // Prefer a hash starting with the 640x640 album prefix; otherwise take the
  // first hash and assume the prefix indicates whether it's an album or
  // playlist cover.
  const list = [...hashes];
  const album640 = list.find((h) => h.startsWith('ab67616d0000b273'));
  if (album640) return `https://i.scdn.co/image/${album640}`;
  const playlist640 = list.find((h) => h.startsWith('ab67706c0000bebb'));
  if (playlist640) return `https://i.scdn.co/image/${playlist640}`;
  // Fall back to whichever hash we have. Strip the size prefix and force 640x640.
  const any = list[0];
  const suffix = any.slice(16);
  // Album hashes use ab67616d* prefix, playlists use ab67706c*.
  const prefix = any.startsWith('ab67706c') ? 'ab67706c0000bebb' : 'ab67616d0000b273';
  return `https://i.scdn.co/image/${prefix}${suffix}`;
}

function isVocalPsalmTrack(title) {
  if (!title) return null;
  if (/instrumental/i.test(title)) return null;
  if (/karaoke|accompaniment|piano version|guitar version/i.test(title))
    return null;
  const m =
    title.match(PSALM_RE) ??
    title.match(PSALM_PARENS_RE) ??
    title.match(PSALM_PREFIX_RE);
  if (!m) return null;
  const n = parseInt(m[1], 10);
  if (n < 1 || n > 150) return null;
  return n;
}

// Some sources (e.g. an album that's all of Psalm 119 split by Hebrew
// letter) don't have "Psalm N" in track titles. The source config can set
// psalmOverride to force-tag every track in the source with that psalm.
function shouldKeepTrackForSource(track, source) {
  if (!track || !track.title) return null;
  if (/instrumental/i.test(track.title)) return null;
  if (/karaoke|accompaniment|piano version|guitar version/i.test(track.title))
    return null;
  if (typeof source.psalmOverride === 'number') {
    return source.psalmOverride;
  }
  return isVocalPsalmTrack(track.title);
}

function buildEntry({ track, psalm, artist, album, albumCoverUrl }) {
  const id = `${slug(artist)}-${String(psalm).padStart(3, '0')}-${track.id.slice(0, 6)}`;
  const entry = {
    id,
    psalm,
    title: track.title,
    artist,
    album,
    spotifyUrl: `https://open.spotify.com/track/${track.id}`,
  };
  if (albumCoverUrl) entry.albumCoverUrl = albumCoverUrl;
  if (track.durationSec) entry.durationSec = track.durationSec;
  return entry;
}

function dedupeBySpotifyUrl(songs) {
  // When two entries point to the same Spotify track, prefer the one
  // with the shorter id (typically the hand-curated "pbh-001" form)
  // over the auto-generated "poor-bishop--001-1ipqa2" form.
  const byUrl = new Map();
  let removed = 0;
  for (const s of songs) {
    if (!s.spotifyUrl) {
      byUrl.set(`__no-url__${s.id}`, s);
      continue;
    }
    const existing = byUrl.get(s.spotifyUrl);
    if (!existing) {
      byUrl.set(s.spotifyUrl, s);
      continue;
    }
    removed += 1;
    if (s.id.length < existing.id.length) byUrl.set(s.spotifyUrl, s);
  }
  return { songs: Array.from(byUrl.values()), removed };
}

function mergeIntoCatalog(existing, freshEntries) {
  const byId = new Map();
  for (const s of existing.songs) byId.set(s.id, s);
  // Also index existing by Spotify URL so we can backfill metadata onto
  // hand-curated entries that use a different (shorter) id.
  const byUrl = new Map();
  for (const s of existing.songs) {
    if (s.spotifyUrl) byUrl.set(s.spotifyUrl, s);
  }
  let added = 0;
  let backfilled = 0;
  for (const entry of freshEntries) {
    if (byId.has(entry.id)) {
      // Same id — backfill missing fields (e.g. albumCoverUrl on older entries).
      const e = byId.get(entry.id);
      let changed = false;
      for (const k of ['album', 'albumCoverUrl', 'durationSec']) {
        if (!e[k] && entry[k]) {
          e[k] = entry[k];
          changed = true;
        }
      }
      if (changed) backfilled += 1;
      continue;
    }
    const existingByUrl = entry.spotifyUrl ? byUrl.get(entry.spotifyUrl) : null;
    if (existingByUrl) {
      // URL match but different id — backfill onto the existing (shorter-id) entry.
      let changed = false;
      for (const k of ['album', 'albumCoverUrl', 'durationSec']) {
        if (!existingByUrl[k] && entry[k]) {
          existingByUrl[k] = entry[k];
          changed = true;
        }
      }
      if (changed) backfilled += 1;
      continue;
    }
    byId.set(entry.id, entry);
    added += 1;
  }
  const all = Array.from(byId.values());
  const { songs: deduped, removed } = dedupeBySpotifyUrl(all);
  deduped.sort(
    (a, b) =>
      a.psalm - b.psalm ||
      a.artist.localeCompare(b.artist) ||
      a.title.localeCompare(b.title),
  );
  return { songs: deduped, added, removed, backfilled };
}

async function main() {
  const allEntries = [];
  for (const src of SOURCES) {
    const embed = toEmbedUrl(src.url);
    console.log(`Fetching ${embed}…`);
    let html;
    try {
      html = await fetchEmbed(embed);
    } catch (e) {
      console.warn(`  ⚠  ${src.url}: ${e.message ?? e}`);
      continue;
    }
    const tracks = parseTracks(html);
    const albumCoverUrl = parseCoverUrl(html);
    console.log(`  parsed ${tracks.length} tracks${albumCoverUrl ? ' + cover' : ''}`);
    let kept = 0;
    for (const t of tracks) {
      const psalm = shouldKeepTrackForSource(t, src);
      if (psalm == null) continue;
      const titled = src.titlePrefix
        ? { ...t, title: `${src.titlePrefix}${t.title}` }
        : t;
      allEntries.push(
        buildEntry({
          track: titled,
          psalm,
          artist: src.artist,
          album: src.album,
          albumCoverUrl,
        }),
      );
      kept += 1;
    }
    console.log(`  → ${kept} Psalm-titled tracks`);
  }

  const existing = JSON.parse(readFileSync(CATALOG_PATH, 'utf8'));
  const merged = mergeIntoCatalog(existing, allEntries);
  writeFileSync(
    CATALOG_PATH,
    JSON.stringify({ songs: merged.songs }, null, 2) + '\n',
  );
  const psalmsCovered = new Set(merged.songs.map((s) => s.psalm)).size;
  const withCover = merged.songs.filter((s) => s.albumCoverUrl).length;
  const withDur = merged.songs.filter((s) => s.durationSec).length;
  console.log(
    `\nWrote ${merged.songs.length} songs (+${merged.added} new, ~${merged.backfilled} backfilled, -${merged.removed} dupes) — ${psalmsCovered}/150 Psalms covered, ${withCover} with cover art, ${withDur} with duration.`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
