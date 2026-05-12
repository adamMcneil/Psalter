import { useLocalSearchParams, Stack } from 'expo-router';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { Screen } from '@/components/Screen';
import { SongRow } from '@/components/SongRow';
import { psalmByNumber } from '@/data/psalms';
import {
  formatDuration,
  songsForPsalm,
  totalDurationSec,
} from '@/data/catalog';
import {
  colors,
  fontSize,
  paletteForThemes,
  radius,
  spacing,
} from '@/theme';

export default function PsalmDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const num = Number(id);
  const psalm = psalmByNumber(num);
  const songs = psalm ? songsForPsalm(num) : [];

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
        data={songs}
        keyExtractor={(s) => s.id}
        renderItem={({ item }) => <SongRow song={item} queue={songs} />}
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
            <Text style={styles.emptyHint}>
              Tap “Submit a song” on the home screen to suggest one.
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
  emptyHint: {
    color: colors.textMuted,
    fontSize: fontSize.sm,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
});
