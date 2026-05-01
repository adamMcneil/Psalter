import { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSegments } from 'expo-router';
import { colors, spacing } from '../theme';
import { NowPlayingBar } from './NowPlayingBar';

export function Screen({ children }: { children: ReactNode }) {
  const segments = useSegments();
  const insideTabs = segments?.[0] === '(tabs)';
  const edges = insideTabs
    ? (['top'] as const)
    : (['top', 'bottom'] as const);

  return (
    <SafeAreaView style={styles.safe} edges={edges}>
      <View style={styles.content}>{children}</View>
      <NowPlayingBar />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { flex: 1, paddingHorizontal: spacing.md },
});
