import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSpotifyAuth } from '../spotify/AuthContext';
import { colors, fontSize, radius, spacing } from '../theme';

export function AuthBar() {
  const { configured, loading, tokens, login } = useSpotifyAuth();
  const [busy, setBusy] = useState(false);

  if (!configured) {
    return (
      <View style={[styles.bar, styles.barWarn]}>
        <Text style={styles.text} numberOfLines={1}>
          Spotify isn’t configured — see the Account tab.
        </Text>
      </View>
    );
  }

  if (loading || tokens) return null;

  const onLogin = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await login();
    } catch {
      // surfaces are owned by the Account screen; bar stays silent on error
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.bar}>
      <Text style={styles.text} numberOfLines={1}>
        Sign in to Spotify to play full songs
      </Text>
      <Pressable
        onPress={onLogin}
        disabled={busy}
        accessibilityLabel="Sign in with Spotify"
        style={({ pressed }) => [
          styles.cta,
          pressed && styles.pressed,
          busy && styles.disabled,
        ]}
      >
        <Text style={styles.ctaText}>{busy ? 'Opening…' : 'Sign in'}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  barWarn: { borderBottomColor: colors.danger },
  text: {
    flex: 1,
    color: colors.text,
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
  cta: {
    backgroundColor: colors.accent,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.pill,
  },
  ctaText: { color: colors.accentInk, fontWeight: '800', fontSize: fontSize.sm },
  pressed: { opacity: 0.8 },
  disabled: { opacity: 0.6 },
});
