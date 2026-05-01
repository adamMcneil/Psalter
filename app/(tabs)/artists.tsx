import { useMemo, useState } from 'react';
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Link } from 'expo-router';
import { Screen } from '@/components/Screen';
import { ArtistAvatar } from '@/components/ArtistAvatar';
import { artists } from '@/data/catalog';
import { colors, fontSize, radius, spacing } from '@/theme';

const AVATAR_TINTS = [
  { bg: '#3a2912', fg: '#d4a24a' },
  { bg: '#1a2438', fg: '#6b8cd1' },
  { bg: '#1a2c20', fg: '#7fb38a' },
  { bg: '#321e15', fg: '#c98a6e' },
  { bg: '#241934', fg: '#a987d1' },
  { bg: '#16262d', fg: '#7ab1c4' },
  { bg: '#2e2a14', fg: '#c9bf6a' },
];

function tintFor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) | 0;
  return AVATAR_TINTS[Math.abs(h) % AVATAR_TINTS.length];
}

export default function ArtistsScreen() {
  const list = artists();
  const [q, setQ] = useState('');

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return list;
    return list.filter((a) => a.name.toLowerCase().includes(term));
  }, [list, q]);

  const totalSongs = list.reduce((acc, a) => acc + a.songCount, 0);

  return (
    <Screen>
      <FlatList
        data={filtered}
        keyExtractor={(a) => a.name}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.h1}>Artists</Text>
            <Text style={styles.subtitle}>
              {list.length} artists · {totalSongs} songs
            </Text>
            <View style={styles.searchWrap}>
              <Text style={styles.searchIcon}>⌕</Text>
              <TextInput
                value={q}
                onChangeText={setQ}
                placeholder="Filter artists"
                placeholderTextColor={colors.textDim}
                style={styles.search}
                autoCorrect={false}
              />
              {q ? (
                <Pressable hitSlop={12} onPress={() => setQ('')}>
                  <Text style={styles.clearBtn}>✕</Text>
                </Pressable>
              ) : null}
            </View>
          </View>
        }
        renderItem={({ item }) => {
          const tint = tintFor(item.name);
          return (
            <Link
              href={{
                pathname: '/artist/[name]',
                params: { name: item.name },
              }}
              asChild
            >
              <Pressable
                style={({ pressed }) => [
                  styles.row,
                  pressed && styles.pressed,
                ]}
              >
                <View style={styles.avatarWrap}>
                  <ArtistAvatar
                    name={item.name}
                    size={44}
                    bg={tint.bg}
                    fg={tint.fg}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.name} numberOfLines={1}>
                    {item.name}
                  </Text>
                  <Text style={styles.meta}>
                    {item.songCount} song{item.songCount === 1 ? '' : 's'} ·{' '}
                    {item.psalmCount} psalm{item.psalmCount === 1 ? '' : 's'}
                  </Text>
                </View>
                <Text style={styles.chev}>›</Text>
              </Pressable>
            </Link>
          );
        }}
        contentContainerStyle={{ paddingBottom: spacing.xl }}
        ListEmptyComponent={
          <Text style={styles.empty}>
            {q ? 'No artists match.' : 'No artists in the catalog yet.'}
          </Text>
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { paddingTop: spacing.md, marginBottom: spacing.md },
  h1: {
    color: colors.text,
    fontSize: fontSize.h1,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  subtitle: {
    color: colors.textMuted,
    marginTop: 4,
    fontSize: fontSize.md,
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.md,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
  },
  searchIcon: { color: colors.textDim, fontSize: 18, marginRight: spacing.sm },
  search: {
    flex: 1,
    color: colors.text,
    paddingVertical: spacing.md,
  },
  clearBtn: {
    color: colors.textDim,
    fontSize: 16,
    paddingHorizontal: spacing.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.sm + 2,
    paddingRight: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pressed: { opacity: 0.75, transform: [{ scale: 0.995 }] },
  avatarWrap: { marginRight: spacing.md },
  name: { color: colors.text, fontSize: fontSize.lg, fontWeight: '600' },
  meta: { color: colors.textMuted, fontSize: fontSize.sm, marginTop: 2 },
  chev: {
    color: colors.textDim,
    fontSize: 22,
    marginLeft: spacing.sm,
  },
  empty: {
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.xl,
  },
});
