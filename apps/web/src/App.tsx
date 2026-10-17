import { Navigate, Route, Routes, useParams } from 'react-router-dom';
import { AdminLayout } from './admin/AdminLayout';
import { OrdersPage } from './admin/billing/OrdersPage';
import { PackagesPage } from './admin/billing/PackagesPage';
import { PaymentMethodsPage } from './admin/billing/PaymentMethodsPage';
import { SettingsPage } from './admin/billing/SettingsPage';
import { CatalogPage } from './admin/catalog/CatalogPage';
import { CertificatesPage } from './admin/content/CertificatesPage';
import { SimulatorPage } from './admin/content/SimulatorPage';
import { GalleryPage } from './admin/media/GalleryPage';
import { IllustrationsPage } from './admin/media/IllustrationsPage';
import { NarrationPage } from './admin/media/NarrationPage';
import { DashboardPage } from './admin/overview/DashboardPage';
import { ChildReportPage } from './admin/reports/ChildReportPage';
import { ReportsPage } from './admin/reports/ReportsPage';
import { FamiliesPage } from './admin/users/FamiliesPage';
import { StaffPage } from './admin/users/StaffPage';
import { RequireRole } from './auth/RequireRole';
import { ChildLayout } from './components/ChildLayout';
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

/** Alamat lama /play/buku/:slug: Peta Belajar buku itu di beranda anak. */
function LegacyBookRedirect() {
  const { slug = '' } = useParams();
  return <Navigate to="/play" replace state={{ book: slug }} />;
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
            <Route path="buku/:slug" element={<LegacyBookRedirect />} />
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
            <Route index element={<DashboardPage />} />
            <Route path="konten" element={<CatalogPage />} />
            <Route path="soal" element={<SimulatorPage />} />
            <Route path="sertifikat" element={<CertificatesPage />} />
            <Route path="galeri" element={<GalleryPage />} />
            <Route path="narasi" element={<NarrationPage />} />
            <Route path="ilustrasi" element={<IllustrationsPage />} />
            <Route path="asisten" element={<Navigate to="/admin/ilustrasi" replace />} />
            <Route path="keluarga" element={<FamiliesPage />} />
            <Route path="pengguna" element={<Navigate to="/admin/keluarga" replace />} />
            <Route path="staf" element={<StaffPage />} />
            <Route path="laporan" element={<ReportsPage />} />
            <Route path="laporan/anak/:id" element={<ChildReportPage />} />
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
