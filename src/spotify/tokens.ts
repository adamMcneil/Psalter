// Web-only token persistence. Access/refresh tokens live in localStorage under
// the same key the previous app used, so existing sessions survive the remake.

const KEY = 'psalter.spotify.tokens.v1';

export interface StoredTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  scope?: string;
}

export async function saveTokens(t: StoredTokens): Promise<void> {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(t));
  } catch {
    // Storage full/blocked — the session just won't survive a reload.
  }
}

export async function loadTokens(): Promise<StoredTokens | null> {
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(KEY);
  } catch {
    return null;
  }
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as StoredTokens;
    if (
      typeof parsed?.accessToken === 'string' &&
      typeof parsed?.refreshToken === 'string' &&
      typeof parsed?.expiresAt === 'number'
    ) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

export async function clearTokens(): Promise<void> {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}

// --- Transient PKCE handshake ------------------------------------------------
// The code_verifier + state are single-transaction secrets, so they live in
// sessionStorage (tab-scoped, auto-cleared, and preserved across the same-tab
// full-page OAuth redirect) rather than localStorage.

export interface PendingWebAuth {
  codeVerifier: string;
  state: string;
  returnTo: string;
}

const PENDING_KEY = 'psalter.spotify.pending';

export function savePendingWebAuth(p: PendingWebAuth): void {
  try {
    window.sessionStorage.setItem(PENDING_KEY, JSON.stringify(p));
  } catch {
    // ignore
  }
}

export function loadPendingWebAuth(): PendingWebAuth | null {
  let raw: string | null = null;
  try {
    raw = window.sessionStorage.getItem(PENDING_KEY);
  } catch {
    return null;
  }
  if (!raw) return null;
  try {
    const p = JSON.parse(raw) as PendingWebAuth;
    if (
      typeof p?.codeVerifier === 'string' &&
      typeof p?.state === 'string' &&
      typeof p?.returnTo === 'string'
    ) {
      return p;
    }
    return null;
  } catch {
    return null;
  }
}

export function clearPendingWebAuth(): void {
  try {
    window.sessionStorage.removeItem(PENDING_KEY);
  } catch {
    // ignore
  }
}
