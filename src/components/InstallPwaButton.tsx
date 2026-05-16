import { useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fontSize, radius, spacing } from '../theme';

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

type Mode = 'prompt' | 'ios-safari' | 'ios-other' | 'desktop-hint' | 'unsupported';

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  const mql = window.matchMedia?.('(display-mode: standalone)');
  const iosStandalone = (window.navigator as unknown as { standalone?: boolean }).standalone;
  return Boolean(mql?.matches || iosStandalone);
}

function detectMode(hasPrompt: boolean): Mode {
  if (hasPrompt) return 'prompt';
  if (typeof window === 'undefined') return 'unsupported';
  const ua = window.navigator.userAgent;
  const isIos = /iPad|iPhone|iPod/.test(ua) || (ua.includes('Mac') && 'ontouchend' in document);
  if (isIos) {
    const isSafari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua);
    return isSafari ? 'ios-safari' : 'ios-other';
  }
  const isChromiumDesktop = /Chrome|Edg|OPR/.test(ua) && !/Mobi|Android/.test(ua);
  if (isChromiumDesktop) return 'desktop-hint';
  return 'unsupported';
}

export function InstallPwaButton() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    if (isStandalone()) {
      setInstalled(true);
      return;
    }

    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  if (Platform.OS !== 'web' || installed) return null;

  const mode = detectMode(!!deferredPrompt);

  const onPress = async () => {
    if (mode === 'prompt' && deferredPrompt) {
      setBusy(true);
      try {
        await deferredPrompt.prompt();
        const choice = await deferredPrompt.userChoice;
        if (choice.outcome === 'accepted') setInstalled(true);
        setDeferredPrompt(null);
      } finally {
        setBusy(false);
      }
      return;
    }
    setExpanded((v) => !v);
  };

  const label =
    mode === 'prompt'
      ? '⤓  Install Psalter on this device'
      : '⤓  Install Psalter';

  return (
    <View style={styles.wrap}>
      <Pressable
        onPress={onPress}
        disabled={busy}
        style={({ pressed }) => [
          styles.button,
          pressed && styles.pressed,
          busy && styles.disabled,
        ]}
      >
        <Text style={styles.buttonText}>
          {busy ? 'Opening installer…' : label}
        </Text>
      </Pressable>

      {expanded && mode === 'ios-safari' && (
        <View style={styles.helpCard}>
          <Text style={styles.helpTitle}>Add Psalter to your Home Screen</Text>
          <Text style={styles.helpStep}>
            1. Tap the <Text style={styles.helpEm}>Share</Text> icon in Safari's toolbar.
          </Text>
          <Text style={styles.helpStep}>
            2. Choose <Text style={styles.helpEm}>Add to Home Screen</Text>.
          </Text>
          <Text style={styles.helpStep}>
            3. Tap <Text style={styles.helpEm}>Add</Text> in the top-right.
          </Text>
        </View>
      )}

      {expanded && mode === 'ios-other' && (
        <View style={styles.helpCard}>
          <Text style={styles.helpTitle}>Open in Safari to install</Text>
          <Text style={styles.helpStep}>
            iOS only allows Home-Screen installs from Safari. Open this page in
            Safari, then tap <Text style={styles.helpEm}>Share → Add to Home Screen</Text>.
          </Text>
        </View>
      )}

      {expanded && mode === 'desktop-hint' && (
        <View style={styles.helpCard}>
          <Text style={styles.helpTitle}>Install not offered yet</Text>
          <Text style={styles.helpStep}>
            Your browser hasn't reported this site as installable. Check that the
            page is served over HTTPS (or localhost), that{' '}
            <Text style={styles.helpEm}>/manifest.webmanifest</Text> loads, and
            that a service worker is registered. You can also try{' '}
            <Text style={styles.helpEm}>Browser menu → Install Psalter</Text> directly.
          </Text>
        </View>
      )}

      {expanded && mode === 'unsupported' && (
        <View style={styles.helpCard}>
          <Text style={styles.helpTitle}>This browser can't install web apps</Text>
          <Text style={styles.helpStep}>
            Open Psalter in Chrome or Edge on Android (or Safari on iOS) to
            install it to your Home Screen.
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: spacing.md },
  button: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.accent,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  buttonText: { color: colors.accent, fontWeight: '800', fontSize: fontSize.lg },
  pressed: { opacity: 0.78, transform: [{ scale: 0.99 }] },
  disabled: { opacity: 0.5 },
  helpCard: {
    marginTop: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  helpTitle: {
    color: colors.text,
    fontWeight: '700',
    fontSize: fontSize.lg,
    marginBottom: spacing.sm,
  },
  helpStep: {
    color: colors.textMuted,
    fontSize: fontSize.md,
    lineHeight: 20,
    marginTop: 2,
  },
  helpEm: { color: colors.text, fontWeight: '700' },
});
