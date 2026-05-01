import { Pressable, StyleSheet, Text, View } from 'react-native';
import TrackPlayer, {
  State,
  useProgress,
} from 'react-native-track-player';
import { Screen } from '@/components/Screen';
import { useNowPlaying } from '@/audio/useNowPlaying';
import { togglePlayPause } from '@/audio/queue';
import { songById } from '@/data/catalog';
import { colors, radius, spacing } from '@/theme';

function fmt(sec: number) {
  const s = Math.max(0, Math.floor(sec));
  const m = Math.floor(s / 60);
  return `${m}:${(s % 60).toString().padStart(2, '0')}`;
}

export default function PlayerScreen() {
  const { track, state } = useNowPlaying();
  const { position, duration } = useProgress(500);
  const song = track?.id ? songById(String(track.id)) : undefined;
  const playing = state === State.Playing;
  const pct = duration > 0 ? Math.min(1, position / duration) : 0;

  return (
    <Screen showMiniPlayer={false}>
      <View style={styles.body}>
        <View style={styles.artwork}>
          <Text style={styles.artworkText}>♪</Text>
        </View>
        <Text style={styles.title} numberOfLines={2}>
          {track?.title ?? 'Nothing playing'}
        </Text>
        <Text style={styles.artist} numberOfLines={1}>
          {track?.artist ?? ' '}
        </Text>
        <Text style={styles.album} numberOfLines={1}>
          {track?.album ?? ' '}
        </Text>

        <View style={styles.progress}>
          <View style={[styles.progressFill, { width: `${pct * 100}%` }]} />
        </View>
        <View style={styles.times}>
          <Text style={styles.timeText}>{fmt(position)}</Text>
          <Text style={styles.timeText}>{fmt(duration)}</Text>
        </View>

        <View style={styles.controls}>
          <Pressable
            style={styles.ctlBtn}
            onPress={() => TrackPlayer.seekBy(-15)}
          >
            <Text style={styles.ctlText}>−15</Text>
          </Pressable>
          <Pressable
            style={[styles.ctlBtn, styles.playBtn]}
            onPress={togglePlayPause}
          >
            <Text style={[styles.ctlText, styles.playText]}>
              {playing ? '❚❚' : '▶'}
            </Text>
          </Pressable>
          <Pressable
            style={styles.ctlBtn}
            onPress={() => TrackPlayer.seekBy(30)}
          >
            <Text style={styles.ctlText}>+30</Text>
          </Pressable>
        </View>

        {song && (
          <Text style={styles.licenseNote}>
            {song.license.kind}
            {song.license.notes ? ` · ${song.license.notes}` : ''}
          </Text>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: {
    flex: 1,
    paddingTop: spacing.xl,
    alignItems: 'center',
  },
  artwork: {
    width: 240,
    height: 240,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceAlt,
    borderColor: colors.border,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xl,
  },
  artworkText: { color: colors.accent, fontSize: 80 },
  title: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
  },
  artist: { color: colors.text, opacity: 0.85, marginTop: spacing.sm },
  album: { color: colors.textMuted, marginTop: spacing.xs, fontSize: 12 },
  progress: {
    height: 4,
    width: '100%',
    backgroundColor: colors.border,
    borderRadius: 2,
    marginTop: spacing.xl,
    overflow: 'hidden',
  },
  progressFill: { height: 4, backgroundColor: colors.accent },
  times: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: spacing.sm,
  },
  timeText: { color: colors.textMuted, fontSize: 12 },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    marginTop: spacing.xl,
  },
  ctlBtn: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  playBtn: {
    width: 72,
    alignItems: 'center',
    backgroundColor: colors.accentSoft,
    borderColor: colors.accent,
  },
  ctlText: { color: colors.text, fontWeight: '600' },
  playText: { color: colors.accent, fontSize: 18 },
  licenseNote: {
    color: colors.textMuted,
    fontSize: 11,
    marginTop: spacing.xl,
    textAlign: 'center',
  },
});
