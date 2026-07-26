import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// Deployed under a sub-path on GitHub Pages (e.g. /Psalter/). CI sets BASE_URL;
// local dev serves from /.
const base = process.env.BASE_URL ?? '/';

export default defineConfig({
  base,
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/icon.svg', 'icons/apple-touch-icon.png'],
      manifest: {
        name: 'Psalter',
        short_name: 'Psalter',
        description:
          'Sing the Psalms — every psalm set to music, with previews that play in any browser.',
        start_url: '.',
        scope: '.',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#15110f',
        theme_color: '#15110f',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'icons/icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
          { src: 'icons/icon.svg', sizes: 'any', type: 'image/svg+xml' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,webmanifest}'],
        navigateFallback: `${base}index.html`,
        // The catalog ships in the JS bundle, so the whole app works offline
        // once installed. Album art and preview audio are cached as used.
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/i\.scdn\.co\/image\//,
            handler: 'CacheFirst',
            options: {
              cacheName: 'album-art',
              expiration: {
                maxEntries: 500,
                maxAgeSeconds: 60 * 60 * 24 * 180,
                purgeOnQuotaError: true,
              },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: /^https:\/\/p\.scdn\.co\/mp3-preview\//,
            handler: 'CacheFirst',
            options: {
              cacheName: 'preview-audio',
              rangeRequests: true,
              expiration: { maxEntries: 200, purgeOnQuotaError: true },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  build: {
    rollupOptions: {
      output: {
        // Catalog data changes on reseed, code changes on deploys — separate
        // chunks let the service worker re-download only what changed.
        manualChunks(id) {
          if (id.includes('/src/data/') && id.endsWith('.json')) return 'data';
          if (id.includes('node_modules')) return 'vendor';
        },
      },
    },
  },
  server: { port: 2222 },
  preview: { port: 2222 },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'],
    setupFiles: ['src/test-setup.ts'],
    restoreMocks: true,
  },
});
