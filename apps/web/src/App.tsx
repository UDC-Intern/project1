import { Route, Routes } from 'react-router-dom';
import { Landing } from './site/Landing';
import { NotFound } from './site/NotFound';
import { StylePage } from './site/StylePage';

export function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      {import.meta.env.DEV && <Route path="/gaya" element={<StylePage />} />}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
