// Build-time harvested 30s preview MP3s (see scripts/fetch-previews.mjs).
// Plain files on p.scdn.co — no DRM, no auth — so they play in any browser.

import raw from './previews.json';

const host: string = (raw as { host: string }).host;
const previews = (raw as { previews: Record<string, string> }).previews;

/** Preview MP3 URL for a Spotify track id, or null when none exists. */
export function previewUrlForTrack(
  trackId: string | null | undefined,
): string | null {
  if (!trackId) return null;
  const hash = previews[trackId];
  return hash ? `${host}${hash}` : null;
}
