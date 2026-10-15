import { Navigate, Route, Routes, useParams } from 'react-router-dom';
import { AdminAssistantPage } from './admin/AdminAssistantPage';
import { AdminContentPage } from './admin/AdminContentPage';
import { AdminLayout } from './admin/AdminLayout';
import { AdminMethodsPage } from './admin/AdminMethodsPage';
import { AdminOrdersPage } from './admin/AdminOrdersPage';
import { AdminPackagesPage } from './admin/AdminPackagesPage';
import { AdminOverviewPage } from './admin/AdminOverviewPage';
import { AdminPreviewPage } from './admin/AdminPreviewPage';
import { AdminReportsPage } from './admin/AdminReportsPage';
import { AdminUsersPage } from './admin/AdminUsersPage';
import { RequireRole } from './auth/RequireRole';
import { ChildLayout } from './components/ChildLayout';
import { BookPage } from './play/BookPage';
import { CertificatePage } from './play/CertificatePage';
import { ParentApp } from './parent/ParentApp';
import { WhatsAppButton } from './components/WhatsAppButton';
import { StaffLogin } from './staff/StaffLogin';
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

/** Alamat lama /play/main/:levelId diarahkan ke /play/latihan/:levelId. */
function LegacyRoundRedirect() {
  const { levelId = '' } = useParams();
  return <Navigate to={`/play/latihan/${levelId}`} replace />;
}

export function App() {
  return (
    <>
      <Routes>
        <Route path="/" element={<Landing />} />
        {import.meta.env.DEV && <Route path="/gaya" element={<StylePage />} />}

        <Route path="/play/masuk" element={<ChildLogin />} />
        <Route path="/play" element={<RequireRole role="child" />}>
          <Route element={<ChildLayout />}>
            <Route index element={<PlayHome />} />
            <Route path="buku/:slug" element={<BookPage />} />
            <Route path="topik/:id" element={<TopicPage />} />
            <Route path="latihan/:levelId" element={<RoundPage />} />
            <Route path="main/:levelId" element={<LegacyRoundRedirect />} />
            <Route path="hasil/:roundId" element={<ResultPage />} />
            <Route path="peringkat" element={<LeaderboardPage />} />
            <Route path="profil" element={<ProfilePage />} />
            <Route path="sertifikat/:bookSlug" element={<CertificatePage />} />
          </Route>
        </Route>

        <Route path="/orang-tua/*" element={<ParentApp />} />

        <Route path="/masuk/staf" element={<StaffLogin />} />
        <Route path="/admin" element={<RequireRole role="admin" />}>
          <Route element={<AdminLayout />}>
            <Route index element={<AdminOverviewPage />} />
            <Route path="konten" element={<AdminContentPage />} />
            <Route path="soal" element={<AdminPreviewPage />} />
            <Route path="asisten" element={<AdminAssistantPage />} />
            <Route path="pengguna" element={<AdminUsersPage />} />
            <Route path="laporan" element={<AdminReportsPage />} />
            <Route path="transaksi" element={<AdminOrdersPage />} />
            <Route path="paket" element={<AdminPackagesPage />} />
            <Route path="rekening" element={<AdminMethodsPage />} />
          </Route>
        </Route>

        <Route path="*" element={<NotFound />} />
      </Routes>
      <WhatsAppButton />
    </>
  );
}
