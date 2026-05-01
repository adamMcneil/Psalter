import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Link } from 'expo-router';
import { Psalm } from '../types';
import { colors, radius, spacing } from '../theme';

export function PsalmCard({ psalm }: { psalm: Psalm }) {
  return (
    <Link href={`/psalm/${psalm.number}`} asChild>
      <Pressable style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
        <View style={styles.numberWrap}>
          <Text style={styles.number}>{psalm.number}</Text>
        </View>
        <View style={styles.body}>
          <Text style={styles.title} numberOfLines={1}>
            {psalm.title}
          </Text>
          <Text style={styles.themes} numberOfLines={1}>
            {psalm.themes.join(' · ')}
          </Text>
        </View>
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  card: {
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
  numberWrap: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  number: { color: colors.accent, fontWeight: '700', fontSize: 16 },
  body: { flex: 1 },
  title: { color: colors.text, fontSize: 15, fontWeight: '600' },
  themes: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
});
