// Capability probe: can this browser actually decrypt Spotify's full-track
// streams? The Web Playback SDK needs Widevine (EME). Brave ships with it
// disabled, Firefox asks first, iOS Safari lacks it entirely — probing up
// front lets the app fall back to previews instead of failing mid-play.

let cached: Promise<boolean> | null = null;

export function widevineAvailable(): Promise<boolean> {
  if (cached) return cached;
  cached = (async () => {
    if (
      typeof navigator === 'undefined' ||
      typeof navigator.requestMediaKeySystemAccess !== 'function'
    ) {
      return false;
    }
    try {
      await navigator.requestMediaKeySystemAccess('com.widevine.alpha', [
        {
          initDataTypes: ['cenc'],
          audioCapabilities: [{ contentType: 'audio/mp4;codecs="mp4a.40.2"' }],
        },
      ]);
      return true;
    } catch {
      return false;
    }
  })();
  return cached;
}
