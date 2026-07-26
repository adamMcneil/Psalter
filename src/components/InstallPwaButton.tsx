import { useEffect, useState } from 'react';
import { BASE } from '../base';

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

// Captured at module scope: the browser fires beforeinstallprompt once, very
// early — often before this component ever mounts.
let capturedPrompt: BeforeInstallPromptEvent | null = null;
const promptListeners = new Set<(e: BeforeInstallPromptEvent) => void>();

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    capturedPrompt = e as BeforeInstallPromptEvent;
    promptListeners.forEach((l) => l(capturedPrompt!));
  });
}

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  const mql = window.matchMedia?.('(display-mode: standalone)');
  const iosStandalone = (
    window.navigator as unknown as { standalone?: boolean }
  ).standalone;
  return Boolean(mql?.matches || iosStandalone);
}

function isIosSafari(): boolean {
  const ua = window.navigator.userAgent;
  const isIos =
    /iPad|iPhone|iPod/.test(ua) ||
    (ua.includes('Mac') && 'ontouchend' in document);
  return isIos && /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua);
}

export function InstallPwaButton() {
  const [prompt, setPrompt] = useState<BeforeInstallPromptEvent | null>(
    capturedPrompt,
  );
  const [installed, setInstalled] = useState(isStandalone());
  const [busy, setBusy] = useState(false);
  const [swActive, setSwActive] = useState<boolean | null>(null);

  useEffect(() => {
    const onPrompt = (e: BeforeInstallPromptEvent) => setPrompt(e);
    promptListeners.add(onPrompt);
    const onInstalled = () => {
      setInstalled(true);
      setPrompt(null);
    };
    window.addEventListener('appinstalled', onInstalled);
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .getRegistration(BASE)
        .then((r) => setSwActive(!!r?.active))
        .catch(() => setSwActive(false));
    } else {
      setSwActive(false);
    }
    return () => {
      promptListeners.delete(onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  if (installed) return null;

  const onInstall = async () => {
    if (!prompt) return;
    setBusy(true);
    try {
      await prompt.prompt();
      const choice = await prompt.userChoice;
      if (choice.outcome === 'accepted') setPrompt(null);
    } catch {
      // user dismissed or prompt already consumed
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="info-card">
      <div className="info-title">Install the app</div>
      {prompt ? (
        <>
          <div className="info-body">
            Add Psalter to your home screen or desktop — it opens instantly and
            works offline.
          </div>
          <button
            type="button"
            className="btn btn-primary btn-block press"
            style={{ marginTop: 12 }}
            onClick={() => void onInstall()}
            disabled={busy}
          >
            {busy ? 'Opening…' : '⤓ Install Psalter'}
          </button>
        </>
      ) : isIosSafari() ? (
        <div className="info-body">
          On iPhone/iPad: tap <strong>Share</strong> and choose{' '}
          <strong>Add to Home Screen</strong>.
        </div>
      ) : (
        <div className="info-body">
          Your browser can install this app from the address bar (look for an
          install icon), or from the browser menu →{' '}
          <strong>“Install Psalter”</strong> / <strong>“Add to Home screen”</strong>.
        </div>
      )}
      <details className="diag">
        <summary>Install diagnostics</summary>
        <div className="diag-grid">
          <span>secure context</span>
          <span>{String(window.isSecureContext === true)}</span>
          <span>service worker</span>
          <span>
            {swActive === null ? 'checking…' : swActive ? 'active' : 'not active'}
          </span>
          <span>install prompt</span>
          <span>{prompt ? 'captured' : 'not fired'}</span>
          <span>display mode</span>
          <span>{isStandalone() ? 'standalone' : 'browser tab'}</span>
        </div>
      </details>
    </div>
  );
}
