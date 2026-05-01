import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Screen } from '@/components/Screen';
import { useSpotifyAuth } from '@/spotify/AuthContext';
import { colors, radius, spacing } from '@/theme';

export default function AccountScreen() {
  const { configured, loading, tokens, user, login, logout } = useSpotifyAuth();
  const [busy, setBusy] = useState(false);

  const onLogin = async () => {
    setBusy(true);
    try {
      await login();
    } catch (e) {
      Alert.alert('Sign-in failed', e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const onLogout = async () => {
    setBusy(true);
    try {
      await logout();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <Text style={styles.h1}>Account</Text>

      {!configured ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Spotify is not configured</Text>
          <Text style={styles.cardBody}>
            Set <Text style={styles.code}>EXPO_PUBLIC_SPOTIFY_CLIENT_ID</Text>{' '}
            (or the <Text style={styles.code}>extra.SPOTIFY_CLIENT_ID</Text>{' '}
            field in app.json) to enable login. Register the redirect URI{' '}
            <Text style={styles.code}>psalter://spotify-auth</Text> in your
            Spotify Developer dashboard.
          </Text>
        </View>
      ) : loading ? (
        <Text style={styles.muted}>Checking your Spotify session…</Text>
      ) : tokens && user ? (
        <View>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>
              {user.displayName ?? user.id}
            </Text>
            {user.email ? (
              <Text style={styles.cardBody}>{user.email}</Text>
            ) : null}
            <Text style={styles.cardBody}>
              Plan:{' '}
              <Text style={styles.value}>
                {user.product === 'premium' ? 'Premium' : 'Free'}
              </Text>
              {user.country ? `  ·  ${user.country}` : ''}
            </Text>
          </View>
          {user.product !== 'premium' && (
            <Text style={styles.muted}>
              Free Spotify accounts have ads and limited mobile playback
              control. Premium is required for SDK-controlled playback.
            </Text>
          )}
          <Pressable
            onPress={onLogout}
            disabled={busy}
            style={[styles.button, styles.buttonGhost, busy && styles.disabled]}
          >
            <Text style={styles.buttonGhostText}>Sign out of Spotify</Text>
          </Pressable>
        </View>
      ) : (
        <View>
          <Text style={styles.intro}>
            Sign in with Spotify to play music, save songs to your Liked Songs,
            and add tracks to your playlists.
          </Text>
          <Pressable
            onPress={onLogin}
            disabled={busy}
            style={[styles.button, busy && styles.disabled]}
          >
            <Text style={styles.buttonText}>
              {busy ? 'Opening Spotify…' : 'Continue with Spotify'}
            </Text>
          </Pressable>
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  h1: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '700',
    paddingTop: spacing.md,
  },
  intro: {
    color: colors.textMuted,
    marginTop: spacing.md,
    marginBottom: spacing.lg,
    fontSize: 14,
    lineHeight: 20,
  },
  muted: {
    color: colors.textMuted,
    marginTop: spacing.md,
    fontSize: 13,
    lineHeight: 18,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: spacing.md,
    marginBottom: spacing.md,
  },
  cardTitle: { color: colors.text, fontSize: 17, fontWeight: '700' },
  cardBody: {
    color: colors.textMuted,
    fontSize: 13,
    marginTop: spacing.xs,
    lineHeight: 18,
  },
  value: { color: colors.text, fontWeight: '600' },
  code: { color: colors.accent, fontFamily: 'monospace' },
  button: {
    marginTop: spacing.md,
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  buttonText: { color: '#1a1207', fontWeight: '700' },
  buttonGhost: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.border,
  },
  buttonGhostText: { color: colors.text, fontWeight: '600' },
  disabled: { opacity: 0.5 },
});
