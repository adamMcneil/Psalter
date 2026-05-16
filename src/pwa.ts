import { useEffect } from 'react';
import { Platform } from 'react-native';

let cachedBase: string | null = null;

function detectBaseUrl(): string {
  const fromEnv = (process.env.EXPO_BASE_URL ?? '').toString().replace(/\/$/, '');
  if (fromEnv) return fromEnv;

  if (typeof document !== 'undefined') {
    const scripts = Array.from(
      document.querySelectorAll('script[src]'),
    ) as HTMLScriptElement[];
    for (const s of scripts) {
      const m = s.src.match(/^(?:https?:\/\/[^/]+)?(.*?)\/_expo\/static\/js\/web\//);
      if (m && m[1]) return m[1];
    }
  }

  return '';
}

export function baseUrl(): string {
  if (cachedBase === null) cachedBase = detectBaseUrl();
  return cachedBase;
}

export function withBase(path: string): string {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return `${baseUrl()}${normalized}`;
}

function ensureHead(selector: string, build: () => HTMLElement): void {
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

    setLink('manifest', withBase('/manifest.webmanifest'));
    setLink('icon', withBase('/icon.svg'), 'image/svg+xml');
    setLink('apple-touch-icon', withBase('/icon.svg'));

    setMeta('theme-color', '#15110f');
    setMeta('application-name', 'Psalter');
    setMeta('apple-mobile-web-app-capable', 'yes');
    setMeta('apple-mobile-web-app-status-bar-style', 'black-translucent');
    setMeta('apple-mobile-web-app-title', 'Psalter');
    setMeta('mobile-web-app-capable', 'yes');

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register(withBase('/sw.js'), { scope: withBase('/') })
        .catch(() => {});
    }
  }, []);
}
