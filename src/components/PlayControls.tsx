import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Song } from '../types';
import { useSpotifyAuth } from '../spotify/AuthContext';
import { useWebPlayer } from '../spotify/WebPlayerContext';
import { usePreviewPlayer } from '../spotify/PreviewPlayerContext';
import { extractTrackId, openSpotifyTrack } from '../spotify/launch';
import { colors, fontSize, radius, spacing } from '../theme';

function shuffle<T>(arr: T[]): T[] {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function PlayControls({ queue }: { queue: Song[] }) {
  const { tokens, login } = useSpotifyAuth();
  const player = useWebPlayer();
  const preview = usePreviewPlayer();

  const playableSongs = useMemo(
    () => queue.filter((s) => extractTrackId(s.spotifyUrl)),
    [queue],
  );

  if (playableSongs.length === 0) return null;

  async function start(order: 'inOrder' | 'shuffled') {
    const songs = order === 'shuffled' ? shuffle(playableSongs) : playableSongs;
    const first = songs[0];
    const firstTrackId = extractTrackId(first.spotifyUrl)!;

    if (player.supported) {
      // Unlock the audio element now, inside the tap, so Spotify is allowed to
      // auto-advance to later tracks in the queue without the browser pausing it.
      // Must happen before the first await below or the user gesture is lost.
      player.activateElement();
      if (!tokens) {
        try {
          await login();
        } catch {
          // ignore — user can retry
        }
        return;
      }
      const uris = songs
        .map((s) => extractTrackId(s.spotifyUrl))
        .filter((id): id is string => !!id)
        .map((id) => `spotify:track:${id}`);
      await player.play(uris);
      return;
    }
    if (preview.supported) {
      await preview.toggle(firstTrackId);
      return;
    }
    openSpotifyTrack(first);
  }

  return (
    <View style={styles.row}>
      <Pressable
        onPress={() => start('inOrder')}
        accessibilityLabel="Play all"
        style={({ pressed }) => [
          styles.btn,
          styles.btnPrimary,
          pressed && styles.pressed,
        ]}
      >
        <Text style={[styles.glyph, styles.glyphPrimary]}>▶</Text>
        <Text style={[styles.label, styles.labelPrimary]}>Play</Text>
      </Pressable>
      <Pressable
        onPress={() => start('shuffled')}
        accessibilityLabel="Shuffle"
        style={({ pressed }) => [
          styles.btn,
          styles.btnGhost,
          pressed && styles.pressed,
        ]}
      >
        <Text style={[styles.glyph, styles.labelGhost]}>⇄</Text>
        <Text style={[styles.label, styles.labelGhost]}>Shuffle</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 2,
    paddingHorizontal: spacing.md + 2,
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  btnPrimary: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  btnGhost: {
    backgroundColor: 'transparent',
    borderColor: colors.border,
  },
  glyph: { fontSize: fontSize.md, fontWeight: '800', lineHeight: fontSize.md + 2 },
  glyphPrimary: { color: colors.accentInk },
  label: { fontSize: fontSize.md, fontWeight: '800', letterSpacing: 0.3 },
  labelPrimary: { color: colors.accentInk },
  labelGhost: { color: colors.text },
  pressed: { opacity: 0.78, transform: [{ scale: 0.98 }] },
});
