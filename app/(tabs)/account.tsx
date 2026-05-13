import { useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Screen } from '@/components/Screen';
import { useSpotifyAuth } from '@/spotify/AuthContext';
import { colors, fontSize, radius, spacing } from '@/theme';

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

  const initials =
    user?.displayName
      ?.split(/\s+/)
      .slice(0, 2)
      .map((p) => p[0])
      .join('')
      .toUpperCase() ?? user?.id?.[0]?.toUpperCase() ?? '♪';

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={{ paddingBottom: spacing.xl }}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.h1}>Account</Text>

        {!configured ? (
          <View style={styles.card}>
            <Text style={styles.cardKicker}>SETUP REQUIRED</Text>
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
            <View style={styles.profileCard}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{initials}</Text>
              </View>
              <Text style={styles.profileName}>
                {user.displayName ?? user.id}
              </Text>
              {user.email ? (
                <Text style={styles.profileMeta}>{user.email}</Text>
              ) : null}
              <View
                style={[
                  styles.planPill,
                  user.product === 'premium' ? styles.planPremium : styles.planFree,
                ]}
              >
                <Text
                  style={[
                    styles.planText,
                    user.product === 'premium'
                      ? styles.planTextPremium
                      : styles.planTextFree,
                  ]}
                >
                  {user.product === 'premium' ? '✦ PREMIUM' : 'FREE'}
                </Text>
              </View>
              {user.country ? (
                <Text style={styles.country}>{user.country}</Text>
              ) : null}
            </View>

            {user.product !== 'premium' && (
              <View style={styles.warnCard}>
                <Text style={styles.warnTitle}>Premium recommended</Text>
                <Text style={styles.warnBody}>
                  Free Spotify accounts have ads and limited mobile playback.
                  Premium is required for SDK-controlled in-app playback.
                </Text>
              </View>
            )}

            <Pressable
              onPress={onLogout}
              disabled={busy}
              style={({ pressed }) => [
                styles.button,
                styles.buttonGhost,
                pressed && styles.pressed,
                busy && styles.disabled,
              ]}
            >
              <Text style={styles.buttonGhostText}>Sign out of Spotify</Text>
            </Pressable>
          </View>
        ) : (
          <View>
            <View style={styles.signinHero}>
              <Text style={styles.signinGlyph}>♫</Text>
              <Text style={styles.signinTitle}>Connect Spotify</Text>
              <Text style={styles.signinIntro}>
                Sign in to play full songs, sync Liked Songs, and add tracks to
                your playlists.
              </Text>
            </View>
            <Pressable
              onPress={onLogin}
              disabled={busy}
              style={({ pressed }) => [
                styles.button,
                pressed && styles.pressed,
                busy && styles.disabled,
              ]}
            >
              <Text style={styles.buttonText}>
                {busy ? 'Opening Spotify…' : '▶  Continue with Spotify'}
              </Text>
            </Pressable>
            <View style={styles.featureList}>
              <FeatureRow glyph="♥" label="Sync your Liked Songs" />
              <FeatureRow glyph="✚" label="Add to your playlists" />
              <FeatureRow glyph="▶" label="Full-track in-app playback" />
            </View>
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}

function FeatureRow({ glyph, label }: { glyph: string; label: string }) {
  return (
    <View style={styles.featRow}>
      <View style={styles.featGlyphWrap}>
        <Text style={styles.featGlyph}>{glyph}</Text>
      </View>
      <Text style={styles.featText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  h1: {
    color: colors.text,
    fontSize: fontSize.h1,
    fontWeight: '800',
    paddingTop: spacing.md,
    letterSpacing: -0.5,
  },
  intro: {
    color: colors.textMuted,
    marginTop: spacing.md,
    marginBottom: spacing.lg,
    fontSize: fontSize.lg,
    lineHeight: 21,
  },
  muted: {
    color: colors.textMuted,
    marginTop: spacing.md,
    fontSize: fontSize.md,
    lineHeight: 18,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: spacing.lg,
  },
  cardKicker: {
    color: colors.danger,
    fontSize: fontSize.xs,
    fontWeight: '800',
    letterSpacing: 1.4,
  },
  cardTitle: {
    color: colors.text,
    fontSize: fontSize.xl,
    fontWeight: '700',
    marginTop: spacing.xs,
  },
  cardBody: {
    color: colors.textMuted,
    fontSize: fontSize.md,
    marginTop: spacing.sm,
    lineHeight: 19,
  },
  code: { color: colors.accent, fontFamily: 'monospace' },

  profileCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: spacing.lg,
    alignItems: 'center',
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.accentSoft,
    borderWidth: 2,
    borderColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  avatarText: {
    color: colors.accent,
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: 1,
  },
  profileName: {
    color: colors.text,
    fontSize: fontSize.h3,
    fontWeight: '800',
  },
  profileMeta: {
    color: colors.textMuted,
    fontSize: fontSize.md,
    marginTop: spacing.xs,
  },
  planPill: {
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    borderRadius: radius.pill,
    borderWidth: 1,
    marginTop: spacing.md,
  },
  planPremium: {
    backgroundColor: colors.accentSoft,
    borderColor: colors.accent,
  },
  planFree: {
    backgroundColor: colors.surfaceAlt,
    borderColor: colors.border,
  },
  planText: { fontSize: fontSize.xs, fontWeight: '800', letterSpacing: 1.2 },
  planTextPremium: { color: colors.accent },
  planTextFree: { color: colors.textMuted },
  country: {
    color: colors.textDim,
    fontSize: fontSize.sm,
    marginTop: spacing.sm,
  },
  warnCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginTop: spacing.md,
  },
  warnTitle: { color: colors.text, fontWeight: '700', fontSize: fontSize.lg },
  warnBody: {
    color: colors.textMuted,
    fontSize: fontSize.sm,
    lineHeight: 18,
    marginTop: spacing.xs,
  },

  signinHero: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xl,
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  signinGlyph: {
    color: colors.accent,
    fontSize: 44,
    marginBottom: spacing.sm,
  },
  signinTitle: {
    color: colors.text,
    fontSize: fontSize.h2,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  signinIntro: {
    color: colors.textMuted,
    fontSize: fontSize.md,
    textAlign: 'center',
    marginTop: spacing.sm,
    lineHeight: 20,
  },

  button: {
    marginTop: spacing.md,
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  buttonText: { color: colors.accentInk, fontWeight: '800', fontSize: fontSize.lg },
  buttonGhost: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.border,
  },
  buttonGhostText: { color: colors.text, fontWeight: '700' },
  pressed: { opacity: 0.78, transform: [{ scale: 0.99 }] },
  disabled: { opacity: 0.5 },

  featureList: {
    marginTop: spacing.lg,
    gap: spacing.sm,
  },
  featRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
  },
  featGlyphWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featGlyph: { color: colors.accent, fontSize: 14, fontWeight: '800' },
  featText: { color: colors.text, fontSize: fontSize.lg, fontWeight: '600' },
});
