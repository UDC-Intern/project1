import { Route, Routes } from 'react-router-dom';
import { RequireRole } from './auth/RequireRole';
import { ChildLayout } from './components/ChildLayout';
import { BookPage } from './play/BookPage';
import { ChildLogin } from './play/ChildLogin';
import { LeaderboardPage } from './play/LeaderboardPage';
import { PlayHome } from './play/PlayHome';
import { ProfilePage } from './play/ProfilePage';
import { ResultPage } from './play/ResultPage';
import { RoundPage } from './play/RoundPage';
import { TopicPage } from './play/TopicPage';
import { Landing } from './site/Landing';
import { NotFound } from './site/NotFound';
import { StylePage } from './site/StylePage';

export function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      {import.meta.env.DEV && <Route path="/gaya" element={<StylePage />} />}

      <Route path="/play/masuk" element={<ChildLogin />} />
      <Route path="/play" element={<RequireRole role="child" />}>
        <Route element={<ChildLayout />}>
          <Route index element={<PlayHome />} />
          <Route path="buku/:slug" element={<BookPage />} />
          <Route path="topik/:id" element={<TopicPage />} />
          <Route path="main/:levelId" element={<RoundPage />} />
          <Route path="hasil/:roundId" element={<ResultPage />} />
          <Route path="peringkat" element={<LeaderboardPage />} />
          <Route path="profil" element={<ProfilePage />} />
        </Route>
      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
