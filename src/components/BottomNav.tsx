import { NavLink } from 'react-router-dom';

const TABS = [
  { label: 'Psalms', glyph: '❖', path: '/' },
  { label: 'Artists', glyph: '♪', path: '/artists' },
  { label: 'Search', glyph: '⌕', path: '/search' },
  { label: 'Coverage', glyph: '◐', path: '/coverage' },
  { label: 'Account', glyph: '◉', path: '/account' },
];

export function BottomNav() {
  return (
    <nav className="bottom-nav" aria-label="Main">
      {TABS.map((tab) => (
        <NavLink
          key={tab.path}
          to={tab.path}
          end={tab.path === '/'}
          className={({ isActive }) => (isActive ? 'active' : undefined)}
        >
          <span className="glyph" aria-hidden>
            {tab.glyph}
          </span>
          {tab.label}
        </NavLink>
      ))}
    </nav>
  );
}
