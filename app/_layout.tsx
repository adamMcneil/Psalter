import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import TrackPlayer from 'react-native-track-player';
import { ensurePlayerSetup } from '@/audio/setup';
import { PlaybackService } from '@/audio/service';
import { colors } from '@/theme';

TrackPlayer.registerPlaybackService(() => PlaybackService);

export default function RootLayout() {
  useEffect(() => {
    ensurePlayerSetup().catch(() => {});
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.bg }}>
      <SafeAreaProvider>
        <StatusBar style="light" />
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: colors.bg },
            headerTintColor: colors.text,
            contentStyle: { backgroundColor: colors.bg },
          }}
        >
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="psalm/[id]" options={{ title: 'Psalm' }} />
          <Stack.Screen
            name="player"
            options={{ title: 'Now Playing', presentation: 'modal' }}
          />
          <Stack.Screen name="submit" options={{ title: 'Submit a Song' }} />
        </Stack>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
