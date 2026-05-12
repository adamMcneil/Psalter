import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { SpotifyAuthProvider } from '@/spotify/AuthContext';
import { WebPlayerProvider } from '@/spotify/WebPlayerContext';
import { PreviewPlayerProvider } from '@/spotify/PreviewPlayerContext';
import { MiniPlayer } from '@/components/MiniPlayer';
import { colors } from '@/theme';

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.bg }}>
      <SafeAreaProvider>
        <SpotifyAuthProvider>
          <WebPlayerProvider>
            <PreviewPlayerProvider>
              <StatusBar style="light" />
              <View style={{ flex: 1 }}>
                <View style={{ flex: 1 }}>
                  <Stack
                    screenOptions={{
                      headerStyle: { backgroundColor: colors.bg },
                      headerTintColor: colors.text,
                      contentStyle: { backgroundColor: colors.bg },
                    }}
                  >
                    <Stack.Screen
                      name="(tabs)"
                      options={{ headerShown: false }}
                    />
                    <Stack.Screen name="psalm/[id]" options={{ title: 'Psalm' }} />
                    <Stack.Screen
                      name="artist/[name]"
                      options={{ title: 'Artist' }}
                    />
                    <Stack.Screen
                      name="playlist/[id]"
                      options={{ title: 'Playlist' }}
                    />
                    <Stack.Screen
                      name="submit"
                      options={{ title: 'Submit a Song' }}
                    />
                    <Stack.Screen
                      name="coverage"
                      options={{ title: 'Coverage' }}
                    />
                    <Stack.Screen
                      name="add-to-playlist"
                      options={{ title: 'Add to playlist', presentation: 'modal' }}
                    />
                  </Stack>
                </View>
                <MiniPlayer />
              </View>
            </PreviewPlayerProvider>
          </WebPlayerProvider>
        </SpotifyAuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
