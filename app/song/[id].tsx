import { useEffect, useRef, useState } from 'react';
import {
  GestureResponderEvent,
  Image,
  LayoutChangeEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Link, Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Screen } from '@/components/Screen';
import { formatDuration, songById, songByTrackId } from '@/data/catalog';
import { useSpotifyAuth } from '@/spotify/AuthContext';
import { useWebPlayer, useWebPlayerProgress } from '@/spotify/WebPlayerContext';
import { usePreviewPlayer } from '@/spotify/PreviewPlayerContext';
import { extractTrackId, openSpotifyTrack } from '@/spotify/launch';
import { colors, fontSize, radius, spacing } from '@/theme';

export default function SongDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const song = id ? songById(id) : undefined;
  const { tokens, login } = useSpotifyAuth();
  const web = useWebPlayer();
  const progress = useWebPlayerProgress();
  const preview = usePreviewPlayer();
  const router = useRouter();
  const wantsFollowRef = useRef(false);

  const trackId = extractTrackId(song?.spotifyUrl);
  const trackUri = trackId ? `spotify:track:${trackId}` : null;
  const isCurrentFull = trackUri !== null && web.currentUri === trackUri;
  const isCurrentPreview =
    trackId !== null && preview.currentTrackId === trackId;
  const isCurrent = isCurrentFull || isCurrentPreview;
  const isPlaying =
    (isCurrentFull && web.isPlaying) ||
    (isCurrentPreview && preview.isPlaying);

  const positionSec = isCurrentFull
    ? Math.floor(progress.position / 1000)
    : isCurrentPreview
      ? preview.position
      : 0;
  const durationSec = isCurrentFull
    ? Math.floor(progress.duration / 1000) || song?.durationSec || 0
    : isCurrentPreview
      ? preview.duration > 0
        ? preview.duration
        : 30
      : (song?.durationSec ?? 0);

  const [barWidth, setBarWidth] = useState(0);
  const draggingRef = useRef(false);
  const [dragPct, setDragPct] = useState<number | null>(null);

  // When the user hits prev/next, Spotify advances its queue and the page
  // would otherwise stay on the old song. Watch web.currentUri after a skip
  // and replace into the new song's route once the SDK reports it.
  useEffect(() => {
    if (!wantsFollowRef.current) return;
    if (!web.currentUri) return;
    if (web.currentUri === trackUri) return;
    const nextTrackId = web.currentUri.replace('spotify:track:', '');
    const nextSong = songByTrackId(nextTrackId);
    if (!nextSong) return;
    wantsFollowRef.current = false;
    router.replace({ pathname: '/song/[id]', params: { id: nextSong.id } });
  }, [web.currentUri, trackUri, router]);

  if (!song) {
    return (
      <Screen>
        <Stack.Screen options={{ title: 'Song' }} />
        <Text style={styles.notFound}>Song not found.</Text>
      </Screen>
    );
  }

  async function handleTogglePlay() {
    if (!trackId || !song) {
      if (song) openSpotifyTrack(song);
      return;
    }
    if (web.supported) {
      // Unlock the audio element inside the tap so Spotify can auto-advance to
      // the next track without the browser pausing it. Must run before the
      // first await below or the user gesture is lost.
      web.activateElement();
      if (!tokens) {
        try {
          await login();
        } catch {
          // ignore
        }
        return;
      }
      if (isCurrentFull) {
        await web.toggle();
      } else {
        await web.play(trackUri!);
      }
      return;
    }
    if (preview.supported) {
      await preview.toggle(trackId);
      return;
    }
    openSpotifyTrack(song);
  }

  const pctFromEvent = (e: GestureResponderEvent): number => {
    if (barWidth <= 0) return 0;
    const x = e.nativeEvent.locationX;
    return Math.max(0, Math.min(1, x / barWidth));
  };

  const commitSeek = (pct: number) => {
    if (durationSec <= 0 || !isCurrent) return;
    const targetSec = pct * durationSec;
    if (isCurrentFull) {
      void web.seek(targetSec * 1000);
    } else if (isCurrentPreview) {
      preview.seek(targetSec);
    }
  };

  const seekHandlers = {
    onStartShouldSetResponder: () => isCurrent,
    onMoveShouldSetResponder: () => isCurrent,
    onResponderGrant: (e: GestureResponderEvent) => {
      draggingRef.current = true;
      setDragPct(pctFromEvent(e));
    },
    onResponderMove: (e: GestureResponderEvent) => {
      if (draggingRef.current) setDragPct(pctFromEvent(e));
    },
    onResponderRelease: (e: GestureResponderEvent) => {
      if (draggingRef.current) {
        commitSeek(pctFromEvent(e));
        draggingRef.current = false;
        setDragPct(null);
      }
    },
    onResponderTerminate: () => {
      draggingRef.current = false;
      setDragPct(null);
    },
  };

  const livePct =
    durationSec > 0 ? Math.max(0, Math.min(1, positionSec / durationSec)) : 0;
  const shownPct = dragPct ?? livePct;
  const shownPositionSec =
    dragPct != null ? Math.round(dragPct * durationSec) : positionSec;

  return (
    <Screen>
      <Stack.Screen options={{ title: 'Now Playing' }} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >
        <View style={styles.container}>
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

        <Text style={styles.title}>{song.title}</Text>

        <Link
          href={{ pathname: '/artist/[name]', params: { name: song.artist } }}
          asChild
        >
          <Pressable hitSlop={6} accessibilityLabel={`View ${song.artist}`}>
            <Text style={styles.artist}>
              {song.artist} <Text style={styles.artistArrow}>›</Text>
            </Text>
          </Pressable>
        </Link>

        {song.album ? <Text style={styles.album}>{song.album}</Text> : null}

        <View
          onLayout={(e: LayoutChangeEvent) =>
            setBarWidth(e.nativeEvent.layout.width)
          }
          style={styles.trackHit}
          {...seekHandlers}
        >
          <View style={styles.track}>
            <View style={[styles.fill, { width: `${shownPct * 100}%` }]} />
            <View style={[styles.thumb, { left: `${shownPct * 100}%` }]} />
          </View>
        </View>

        <View style={styles.timeRow}>
          <Text style={styles.time}>{formatDuration(shownPositionSec)}</Text>
          <Text style={styles.time}>{formatDuration(durationSec)}</Text>
        </View>

        <View style={styles.controls}>
          <Pressable
            onPress={() => {
              wantsFollowRef.current = true;
              void web.previousTrack();
            }}
            disabled={!web.supported}
            accessibilityLabel="Previous track"
            style={({ pressed }) => [
              styles.skipBtn,
              !web.supported && styles.skipDisabled,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.skipGlyph}>⏮</Text>
          </Pressable>
          <Pressable
            onPress={() => void handleTogglePlay()}
            accessibilityLabel={isPlaying ? 'Pause' : 'Play'}
            style={({ pressed }) => [
              styles.playBtn,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.playGlyph}>{isPlaying ? '❚❚' : '▶'}</Text>
          </Pressable>
          <Pressable
            onPress={() => {
              wantsFollowRef.current = true;
              void web.nextTrack();
            }}
            disabled={!web.supported}
            accessibilityLabel="Next track"
            style={({ pressed }) => [
              styles.skipBtn,
              !web.supported && styles.skipDisabled,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.skipGlyph}>⏭</Text>
          </Pressable>
        </View>

        <Link href={`/psalm/${song.psalm}`} asChild>
          <Pressable
            hitSlop={6}
            style={({ pressed }) => [
              styles.psalmLink,
              pressed && styles.pressedSubtle,
            ]}
          >
            <Text style={styles.psalmLinkText}>‹ Psalm {song.psalm}</Text>
          </Pressable>
        </Link>
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: {
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
    alignItems: 'stretch',
  },
  // Keep the whole layout phone-sized on wide screens — otherwise the
  // 1:1 cover stretches to ~the viewport height on desktop.
  container: {
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
  },
  coverWrap: {
    aspectRatio: 1,
    width: '100%',
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cover: {
    width: '100%',
    height: '100%',
  },
  coverPlaceholder: { backgroundColor: colors.surfaceAlt },
  title: {
    color: colors.text,
    fontSize: fontSize.h2,
    fontWeight: '800',
    marginTop: spacing.lg,
    lineHeight: 30,
    letterSpacing: -0.3,
  },
  artist: {
    color: colors.text,
    opacity: 0.85,
    fontSize: fontSize.lg,
    marginTop: spacing.xs,
  },
  artistArrow: { color: colors.textDim, fontSize: fontSize.lg },
  album: {
    color: colors.textMuted,
    fontSize: fontSize.md,
    fontStyle: 'italic',
    marginTop: 2,
  },
  trackHit: {
    paddingVertical: spacing.md,
    marginTop: spacing.xl,
  },
  track: {
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.surfaceAlt,
    overflow: 'visible',
  },
  fill: {
    height: '100%',
    backgroundColor: colors.accent,
    borderRadius: 4,
  },
  thumb: {
    position: 'absolute',
    top: -8,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.accent,
    marginLeft: -12,
    borderWidth: 2,
    borderColor: colors.accentInk,
  },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: -spacing.xs,
  },
  time: {
    color: colors.textMuted,
    fontSize: fontSize.sm,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xl,
    marginTop: spacing.xl,
  },
  playBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playGlyph: {
    color: colors.accentInk,
    fontSize: 26,
    fontWeight: '800',
    marginLeft: 2,
  },
  skipBtn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
  },
  skipDisabled: { opacity: 0.35 },
  skipGlyph: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '700',
    lineHeight: 24,
  },
  pressed: { opacity: 0.78, transform: [{ scale: 0.96 }] },
  pressedSubtle: { opacity: 0.6 },
  psalmLink: {
    marginTop: spacing.xl,
    alignItems: 'center',
  },
  psalmLinkText: {
    color: colors.textMuted,
    fontSize: fontSize.md,
    fontWeight: '600',
  },
  notFound: {
    color: colors.textMuted,
    fontSize: fontSize.lg,
    textAlign: 'center',
    marginTop: spacing.xl,
  },
});
