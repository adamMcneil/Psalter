import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { Link } from 'expo-router';
import { Screen } from '@/components/Screen';
import { featuredPlaylists } from '@/data/playlists';
import { psalms } from '@/data/psalms';
import {
  colors,
  fontSize,
  paletteForThemes,
  radius,
  spacing,
} from '@/theme';

export default function PlaylistsScreen() {
  return (
    <Screen>
      <FlatList
        data={featuredPlaylists}
        keyExtractor={(p) => p.id}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.h1}>Featured</Text>
            <Text style={styles.subtitle}>
              Curated journeys through the Psalter
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const firstPsalm = psalms.find((p) => p.number === item.psalms[0]);
          const palette = paletteForThemes(firstPsalm?.themes);
          return (
            <Link
              href={{ pathname: '/playlist/[id]', params: { id: item.id } }}
              asChild
            >
              <Pressable
                style={({ pressed }) => [
                  styles.card,
                  pressed && styles.pressed,
                ]}
              >
                <View
                  style={[
                    styles.cover,
                    {
                      backgroundColor: palette.soft,
                      borderColor: palette.base,
                    },
                  ]}
                >
                  <Text style={[styles.coverGlyph, { color: palette.base }]}>
                    {palette.glyph}
                  </Text>
                </View>
                <View style={styles.body}>
                  <Text style={styles.title} numberOfLines={2}>
                    {item.title}
                  </Text>
                  <Text style={styles.blurb} numberOfLines={2}>
                    {item.blurb}
                  </Text>
                  <View style={styles.metaRow}>
                    <View
                      style={[
                        styles.metaPill,
                        { borderColor: palette.base },
                      ]}
                    >
                      <Text
                        style={[styles.metaPillText, { color: palette.base }]}
                      >
                        {item.psalms.length} psalms
                      </Text>
                    </View>
                    <Text style={styles.metaArrow}>→</Text>
                  </View>
                </View>
              </Pressable>
            </Link>
          );
        }}
        contentContainerStyle={{ paddingBottom: spacing.xl }}
        showsVerticalScrollIndicator={false}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingTop: spacing.md,
    marginBottom: spacing.md,
  },
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
  card: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  pressed: { opacity: 0.78, transform: [{ scale: 0.995 }] },
  cover: {
    width: 88,
    alignItems: 'center',
    justifyContent: 'center',
    borderRightWidth: 1,
  },
  coverGlyph: { fontSize: 36 },
  body: {
    flex: 1,
    padding: spacing.md,
  },
  title: { color: colors.text, fontSize: fontSize.xl, fontWeight: '700' },
  blurb: {
    color: colors.textMuted,
    fontSize: fontSize.md,
    marginTop: spacing.xs,
    lineHeight: 18,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  metaPill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  metaPillText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  metaArrow: {
    color: colors.textDim,
    fontSize: fontSize.lg,
    marginLeft: 'auto',
  },
});
