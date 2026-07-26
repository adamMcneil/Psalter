import { Link } from 'react-router-dom';

export function NotFound() {
  return (
    <div className="shell">
      <div className="center-note">
        <div className="kicker">404</div>
        <div style={{ fontSize: 18, fontWeight: 700 }}>Page not found</div>
        <Link to="/" className="btn btn-primary press">
          Back to the Psalms
        </Link>
      </div>
    </div>
  );
}
