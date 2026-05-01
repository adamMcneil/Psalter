import { FlatList, StyleSheet, Text } from 'react-native';
import { Screen } from '@/components/Screen';
import { SongRow } from '@/components/SongRow';
import { useFavorites } from '@/storage/favorites';
import { catalog } from '@/data/catalog';
import { playSong } from '@/audio/queue';
import { useRouter } from 'expo-router';
import { colors, spacing } from '@/theme';

export default function FavoritesScreen() {
  const { ids } = useFavorites();
  const router = useRouter();
  const items = catalog.filter((s) => ids.includes(s.id));

  return (
    <Screen>
      <Text style={styles.h1}>Favorites</Text>
      <FlatList
        data={items}
        keyExtractor={(s) => s.id}
        renderItem={({ item }) => (
          <SongRow
            song={item}
            onPress={async () => {
              await playSong(item, items);
              router.push('/player');
            }}
          />
        )}
        contentContainerStyle={{ paddingVertical: spacing.md }}
        ListEmptyComponent={
          <Text style={styles.empty}>
            Tap the heart on any song to save it here.
          </Text>
        }
      />
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
  empty: { color: colors.textMuted, textAlign: 'center', marginTop: spacing.xl },
});
