import { StyleSheet, View } from 'react-native';
import { colors, radius } from '../theme';

const EMBED_HEIGHT = 80;

export function SpotifyEmbedPlayer({ trackId }: { trackId: string }) {
  const uri = `https://open.spotify.com/embed/track/${trackId}?utm_source=generator&theme=0`;

  return (
    <View style={styles.wrap}>
      <iframe
        src={uri}
        style={iframeStyle}
        allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
        loading="lazy"
      />
    </View>
  );
}

const iframeStyle: React.CSSProperties = {
  width: '100%',
  height: '100%',
  border: 0,
  backgroundColor: 'transparent',
};

const styles = StyleSheet.create({
  wrap: {
    height: EMBED_HEIGHT,
    borderRadius: radius.md,
    overflow: 'hidden',
    backgroundColor: colors.surfaceAlt,
  },
});
