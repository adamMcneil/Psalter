import { useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSpotifyAuth } from '../spotify/AuthContext';
import { useWebPlayer } from '../spotify/WebPlayerContext';
import { colors, radius, spacing } from '../theme';

export function NowPlayingBar() {
  const { tokens, user, login } = useSpotifyAuth();
  const player = useWebPlayer();
  const [busy, setBusy] = useState(false);

  if (!tokens) {
    return (
      <View style={styles.bar}>
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
          <Text style={styles.ctaText}>
            {busy ? 'Opening…' : 'Sign in'}
          </Text>
        </Pressable>
      </View>
    );
  }

  if (user && user.product !== 'premium') {
    return (
      <View style={styles.bar}>
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
      <View style={styles.bar}>
        <Text style={[styles.subtitle, styles.error]} numberOfLines={2}>
          {player.error}
        </Text>
      </View>
    );
  }

  if (!player.currentUri) {
    if (player.initializing || !player.ready) {
      return (
        <View style={styles.bar}>
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
    <View style={styles.bar}>
      {player.albumArt ? (
        <Image source={{ uri: player.albumArt }} style={styles.art} />
      ) : (
        <View style={styles.art} />
      )}
      <View style={{ flex: 1, marginLeft: spacing.sm }}>
        <Text style={styles.title} numberOfLines={1}>
          {player.trackName ?? '—'}
        </Text>
        <Text style={styles.subtitle} numberOfLines={1}>
          {player.artistName ?? ''}
        </Text>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
        </View>
      </View>
      <Pressable
        onPress={player.toggle}
        style={styles.btn}
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
    paddingVertical: spacing.sm,
    minHeight: 64,
  },
  art: {
    width: 48,
    height: 48,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceAlt,
  },
  title: { color: colors.text, fontWeight: '600', fontSize: 13 },
  subtitle: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  progressTrack: {
    height: 3,
    backgroundColor: colors.surfaceAlt,
    borderRadius: 2,
    marginTop: spacing.xs,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', backgroundColor: colors.accent },
  btn: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  btnText: { color: colors.text, fontSize: 18 },
  cta: {
    backgroundColor: colors.accent,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
  },
  ctaText: { color: '#1a1207', fontWeight: '700', fontSize: 13 },
  disabled: { opacity: 0.6 },
  error: { color: colors.danger },
});
