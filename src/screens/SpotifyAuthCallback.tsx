import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSpotifyAuth } from '../spotify/AuthContext';

export function SpotifyAuthCallback() {
  const navigate = useNavigate();
  const { completeWebRedirect } = useSpotifyAuth();
  const [error, setError] = useState<string | null>(null);
  // The exchange consumes a single-use code — make StrictMode's double-mount
  // (and any re-render) run it exactly once.
  const ranRef = useRef(false);

  useEffect(() => {
    if (ranRef.current) return;
    ranRef.current = true;
    void (async () => {
      try {
        const result = await completeWebRedirect();
        if (result.error) {
          setError(result.error);
          return;
        }
        navigate(result.returnTo || '/account', { replace: true });
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    })();
  }, [completeWebRedirect, navigate]);

  return (
    <div className="shell">
      <div className="center-note">
        {error ? (
          <>
            <div style={{ fontSize: 15, fontWeight: 700 }}>
              Spotify sign-in failed
            </div>
            <div className="muted" style={{ fontSize: 13, lineHeight: 1.5 }}>
              {error}
            </div>
            <button
              type="button"
              className="btn btn-primary press"
              onClick={() => navigate('/account', { replace: true })}
            >
              Back to Account
            </button>
          </>
        ) : (
          <>
            <div className="spinner" aria-hidden />
            <div style={{ fontSize: 15, fontWeight: 700 }}>
              Completing Spotify sign-in…
            </div>
          </>
        )}
      </div>
    </div>
  );
}
