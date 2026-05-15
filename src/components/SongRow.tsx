import { useMemo } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Song } from '../types';
import { colors, fontSize, radius, spacing } from '../theme';
import { useSpotifyAuth } from '../spotify/AuthContext';
import { useWebPlayer } from '../spotify/WebPlayerContext';
import { usePreviewPlayer } from '../spotify/PreviewPlayerContext';
import { extractTrackId, openSpotifyTrack } from '../spotify/launch';

export function SongRow({
  song,
  queue,
}: {
  song: Song;
  queue?: Song[];
}) {
  const { tokens, login } = useSpotifyAuth();
  const player = useWebPlayer();
  const preview = usePreviewPlayer();
  const router = useRouter();
  const trackId = extractTrackId(song.spotifyUrl);
  const trackUri = trackId ? `spotify:track:${trackId}` : null;
  const isCurrentFull = trackUri !== null && player.currentUri === trackUri;
  const isCurrentPreview =
    trackId !== null && preview.currentTrackId === trackId;
  const isCurrent = isCurrentFull || isCurrentPreview;

  const playQueueUris = useMemo(() => {
    if (!queue || queue.length === 0) return null;
    const idx = queue.findIndex((s) => s.id === song.id);
    if (idx === -1) return null;
    const uris = queue
      .slice(idx)
      .map((s) => extractTrackId(s.spotifyUrl))
      .filter((id): id is string => !!id)
      .map((id) => `spotify:track:${id}`);
    return uris.length > 0 ? uris : null;
  }, [queue, song.id]);

  async function handlePress() {
    if (!trackId) {
      openSpotifyTrack(song);
      return;
    }
    if (player.supported) {
      if (!tokens) {
        try {
          await login();
        } catch {
          // ignore
        }
        return;
      }
      if (isCurrentFull) {
        await player.toggle();
      } else {
        await player.play(playQueueUris ?? trackUri!);
      }
      return;
    }
    if (preview.supported) {
      await preview.toggle(trackId);
      return;
    }
    openSpotifyTrack(song);
  }

  return (
    <View style={[styles.card, isCurrent && styles.cardCurrent]}>
      <Pressable
        onPress={handlePress}
        style={({ pressed }) => [styles.row, pressed && styles.pressed]}
      >
        <View style={styles.coverWrap}>
          {song.albumCoverUrl ? (
            <Image
              source={{ uri: song.albumCoverUrl }}
              style={styles.cover}
              accessibilityIgnoresInvertColors
            />
          ) : (
            <View style={[styles.cover, styles.coverPlaceholder]} />
          )}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{song.title}</Text>
          <Pressable
            onPress={(e) => {
              e.stopPropagation?.();
              router.push({
                pathname: '/artist/[name]',
                params: { name: song.artist },
              });
            }}
            hitSlop={{ top: 4, bottom: 4 }}
            accessibilityLabel={`View ${song.artist}`}
          >
            <Text style={styles.artist}>
              {song.artist} <Text style={styles.artistArrow}>›</Text>
            </Text>
          </Pressable>
          {song.album ? (
            <Text style={styles.album}>{song.album}</Text>
          ) : null}
        </View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  cardCurrent: {
    borderColor: colors.accent,
    backgroundColor: colors.bgElevated,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.sm + 2,
    paddingRight: spacing.xs,
    gap: spacing.sm,
  },
  pressed: { opacity: 0.78 },
  coverWrap: {
    width: 56,
    height: 56,
    borderRadius: radius.sm,
    overflow: 'hidden',
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cover: {
    width: '100%',
    height: '100%',
  },
  coverPlaceholder: {
    backgroundColor: colors.surfaceAlt,
  },
  title: { color: colors.text, fontSize: fontSize.lg, fontWeight: '600' },
  album: {
    color: colors.textDim,
    fontSize: fontSize.xs,
    marginTop: 2,
    fontStyle: 'italic',
  },
  artist: {
    color: colors.text,
    opacity: 0.85,
    fontSize: fontSize.md,
    marginTop: 2,
  },
  artistArrow: { color: colors.textDim, fontSize: fontSize.lg },
});
