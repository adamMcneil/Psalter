import { useMemo, useRef, useState } from 'react';
import {
  GestureResponderEvent,
  Image,
  LayoutChangeEvent,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useWebPlayer } from '../spotify/WebPlayerContext';
import { usePreviewPlayer } from '../spotify/PreviewPlayerContext';
import { formatDuration, songByTrackId } from '../data/catalog';
import { colors, fontSize, radius, spacing } from '../theme';
import { MarqueeText } from './MarqueeText';

export function MiniPlayer() {
  const web = useWebPlayer();
  const preview = usePreviewPlayer();
  const router = useRouter();

  const usingWeb = web.supported && !!web.currentUri;
  const usingPreview = !usingWeb && !!preview.currentTrackId;

  // Resolve track display info + a song id we can deep-link to.
  const info = useMemo(() => {
    if (usingWeb) {
      const trackId = web.currentUri
        ? web.currentUri.replace('spotify:track:', '')
        : null;
      const song = trackId ? songByTrackId(trackId) : undefined;
      return {
        title: web.trackName ?? song?.title ?? 'Now playing',
        artist: web.artistName ?? song?.artist ?? '',
        cover: web.albumArt ?? song?.albumCoverUrl ?? null,
        positionSec: Math.floor(web.position / 1000),
        durationSec: Math.floor(web.duration / 1000) || song?.durationSec || 0,
        isPlaying: web.isPlaying,
        songId: song?.id,
      };
    }
    if (usingPreview) {
      const song = preview.currentTrackId
        ? songByTrackId(preview.currentTrackId)
        : undefined;
      // Preview clips are typically 30s. If we don't have audio metadata yet,
      // fall back to 30 to keep the bar from looking broken.
      const dur = preview.duration > 0 ? preview.duration : 30;
      return {
        title: song?.title ?? 'Preview',
        artist: song?.artist ?? '',
        cover: song?.albumCoverUrl ?? null,
        positionSec: preview.position,
        durationSec: dur,
        isPlaying: preview.isPlaying,
        songId: song?.id,
      };
    }
    return null;
  }, [usingWeb, usingPreview, web, preview]);

  const [barWidth, setBarWidth] = useState(0);
  const draggingRef = useRef(false);
  const [dragPct, setDragPct] = useState<number | null>(null);

  // Surface Web Playback errors even when no track is current — connect
  // timeouts and 401s land here before the user has played anything.
  const banner = web.error;

  if (!info) {
    if (!banner) return null;
    return (
      <View style={styles.wrap} pointerEvents="box-none">
        <View style={styles.banner}>
          <Text style={styles.bannerText} numberOfLines={2}>
            {banner}
          </Text>
        </View>
      </View>
    );
  }

  const pctFromEvent = (e: GestureResponderEvent): number => {
    if (barWidth <= 0) return 0;
    const x = e.nativeEvent.locationX;
    return Math.max(0, Math.min(1, x / barWidth));
  };

  const commitSeek = (pct: number) => {
    if (info.durationSec <= 0) return;
    const targetSec = pct * info.durationSec;
    if (usingWeb) {
      void web.seek(targetSec * 1000);
    } else if (usingPreview) {
      preview.seek(targetSec);
    }
  };

  // Single source of truth for tap + drag: the responder API. We deliberately
  // don't wrap this in a Pressable — Pressable's onPress fires in addition to
  // the responder release on web and provides a press-event whose locationX is
  // unreliable for clicks, causing a second commitSeek(0) that resets the song.
  const seekHandlers = {
    onStartShouldSetResponder: () => true,
    onMoveShouldSetResponder: () => true,
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
    info.durationSec > 0
      ? Math.max(0, Math.min(1, info.positionSec / info.durationSec))
      : 0;
  const shownPct = dragPct ?? livePct;
  const shownPositionSec =
    dragPct != null ? Math.round(dragPct * info.durationSec) : info.positionSec;

  const togglePlay = () => {
    if (usingWeb) {
      if (web.isPlaying) {
        void web.pause();
      } else {
        void web.playOrResume();
      }
      return;
    }
    if (usingPreview && preview.currentTrackId) {
      if (preview.isPlaying) {
        preview.pause();
      } else {
        void preview.play(preview.currentTrackId, {
          positionSec: preview.position,
        });
      }
    }
  };

  const goToSong = () => {
    if (info.songId) {
      router.push({ pathname: '/song/[id]', params: { id: info.songId } });
    }
  };

  return (
    <View style={styles.wrap} pointerEvents="box-none">
      {banner ? (
        <View style={styles.banner}>
          <Text style={styles.bannerText} numberOfLines={2}>
            {banner}
          </Text>
        </View>
      ) : null}
      <View style={styles.bar}>
        {usingWeb ? (
          <Pressable
            onPress={() => void web.previousTrack()}
            style={({ pressed }) => [styles.skipBtn, pressed && styles.pressed]}
            accessibilityLabel="Previous track"
          >
            <Text style={styles.skipGlyph}>⏮</Text>
          </Pressable>
        ) : null}
        <Pressable
          onPress={goToSong}
          style={({ pressed }) => [styles.meta, pressed && styles.pressed]}
        >
          {info.cover ? (
            <Image
              source={{ uri: info.cover }}
              style={styles.cover}
              accessibilityIgnoresInvertColors
            />
          ) : (
            <View style={[styles.cover, styles.coverPlaceholder]} />
          )}
          <View style={styles.text}>
            <MarqueeText text={info.title} style={styles.title} />
            {info.artist ? (
              <Text style={styles.artist} numberOfLines={1}>
                {info.artist}
              </Text>
            ) : null}
          </View>
        </Pressable>
        <Text style={styles.time}>
          {formatDuration(shownPositionSec)} / {formatDuration(info.durationSec)}
        </Text>
        <Pressable
          onPress={togglePlay}
          style={({ pressed }) => [styles.playBtn, pressed && styles.pressed]}
          accessibilityLabel={info.isPlaying ? 'Pause' : 'Play'}
        >
          <Text style={styles.playGlyph}>{info.isPlaying ? '❚❚' : '▶'}</Text>
        </Pressable>
        {usingWeb ? (
          <Pressable
            onPress={() => void web.nextTrack()}
            style={({ pressed }) => [styles.skipBtn, pressed && styles.pressed]}
            accessibilityLabel="Next track"
          >
            <Text style={styles.skipGlyph}>⏭</Text>
          </Pressable>
        ) : null}
      </View>
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
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
    minWidth: 0,
  },
  cover: {
    width: 44,
    height: 44,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceAlt,
  },
  coverPlaceholder: {
    borderWidth: 1,
    borderColor: colors.border,
  },
  text: { flex: 1, minWidth: 0 },
  title: {
    color: colors.text,
    fontSize: fontSize.md,
    fontWeight: '700',
  },
  artist: {
    color: colors.textMuted,
    fontSize: fontSize.sm,
    marginTop: 1,
  },
  time: {
    color: colors.textMuted,
    fontSize: fontSize.xs,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  playBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playGlyph: {
    color: colors.accentInk,
    fontSize: 14,
    fontWeight: '800',
    marginLeft: 1,
  },
  skipBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  skipGlyph: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 18,
  },
  pressed: { opacity: 0.78 },
  banner: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    marginBottom: spacing.xs,
  },
  bannerText: {
    color: colors.text,
    fontSize: fontSize.xs,
    fontWeight: '600',
  },
  trackHit: {
    paddingVertical: spacing.md,
    marginTop: -spacing.xs,
  },
  track: {
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.surfaceAlt,
    overflow: 'visible',
  },
  fill: {
    height: '100%',
    backgroundColor: colors.accent,
    borderRadius: 3,
  },
  thumb: {
    position: 'absolute',
    top: -7,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.accent,
    marginLeft: -10,
    borderWidth: 2,
    borderColor: colors.accentInk,
  },
});
