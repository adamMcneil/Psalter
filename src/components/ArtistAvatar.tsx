import { Image, StyleSheet, Text, View } from 'react-native';
import { useArtistImage } from '../spotify/artistImages';

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0] ?? '').join('').toUpperCase() || '♪';
}

interface Props {
  name: string;
  size: number;
  bg: string;
  fg: string;
  bordered?: boolean;
}

export function ArtistAvatar({ name, size, bg, fg, bordered }: Props) {
  const url = useArtistImage(name);
  const radius = size / 2;
  const base = { width: size, height: size, borderRadius: radius };
  const border = bordered ? { borderWidth: 1.5, borderColor: fg } : null;

  if (url) {
    return (
      <Image
        source={{ uri: url }}
        style={[base, { backgroundColor: bg }, border]}
        accessibilityLabel={`${name} artist photo`}
      />
    );
  }

  return (
    <View
      style={[base, styles.fallback, { backgroundColor: bg }, border]}
      accessibilityLabel={`${name} initials`}
    >
      <Text
        style={[
          styles.text,
          { color: fg, fontSize: Math.max(11, Math.round(size * 0.34)) },
        ]}
      >
        {initials(name)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  fallback: { alignItems: 'center', justifyContent: 'center' },
  text: { fontWeight: '800', letterSpacing: 1 },
});
