import { useNavigate } from 'react-router-dom';

/** Sticky back-navigation bar for detail screens. */
export function TopBar({ title }: { title?: string }) {
  const navigate = useNavigate();
  const goBack = () => {
    if (window.history.length > 1) navigate(-1);
    else navigate('/');
  };
  return (
    <div className="top-bar">
      <button type="button" className="back" onClick={goBack} aria-label="Back">
        ‹
      </button>
      {title ? <div className="bar-title">{title}</div> : null}
    </div>
  );
}
