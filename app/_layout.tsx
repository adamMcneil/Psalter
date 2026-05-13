import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Pressable, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { SpotifyAuthProvider } from '@/spotify/AuthContext';
import { WebPlayerProvider } from '@/spotify/WebPlayerContext';
import { PreviewPlayerProvider } from '@/spotify/PreviewPlayerContext';
import { MiniPlayer } from '@/components/MiniPlayer';
import { BottomNav } from '@/components/BottomNav';
import { colors, spacing } from '@/theme';

function HeaderBackButton() {
  const router = useRouter();
  return (
    <Pressable
      onPress={() => {
        if (router.canGoBack()) router.back();
        else router.replace('/');
      }}
      hitSlop={12}
      accessibilityLabel="Back"
      style={({ pressed }) => ({
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.xs,
        opacity: pressed ? 0.6 : 1,
      })}
    >
      <Text style={{ color: colors.text, fontSize: 28, lineHeight: 28, fontWeight: '600' }}>‹</Text>
    </Pressable>
  );
}

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
                      headerLeft: () => <HeaderBackButton />,
                      headerBackVisible: false,
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
                      name="coverage"
                      options={{ title: 'Coverage' }}
                    />
                  </Stack>
                </View>
                <MiniPlayer />
                <BottomNav />
              </View>
            </PreviewPlayerProvider>
          </WebPlayerProvider>
        </SpotifyAuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
