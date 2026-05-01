import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Link } from 'expo-router';
import { Psalm } from '../types';
import { colors, paletteForThemes, radius, spacing } from '../theme';
import { songsForPsalm } from '../data/catalog';

export function PsalmCard({ psalm }: { psalm: Psalm }) {
  const palette = paletteForThemes(psalm.themes);
  const songCount = songsForPsalm(psalm.number).length;

  return (
    <Link href={`/psalm/${psalm.number}`} asChild>
      <Pressable>
        {({ pressed }) => (
          <View style={[styles.card, pressed && styles.pressed]}>
            <View style={[styles.stripe, { backgroundColor: palette.base }]} />
            <View
              style={[
                styles.numberWrap,
                { backgroundColor: palette.soft, borderColor: palette.base },
              ]}
            >
              <Text style={[styles.number, { color: palette.base }]}>
                {psalm.number}
              </Text>
            </View>
            <View style={styles.body}>
              <Text style={styles.title} numberOfLines={1}>
                {psalm.title}
              </Text>
              <Text style={styles.themes} numberOfLines={1}>
                {psalm.themes.join(' · ')}
              </Text>
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
    paddingRight: spacing.md,
    paddingLeft: spacing.md + 4,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  pressed: { opacity: 0.7 },
  stripe: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
  },
  numberWrap: {
    width: 46,
    height: 46,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
    borderWidth: 1,
  },
  number: { fontWeight: '700', fontSize: 16 },
  body: { flex: 1 },
  title: { color: colors.text, fontSize: 15, fontWeight: '600' },
  themes: { color: colors.textMuted, fontSize: 12, marginTop: 3 },
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
