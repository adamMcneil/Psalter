import { useMemo, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Song } from '../types';
import { colors, fontSize, radius, spacing } from '../theme';
import { useFavorites } from '../storage/favorites';
import { useSpotifyAuth } from '../spotify/AuthContext';
import { useWebPlayer } from '../spotify/WebPlayerContext';
import { usePreviewPlayer } from '../spotify/PreviewPlayerContext';
import { extractTrackId, openSpotifyTrack } from '../spotify/launch';
import { SpotifyEmbedPlayer } from './SpotifyEmbedPlayer';

export function SongRow({
  song,
  queue,
}: {
  song: Song;
  queue?: Song[];
}) {
  const { isFavorite, toggle } = useFavorites();
  const { tokens, login } = useSpotifyAuth();
  const player = useWebPlayer();
  const preview = usePreviewPlayer();
  const router = useRouter();
  const fav = isFavorite(song.id);
  const trackId = extractTrackId(song.spotifyUrl);
  const trackUri = trackId ? `spotify:track:${trackId}` : null;
  const isCurrentFull = trackUri !== null && player.currentUri === trackUri;
  const isCurrentPreview =
    trackId !== null && preview.currentTrackId === trackId;
  const isCurrent = isCurrentFull || isCurrentPreview;
  const isPlayingNow =
    (isCurrentFull && player.isPlaying) ||
    (isCurrentPreview && preview.isPlaying);
  const previewLoading = isCurrentPreview && preview.loading;
  const [expanded, setExpanded] = useState(false);
  const [busy, setBusy] = useState(false);

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
    if (!tokens) {
      setBusy(true);
      try {
        await login();
      } catch {
      } finally {
        setBusy(false);
      }
      return;
    }
    if (player.supported) {
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
    setExpanded((v) => !v);
  }

  function handleAddToPlaylist() {
    router.push({
      pathname: '/add-to-playlist',
      params: { songId: song.id },
    });
  }

  const meta = !trackId
    ? 'Search on Spotify'
    : !tokens
      ? busy
        ? 'Opening Spotify…'
        : 'Sign in to play'
      : player.supported
        ? isCurrentFull
          ? player.isPlaying
            ? 'Playing'
            : 'Paused'
          : !player.ready
            ? 'Connecting…'
            : 'Tap to play'
        : preview.supported
          ? previewLoading
            ? 'Loading preview…'
            : isCurrentPreview
              ? preview.isPlaying
                ? 'Playing preview'
                : 'Paused'
              : '30-sec preview'
          : expanded
            ? 'Tap to hide preview'
            : '30-sec preview';

  const playGlyph = !trackId
    ? '↗'
    : previewLoading
      ? '…'
      : isPlayingNow
        ? '❚❚'
        : '▶';

  return (
    <View style={[styles.card, isCurrent && styles.cardCurrent]}>
      <Pressable
        onPress={handlePress}
        style={({ pressed }) => [styles.row, pressed && styles.pressed]}
      >
        <View
          style={[
            styles.playBtn,
            isCurrent && styles.playBtnOn,
          ]}
        >
          <Text
            style={[
              styles.playGlyph,
              isCurrent && styles.playGlyphOn,
            ]}
          >
            {playGlyph}
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.title} numberOfLines={1}>
            {song.title}
          </Text>
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
            <Text style={styles.artist} numberOfLines={1}>
              {song.artist} <Text style={styles.artistArrow}>›</Text>
            </Text>
          </Pressable>
          <View style={styles.metaRow}>
            {isPlayingNow ? (
              <View style={styles.eq}>
                <View style={[styles.eqBar, styles.eqBarA]} />
                <View style={[styles.eqBar, styles.eqBarB]} />
                <View style={[styles.eqBar, styles.eqBarC]} />
              </View>
            ) : null}
            <Text
              style={[
                styles.meta,
                isCurrent && styles.metaOn,
              ]}
              numberOfLines={1}
            >
              {meta}
            </Text>
          </View>
        </View>
        {tokens && trackId && (
          <Pressable
            hitSlop={12}
            onPress={handleAddToPlaylist}
            style={styles.iconBtn}
            accessibilityLabel="Add to playlist"
          >
            <Text style={styles.plus}>＋</Text>
          </Pressable>
        )}
        <Pressable
          hitSlop={12}
          onPress={() => toggle(song)}
          style={styles.iconBtn}
          accessibilityLabel={fav ? 'Remove from favorites' : 'Add to favorites'}
        >
          <Text style={[styles.heart, fav && styles.heartOn]}>
            {fav ? '♥' : '♡'}
          </Text>
        </Pressable>
      </Pressable>
      {trackId &&
        expanded &&
        !player.supported &&
        !preview.supported &&
        Platform.OS !== 'web' && (
          <View style={styles.playerWrap}>
            <SpotifyEmbedPlayer trackId={trackId} />
          </View>
        )}
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
  playBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  playBtnOn: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  playGlyph: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '800',
    marginLeft: 1,
  },
  playGlyphOn: { color: '#1a1207' },
  title: { color: colors.text, fontSize: fontSize.lg, fontWeight: '600' },
  artist: {
    color: colors.text,
    opacity: 0.85,
    fontSize: fontSize.md,
    marginTop: 2,
  },
  artistArrow: { color: colors.textDim, fontSize: fontSize.lg },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 2,
    marginTop: 4,
  },
  meta: {
    color: colors.accent,
    fontSize: fontSize.xs,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  metaOn: { color: colors.accentHi },
  eq: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 2,
    height: 10,
  },
  eqBar: {
    width: 2,
    backgroundColor: colors.accent,
    borderRadius: 1,
  },
  eqBarA: { height: 7 },
  eqBarB: { height: 10 },
  eqBarC: { height: 5 },
  iconBtn: { paddingHorizontal: spacing.xs + 2, paddingVertical: spacing.xs },
  heart: { color: colors.textMuted, fontSize: 22 },
  heartOn: { color: colors.accent },
  plus: { color: colors.textMuted, fontSize: 22, fontWeight: '700' },
  playerWrap: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
  },
});
