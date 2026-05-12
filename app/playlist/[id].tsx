import { Stack, useLocalSearchParams } from 'expo-router';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { Screen } from '@/components/Screen';
import { PsalmCard } from '@/components/PsalmCard';
import { playlistById } from '@/data/playlists';
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

export default function PlaylistDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const playlist = id ? playlistById(id) : undefined;

  if (!playlist) {
    return (
      <Screen>
        <Stack.Screen options={{ title: 'Playlist' }} />
        <Text style={styles.title}>Playlist not found</Text>
      </Screen>
    );
  }

  const psalms = playlist.psalms
    .map((n) => psalmByNumber(n))
    .filter((p): p is NonNullable<typeof p> => !!p);

  const palette = paletteForThemes(psalms[0]?.themes);
  const playlistSongs = playlist.psalms.flatMap((n) => songsForPsalm(n));
  const playlistDuration = formatDuration(totalDurationSec(playlistSongs));

  return (
    <Screen>
      <Stack.Screen options={{ title: playlist.title }} />
      <FlatList
        data={psalms}
        keyExtractor={(p) => String(p.number)}
        renderItem={({ item }) => <PsalmCard psalm={item} />}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View
            style={[
              styles.hero,
              { backgroundColor: palette.soft, borderColor: palette.base },
            ]}
          >
            <Text style={[styles.heroGlyph, { color: palette.base }]}>
              {palette.glyph}
            </Text>
            <Text style={[styles.kicker, { color: palette.base }]}>
              FEATURED PLAYLIST
            </Text>
            <Text style={styles.title}>{playlist.title}</Text>
            <Text style={styles.blurb}>{playlist.blurb}</Text>
            <View style={styles.pillRow}>
              <View style={[styles.countPill, { borderColor: palette.base }]}>
                <Text style={[styles.countText, { color: palette.base }]}>
                  {psalms.length} psalms
                </Text>
              </View>
              <View style={[styles.countPill, { borderColor: palette.base }]}>
                <Text style={[styles.countText, { color: palette.base }]}>
                  {playlistSongs.length} songs · {playlistDuration}
                </Text>
              </View>
            </View>
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
    marginBottom: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  heroGlyph: { fontSize: 36 },
  kicker: {
    fontWeight: '800',
    letterSpacing: 1.6,
    fontSize: fontSize.xs,
    marginTop: spacing.sm,
  },
  title: {
    color: colors.text,
    fontSize: fontSize.h1,
    fontWeight: '800',
    marginTop: spacing.xs,
    lineHeight: 34,
    letterSpacing: -0.5,
  },
  blurb: {
    color: colors.textMuted,
    marginTop: spacing.sm,
    fontSize: fontSize.lg,
    lineHeight: 21,
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs + 2,
    marginTop: spacing.md,
  },
  countPill: {
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 3,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  countText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});
