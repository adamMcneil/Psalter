import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Link } from 'expo-router';
import { Psalm } from '../types';
import { colors, radius, spacing } from '../theme';
import { songsForPsalm } from '../data/catalog';

export function PsalmCard({ psalm }: { psalm: Psalm }) {
  const songCount = songsForPsalm(psalm.number).length;

  return (
    <Link href={`/psalm/${psalm.number}`} asChild>
      <Pressable>
        {({ pressed }) => (
          <View style={[styles.card, pressed && styles.pressed]}>
            <View style={styles.numberWrap}>
              <Text style={styles.number}>{psalm.number}</Text>
            </View>
            <View style={styles.body}>
              <Text style={styles.title}>{psalm.title}</Text>
            </View>
            <View style={styles.right}>
              {songCount > 0 ? (
                <View style={styles.countPill}>
                  <Text style={styles.countText}>
                    {songCount} {songCount === 1 ? 'song' : 'songs'}
                  </Text>
                </View>
              ) : null}
              <Text style={styles.chev}>›</Text>
            </View>
          </View>
        )}
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
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pressed: { opacity: 0.7 },
  numberWrap: {
    width: 46,
    height: 46,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
    borderWidth: 1,
    backgroundColor: colors.surfaceAlt,
    borderColor: colors.border,
  },
  number: { fontWeight: '700', fontSize: 16, color: colors.text },
  body: { flex: 1 },
  title: { color: colors.text, fontSize: 15, fontWeight: '600' },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  countPill: {
    backgroundColor: colors.surfaceAlt,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
  },
  countText: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '600',
  },
  chev: { color: colors.textDim, fontSize: 22, marginLeft: 2 },
});
