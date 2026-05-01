import { useMemo, useState } from 'react';
import {
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Link } from 'expo-router';
import { Screen } from '@/components/Screen';
import { PsalmCard } from '@/components/PsalmCard';
import { psalms } from '@/data/psalms';
import { catalog } from '@/data/catalog';
import { Psalm, Song } from '@/types';
import { colors, radius, spacing } from '@/theme';

type Result =
  | { kind: 'psalm'; psalm: Psalm }
  | { kind: 'song'; song: Song };

export default function SearchScreen() {
  const [q, setQ] = useState('');

  const results = useMemo<Result[]>(() => {
    const term = q.trim().toLowerCase();
    if (!term) return [];

    const asNum = Number(term);
    const psalmHits: Result[] = psalms
      .filter((p) => {
        if (!Number.isNaN(asNum) && term.length <= 3) {
          return p.number === asNum;
        }
        return (
          p.title.toLowerCase().includes(term) ||
          p.themes.some((t) => t.toLowerCase().includes(term))
        );
      })
      .slice(0, 30)
      .map((p) => ({ kind: 'psalm' as const, psalm: p }));

    const songHits: Result[] = catalog
      .filter(
        (s) =>
          s.title.toLowerCase().includes(term) ||
          s.artist.toLowerCase().includes(term),
      )
      .slice(0, 30)
      .map((s) => ({ kind: 'song' as const, song: s }));

    return [...psalmHits, ...songHits];
  }, [q]);

  return (
    <Screen>
      <Text style={styles.h1}>Search</Text>
      <TextInput
        value={q}
        onChangeText={setQ}
        placeholder="Psalm number, theme, artist, or title"
        placeholderTextColor={colors.textMuted}
        style={styles.input}
        autoCorrect={false}
        autoCapitalize="none"
      />
      <FlatList
        data={results}
        keyExtractor={(item, i) =>
          item.kind === 'psalm'
            ? `p-${item.psalm.number}`
            : `s-${item.song.id}-${i}`
        }
        renderItem={({ item }) =>
          item.kind === 'psalm' ? (
            <PsalmCard psalm={item.psalm} />
          ) : (
            <Link href={`/psalm/${item.song.psalm}`} asChild>
              <View style={styles.songHit}>
                <Text style={styles.songTitle}>{item.song.title}</Text>
                <Text style={styles.songMeta}>
                  {item.song.artist} · Psalm {item.song.psalm}
                </Text>
              </View>
            </Link>
          )
        }
        contentContainerStyle={{ paddingVertical: spacing.md }}
        ListEmptyComponent={
          q.trim() ? (
            <Text style={styles.empty}>No matches.</Text>
          ) : (
            <Text style={styles.empty}>
              Try “23”, “Lament”, “Sandra”, or “shepherd”.
            </Text>
          )
        }
        keyboardShouldPersistTaps="handled"
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
  input: {
    marginTop: spacing.md,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    color: colors.text,
  },
  songHit: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  songTitle: { color: colors.text, fontWeight: '600' },
  songMeta: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  empty: { color: colors.textMuted, textAlign: 'center', marginTop: spacing.xl },
});
