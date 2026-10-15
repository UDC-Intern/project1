import { Route, Routes } from 'react-router-dom';
import { RequireRole } from './auth/RequireRole';
import { ChildLayout } from './components/ChildLayout';
import { BookPage } from './play/BookPage';
import { ChildLogin } from './play/ChildLogin';
import { ComingSoon } from './play/ComingSoon';
import { PlayHome } from './play/PlayHome';
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
          <Route path="main/:levelId" element={<ComingSoon />} />
          <Route path="peringkat" element={<ComingSoon />} />
          <Route path="profil" element={<ComingSoon />} />
        </Route>
      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
