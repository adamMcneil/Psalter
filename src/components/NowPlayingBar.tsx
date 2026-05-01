import { useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSpotifyAuth } from '../spotify/AuthContext';
import { useWebPlayer } from '../spotify/WebPlayerContext';
import { colors, fontSize, radius, spacing } from '../theme';

export function NowPlayingBar() {
  const { tokens, user, login } = useSpotifyAuth();
  const player = useWebPlayer();
  const [busy, setBusy] = useState(false);

  if (!tokens) {
    return (
      <View style={[styles.bar, styles.barFlat]}>
        <View style={styles.iconCircle}>
          <Text style={styles.iconCircleText}>♫</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Sign in to play full songs</Text>
          <Text style={styles.subtitle}>
            Spotify Premium required for in-app playback
          </Text>
        </View>
        <Pressable
          disabled={busy}
          onPress={async () => {
            setBusy(true);
            try {
              await login();
            } finally {
              setBusy(false);
            }
          }}
          style={[styles.cta, busy && styles.disabled]}
          accessibilityLabel="Sign in with Spotify"
        >
          <Text style={styles.ctaText}>{busy ? 'Opening…' : 'Sign in'}</Text>
        </Pressable>
      </View>
    );
  }

  if (user && user.product !== 'premium') {
    return (
      <View style={[styles.bar, styles.barFlat]}>
        <View style={styles.iconCircle}>
          <Text style={styles.iconCircleText}>!</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Spotify Premium required</Text>
          <Text style={styles.subtitle}>
            Free accounts can preview tracks (30 sec) only
          </Text>
        </View>
      </View>
    );
  }

  if (player.error) {
    return (
      <View style={[styles.bar, styles.barFlat]}>
        <Text style={[styles.subtitle, styles.error]} numberOfLines={2}>
          {player.error}
        </Text>
      </View>
    );
  }

  if (!player.currentUri) {
    if (player.initializing || !player.ready) {
      return (
        <View style={[styles.bar, styles.barFlat]}>
          <View style={styles.dotPulse} />
          <Text style={styles.subtitle}>Connecting to Spotify…</Text>
        </View>
      );
    }
    return null;
  }

  const progress =
    player.duration > 0
      ? Math.min(1, player.position / player.duration)
      : 0;

  return (
    <View
      style={[
        styles.bar,
        player.isPlaying && styles.playingBar,
      ]}
    >
      {player.albumArt ? (
        <Image source={{ uri: player.albumArt }} style={styles.art} />
      ) : (
        <View style={[styles.art, styles.artPlaceholder]}>
          <Text style={styles.artGlyph}>♪</Text>
        </View>
      )}
      <View style={{ flex: 1, marginLeft: spacing.md }}>
        <Text style={styles.kicker}>
          {player.isPlaying ? 'NOW PLAYING' : 'PAUSED'}
        </Text>
        <Text style={styles.title} numberOfLines={1}>
          {player.trackName ?? '—'}
        </Text>
        <Text style={styles.subtitle} numberOfLines={1}>
          {player.artistName ?? ''}
        </Text>
        <View style={styles.progressTrack}>
          <View
            style={[styles.progressFill, { width: `${progress * 100}%` }]}
          />
        </View>
      </View>
      <Pressable
        onPress={player.toggle}
        style={({ pressed }) => [styles.btn, pressed && styles.btnPressed]}
        accessibilityLabel={player.isPlaying ? 'Pause' : 'Play'}
      >
        <Text style={styles.btnText}>{player.isPlaying ? '❚❚' : '▶'}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderTopColor: colors.border,
    borderTopWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    minHeight: 72,
    gap: spacing.sm,
  },
  barFlat: { minHeight: 60 },
  playingBar: {
    backgroundColor: colors.bgElevated,
    borderTopColor: colors.accent,
    borderTopWidth: 1.5,
  },
  art: {
    width: 52,
    height: 52,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
  },
  artPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  artGlyph: { color: colors.textDim, fontSize: 22 },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  iconCircleText: { color: colors.accent, fontSize: 16, fontWeight: '700' },
  kicker: {
    color: colors.accent,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.4,
    marginBottom: 1,
  },
  title: { color: colors.text, fontWeight: '700', fontSize: fontSize.md },
  subtitle: {
    color: colors.textMuted,
    fontSize: fontSize.sm,
    marginTop: 1,
  },
  progressTrack: {
    height: 3,
    backgroundColor: colors.surfaceAlt,
    borderRadius: 2,
    marginTop: spacing.xs + 2,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', backgroundColor: colors.accent },
  btn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: spacing.xs,
  },
  btnPressed: { opacity: 0.8, transform: [{ scale: 0.96 }] },
  btnText: { color: '#1a1207', fontSize: 14, fontWeight: '800' },
  cta: {
    backgroundColor: colors.accent,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
  },
  ctaText: { color: '#1a1207', fontWeight: '800', fontSize: fontSize.md },
  disabled: { opacity: 0.6 },
  error: { color: colors.danger },
  dotPulse: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.accent,
    marginRight: spacing.sm,
  },
});
