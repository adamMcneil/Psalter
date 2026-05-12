import { useMemo, useState } from 'react';
import { Link, Stack, useLocalSearchParams } from 'expo-router';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { Screen } from '@/components/Screen';
import { SongRow } from '@/components/SongRow';
import { ArtistAvatar } from '@/components/ArtistAvatar';
import { songsByArtist } from '@/data/catalog';
import { Song } from '@/types';
import { colors, fontSize, radius, spacing } from '@/theme';

const AVATAR_TINTS = [
  { bg: '#3a2912', fg: '#d4a24a' },
  { bg: '#1a2438', fg: '#6b8cd1' },
  { bg: '#1a2c20', fg: '#7fb38a' },
  { bg: '#321e15', fg: '#c98a6e' },
  { bg: '#241934', fg: '#a987d1' },
  { bg: '#16262d', fg: '#7ab1c4' },
  { bg: '#2e2a14', fg: '#c9bf6a' },
];

function tintFor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) | 0;
  return AVATAR_TINTS[Math.abs(h) % AVATAR_TINTS.length];
}

type SortMode = 'psalm' | 'title' | 'album';

const SORTS: { id: SortMode; label: string }[] = [
  { id: 'psalm', label: 'Psalm #' },
  { id: 'title', label: 'A → Z' },
  { id: 'album', label: 'Album' },
];

function sortSongs(songs: Song[], mode: SortMode): Song[] {
  const copy = songs.slice();
  switch (mode) {
    case 'psalm':
      return copy.sort(
        (a, b) => a.psalm - b.psalm || a.title.localeCompare(b.title),
      );
    case 'title':
      return copy.sort((a, b) => a.title.localeCompare(b.title));
    case 'album':
      return copy.sort((a, b) => {
        const ax = a.album ?? '~';
        const bx = b.album ?? '~';
        return ax.localeCompare(bx) || a.psalm - b.psalm;
      });
  }
}

export default function ArtistDetail() {
  const { name } = useLocalSearchParams<{ name: string }>();
  const artistName = decodeURIComponent(name ?? '');
  const allSongs = songsByArtist(artistName);
  const tint = tintFor(artistName);
  const psalmCount = new Set(allSongs.map((s) => s.psalm)).size;
  const albumCount = new Set(
    allSongs.map((s) => s.album).filter(Boolean),
  ).size;

  const hasAlbums = albumCount > 0;
  const [sort, setSort] = useState<SortMode>('psalm');
  const songs = useMemo(() => sortSongs(allSongs, sort), [allSongs, sort]);

  const psalmSongCounts = useMemo(() => {
    const m = new Map<number, number>();
    for (const s of allSongs) m.set(s.psalm, (m.get(s.psalm) ?? 0) + 1);
    return m;
  }, [allSongs]);
  const coveragePct = Math.round((psalmCount / 150) * 100);

  const visibleSorts = SORTS.filter((s) => s.id !== 'album' || hasAlbums);

  const sortHint =
    sort === 'psalm'
      ? 'In Psalm order'
      : sort === 'title'
        ? 'Alphabetical'
        : 'By album';

  return (
    <Screen>
      <Stack.Screen options={{ title: artistName || 'Artist' }} />
      <FlatList
        data={songs}
        keyExtractor={(s) => s.id}
        renderItem={({ item }) => <SongRow song={item} queue={songs} />}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View>
            <View
              style={[
                styles.hero,
                { backgroundColor: tint.bg, borderColor: tint.fg },
              ]}
            >
              <View style={styles.avatarWrap}>
                <ArtistAvatar
                  name={artistName}
                  size={64}
                  bg={tint.fg + '22'}
                  fg={tint.fg}
                  bordered
                />
              </View>
              <Text style={[styles.kicker, { color: tint.fg }]}>ARTIST</Text>
              <Text style={styles.title}>{artistName}</Text>
              <Text style={styles.meta}>
                {allSongs.length} song{allSongs.length === 1 ? '' : 's'} ·{' '}
                {psalmCount} psalm{psalmCount === 1 ? '' : 's'}
                {hasAlbums
                  ? ` · ${albumCount} album${albumCount === 1 ? '' : 's'}`
                  : ''}
              </Text>
            </View>

            <View style={styles.coverageHeader}>
              <Text style={styles.section}>Coverage</Text>
              <Text style={[styles.coverageStat, { color: tint.fg }]}>
                {psalmCount} / 150 · {coveragePct}%
              </Text>
            </View>
            <View style={styles.grid}>
              {Array.from({ length: 15 }).map((_, row) => {
                const start = row * 10 + 1;
                return (
                  <View key={row} style={styles.gridRow}>
                    <Text style={styles.rowLabel}>{start}</Text>
                    <View style={styles.cells}>
                      {Array.from({ length: 10 }).map((_, col) => {
                        const num = start + col;
                        const count = psalmSongCounts.get(num) ?? 0;
                        const covered = count > 0;
                        const intense = count >= 2;
                        return (
                          <Link
                            key={num}
                            href={`/psalm/${num}`}
                            asChild
                          >
                            <Pressable
                              style={styles.cellPressable}
                              accessibilityLabel={`Psalm ${num}${
                                covered
                                  ? `, ${count} song${count === 1 ? '' : 's'}`
                                  : ' (no song)'
                              }`}
                            >
                              {({ pressed }) => (
                                <View
                                  style={[
                                    styles.cell,
                                    covered && {
                                      backgroundColor: tint.fg,
                                      borderColor: tint.fg,
                                    },
                                    intense && styles.cellIntense,
                                    pressed && styles.pressed,
                                  ]}
                                >
                                  {count > 1 ? (
                                    <Text
                                      style={[
                                        styles.cellNum,
                                        { color: tint.bg },
                                      ]}
                                    >
                                      {count}
                                    </Text>
                                  ) : null}
                                </View>
                              )}
                            </Pressable>
                          </Link>
                        );
                      })}
                    </View>
                  </View>
                );
              })}
            </View>
            <View style={styles.legendRow}>
              <View style={styles.legendItem}>
                <View
                  style={[
                    styles.legendSwatch,
                    { backgroundColor: colors.surfaceAlt, borderColor: colors.borderSoft },
                  ]}
                />
                <Text style={styles.legendText}>None</Text>
              </View>
              <View style={styles.legendItem}>
                <View
                  style={[
                    styles.legendSwatch,
                    { backgroundColor: tint.fg, borderColor: tint.fg },
                  ]}
                />
                <Text style={styles.legendText}>1 song</Text>
              </View>
              <View style={styles.legendItem}>
                <View
                  style={[
                    styles.legendSwatch,
                    { backgroundColor: tint.fg },
                    styles.cellIntense,
                  ]}
                />
                <Text style={styles.legendText}>2+</Text>
              </View>
            </View>

            <View style={styles.sortHeader}>
              <Text style={styles.section}>Songs</Text>
              <Text style={[styles.sortHint, { color: tint.fg }]}>
                {sortHint}
              </Text>
            </View>

            <View style={styles.sortRow}>
              {visibleSorts.map((s) => {
                const on = sort === s.id;
                return (
                  <Pressable
                    key={s.id}
                    onPress={() => setSort(s.id)}
                    style={({ pressed }) => [
                      styles.sortChip,
                      on && {
                        backgroundColor: tint.fg + '22',
                        borderColor: tint.fg,
                      },
                      pressed && styles.pressed,
                    ]}
                    accessibilityLabel={`Sort by ${s.label}`}
                  >
                    <Text
                      style={[
                        styles.sortChipText,
                        on && { color: tint.fg },
                      ]}
                    >
                      {s.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        }
        ListEmptyComponent={
          <Text style={styles.empty}>No songs found for this artist.</Text>
        }
        contentContainerStyle={{ paddingBottom: spacing.xl }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: {
    marginTop: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    alignItems: 'flex-start',
  },
  avatarWrap: { marginBottom: spacing.md },
  kicker: {
    fontWeight: '800',
    letterSpacing: 1.6,
    fontSize: fontSize.xs,
  },
  title: {
    color: colors.text,
    fontSize: fontSize.h1,
    fontWeight: '800',
    marginTop: spacing.xs,
    letterSpacing: -0.5,
  },
  meta: {
    color: colors.textMuted,
    fontSize: fontSize.md,
    marginTop: spacing.xs,
  },
  coverageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  coverageStat: {
    fontWeight: '800',
    fontSize: fontSize.sm,
    letterSpacing: 0.4,
  },
  grid: {
    gap: 3,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.sm,
  },
  gridRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  rowLabel: {
    color: colors.textDim,
    fontSize: 9,
    fontWeight: '700',
    width: 22,
    textAlign: 'right',
  },
  cells: {
    flexDirection: 'row',
    gap: 3,
    flex: 1,
  },
  cellPressable: {
    flex: 1,
  },
  cell: {
    height: 18,
    borderRadius: 3,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cellIntense: {
    borderWidth: 2,
    borderColor: colors.text,
  },
  cellNum: {
    fontSize: 9,
    fontWeight: '800',
  },
  legendRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.xs,
    marginBottom: spacing.xs,
    paddingHorizontal: spacing.xs,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendSwatch: {
    width: 12,
    height: 12,
    borderRadius: 3,
    borderWidth: 1,
  },
  legendText: {
    color: colors.textDim,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  sortHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.lg,
  },
  section: {
    color: colors.textMuted,
    fontWeight: '800',
    fontSize: fontSize.xs,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  sortHint: {
    fontWeight: '700',
    fontSize: fontSize.xs,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  sortRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
  },
  sortChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.pill,
    borderWidth: 1,
    backgroundColor: colors.surface,
    borderColor: colors.border,
  },
  sortChipText: {
    color: colors.textMuted,
    fontSize: fontSize.sm,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  pressed: { opacity: 0.78, transform: [{ scale: 0.99 }] },
  empty: {
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.xl,
  },
});
