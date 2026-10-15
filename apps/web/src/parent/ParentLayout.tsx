import { Link, Outlet, useNavigate } from 'react-router-dom';
import { useSession } from '../auth/store';
import { Momo } from '../components/Momo';
import { useT } from '../i18n';
import { AppShell, ShellIconSvg } from '../ui/AppShell';

export function ParentLayout() {
  const t = useT('parent');
  const signOut = useSession((s) => s.signOut);
  const name = useSession((s) => s.session?.name ?? '');
  const navigate = useNavigate();
  return (
    <AppShell
      id="parent"
      brand={
        <Link to="/orang-tua">
          <Momo mood="happy" size={36} />
          <span>{t('brand')}</span>
        </Link>
      }
      navLabel={t('nav.label')}
      nav={[
        { to: '/orang-tua', label: t('nav.home'), icon: 'home', end: true },
        { to: '/orang-tua/anak/baru', label: t('nav.add'), icon: 'plus' },
        { to: '/orang-tua/paket', label: t('nav.plan'), icon: 'tag' },
      ]}
      extra={
        <Link to="/play/masuk" className="shell-link shell-play" title={t('nav.playNow')}>
          <ShellIconSvg name="play" />
          <span className="shell-label">{t('nav.playNow')}</span>
        </Link>
      }
      user={{ name, caption: t('signedIn') }}
      onLogout={() => {
        signOut();
        navigate('/orang-tua/masuk');
      }}
    >
      <Outlet />
    </AppShell>
  );
}
