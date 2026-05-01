import { StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { colors, radius } from '../theme';

const EMBED_HEIGHT = 80;

export function SpotifyEmbedPlayer({ trackId }: { trackId: string }) {
  const uri = `https://open.spotify.com/embed/track/${trackId}?utm_source=generator&theme=0`;

  return (
    <View style={styles.wrap}>
      <WebView
        source={{ uri }}
        style={styles.web}
        userAgent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15"
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        javaScriptEnabled
        domStorageEnabled
        scrollEnabled={false}
        androidLayerType="hardware"
        setSupportMultipleWindows={false}
        originWhitelist={['*']}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    height: EMBED_HEIGHT,
    borderRadius: radius.md,
    overflow: 'hidden',
    backgroundColor: colors.surfaceAlt,
  },
  web: {
    flex: 1,
    backgroundColor: 'transparent',
  },
});
