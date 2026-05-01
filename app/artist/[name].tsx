import { Stack, useLocalSearchParams } from 'expo-router';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { Screen } from '@/components/Screen';
import { SongRow } from '@/components/SongRow';
import { songsByArtist } from '@/data/catalog';
import { colors, spacing } from '@/theme';

export default function ArtistDetail() {
  const { name } = useLocalSearchParams<{ name: string }>();
  const artistName = decodeURIComponent(name ?? '');
  const songs = songsByArtist(artistName);

  return (
    <Screen>
      <Stack.Screen options={{ title: artistName || 'Artist' }} />
      <View style={styles.header}>
        <Text style={styles.kicker}>ARTIST</Text>
        <Text style={styles.title}>{artistName}</Text>
        <Text style={styles.meta}>
          {songs.length} song{songs.length === 1 ? '' : 's'} in the catalog
        </Text>
      </View>
      <FlatList
        data={songs}
        keyExtractor={(s) => s.id}
        renderItem={({ item }) => <SongRow song={item} />}
        contentContainerStyle={{ paddingVertical: spacing.md }}
        ListEmptyComponent={
          <Text style={styles.empty}>No songs found for this artist.</Text>
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
  },
  kicker: { color: colors.accent, fontWeight: '700', letterSpacing: 1 },
  title: {
    color: colors.text,
    fontSize: 26,
    fontWeight: '700',
    marginTop: spacing.xs,
  },
  meta: { color: colors.textMuted, fontSize: 13, marginTop: spacing.xs },
  empty: { color: colors.textMuted, textAlign: 'center', marginTop: spacing.xl },
});
