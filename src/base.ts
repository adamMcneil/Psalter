// The app is served from a sub-path on GitHub Pages (e.g. /Psalter/).
// BASE_URL always starts and ends with '/'.
export const BASE = import.meta.env.BASE_URL;

/** Current location as an in-app path (basename stripped), incl. search+hash. */
export function appPath(): string {
  const p = window.location.pathname;
  const stripped =
    BASE !== '/' && p.startsWith(BASE) ? p.slice(BASE.length - 1) : p;
  return (stripped || '/') + window.location.search + window.location.hash;
}
