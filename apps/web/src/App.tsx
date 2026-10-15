import { Route, Routes } from 'react-router-dom';
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
import { StaffLogin } from './staff/StaffLogin';
import { ChildLogin } from './play/ChildLogin';
import { LeaderboardPage } from './play/LeaderboardPage';
import { AddChild } from './parent/AddChild';
import { ChildPin } from './parent/ChildPin';
import { ChildReportPage } from './parent/ChildReportPage';
import { EditChild } from './parent/EditChild';
import { ParentHome } from './parent/ParentHome';
import { ParentLayout } from './parent/ParentLayout';
import { ParentLogin } from './parent/ParentLogin';
import { ParentRegister } from './parent/ParentRegister';
import { AccountPage } from './parent/AccountPage';
import { OrderPage } from './parent/OrderPage';
import { OrdersPage } from './parent/OrdersPage';
import { PackagesPage } from './parent/PackagesPage';
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
          <Route path="sertifikat/:bookSlug" element={<CertificatePage />} />
        </Route>
      </Route>

      <Route path="/orang-tua/daftar" element={<ParentRegister />} />
      <Route path="/orang-tua/masuk" element={<ParentLogin />} />
      <Route path="/orang-tua" element={<RequireRole role="parent" />}>
        <Route element={<ParentLayout />}>
          <Route index element={<ParentHome />} />
          <Route path="anak/baru" element={<AddChild />} />
          <Route path="anak/:id" element={<ChildReportPage />} />
          <Route path="anak/:id/ubah" element={<EditChild />} />
          <Route path="anak/:id/sandi" element={<ChildPin />} />
          <Route path="paket" element={<PackagesPage />} />
          <Route path="transaksi" element={<OrdersPage />} />
          <Route path="transaksi/:id" element={<OrderPage />} />
          <Route path="akun" element={<AccountPage />} />
        </Route>
      </Route>

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
  );
}
