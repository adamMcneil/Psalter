import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Song } from '../types';
import { colors, radius, spacing } from '../theme';
import { useFavorites } from '../storage/favorites';
import { useSpotifyAuth } from '../spotify/AuthContext';
import { useWebPlayer } from '../spotify/WebPlayerContext';
import { extractTrackId, openSpotifyTrack } from '../spotify/launch';
import { SpotifyEmbedPlayer } from './SpotifyEmbedPlayer';

export function SongRow({ song }: { song: Song }) {
  const { isFavorite, toggle } = useFavorites();
  const { tokens, login } = useSpotifyAuth();
  const player = useWebPlayer();
  const router = useRouter();
  const fav = isFavorite(song.id);
  const trackId = extractTrackId(song.spotifyUrl);
  const trackUri = trackId ? `spotify:track:${trackId}` : null;
  const isCurrent = trackUri !== null && player.currentUri === trackUri;
  const [expanded, setExpanded] = useState(false);
  const [busy, setBusy] = useState(false);

  async function handlePress() {
    if (!trackId) {
      openSpotifyTrack(song);
      return;
    }
    if (!tokens) {
      setBusy(true);
      try {
        await login();
      } catch {} finally {
        setBusy(false);
      }
      return;
    }
    if (player.supported) {
      if (isCurrent) {
        await player.toggle();
      } else {
        await player.play(trackUri!);
      }
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
        ? isCurrent
          ? player.isPlaying
            ? 'Playing · Tap to pause'
            : 'Paused · Tap to resume'
          : !player.ready
            ? 'Connecting…'
            : 'Tap to play full song'
        : expanded
          ? 'Tap to hide preview'
          : 'Tap for 30-sec preview';

  return (
    <View style={styles.card}>
      <Pressable
        onPress={handlePress}
        style={({ pressed }) => [styles.row, pressed && styles.pressed]}
      >
        <View style={{ flex: 1 }}>
          <Text style={styles.title} numberOfLines={1}>
            {song.title}
          </Text>
          <Text style={styles.artist} numberOfLines={1}>
            {song.artist}
          </Text>
          <Text style={styles.meta}>{meta}</Text>
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
      {trackId && expanded && !player.supported && (
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
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
  },
  pressed: { opacity: 0.7 },
  title: { color: colors.text, fontSize: 15, fontWeight: '600' },
  artist: { color: colors.text, opacity: 0.85, fontSize: 13, marginTop: 2 },
  meta: { color: colors.accent, fontSize: 11, marginTop: 4, fontWeight: '600' },
  iconBtn: { paddingHorizontal: spacing.sm },
  heart: { color: colors.textMuted, fontSize: 22 },
  heartOn: { color: colors.accent },
  plus: { color: colors.textMuted, fontSize: 22, fontWeight: '700' },
  playerWrap: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
  },
});
