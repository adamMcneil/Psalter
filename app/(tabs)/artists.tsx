import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { Link } from 'expo-router';
import { Screen } from '@/components/Screen';
import { artists } from '@/data/catalog';
import { colors, radius, spacing } from '@/theme';

export default function ArtistsScreen() {
  const list = artists();

  return (
    <Screen>
      <Text style={styles.h1}>Artists</Text>
      <Text style={styles.subtitle}>
        Curated psalm-singers and songwriters
      </Text>
      <FlatList
        data={list}
        keyExtractor={(a) => a.name}
        renderItem={({ item }) => (
          <Link
            href={{ pathname: '/artist/[name]', params: { name: item.name } }}
            asChild
          >
            <Pressable
              style={({ pressed }) => [styles.row, pressed && styles.pressed]}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{item.name}</Text>
                <Text style={styles.meta}>
                  {item.songCount} song{item.songCount === 1 ? '' : 's'} ·{' '}
                  {item.psalmCount} psalm{item.psalmCount === 1 ? '' : 's'}
                </Text>
              </View>
              <Text style={styles.chev}>›</Text>
            </Pressable>
          </Link>
        )}
        contentContainerStyle={{ paddingVertical: spacing.md }}
        ListEmptyComponent={
          <Text style={styles.empty}>No artists in the catalog yet.</Text>
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
  subtitle: { color: colors.textMuted, marginTop: 2, fontSize: 13 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pressed: { opacity: 0.7 },
  name: { color: colors.text, fontSize: 15, fontWeight: '600' },
  meta: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  chev: { color: colors.textMuted, fontSize: 22, marginLeft: spacing.md },
  empty: { color: colors.textMuted, textAlign: 'center', marginTop: spacing.xl },
});
