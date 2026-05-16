import { useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { withBase } from '../pwa';
import { colors, fontSize, radius, spacing } from '../theme';

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

type Diag = {
  origin: string;
  isSecureContext: boolean;
  isLocalhost: boolean;
  swSupported: boolean;
  swRegistered: boolean | null;
  swError?: string;
  manifestOk: boolean | null;
  manifestStatus?: number;
  manifestError?: string;
  promptFired: boolean;
  standalone: boolean;
  uaKind: 'ios-safari' | 'ios-other' | 'android-chromium' | 'desktop-chromium' | 'other';
};

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  const mql = window.matchMedia?.('(display-mode: standalone)');
  const iosStandalone = (window.navigator as unknown as { standalone?: boolean }).standalone;
  return Boolean(mql?.matches || iosStandalone);
}

function classifyUa(): Diag['uaKind'] {
  if (typeof window === 'undefined') return 'other';
  const ua = window.navigator.userAgent;
  const isIos = /iPad|iPhone|iPod/.test(ua) || (ua.includes('Mac') && 'ontouchend' in document);
  if (isIos) {
    const isSafari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua);
    return isSafari ? 'ios-safari' : 'ios-other';
  }
  const isAndroid = /Android/.test(ua);
  const isChromium = /Chrome|Edg|OPR|Brave/.test(ua);
  if (isAndroid && isChromium) return 'android-chromium';
  if (isChromium) return 'desktop-chromium';
  return 'other';
}

export function InstallPwaButton() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [diag, setDiag] = useState<Diag | null>(null);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    if (typeof window === 'undefined') return;
    if (isStandalone()) {
      setInstalled(true);
      return;
    }

    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setDiag((d) => (d ? { ...d, promptFired: true } : d));
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onInstalled);

    const host = window.location.hostname;
    const isLocalhost = host === 'localhost' || host === '127.0.0.1' || host === '[::1]';
    const base: Diag = {
      origin: window.location.origin,
      isSecureContext: window.isSecureContext === true,
      isLocalhost,
      swSupported: 'serviceWorker' in navigator,
      swRegistered: null,
      manifestOk: null,
      promptFired: false,
      standalone: isStandalone(),
      uaKind: classifyUa(),
    };
    setDiag(base);

    fetch(withBase('/manifest.webmanifest'), { cache: 'no-store' })
      .then((r) =>
        setDiag((d) => (d ? { ...d, manifestOk: r.ok, manifestStatus: r.status } : d)),
      )
      .catch((e) =>
        setDiag((d) =>
          d ? { ...d, manifestOk: false, manifestError: String(e?.message ?? e) } : d,
        ),
      );

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .getRegistration(withBase('/'))
        .then((reg) => setDiag((d) => (d ? { ...d, swRegistered: !!reg } : d)))
        .catch((e) =>
          setDiag((d) => (d ? { ...d, swRegistered: false, swError: String(e?.message ?? e) } : d)),
        );
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  if (Platform.OS !== 'web' || installed) return null;

  const canPrompt = !!deferredPrompt;

  const onPress = async () => {
    if (canPrompt && deferredPrompt) {
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
          {busy
            ? 'Opening installer…'
            : canPrompt
              ? '⤓  Install Psalter on this device'
              : '⤓  Why can\'t I install?'}
        </Text>
      </Pressable>

      {expanded && diag && !canPrompt && (
        <View style={styles.helpCard}>
          {diag.uaKind === 'ios-safari' && (
            <View style={{ marginBottom: spacing.md }}>
              <Text style={styles.helpTitle}>Add Psalter to your Home Screen</Text>
              <Text style={styles.helpStep}>
                1. Tap the <Text style={styles.helpEm}>Share</Text> icon in Safari's toolbar.
              </Text>
              <Text style={styles.helpStep}>
                2. Choose <Text style={styles.helpEm}>Add to Home Screen</Text>.
              </Text>
              <Text style={styles.helpStep}>
                3. Tap <Text style={styles.helpEm}>Add</Text>.
              </Text>
            </View>
          )}

          {diag.uaKind === 'ios-other' && (
            <View style={{ marginBottom: spacing.md }}>
              <Text style={styles.helpTitle}>Open in Safari to install</Text>
              <Text style={styles.helpStep}>
                iOS only allows Home-Screen installs from Safari. Open this URL
                in Safari, then tap <Text style={styles.helpEm}>Share → Add to Home Screen</Text>.
              </Text>
            </View>
          )}

          <Text style={styles.helpTitle}>Install requirements</Text>
          <DiagRow
            ok={diag.isSecureContext || diag.isLocalhost}
            label={`Secure origin (${diag.origin})`}
            hint="PWAs require HTTPS — http://… on a phone won't work. Use a tunnel (cloudflared / ngrok) or deploy to an HTTPS host."
          />
          <DiagRow
            ok={diag.manifestOk === true}
            label={
              diag.manifestOk === null
                ? 'Manifest: checking…'
                : diag.manifestOk
                  ? 'Manifest loads'
                  : `Manifest failed (${diag.manifestStatus ?? diag.manifestError ?? 'error'})`
            }
            hint="Expo must serve /manifest.webmanifest from the public/ folder. Restart `npm start` after adding files."
          />
          <DiagRow
            ok={diag.swRegistered === true}
            label={
              !diag.swSupported
                ? 'Service workers not supported'
                : diag.swRegistered === null
                  ? 'Service worker: checking…'
                  : diag.swRegistered
                    ? 'Service worker registered'
                    : `Service worker not registered${diag.swError ? ` (${diag.swError})` : ''}`
            }
            hint="SW can't register on insecure origins. Fix HTTPS first."
          />
          <DiagRow
            ok={diag.promptFired}
            label={diag.promptFired ? 'Browser offered install' : 'Browser has not offered install yet'}
            hint={
              diag.uaKind === 'android-chromium'
                ? "On Android, you can also use the browser's menu → Install app / Add to Home screen."
                : diag.uaKind === 'desktop-chromium'
                  ? 'On desktop Chromium, look for an install icon in the address bar.'
                  : 'On other browsers, install may not be available.'
            }
          />
          <Text style={styles.helpStepDim}>
            UA: {diag.uaKind}
          </Text>
        </View>
      )}
    </View>
  );
}

function DiagRow({ ok, label, hint }: { ok: boolean; label: string; hint: string }) {
  return (
    <View style={styles.diagRow}>
      <Text style={[styles.diagMark, ok ? styles.diagOk : styles.diagBad]}>
        {ok ? '✓' : '✗'}
      </Text>
      <View style={{ flex: 1 }}>
        <Text style={styles.diagLabel}>{label}</Text>
        {!ok && <Text style={styles.diagHint}>{hint}</Text>}
      </View>
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
  helpStepDim: {
    color: colors.textDim,
    fontSize: fontSize.xs,
    marginTop: spacing.md,
  },
  helpEm: { color: colors.text, fontWeight: '700' },
  diagRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  diagMark: { fontSize: fontSize.lg, fontWeight: '800', width: 16 },
  diagOk: { color: '#7fd17f' },
  diagBad: { color: colors.danger },
  diagLabel: { color: colors.text, fontSize: fontSize.md },
  diagHint: { color: colors.textMuted, fontSize: fontSize.sm, lineHeight: 17, marginTop: 2 },
});
