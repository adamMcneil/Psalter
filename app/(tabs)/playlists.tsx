import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { Link } from 'expo-router';
import { Screen } from '@/components/Screen';
import { featuredPlaylists } from '@/data/playlists';
import { colors, radius, spacing } from '@/theme';

export default function PlaylistsScreen() {
  return (
    <Screen>
      <Text style={styles.h1}>Featured</Text>
      <Text style={styles.subtitle}>Curated playlists across the Psalter</Text>
      <FlatList
        data={featuredPlaylists}
        keyExtractor={(p) => p.id}
        renderItem={({ item }) => (
          <Link
            href={{ pathname: '/playlist/[id]', params: { id: item.id } }}
            asChild
          >
            <Pressable
              style={({ pressed }) => [styles.card, pressed && styles.pressed]}
            >
              <Text style={styles.title}>{item.title}</Text>
              <Text style={styles.blurb}>{item.blurb}</Text>
              <Text style={styles.meta}>
                {item.psalms.length} psalm{item.psalms.length === 1 ? '' : 's'}
              </Text>
            </Pressable>
          </Link>
        )}
        contentContainerStyle={{ paddingVertical: spacing.md }}
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
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pressed: { opacity: 0.7 },
  title: { color: colors.text, fontSize: 16, fontWeight: '700' },
  blurb: { color: colors.textMuted, fontSize: 13, marginTop: spacing.xs, lineHeight: 18 },
  meta: { color: colors.accent, fontSize: 11, marginTop: spacing.sm, fontWeight: '600' },
});
