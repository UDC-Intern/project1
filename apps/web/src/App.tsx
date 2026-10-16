import { Navigate, Route, Routes, useParams } from 'react-router-dom';
import { AdminAssistantPage } from './admin/AdminAssistantPage';
import { AdminCertificatesPage } from './admin/AdminCertificatesPage';
import { AdminLayout } from './admin/AdminLayout';
import { AdminOverviewPage } from './admin/AdminOverviewPage';
import { AdminPreviewPage } from './admin/AdminPreviewPage';
import { OrdersPage } from './admin/billing/OrdersPage';
import { PackagesPage } from './admin/billing/PackagesPage';
import { PaymentMethodsPage } from './admin/billing/PaymentMethodsPage';
import { SettingsPage } from './admin/billing/SettingsPage';
import { CatalogPage } from './admin/catalog/CatalogPage';
import { ChildReportPage } from './admin/reports/ChildReportPage';
import { ReportsPage } from './admin/reports/ReportsPage';
import { FamiliesPage } from './admin/users/FamiliesPage';
import { StaffPage } from './admin/users/StaffPage';
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
import { VerifyCertificate } from './site/VerifyCertificate';

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
        <Route path="/sertifikat/cek" element={<VerifyCertificate />} />
        <Route path="/sertifikat/cek/:id" element={<VerifyCertificate />} />

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
            <Route path="konten" element={<CatalogPage />} />
            <Route path="soal" element={<AdminPreviewPage />} />
            <Route path="asisten" element={<AdminAssistantPage />} />
            <Route path="keluarga" element={<FamiliesPage />} />
            <Route path="pengguna" element={<Navigate to="/admin/keluarga" replace />} />
            <Route path="staf" element={<StaffPage />} />
            <Route path="laporan" element={<ReportsPage />} />
            <Route path="laporan/anak/:id" element={<ChildReportPage />} />
            <Route path="sertifikat" element={<AdminCertificatesPage />} />
            <Route path="transaksi" element={<OrdersPage />} />
            <Route path="paket" element={<PackagesPage />} />
            <Route path="rekening" element={<PaymentMethodsPage />} />
            <Route path="pengaturan" element={<SettingsPage />} />
          </Route>
        </Route>

        <Route path="*" element={<NotFound />} />
      </Routes>
      <WhatsAppButton />
    </>
  );
}
