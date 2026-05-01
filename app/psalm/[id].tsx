import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { Screen } from '@/components/Screen';
import { SongRow } from '@/components/SongRow';
import { psalmByNumber } from '@/data/psalms';
import { songsForPsalm } from '@/data/catalog';
import { playSong } from '@/audio/queue';
import { colors, radius, spacing } from '@/theme';

export default function PsalmDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const num = Number(id);
  const psalm = psalmByNumber(num);
  const songs = songsForPsalm(num);

  if (!psalm) {
    return (
      <Screen>
        <Text style={styles.title}>Psalm not found</Text>
      </Screen>
    );
  }

  return (
    <Screen>
      <Stack.Screen options={{ title: `Psalm ${psalm.number}` }} />
      <View style={styles.header}>
        <Text style={styles.kicker}>Psalm {psalm.number}</Text>
        <Text style={styles.title}>{psalm.title}</Text>
        <View style={styles.themes}>
          {psalm.themes.map((t) => (
            <View key={t} style={styles.themeChip}>
              <Text style={styles.themeText}>{t}</Text>
            </View>
          ))}
        </View>
      </View>
      <Text style={styles.section}>
        Songs ({songs.length})
      </Text>
      <FlatList
        data={songs}
        keyExtractor={(s) => s.id}
        renderItem={({ item }) => (
          <SongRow
            song={item}
            onPress={async () => {
              await playSong(item, songs);
              router.push('/player');
            }}
          />
        )}
        ListEmptyComponent={
          <Text style={styles.empty}>
            No songs yet for this Psalm. Tap “Submit a song” to suggest one.
          </Text>
        }
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
  themes: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  themeChip: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
  },
  themeText: { color: colors.textMuted, fontSize: 12 },
  section: {
    color: colors.text,
    fontWeight: '700',
    marginTop: spacing.md,
  },
  empty: { color: colors.textMuted, textAlign: 'center', marginTop: spacing.xl },
});
