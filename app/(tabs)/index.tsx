import {
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Link } from 'expo-router';
import { Screen } from '@/components/Screen';
import { PsalmCard } from '@/components/PsalmCard';
import { psalms } from '@/data/psalms';
import { themes } from '@/data/themes';
import { featuredPlaylists } from '@/data/playlists';
import {
  catalog,
  formatDuration,
  songsForPsalm,
  totalDurationSec,
} from '@/data/catalog';
import { useSpotifyAuth } from '@/spotify/AuthContext';
import { Theme } from '@/types';
import {
  colors,
  fontSize,
  paletteForThemes,
  radius,
  spacing,
  themePalettes,
} from '@/theme';

const PLAYLIST_PALETTE_OVERRIDE: Record<string, Theme> = {
  'songs-of-ascent': 'Confidence',
  'morning-psalms': 'Praise',
  'evening-psalms': 'Remembrance',
  'psalms-for-mourning': 'Lament',
  kingship: 'Kingship',
  'great-thanksgiving': 'Thanksgiving',
  'praise-the-lord': 'Praise',
};

function paletteForPlaylist(id: string, fallback: Theme[] | undefined) {
  const override = PLAYLIST_PALETTE_OVERRIDE[id];
  if (override) return themePalettes[override];
  return paletteForThemes(fallback);
}

function greeting(): string {
  const h = new Date().getHours();
  if (h < 5) return 'A quiet hour';
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  if (h < 21) return 'Good evening';
  return 'Peace tonight';
}

function dayOfYear(d = new Date()): number {
  const start = new Date(d.getFullYear(), 0, 0);
  const diff = d.getTime() - start.getTime();
  return Math.floor(diff / 86400000);
}

const psalmOfTheDay = () => {
  const idx = (dayOfYear() * 7) % psalms.length;
  return psalms[idx];
};

export default function PsalmsList() {
  const { user } = useSpotifyAuth();
  const featured = psalmOfTheDay();
  const featuredPalette = paletteForThemes(featured.themes);
  const featuredSongCount = songsForPsalm(featured.number).length;

  return (
    <Screen>
      <FlatList
        data={psalms}
        keyExtractor={(p) => String(p.number)}
        renderItem={({ item }) => <PsalmCard psalm={item} />}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: spacing.xl }}
        ListHeaderComponent={
          <View>
            <View style={styles.headerBlock}>
              <Text style={styles.greeting}>
                {greeting()}
                {user?.displayName ? `, ${user.displayName.split(' ')[0]}` : ''}
              </Text>
              <View style={styles.titleRow}>
                <Text style={styles.h1}>Psalter</Text>
                <Link href="/submit" asChild>
                  <Pressable>
                    {({ pressed }) => (
                      <View
                        style={[styles.submitBtn, pressed && styles.pressed]}
                      >
                        <Text style={styles.submitText}>＋ Submit</Text>
                      </View>
                    )}
                  </Pressable>
                </Link>
              </View>
              <Text style={styles.subtitle}>
                All 150 Psalms · {catalog.length} songs ·{' '}
                {formatDuration(totalDurationSec(catalog))}
              </Text>
            </View>

            <Text style={styles.sectionLabel}>Psalm of the Day</Text>
            <Link href={`/psalm/${featured.number}`} asChild>
              <Pressable>
                {({ pressed }) => (
                  <View
                    style={[
                      styles.hero,
                      {
                        backgroundColor: featuredPalette.soft,
                        borderColor: featuredPalette.base,
                      },
                      pressed && styles.pressed,
                    ]}
                  >
                    <View style={styles.heroTop}>
                      <Text
                        style={[
                          styles.heroKicker,
                          { color: featuredPalette.base },
                        ]}
                      >
                        PSALM {featured.number}
                      </Text>
                      <Text
                        style={[
                          styles.heroGlyph,
                          { color: featuredPalette.base },
                        ]}
                      >
                        {featuredPalette.glyph}
                      </Text>
                    </View>
                    <Text style={styles.heroTitle} numberOfLines={2}>
                      {featured.title}
                    </Text>
                    <View style={styles.heroFoot}>
                      <View style={styles.heroTags}>
                        {featured.themes.map((t) => (
                          <View
                            key={t}
                            style={[
                              styles.heroTag,
                              { borderColor: featuredPalette.base },
                            ]}
                          >
                            <Text
                              style={[
                                styles.heroTagText,
                                { color: featuredPalette.base },
                              ]}
                            >
                              {t}
                            </Text>
                          </View>
                        ))}
                      </View>
                      <Text
                        style={[
                          styles.heroMeta,
                          { color: featuredPalette.base },
                        ]}
                      >
                        {featuredSongCount > 0
                          ? `${featuredSongCount} ${featuredSongCount === 1 ? 'song' : 'songs'} →`
                          : 'Open →'}
                      </Text>
                    </View>
                  </View>
                )}
              </Pressable>
            </Link>

            <Text style={styles.sectionLabel}>Featured Playlists</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.railBleed}
              contentContainerStyle={styles.railContent}
            >
              {featuredPlaylists.map((pl) => {
                const palette = paletteForPlaylist(
                  pl.id,
                  psalms.find((p) => p.number === pl.psalms[0])?.themes,
                );
                return (
                  <Link
                    key={pl.id}
                    href={{ pathname: '/playlist/[id]', params: { id: pl.id } }}
                    asChild
                  >
                    <Pressable>
                      {({ pressed }) => (
                        <View
                          style={[
                            styles.railCard,
                            {
                              backgroundColor: palette.soft,
                              borderColor: palette.base,
                            },
                            pressed && styles.pressed,
                          ]}
                        >
                          <Text
                            style={[styles.railGlyph, { color: palette.base }]}
                          >
                            {palette.glyph}
                          </Text>
                          <Text style={styles.railTitle} numberOfLines={2}>
                            {pl.title}
                          </Text>
                          <Text style={styles.railMeta}>
                            {pl.psalms.length} psalms
                          </Text>
                        </View>
                      )}
                    </Pressable>
                  </Link>
                );
              })}
            </ScrollView>

            <Text style={styles.sectionLabel}>Browse by Theme</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.railBleed}
              contentContainerStyle={styles.railContent}
            >
              {themes.map((t) => {
                const palette = themePalettes[t.name];
                const count = psalms.filter((p) =>
                  p.themes.includes(t.name),
                ).length;
                return (
                  <Link key={t.name} href="/themes" asChild>
                    <Pressable>
                      {({ pressed }) => (
                        <View
                          style={[
                            styles.themeChip,
                            {
                              backgroundColor: palette.soft,
                              borderColor: palette.base,
                            },
                            pressed && styles.pressed,
                          ]}
                        >
                          <Text
                            style={[styles.themeGlyph, { color: palette.base }]}
                          >
                            {palette.glyph}
                          </Text>
                          <View>
                            <Text
                              style={[
                                styles.themeName,
                                { color: palette.base },
                              ]}
                            >
                              {t.name}
                            </Text>
                            <Text style={styles.themeCount}>
                              {count} psalms
                            </Text>
                          </View>
                        </View>
                      )}
                    </Pressable>
                  </Link>
                );
              })}
            </ScrollView>

            <View style={styles.allHeader}>
              <Text style={styles.sectionLabel}>All Psalms</Text>
              <Link href="/coverage" asChild>
                <Pressable>
                  {({ pressed }) => (
                    <View
                      style={[
                        styles.coverageLink,
                        pressed && styles.pressed,
                      ]}
                    >
                      <Text style={styles.coverageLinkText}>
                        📊 Coverage →
                      </Text>
                    </View>
                  )}
                </Pressable>
              </Link>
            </View>
          </View>
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerBlock: {
    paddingTop: spacing.md,
    marginBottom: spacing.lg,
  },
  greeting: {
    color: colors.textMuted,
    fontSize: fontSize.md,
    fontWeight: '600',
    letterSpacing: 0.3,
    marginBottom: 2,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  h1: {
    color: colors.text,
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  submitBtn: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
  },
  submitText: {
    color: colors.accent,
    fontWeight: '700',
    fontSize: fontSize.sm,
  },
  subtitle: {
    color: colors.textMuted,
    marginTop: 4,
    fontSize: fontSize.md,
  },

  sectionLabel: {
    color: colors.textMuted,
    fontSize: fontSize.xs,
    fontWeight: '700',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },

  hero: {
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.lg,
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  heroGlyph: { fontSize: 22 },
  heroKicker: {
    fontSize: fontSize.xs,
    fontWeight: '800',
    letterSpacing: 1.6,
  },
  heroTitle: {
    color: colors.text,
    fontSize: fontSize.h2,
    fontWeight: '700',
    marginTop: spacing.sm,
    lineHeight: 30,
  },
  heroFoot: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.md,
  },
  heroTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    flex: 1,
  },
  heroTag: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  heroTagText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  heroMeta: {
    fontSize: fontSize.sm,
    fontWeight: '700',
    marginLeft: spacing.sm,
  },

  railBleed: {
    marginHorizontal: -spacing.md,
  },
  railContent: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    gap: spacing.sm,
  },
  railCard: {
    width: 170,
    height: 130,
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing.md,
    justifyContent: 'space-between',
  },
  railGlyph: { fontSize: 20 },
  railTitle: {
    color: colors.text,
    fontSize: fontSize.lg,
    fontWeight: '700',
    lineHeight: 19,
  },
  railMeta: {
    color: colors.textMuted,
    fontSize: fontSize.xs,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },

  themeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  themeGlyph: { fontSize: 16 },
  themeName: { fontWeight: '700', fontSize: fontSize.md },
  themeCount: { color: colors.textDim, fontSize: 10, marginTop: 1 },

  allHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.lg,
  },
  coverageLink: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  coverageLinkText: {
    color: colors.accent,
    fontSize: fontSize.xs,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  pressed: { opacity: 0.78, transform: [{ scale: 0.99 }] },
});
