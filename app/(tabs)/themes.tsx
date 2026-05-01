import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useState } from 'react';
import { Screen } from '@/components/Screen';
import { PsalmCard } from '@/components/PsalmCard';
import { themes } from '@/data/themes';
import { psalms } from '@/data/psalms';
import { Theme } from '@/types';
import { colors, radius, spacing } from '@/theme';

export default function ThemesScreen() {
  const [active, setActive] = useState<Theme>('Praise');
  const filtered = psalms.filter((p) => p.themes.includes(active));

  return (
    <Screen>
      <Text style={styles.h1}>Browse by theme</Text>
      <View style={styles.chips}>
        {themes.map((t) => {
          const on = t.name === active;
          return (
            <Pressable
              key={t.name}
              onPress={() => setActive(t.name)}
              style={[styles.chip, on && styles.chipOn]}
            >
              <Text style={[styles.chipText, on && styles.chipTextOn]}>
                {t.name}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <Text style={styles.desc}>
        {themes.find((t) => t.name === active)?.description}
      </Text>
      <FlatList
        data={filtered}
        keyExtractor={(p) => String(p.number)}
        renderItem={({ item }) => <PsalmCard psalm={item} />}
        contentContainerStyle={{ paddingVertical: spacing.md }}
        showsVerticalScrollIndicator={false}
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
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipOn: { backgroundColor: colors.accentSoft, borderColor: colors.accent },
  chipText: { color: colors.textMuted, fontSize: 13 },
  chipTextOn: { color: colors.accent, fontWeight: '600' },
  desc: { color: colors.textMuted, marginTop: spacing.md, fontSize: 13 },
});
