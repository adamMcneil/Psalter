import { useMemo } from 'react';
import { useLocalSearchParams, Stack } from 'expo-router';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { Screen } from '@/components/Screen';
import { SongRow } from '@/components/SongRow';
import { PlayControls } from '@/components/PlayControls';
import { psalmByNumber } from '@/data/psalms';
import {
  formatDuration,
  PSALM_119_SECTIONS,
  Psalm119Section,
  sectionForPsalm119Song,
  songsForPsalm,
  totalDurationSec,
} from '@/data/catalog';
import { Song } from '@/types';
import {
  colors,
  fontSize,
  paletteForThemes,
  radius,
  spacing,
} from '@/theme';

type Row =
  | { kind: 'song'; song: Song }
  | { kind: 'section'; section: Psalm119Section; songCount: number }
  | { kind: 'other'; songCount: number };

export default function PsalmDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const num = Number(id);
  const psalm = psalmByNumber(num);
  const songs = psalm ? songsForPsalm(num) : [];

  const { rows, queue } = useMemo(() => {
    if (num !== 119 || songs.length === 0) {
      return {
        rows: songs.map<Row>((song) => ({ kind: 'song', song })),
        queue: songs,
      };
    }

    const bySection = new Map<string, Song[]>();
    const others: Song[] = [];
    for (const song of songs) {
      const sec = sectionForPsalm119Song(song);
      if (sec) {
        const list = bySection.get(sec.letter);
        if (list) list.push(song);
        else bySection.set(sec.letter, [song]);
      } else {
        others.push(song);
      }
    }

    const builtRows: Row[] = [];
    const builtQueue: Song[] = [];
    for (const sec of PSALM_119_SECTIONS) {
      const list = bySection.get(sec.letter);
      if (!list || list.length === 0) continue;
      builtRows.push({ kind: 'section', section: sec, songCount: list.length });
      for (const song of list) {
        builtRows.push({ kind: 'song', song });
        builtQueue.push(song);
      }
    }
    if (others.length > 0) {
      builtRows.push({ kind: 'other', songCount: others.length });
      for (const song of others) {
        builtRows.push({ kind: 'song', song });
        builtQueue.push(song);
      }
    }
    return { rows: builtRows, queue: builtQueue };
  }, [num, songs]);

  if (!psalm) {
    return (
      <Screen>
        <Text style={styles.title}>Psalm not found</Text>
      </Screen>
    );
  }

  const palette = paletteForThemes(psalm.themes);

  return (
    <Screen>
      <Stack.Screen options={{ title: `Psalm ${psalm.number}` }} />
      <FlatList
        data={rows}
        keyExtractor={(row, idx) =>
          row.kind === 'song'
            ? row.song.id
            : row.kind === 'section'
              ? `sec-${row.section.letter}`
              : `other-${idx}`
        }
        renderItem={({ item }) => {
          if (item.kind === 'song') {
            return <SongRow song={item.song} queue={queue} />;
          }
          if (item.kind === 'section') {
            return (
              <View style={styles.letterRow}>
                <Text style={[styles.letterGlyph, { color: palette.base }]}>
                  {item.section.glyph}
                </Text>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.letterName, { color: palette.base }]}>
                    {item.section.letter.toUpperCase()}
                  </Text>
                  <Text style={styles.letterMeta}>
                    vv. {item.section.verseStart}–{item.section.verseEnd} ·{' '}
                    {item.songCount}{' '}
                    {item.songCount === 1 ? 'song' : 'songs'}
                  </Text>
                </View>
              </View>
            );
          }
          return (
            <View style={styles.letterRow}>
              <Text style={[styles.letterGlyph, { color: colors.textDim }]}>
                ✦
              </Text>
              <View style={{ flex: 1 }}>
                <Text style={[styles.letterName, { color: colors.textDim }]}>
                  WHOLE PSALM
                </Text>
                <Text style={styles.letterMeta}>
                  {item.songCount}{' '}
                  {item.songCount === 1 ? 'song' : 'songs'}
                </Text>
              </View>
            </View>
          );
        }}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View>
            <View
              style={[
                styles.hero,
                {
                  backgroundColor: palette.soft,
                  borderColor: palette.base,
                },
              ]}
            >
              <View style={styles.heroTop}>
                <View
                  style={[
                    styles.numberBadge,
                    { borderColor: palette.base },
                  ]}
                >
                  <Text style={[styles.numberText, { color: palette.base }]}>
                    {psalm.number}
                  </Text>
                </View>
                <Text style={[styles.heroGlyph, { color: palette.base }]}>
                  {palette.glyph}
                </Text>
              </View>
              <Text style={[styles.kicker, { color: palette.base }]}>
                PSALM {psalm.number}
              </Text>
              <Text style={styles.title}>{psalm.title}</Text>
              <View style={styles.themes}>
                {psalm.themes.map((t) => (
                  <View
                    key={t}
                    style={[
                      styles.themeChip,
                      { borderColor: palette.base },
                    ]}
                  >
                    <Text
                      style={[styles.themeText, { color: palette.base }]}
                    >
                      {t}
                    </Text>
                  </View>
                ))}
              </View>
              <PlayControls queue={queue} palette={palette} />
            </View>
            <View style={styles.sectionRow}>
              <Text style={styles.section}>Songs</Text>
              <Text style={styles.sectionCount}>
                {songs.length}
                {songs.length > 0
                  ? ` · ${formatDuration(totalDurationSec(songs))}`
                  : ''}
              </Text>
            </View>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyBox}>
            <Text style={styles.empty}>
              No songs yet for this Psalm.
            </Text>
          </View>
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
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  numberBadge: {
    width: 56,
    height: 56,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
  },
  numberText: { fontSize: 22, fontWeight: '800' },
  heroGlyph: { fontSize: 32 },
  kicker: {
    fontWeight: '800',
    letterSpacing: 1.6,
    fontSize: fontSize.xs,
    marginTop: spacing.md,
  },
  title: {
    color: colors.text,
    fontSize: fontSize.h1,
    fontWeight: '800',
    marginTop: spacing.xs,
    lineHeight: 34,
    letterSpacing: -0.5,
  },
  themes: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  themeChip: {
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 3,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  themeText: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  section: {
    color: colors.textMuted,
    fontWeight: '800',
    fontSize: fontSize.xs,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  sectionCount: {
    color: colors.textDim,
    fontSize: fontSize.sm,
    fontWeight: '700',
  },
  letterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
  },
  letterGlyph: {
    fontSize: 36,
    fontWeight: '800',
    width: 44,
    textAlign: 'center',
    lineHeight: 40,
  },
  letterName: {
    fontSize: fontSize.lg,
    fontWeight: '800',
    letterSpacing: 1.6,
  },
  letterMeta: {
    color: colors.textMuted,
    fontSize: fontSize.xs,
    fontWeight: '600',
    marginTop: 2,
    letterSpacing: 0.4,
  },
  emptyBox: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.lg,
    alignItems: 'center',
  },
  empty: {
    color: colors.text,
    fontSize: fontSize.lg,
    fontWeight: '600',
    textAlign: 'center',
  },
});
