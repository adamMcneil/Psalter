import { useState } from 'react';
import { InstallPwaButton } from '../components/InstallPwaButton';
import { useSpotifyAuth } from '../spotify/AuthContext';
import { usePlayer } from '../player/PlayerContext';

function PlaybackCard() {
  const { fullTracks } = usePlayer();
  const body = (() => {
    switch (fullTracks.reason) {
      case 'ready':
        return 'Signed in with Premium in a DRM-capable browser: songs play in full through Spotify. If that ever fails, the app falls back to 30-second previews automatically.';
      case 'no-drm':
        return 'Your browser has DRM (Widevine) disabled, so Spotify full-track streaming is not available — the app plays 30-second previews instead, which work everywhere. In Brave you can enable it at brave://settings/extensions → “Widevine”, then reload.';
      case 'not-premium':
        return 'Spotify only allows full-track streaming for Premium accounts. You get 30-second previews of every song — or open any song in Spotify to hear it in full.';
      case 'signed-out':
        return 'Every song plays a 30-second preview — no account needed, in any browser. Sign in with Spotify Premium (in a DRM-capable browser) to stream full tracks in the app.';
      default:
        return 'Every song plays a 30-second preview — no account needed, in any browser.';
    }
  })();
  return (
    <div className="info-card">
      <div className="info-title">
        {fullTracks.ready ? '▶ Full tracks enabled' : '▶ How playback works'}
      </div>
      <div className="info-body">{body}</div>
    </div>
  );
}

export function Account() {
  const { configured, loading, tokens, user, login, logout } = useSpotifyAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onLogin = async () => {
    setBusy(true);
    setError(null);
    try {
      await login();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  };

  const onLogout = async () => {
    setBusy(true);
    try {
      await logout();
    } finally {
      setBusy(false);
    }
  };

  const initials =
    user?.displayName
      ?.split(/\s+/)
      .slice(0, 2)
      .map((p) => p[0])
      .join('')
      .toUpperCase() ??
    user?.id?.[0]?.toUpperCase() ??
    '♪';

  return (
    <div className="shell">
      <header style={{ paddingTop: 12 }}>
        <h1 className="h1">Account</h1>
      </header>

      {error ? (
        <div className="info-card" style={{ borderColor: 'var(--danger)' }}>
          <div className="info-title" style={{ color: 'var(--danger)' }}>
            Sign-in failed
          </div>
          <div className="info-body">{error}</div>
        </div>
      ) : null}

      {!configured ? (
        <div className="info-card">
          <div className="kicker" style={{ color: 'var(--danger)' }}>
            SETUP REQUIRED
          </div>
          <div className="info-title" style={{ marginTop: 4 }}>
            Spotify is not configured
          </div>
          <div className="info-body">
            Set <code>VITE_SPOTIFY_CLIENT_ID</code> at build time and register
            this site&apos;s <code>/spotify-auth</code> URL as a redirect URI in
            your Spotify developer dashboard.
          </div>
        </div>
      ) : loading ? (
        <p className="muted" style={{ marginTop: 12 }}>
          Checking your Spotify session…
        </p>
      ) : tokens && user ? (
        <>
          <div className="profile-card">
            <div className="big-avatar">{initials}</div>
            <div style={{ fontSize: 20, fontWeight: 800 }}>
              {user.displayName ?? user.id}
            </div>
            {user.email ? (
              <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>
                {user.email}
              </div>
            ) : null}
            <div
              className={`plan-pill${user.product === 'premium' ? ' premium' : ''}`}
            >
              {user.product === 'premium' ? '✦ PREMIUM' : 'FREE'}
            </div>
            {user.country ? (
              <div className="dim" style={{ fontSize: 12, marginTop: 8 }}>
                {user.country}
              </div>
            ) : null}
          </div>

          <PlaybackCard />

          <button
            type="button"
            className="btn btn-block press"
            style={{ marginTop: 12 }}
            onClick={() => void onLogout()}
            disabled={busy}
          >
            Sign out of Spotify
          </button>

          <InstallPwaButton />
        </>
      ) : (
        <>
          <div className="profile-card">
            <div style={{ color: 'var(--accent-hi)', fontSize: 44 }}>♫</div>
            <div className="display" style={{ fontSize: 24, fontWeight: 800 }}>
              Connect Spotify
            </div>
            <div
              className="muted"
              style={{
                fontSize: 13,
                textAlign: 'center',
                marginTop: 8,
                lineHeight: 1.5,
              }}
            >
              Optional — previews already play without an account. Premium
              members in a DRM-capable browser get full-length songs inside the
              app.
            </div>
          </div>
          <button
            type="button"
            className="btn btn-primary btn-block press"
            style={{ marginTop: 12 }}
            onClick={() => void onLogin()}
            disabled={busy}
          >
            {busy ? 'Opening Spotify…' : '▶ Continue with Spotify'}
          </button>

          <div style={{ marginTop: 16 }}>
            <div className="feature-row">
              <span className="glyph-wrap">▶</span>
              <span style={{ fontWeight: 600 }}>Full-track playback (Premium)</span>
            </div>
            <div className="feature-row">
              <span className="glyph-wrap">✦</span>
              <span style={{ fontWeight: 600 }}>Artist photos in the app</span>
            </div>
          </div>

          <PlaybackCard />

          <InstallPwaButton />
        </>
      )}
    </div>
  );
}
