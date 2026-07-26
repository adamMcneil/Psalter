import { useEffect, useRef } from 'react';
import {
  BrowserRouter,
  Route,
  Routes,
  useLocation,
  useNavigationType,
} from 'react-router-dom';
import { SpotifyAuthProvider } from './spotify/AuthContext';
import { PlayerProvider } from './player/PlayerContext';
import { MiniPlayer } from './components/MiniPlayer';
import { BottomNav } from './components/BottomNav';
import { Home } from './screens/Home';
import { Search } from './screens/Search';
import { Artists } from './screens/Artists';
import { ArtistDetail } from './screens/ArtistDetail';
import { PsalmDetail } from './screens/PsalmDetail';
import { SongDetail } from './screens/SongDetail';
import { Coverage } from './screens/Coverage';
import { Account } from './screens/Account';
import { SpotifyAuthCallback } from './screens/SpotifyAuthCallback';
import { NotFound } from './screens/NotFound';
import { BASE } from './base';

function Main() {
  const mainRef = useRef<HTMLElement>(null);
  const location = useLocation();
  const navType = useNavigationType();

  // New navigations start at the top; Back/Forward keeps the browser default.
  useEffect(() => {
    if (navType !== 'POP') mainRef.current?.scrollTo(0, 0);
  }, [location.pathname, navType]);

  return (
    <main ref={mainRef} className="app-main">
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/search" element={<Search />} />
        <Route path="/artists" element={<Artists />} />
        <Route path="/artist/:name" element={<ArtistDetail />} />
        <Route path="/psalm/:id" element={<PsalmDetail />} />
        <Route path="/song/:id" element={<SongDetail />} />
        <Route path="/coverage" element={<Coverage />} />
        <Route path="/account" element={<Account />} />
        <Route path="/spotify-auth" element={<SpotifyAuthCallback />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </main>
  );
}

export function App() {
  return (
    <BrowserRouter
      basename={BASE}
      future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
    >
      <SpotifyAuthProvider>
        <PlayerProvider>
          <div className="app">
            <Main />
            <MiniPlayer />
            <BottomNav />
          </div>
        </PlayerProvider>
      </SpotifyAuthProvider>
    </BrowserRouter>
  );
}
