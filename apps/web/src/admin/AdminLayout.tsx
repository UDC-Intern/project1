import { useEffect, useRef } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useSession as useStaffSession } from '../auth/session';
import { useSession } from '../auth/store';
import { useFetch } from '../auth/useApi';
import { t, type MessageKey } from '../i18n';
import { AppShell, type ShellIcon } from '../ui/AppShell';
import { ORDERS_CHANGED } from './common';
import { NotificationBell } from './notifications/NotificationBell';
import './admin.css';

type NavItem = { to: string; label: MessageKey; icon: ShellIcon; end?: boolean; badge?: 'orders' };
const NAV: (NavItem | { group: MessageKey })[] = [
  { to: '/admin', label: 'admin.nav.overview', icon: 'chart', end: true },
  { group: 'admin.nav.groupContent' },
  { to: '/admin/konten', label: 'admin.nav.catalog', icon: 'book' },
  { to: '/admin/soal', label: 'admin.nav.preview', icon: 'grid' },
  { to: '/admin/asisten', label: 'admin.nav.assistant', icon: 'gear' },
  { group: 'admin.nav.groupPeople' },
  { to: '/admin/keluarga', label: 'admin.nav.families', icon: 'users' },
  { to: '/admin/staf', label: 'admin.nav.staff', icon: 'badge' },
  { to: '/admin/laporan', label: 'admin.nav.reports', icon: 'report' },
  { to: '/admin/sertifikat', label: 'admin.nav.certificates', icon: 'award' },
  { group: 'admin.nav.groupBilling' },
  { to: '/admin/transaksi', label: 'admin.nav.orders', icon: 'receipt', badge: 'orders' },
  { to: '/admin/paket', label: 'admin.nav.packages', icon: 'tag' },
  { to: '/admin/rekening', label: 'admin.nav.paymentMethods', icon: 'bank' },
  { to: '/admin/pengaturan', label: 'admin.nav.settings', icon: 'gear' },
];

/** Jumlah transfer yang menunggu verifikasi (lencana menu Transaksi). */
function usePendingOrders() {
  const pending = useFetch<{ count: number }>('staff', '/admin/orders/pending-count');
  const { pathname } = useLocation();
  const { reload } = pending;
  const first = useRef(true);
  // Muat ulang saat pindah halaman (bukan saat pertama tampil) dan setelah pesanan disetujui atau ditolak.
  useEffect(() => {
    if (first.current) first.current = false;
    else reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);
  useEffect(() => {
    window.addEventListener(ORDERS_CHANGED, reload);
    return () => window.removeEventListener(ORDERS_CHANGED, reload);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return pending.error ? 0 : (pending.data?.count ?? 0);
}

export function AdminLayout() {
  const signOut = useSession((s) => s.signOut);
  const staff = useStaffSession('staff');
  const navigate = useNavigate();
  const pending = usePendingOrders();
  return (
    <AppShell
      id="admin"
      theme="dark"
      brand={<span>{t('admin.brand')}</span>}
      navLabel={t('admin.nav.label')}
      nav={NAV.map((n) =>
        'group' in n
          ? { group: t(n.group) }
          : {
              to: n.to,
              label: t(n.label),
              icon: n.icon,
              end: n.end,
              ...(n.badge === 'orders' && {
                badge: pending,
                badgeLabel: `${t(n.label)}, ${t('admin.nav.pendingOrders', { n: pending })}`,
              }),
            },
      )}
      topbar={staff && <NotificationBell userId={staff.user.id} />}
      user={{ name: staff?.user.name ?? '—', caption: t('admin.topbar.signedInAs') }}
      onLogout={() => {
        signOut();
        navigate('/masuk/staf');
      }}
    >
      <Outlet />
    </AppShell>
  );
}
