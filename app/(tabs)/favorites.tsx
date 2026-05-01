import { FlatList, StyleSheet, Text, View } from 'react-native';
import { Link } from 'expo-router';
import { Screen } from '@/components/Screen';
import { SongRow } from '@/components/SongRow';
import { useFavorites } from '@/storage/favorites';
import { catalog } from '@/data/catalog';
import { colors, fontSize, radius, spacing } from '@/theme';

export default function FavoritesScreen() {
  const { ids, source, loading } = useFavorites();
  const items = catalog.filter((s) => ids.includes(s.id));
  const isSpotify = source === 'spotify';

  return (
    <Screen>
      <FlatList
        data={items}
        keyExtractor={(s) => s.id}
        renderItem={({ item }) => <SongRow song={item} queue={items} />}
        contentContainerStyle={{ paddingBottom: spacing.xl }}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View style={styles.header}>
            <View style={styles.titleRow}>
              <Text style={styles.heart}>♥</Text>
              <Text style={styles.h1}>
                {isSpotify ? 'Liked Songs' : 'Favorites'}
              </Text>
            </View>
            {isSpotify ? (
              <View style={styles.syncPill}>
                <View style={styles.syncDot} />
                <Text style={styles.syncText}>Synced with Spotify</Text>
              </View>
            ) : (
              <Text style={styles.subtitle}>
                Saved on this device.{' '}
                <Link href="/account" style={styles.link}>
                  Sign in with Spotify
                </Link>{' '}
                to sync to Liked Songs.
              </Text>
            )}
            <Text style={styles.count}>
              {items.length} {items.length === 1 ? 'song' : 'songs'}
            </Text>
          </View>
        }
        ListEmptyComponent={
          loading && items.length === 0 ? (
            <Text style={styles.empty}>Loading from Spotify…</Text>
          ) : (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyHeart}>♡</Text>
              <Text style={styles.emptyTitle}>No favorites yet</Text>
              <Text style={styles.emptyHint}>
                Tap the heart on any song to{' '}
                {isSpotify ? 'save it to Liked Songs' : 'save it here'}.
              </Text>
            </View>
          )
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { paddingTop: spacing.md, marginBottom: spacing.md },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  heart: { color: colors.accent, fontSize: 26 },
  h1: {
    color: colors.text,
    fontSize: fontSize.h1,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  syncPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 2,
    alignSelf: 'flex-start',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 4,
    borderRadius: radius.pill,
    marginTop: spacing.sm,
  },
  syncDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#7fb38a',
  },
  syncText: {
    color: colors.textMuted,
    fontSize: fontSize.xs,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  subtitle: {
    color: colors.textMuted,
    marginTop: spacing.sm,
    fontSize: fontSize.md,
    lineHeight: 19,
  },
  link: { color: colors.accent, fontWeight: '700' },
  count: {
    color: colors.textDim,
    fontSize: fontSize.xs,
    fontWeight: '700',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    marginTop: spacing.md,
  },
  emptyBox: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.xl,
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  emptyHeart: {
    color: colors.textDim,
    fontSize: 48,
    marginBottom: spacing.sm,
  },
  emptyTitle: {
    color: colors.text,
    fontSize: fontSize.xl,
    fontWeight: '700',
  },
  emptyHint: {
    color: colors.textMuted,
    fontSize: fontSize.md,
    textAlign: 'center',
    marginTop: spacing.xs,
    lineHeight: 19,
  },
  empty: {
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.xl,
  },
});
