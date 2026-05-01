import { useMemo } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Link, Stack } from 'expo-router';
import { Screen } from '@/components/Screen';
import { catalog } from '@/data/catalog';
import { psalms } from '@/data/psalms';
import {
  colors,
  fontSize,
  paletteForThemes,
  radius,
  spacing,
} from '@/theme';

const BAR_WIDTH = 10;
const BAR_GAP = 2;
const CHART_HEIGHT = 180;
const SLOT_WIDTH = BAR_WIDTH + BAR_GAP;

const BOOK_DIVIDERS = [42, 73, 90, 107];
const LABELLED = new Set([1, 10, 25, 50, 75, 100, 125, 150]);

export default function CoverageScreen() {
  const counts = useMemo(() => {
    const map = new Map<number, number>();
    for (const s of catalog) {
      map.set(s.psalm, (map.get(s.psalm) ?? 0) + 1);
    }
    return map;
  }, []);

  const max = Math.max(1, ...Array.from(counts.values()));
  const covered = counts.size;
  const uncovered = 150 - covered;
  const totalSongs = catalog.length;

  const top = useMemo(() => {
    return Array.from(counts.entries())
      .map(([num, count]) => ({
        num,
        count,
        psalm: psalms.find((p) => p.number === num)!,
      }))
      .filter((t) => t.psalm)
      .sort((a, b) => b.count - a.count || a.num - b.num)
      .slice(0, 10);
  }, [counts]);

  return (
    <Screen>
      <Stack.Screen options={{ title: 'Coverage' }} />
      <ScrollView
        contentContainerStyle={{ paddingBottom: spacing.xl }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerBlock}>
          <Text style={styles.kicker}>CATALOG</Text>
          <Text style={styles.h1}>Coverage</Text>
          <Text style={styles.subtitle}>
            Songs per psalm across all 150
          </Text>

          <View style={styles.stats}>
            <StatTile value={`${covered}`} label="of 150 covered" emphasis />
            <StatTile value={`${uncovered}`} label="still need a song" />
            <StatTile value={`${totalSongs}`} label="songs total" />
            <StatTile value={`${max}`} label="most for one psalm" />
          </View>
        </View>

        <Text style={styles.sectionLabel}>Distribution</Text>
        <Text style={styles.sectionHint}>
          Tap any bar to open that psalm
        </Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator
          style={styles.chartBleed}
          contentContainerStyle={styles.chartContent}
        >
          <View>
            <View style={styles.chart}>
              {BOOK_DIVIDERS.map((d) => (
                <View
                  key={d}
                  style={[
                    styles.divider,
                    { left: (d - 1) * SLOT_WIDTH - 1 },
                  ]}
                />
              ))}
              {psalms.map((p) => {
                const count = counts.get(p.number) ?? 0;
                const palette = paletteForThemes(p.themes);
                const h =
                  count > 0
                    ? Math.max(3, (count / max) * CHART_HEIGHT)
                    : 2;
                const empty = count === 0;
                return (
                  <Link
                    key={p.number}
                    href={`/psalm/${p.number}`}
                    asChild
                  >
                    <Pressable
                      style={({ pressed }) => [
                        styles.barWrap,
                        pressed && styles.pressed,
                      ]}
                      accessibilityLabel={`Psalm ${p.number}, ${count} song${count === 1 ? '' : 's'}`}
                    >
                      <Text style={styles.barCount}>
                        {count > 0 ? count : ''}
                      </Text>
                      <View
                        style={[
                          styles.bar,
                          {
                            height: h,
                            backgroundColor: empty
                              ? colors.surfaceAlt
                              : palette.base,
                            borderColor: empty
                              ? colors.border
                              : palette.base,
                          },
                        ]}
                      />
                    </Pressable>
                  </Link>
                );
              })}
            </View>
            <View style={styles.axis}>
              {psalms.map((p) => (
                <View key={p.number} style={styles.axisSlot}>
                  <Text
                    style={[
                      styles.axisLabel,
                      LABELLED.has(p.number) ? null : styles.axisLabelHidden,
                    ]}
                  >
                    {p.number}
                  </Text>
                </View>
              ))}
            </View>
            <View style={styles.bookRow}>
              <BookLabel label="Book I" from={1} to={41} />
              <BookLabel label="Book II" from={42} to={72} />
              <BookLabel label="Book III" from={73} to={89} />
              <BookLabel label="Book IV" from={90} to={106} />
              <BookLabel label="Book V" from={107} to={150} />
            </View>
          </View>
        </ScrollView>

        <Text style={styles.sectionLabel}>Most Songs</Text>
        {top.length === 0 ? (
          <Text style={styles.empty}>No songs in the catalog yet.</Text>
        ) : (
          top.map((t, i) => {
            const palette = paletteForThemes(t.psalm.themes);
            return (
              <Link key={t.num} href={`/psalm/${t.num}`} asChild>
                <Pressable
                  style={({ pressed }) => [
                    styles.row,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={styles.rank}>{i + 1}</Text>
                  <View
                    style={[
                      styles.numBadge,
                      {
                        backgroundColor: palette.soft,
                        borderColor: palette.base,
                      },
                    ]}
                  >
                    <Text style={[styles.numText, { color: palette.base }]}>
                      {t.num}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowTitle} numberOfLines={1}>
                      {t.psalm.title}
                    </Text>
                    <Text style={styles.rowMeta}>Psalm {t.num}</Text>
                  </View>
                  <View
                    style={[
                      styles.countPill,
                      { borderColor: palette.base },
                    ]}
                  >
                    <Text
                      style={[styles.countText, { color: palette.base }]}
                    >
                      {t.count} {t.count === 1 ? 'song' : 'songs'}
                    </Text>
                  </View>
                </Pressable>
              </Link>
            );
          })
        )}
      </ScrollView>
    </Screen>
  );
}

function StatTile({
  value,
  label,
  emphasis,
}: {
  value: string;
  label: string;
  emphasis?: boolean;
}) {
  return (
    <View style={[styles.tile, emphasis && styles.tileEmphasis]}>
      <Text style={[styles.tileValue, emphasis && styles.tileValueEmphasis]}>
        {value}
      </Text>
      <Text style={styles.tileLabel}>{label}</Text>
    </View>
  );
}

function BookLabel({
  label,
  from,
  to,
}: {
  label: string;
  from: number;
  to: number;
}) {
  const width = (to - from + 1) * SLOT_WIDTH;
  return (
    <View style={[styles.bookSeg, { width }]}>
      <Text style={styles.bookText} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  headerBlock: { paddingTop: spacing.md },
  kicker: {
    color: colors.accent,
    fontSize: fontSize.xs,
    fontWeight: '800',
    letterSpacing: 1.6,
  },
  h1: {
    color: colors.text,
    fontSize: fontSize.h1,
    fontWeight: '800',
    marginTop: spacing.xs,
    letterSpacing: -0.5,
  },
  subtitle: {
    color: colors.textMuted,
    marginTop: 4,
    fontSize: fontSize.md,
  },
  stats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  tile: {
    flexBasis: '48%',
    flexGrow: 1,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  tileEmphasis: {
    backgroundColor: colors.accentSoft,
    borderColor: colors.accent,
  },
  tileValue: {
    color: colors.text,
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  tileValueEmphasis: { color: colors.accent },
  tileLabel: {
    color: colors.textMuted,
    fontSize: fontSize.xs,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginTop: 4,
  },
  sectionLabel: {
    color: colors.textMuted,
    fontSize: fontSize.xs,
    fontWeight: '800',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    marginTop: spacing.lg,
  },
  sectionHint: {
    color: colors.textDim,
    fontSize: fontSize.sm,
    marginTop: 2,
    marginBottom: spacing.sm,
  },
  chartBleed: {
    marginHorizontal: -spacing.md,
  },
  chartContent: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xs,
  },
  chart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: CHART_HEIGHT + 18,
    position: 'relative',
  },
  divider: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: colors.border,
  },
  barWrap: {
    width: BAR_WIDTH,
    marginRight: BAR_GAP,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  barCount: {
    color: colors.textDim,
    fontSize: 9,
    fontWeight: '700',
    height: 12,
    lineHeight: 12,
    textAlign: 'center',
    width: 18,
    marginLeft: -4,
  },
  bar: {
    width: BAR_WIDTH,
    borderRadius: 2,
    borderWidth: 0.5,
  },
  axis: {
    flexDirection: 'row',
    marginTop: 4,
  },
  axisSlot: {
    width: BAR_WIDTH,
    marginRight: BAR_GAP,
    alignItems: 'center',
  },
  axisLabel: {
    color: colors.textMuted,
    fontSize: 9,
    fontWeight: '700',
    width: 24,
    textAlign: 'center',
    marginLeft: -7,
  },
  axisLabelHidden: { opacity: 0 },
  bookRow: {
    flexDirection: 'row',
    marginTop: 6,
  },
  bookSeg: {
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: colors.borderSoft,
    paddingTop: 4,
  },
  bookText: {
    color: colors.textDim,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm + 2,
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  pressed: { opacity: 0.78, transform: [{ scale: 0.99 }] },
  rank: {
    color: colors.textDim,
    fontSize: fontSize.lg,
    fontWeight: '800',
    width: 22,
    textAlign: 'center',
  },
  numBadge: {
    width: 40,
    height: 40,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  numText: { fontSize: fontSize.lg, fontWeight: '800' },
  rowTitle: {
    color: colors.text,
    fontSize: fontSize.lg,
    fontWeight: '600',
  },
  rowMeta: {
    color: colors.textMuted,
    fontSize: fontSize.sm,
    marginTop: 2,
  },
  countPill: {
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 4,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  countText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  empty: {
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.xl,
  },
});
