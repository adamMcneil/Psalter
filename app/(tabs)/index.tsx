import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Link } from 'expo-router';
import { Screen } from '@/components/Screen';
import { PsalmCard } from '@/components/PsalmCard';
import { psalms } from '@/data/psalms';
import {
  catalog,
  formatDuration,
  songsForPsalm,
  totalDurationSec,
} from '@/data/catalog';
import { useSpotifyAuth } from '@/spotify/AuthContext';
import { colors, fontSize, radius, spacing } from '@/theme';

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
              <Text style={styles.h1}>Psalter</Text>
              <Text style={styles.subtitle}>
                All 150 Psalms · {catalog.length} songs ·{' '}
                {formatDuration(totalDurationSec(catalog))}
              </Text>
            </View>

            <Text style={styles.sectionLabel}>Psalm of the Day</Text>
            <Link href={`/psalm/${featured.number}`} asChild>
              <Pressable>
                {({ pressed }) => (
                  <View style={[styles.hero, pressed && styles.pressed]}>
                    <Text style={styles.heroKicker}>
                      PSALM {featured.number}
                    </Text>
                    <Text style={styles.heroTitle}>{featured.title}</Text>
                    <Text style={styles.heroMeta}>
                      {featuredSongCount > 0
                        ? `${featuredSongCount} ${featuredSongCount === 1 ? 'song' : 'songs'} →`
                        : 'Open →'}
                    </Text>
                  </View>
                )}
              </Pressable>
            </Link>

            <Text style={styles.sectionLabel}>All Psalms</Text>
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
  h1: {
    color: colors.text,
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: -0.4,
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
    backgroundColor: colors.surface,
    borderColor: colors.border,
  },
  heroKicker: {
    color: colors.accent,
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
  heroMeta: {
    color: colors.textMuted,
    fontSize: fontSize.sm,
    fontWeight: '700',
    marginTop: spacing.md,
  },

  pressed: { opacity: 0.78, transform: [{ scale: 0.99 }] },
});
