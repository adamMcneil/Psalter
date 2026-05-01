import { Stack, useLocalSearchParams } from 'expo-router';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { Screen } from '@/components/Screen';
import { PsalmCard } from '@/components/PsalmCard';
import { playlistById } from '@/data/playlists';
import { psalmByNumber } from '@/data/psalms';
import { colors, spacing } from '@/theme';

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

  return (
    <Screen>
      <Stack.Screen options={{ title: playlist.title }} />
      <View style={styles.header}>
        <Text style={styles.kicker}>FEATURED PLAYLIST</Text>
        <Text style={styles.title}>{playlist.title}</Text>
        <Text style={styles.blurb}>{playlist.blurb}</Text>
      </View>
      <FlatList
        data={psalms}
        keyExtractor={(p) => String(p.number)}
        renderItem={({ item }) => <PsalmCard psalm={item} />}
        contentContainerStyle={{ paddingVertical: spacing.md }}
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
  blurb: {
    color: colors.textMuted,
    marginTop: spacing.sm,
    fontSize: 14,
    lineHeight: 20,
  },
});
