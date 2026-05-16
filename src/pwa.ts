import { useEffect } from 'react';
import { Platform } from 'react-native';

function ensureHead(
  selector: string,
  build: () => HTMLElement,
): void {
  if (document.head.querySelector(selector)) return;
  document.head.appendChild(build());
}

function setMeta(name: string, content: string): void {
  ensureHead(`meta[name="${name}"]`, () => {
    const m = document.createElement('meta');
    m.name = name;
    m.content = content;
    return m;
  });
}

function setLink(rel: string, href: string, type?: string): void {
  ensureHead(`link[rel="${rel}"]`, () => {
    const l = document.createElement('link');
    l.rel = rel;
    l.href = href;
    if (type) l.type = type;
    return l;
  });
}

export function usePwaSetup(): void {
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    if (typeof window === 'undefined' || typeof document === 'undefined') return;

    setLink('manifest', '/manifest.webmanifest');
    setLink('icon', '/icon.svg', 'image/svg+xml');
    setLink('apple-touch-icon', '/icon.svg');

    setMeta('theme-color', '#15110f');
    setMeta('application-name', 'Psalter');
    setMeta('apple-mobile-web-app-capable', 'yes');
    setMeta('apple-mobile-web-app-status-bar-style', 'black-translucent');
    setMeta('apple-mobile-web-app-title', 'Psalter');
    setMeta('mobile-web-app-capable', 'yes');

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
  }, []);
}
