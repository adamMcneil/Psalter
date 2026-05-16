import { ScrollViewStyleReset } from 'expo-router/html';
import { type PropsWithChildren } from 'react';

export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, shrink-to-fit=no, viewport-fit=cover"
        />

        <link rel="manifest" href="/manifest.webmanifest" />
        <meta name="theme-color" content="#15110f" />
        <meta name="application-name" content="Psalter" />

        <link rel="icon" href="/icon.svg" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/icon.svg" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Psalter" />
        <meta name="mobile-web-app-capable" content="yes" />

        <ScrollViewStyleReset />

        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', function () {
                  navigator.serviceWorker.register('/sw.js').catch(function () {});
                });
              }
            `,
          }}
        />

        <style
          dangerouslySetInnerHTML={{
            __html: `
              html, body { height: 100%; }
              body { overflow: hidden; background-color: #15110f; }
              #root { display: flex; height: 100%; flex: 1; }
            `,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
