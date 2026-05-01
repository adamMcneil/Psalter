import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useMemo, useState } from 'react';
import { Screen } from '@/components/Screen';
import { PsalmCard } from '@/components/PsalmCard';
import { themes } from '@/data/themes';
import { psalms } from '@/data/psalms';
import { Theme } from '@/types';
import {
  colors,
  fontSize,
  radius,
  spacing,
  themePalettes,
} from '@/theme';

export default function ThemesScreen() {
  const [active, setActive] = useState<Theme | null>(null);

  const filtered = useMemo(
    () =>
      active ? psalms.filter((p) => p.themes.includes(active)) : [],
    [active],
  );

  const palette = active ? themePalettes[active] : null;

  return (
    <Screen>
      <FlatList
        data={filtered}
        keyExtractor={(p) => String(p.number)}
        renderItem={({ item }) => <PsalmCard psalm={item} />}
        contentContainerStyle={{ paddingBottom: spacing.xl }}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View>
            <Text style={styles.h1}>Themes</Text>
            <Text style={styles.subtitle}>
              Seven streams running through the Psalter
            </Text>

            <View style={styles.grid}>
              {themes.map((t) => {
                const p = themePalettes[t.name];
                const on = active === t.name;
                const count = psalms.filter((ps) =>
                  ps.themes.includes(t.name),
                ).length;
                return (
                  <Pressable
                    key={t.name}
                    onPress={() => setActive(on ? null : t.name)}
                    style={({ pressed }) => [
                      styles.tile,
                      {
                        backgroundColor: on ? p.base : p.soft,
                        borderColor: p.base,
                      },
                      pressed && styles.pressed,
                    ]}
                  >
                    <Text
                      style={[
                        styles.tileGlyph,
                        { color: on ? p.ink : p.base },
                      ]}
                    >
                      {p.glyph}
                    </Text>
                    <Text
                      style={[
                        styles.tileName,
                        { color: on ? p.ink : p.base },
                      ]}
                    >
                      {t.name}
                    </Text>
                    <Text
                      style={[
                        styles.tileCount,
                        { color: on ? p.ink : colors.textMuted, opacity: on ? 0.75 : 1 },
                      ]}
                    >
                      {count} psalms
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {active && palette ? (
              <View
                style={[
                  styles.descBox,
                  { backgroundColor: palette.soft, borderColor: palette.base },
                ]}
              >
                <Text style={[styles.descTitle, { color: palette.base }]}>
                  {active}
                </Text>
                <Text style={styles.descText}>
                  {themes.find((t) => t.name === active)?.description}
                </Text>
              </View>
            ) : (
              <Text style={styles.tapHint}>Tap a theme to filter psalms.</Text>
            )}
          </View>
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  h1: {
    color: colors.text,
    fontSize: fontSize.h1,
    fontWeight: '800',
    paddingTop: spacing.md,
    letterSpacing: -0.5,
  },
  subtitle: {
    color: colors.textMuted,
    marginTop: 4,
    fontSize: fontSize.md,
    marginBottom: spacing.lg,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  tile: {
    flexBasis: '48%',
    flexGrow: 1,
    minHeight: 96,
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing.md,
    justifyContent: 'space-between',
  },
  pressed: { opacity: 0.85, transform: [{ scale: 0.99 }] },
  tileGlyph: { fontSize: 22 },
  tileName: {
    fontSize: fontSize.lg,
    fontWeight: '800',
    marginTop: spacing.sm,
  },
  tileCount: {
    fontSize: fontSize.xs,
    fontWeight: '700',
    letterSpacing: 0.4,
    marginTop: 2,
  },
  descBox: {
    marginTop: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing.md,
  },
  descTitle: {
    fontSize: fontSize.xs,
    fontWeight: '800',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  descText: {
    color: colors.text,
    fontSize: fontSize.md,
    marginTop: spacing.xs,
    lineHeight: 19,
  },
  tapHint: {
    color: colors.textDim,
    textAlign: 'center',
    marginTop: spacing.lg,
    fontSize: fontSize.md,
  },
});
