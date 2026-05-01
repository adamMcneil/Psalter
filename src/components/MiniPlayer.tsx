import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { State } from 'react-native-track-player';
import { useNowPlaying } from '../audio/useNowPlaying';
import { togglePlayPause } from '../audio/queue';
import { colors, radius, spacing } from '../theme';

export function MiniPlayer() {
  const router = useRouter();
  const { track, state } = useNowPlaying();
  if (!track) return null;

  const playing = state === State.Playing;

  return (
    <Pressable style={styles.bar} onPress={() => router.push('/player')}>
      <View style={{ flex: 1 }}>
        <Text style={styles.title} numberOfLines={1}>
          {track.title}
        </Text>
        <Text style={styles.artist} numberOfLines={1}>
          {track.artist}
        </Text>
      </View>
      <Pressable
        hitSlop={12}
        onPress={(e) => {
          e.stopPropagation();
          togglePlayPause();
        }}
        style={styles.btn}
      >
        <Text style={styles.btnText}>{playing ? '❚❚' : '▶'}</Text>
      </Pressable>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    padding: spacing.md,
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  title: { color: colors.text, fontWeight: '600' },
  artist: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  btn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accentSoft,
  },
  btnText: { color: colors.accent, fontWeight: '700' },
});
