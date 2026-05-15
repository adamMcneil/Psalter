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
import { PsalmCard } from '@/components/PsalmCard';
import { psalms } from '@/data/psalms';
import { catalog } from '@/data/catalog';
import { Psalm, Song } from '@/types';
import { colors, fontSize, radius, spacing } from '@/theme';

type Row =
  | { kind: 'header'; label: string; count: number }
  | { kind: 'psalm'; psalm: Psalm }
  | { kind: 'song'; song: Song };

const SUGGESTIONS = ['23', 'Lament', 'shepherd', 'Confidence', 'Praise'];

export default function SearchScreen() {
  const [q, setQ] = useState('');

  const rows = useMemo<Row[]>(() => {
    const term = q.trim().toLowerCase();
    if (!term) return [];

    const asNum = Number(term);
    const psalmHits: Psalm[] = psalms
      .filter((p) => {
        if (!Number.isNaN(asNum) && term.length <= 3) {
          return p.number === asNum;
        }
        return (
          p.title.toLowerCase().includes(term) ||
          p.themes.some((t) => t.toLowerCase().includes(term))
        );
      })
      .slice(0, 30);

    const songHits: Song[] = catalog
      .filter(
        (s) =>
          s.title.toLowerCase().includes(term) ||
          s.artist.toLowerCase().includes(term),
      )
      .slice(0, 30);

    const out: Row[] = [];
    if (psalmHits.length) {
      out.push({ kind: 'header', label: 'Psalms', count: psalmHits.length });
      psalmHits.forEach((p) => out.push({ kind: 'psalm', psalm: p }));
    }
    if (songHits.length) {
      out.push({ kind: 'header', label: 'Songs', count: songHits.length });
      songHits.forEach((s) => out.push({ kind: 'song', song: s }));
    }
    return out;
  }, [q]);

  return (
    <Screen>
      <View style={styles.header}>
        <Text style={styles.h1}>Search</Text>
        <View style={styles.searchWrap}>
          <Text style={styles.searchIcon}>⌕</Text>
          <TextInput
            value={q}
            onChangeText={setQ}
            placeholder="Psalm number, theme, artist, or title"
            placeholderTextColor={colors.textDim}
            style={styles.search}
            autoCorrect={false}
            autoCapitalize="none"
          />
          {q ? (
            <Pressable hitSlop={12} onPress={() => setQ('')}>
              <Text style={styles.clearBtn}>✕</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
      <FlatList
        data={rows}
        keyExtractor={(item, i) =>
          item.kind === 'header'
            ? `h-${item.label}-${i}`
            : item.kind === 'psalm'
              ? `p-${item.psalm.number}`
              : `s-${item.song.id}-${i}`
        }
        renderItem={({ item }) => {
          if (item.kind === 'header') {
            return (
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionLabel}>{item.label}</Text>
                <Text style={styles.sectionCount}>{item.count}</Text>
              </View>
            );
          }
          if (item.kind === 'psalm') {
            return <PsalmCard psalm={item.psalm} />;
          }
          return (
            <Link href={`/psalm/${item.song.psalm}`} asChild>
              <Pressable
                style={({ pressed }) => [
                  styles.songHit,
                  pressed && styles.pressed,
                ]}
              >
                <View style={styles.songMark}>
                  <Text style={styles.songMarkText}>
                    {item.song.psalm}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.songTitle}>{item.song.title}</Text>
                  <Text style={styles.songMeta}>
                    {item.song.artist} · Psalm {item.song.psalm}
                  </Text>
                </View>
                <Text style={styles.chev}>›</Text>
              </Pressable>
            </Link>
          );
        }}
        contentContainerStyle={{ paddingVertical: spacing.md }}
        ListEmptyComponent={
          q.trim() ? (
            <Text style={styles.empty}>No matches.</Text>
          ) : (
            <View style={styles.suggestWrap}>
              <Text style={styles.suggestLabel}>Try</Text>
              <View style={styles.suggestRow}>
                {SUGGESTIONS.map((s) => (
                  <Pressable
                    key={s}
                    onPress={() => setQ(s)}
                    style={({ pressed }) => [
                      styles.suggestChip,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Text style={styles.suggestText}>{s}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          )
        }
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { paddingTop: spacing.md },
  h1: {
    color: colors.text,
    fontSize: fontSize.h1,
    fontWeight: '800',
    letterSpacing: -0.5,
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
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  sectionLabel: {
    color: colors.textMuted,
    fontSize: fontSize.xs,
    fontWeight: '800',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  sectionCount: {
    color: colors.textDim,
    fontSize: fontSize.sm,
    fontWeight: '700',
  },
  songHit: {
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
  pressed: { opacity: 0.78, transform: [{ scale: 0.995 }] },
  songMark: {
    width: 40,
    height: 40,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    marginRight: spacing.md,
    backgroundColor: colors.surfaceAlt,
    borderColor: colors.border,
  },
  songMarkText: { fontWeight: '800', fontSize: fontSize.md, color: colors.text },
  songTitle: { color: colors.text, fontWeight: '600', fontSize: fontSize.lg },
  songMeta: {
    color: colors.textMuted,
    fontSize: fontSize.sm,
    marginTop: 2,
  },
  chev: { color: colors.textDim, fontSize: 22 },
  suggestWrap: { alignItems: 'center', marginTop: spacing.xl },
  suggestLabel: {
    color: colors.textDim,
    fontSize: fontSize.xs,
    fontWeight: '700',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: spacing.md,
  },
  suggestRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    justifyContent: 'center',
  },
  suggestChip: {
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
  },
  suggestText: {
    color: colors.accent,
    fontSize: fontSize.md,
    fontWeight: '600',
  },
  empty: {
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.xl,
  },
});
