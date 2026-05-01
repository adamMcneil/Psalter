import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Song } from '../types';
import { colors, radius, spacing } from '../theme';
import { useFavorites } from '../storage/favorites';

function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function SongRow({
  song,
  onPress,
}: {
  song: Song;
  onPress: () => void;
}) {
  const { isFavorite, toggle } = useFavorites();
  const fav = isFavorite(song.id);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <View style={{ flex: 1 }}>
        <Text style={styles.title} numberOfLines={1}>
          {song.title}
        </Text>
        <Text style={styles.artist} numberOfLines={1}>
          {song.artist}
        </Text>
        <Text style={styles.meta}>
          {formatDuration(song.durationSec)} · {song.license.kind}
        </Text>
      </View>
      <Pressable
        hitSlop={12}
        onPress={() => toggle(song.id)}
        style={styles.heartBtn}
      >
        <Text style={[styles.heart, fav && styles.heartOn]}>
          {fav ? '♥' : '♡'}
        </Text>
      </Pressable>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
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
  title: { color: colors.text, fontSize: 15, fontWeight: '600' },
  artist: { color: colors.text, opacity: 0.85, fontSize: 13, marginTop: 2 },
  meta: { color: colors.textMuted, fontSize: 11, marginTop: 4 },
  heartBtn: { paddingHorizontal: spacing.sm },
  heart: { color: colors.textMuted, fontSize: 22 },
  heartOn: { color: colors.accent },
});
