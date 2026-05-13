import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, fontSize, spacing } from '../theme';

interface TabItem {
  label: string;
  glyph: string;
  path: string;
}

const TABS: TabItem[] = [
  { label: 'Psalms', glyph: '❖', path: '/' },
  { label: 'Artists', glyph: '♪', path: '/artists' },
  { label: 'Search', glyph: '⌕', path: '/search' },
  { label: 'Coverage', glyph: '◐', path: '/coverage' },
  { label: 'Account', glyph: '◉', path: '/account' },
];

export function BottomNav() {
  const router = useRouter();
  const pathname = usePathname();

  return (
    <SafeAreaView edges={['bottom']} style={styles.safe}>
      <View style={styles.bar}>
        {TABS.map((tab) => {
          const active =
            tab.path === '/'
              ? pathname === '/' || pathname === '/index'
              : pathname === tab.path;
          return (
            <Pressable
              key={tab.path}
              onPress={() => router.push(tab.path as never)}
              style={({ pressed }) => [
                styles.item,
                pressed && styles.pressed,
              ]}
              accessibilityLabel={tab.label}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
            >
              <Text style={[styles.glyph, active && styles.activeText]}>
                {tab.glyph}
              </Text>
              <Text style={[styles.label, active && styles.activeText]}>
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  bar: {
    flexDirection: 'row',
    paddingHorizontal: spacing.sm,
    paddingTop: spacing.xs,
    paddingBottom: spacing.xs,
  },
  item: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xs + 2,
    gap: 2,
  },
  pressed: { opacity: 0.6 },
  glyph: {
    color: colors.textMuted,
    fontSize: 18,
    lineHeight: 22,
  },
  label: {
    color: colors.textMuted,
    fontSize: fontSize.xs,
    fontWeight: '600',
  },
  activeText: { color: colors.accent },
});
