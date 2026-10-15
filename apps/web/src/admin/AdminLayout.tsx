import { Outlet, useNavigate } from 'react-router-dom';
import { useSession } from '../auth/store';
import { useT } from '../i18n';
import { AppShell } from '../ui/AppShell';

export function AdminLayout() {
  const t = useT('admin');
  const signOut = useSession((s) => s.signOut);
  const name = useSession((s) => s.session?.name ?? '');
  const navigate = useNavigate();
  return (
    <AppShell
      id="admin"
      theme="dark"
      brand={<span>{t('brand')}</span>}
      navLabel={t('nav.label')}
      nav={[
        { to: '/admin', label: t('nav.overview'), icon: 'chart', end: true },
        { group: t('group.content') },
        { to: '/admin/konten', label: t('nav.content'), icon: 'book' },
        { to: '/admin/soal', label: t('nav.preview'), icon: 'grid' },
        { to: '/admin/asisten', label: t('nav.assistant'), icon: 'spark' },
        { group: t('group.people') },
        { to: '/admin/pengguna', label: t('nav.users'), icon: 'users' },
        { to: '/admin/laporan', label: t('nav.reports'), icon: 'report' },
      ]}
      user={{ name, caption: t('signedIn') }}
      onLogout={() => {
        signOut();
        navigate('/masuk/staf');
      }}
    >
      <Outlet />
    </AppShell>
  );
}
