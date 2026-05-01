import { FlatList, StyleSheet, Text, View } from 'react-native';
import { Link } from 'expo-router';
import { Screen } from '@/components/Screen';
import { SongRow } from '@/components/SongRow';
import { useFavorites } from '@/storage/favorites';
import { catalog } from '@/data/catalog';
import { colors, spacing } from '@/theme';

export default function FavoritesScreen() {
  const { ids, source, loading } = useFavorites();
  const items = catalog.filter((s) => ids.includes(s.id));

  return (
    <Screen>
      <Text style={styles.h1}>
        {source === 'spotify' ? 'Liked Songs' : 'Favorites'}
      </Text>
      {source === 'spotify' ? (
        <Text style={styles.subtitle}>
          Synced with your Spotify Liked Songs
        </Text>
      ) : (
        <Text style={styles.subtitle}>
          Saved on this device.{' '}
          <Link href="/account" style={styles.link}>
            Sign in with Spotify
          </Link>{' '}
          to sync to your Liked Songs.
        </Text>
      )}
      {loading && items.length === 0 ? (
        <Text style={styles.empty}>Loading from Spotify…</Text>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(s) => s.id}
          renderItem={({ item }) => <SongRow song={item} />}
          contentContainerStyle={{ paddingVertical: spacing.md }}
          ListEmptyComponent={
            <Text style={styles.empty}>
              Tap the heart on any song to{' '}
              {source === 'spotify' ? 'save it to Liked Songs' : 'save it here'}
              .
            </Text>
          }
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  h1: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '700',
    paddingTop: spacing.md,
  },
  subtitle: {
    color: colors.textMuted,
    marginTop: 2,
    fontSize: 13,
    lineHeight: 18,
  },
  link: { color: colors.accent, fontWeight: '600' },
  empty: { color: colors.textMuted, textAlign: 'center', marginTop: spacing.xl },
});
