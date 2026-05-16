import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Screen } from '@/components/Screen';
import { useSpotifyAuth } from '@/spotify/AuthContext';
import { colors, fontSize, radius, spacing } from '@/theme';

export default function SpotifyAuthCallback() {
  const router = useRouter();
  const { completeWebRedirect } = useSpotifyAuth();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (Platform.OS !== 'web') {
      router.replace('/account');
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const result = await completeWebRedirect();
        if (cancelled) return;
        if (result.error) {
          setError(result.error);
          return;
        }
        // Whether or not we consumed a code, send the user back to the app.
        router.replace('/account');
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [completeWebRedirect, router]);

  return (
    <Screen>
      <View style={styles.center}>
        {error ? (
          <>
            <Text style={styles.title}>Spotify sign-in failed</Text>
            <Text style={styles.body}>{error}</Text>
            <Pressable
              onPress={() => router.replace('/account')}
              style={({ pressed }) => [styles.button, pressed && styles.pressed]}
            >
              <Text style={styles.buttonText}>Back to Account</Text>
            </Pressable>
          </>
        ) : (
          <>
            <ActivityIndicator color={colors.accent} />
            <Text style={styles.title}>Completing Spotify sign-in…</Text>
          </>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  title: {
    color: colors.text,
    fontSize: fontSize.lg,
    fontWeight: '700',
    marginTop: spacing.md,
    textAlign: 'center',
  },
  body: {
    color: colors.textMuted,
    fontSize: fontSize.md,
    marginTop: spacing.sm,
    textAlign: 'center',
    lineHeight: 20,
  },
  button: {
    marginTop: spacing.lg,
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
  },
  buttonText: { color: colors.accentInk, fontWeight: '800', fontSize: fontSize.lg },
  pressed: { opacity: 0.78 },
});
