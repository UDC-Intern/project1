import { useCallback } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { pendingCount } from '../api/billing';
import { useSession } from '../auth/store';
import { Momo } from '../components/Momo';
import { BILLING } from '../content/billing';
import { useAsync } from '../hooks/useAsync';
import { useT } from '../i18n';
import { AppShell, ShellIconSvg } from '../ui/AppShell';

export function ParentLayout() {
  const t = useT('parent');
  const signOut = useSession((s) => s.signOut);
  const name = useSession((s) => s.session?.name ?? '');
  const navigate = useNavigate();
  const { pathname } = useLocation();

  // Dimuat ulang tiap pindah halaman supaya lencana ikut berubah setelah pesanan dibuat atau dibayar.
  const load = useCallback(() => pendingCount().then((n) => ({ n, at: pathname })), [pathname]);
  const pending = useAsync(load).data?.n ?? 0;

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
        {
          to: '/orang-tua/transaksi',
          label: t('nav.orders'),
          icon: 'receipt',
          badge: pending,
          badgeLabel: `${t('nav.orders')}, ${t('badge.pending', { n: pending })}`,
        },
        { to: '/orang-tua/akun', label: t('nav.account'), icon: 'badge' },
      ]}
      extra={
        <Link to="/play/masuk" className="shell-play" title={t('nav.playNow')}>
          <ShellIconSvg name="play" />
          <span className="shell-label">
            <strong>{t('nav.playNow')}</strong>
            <small>{t('nav.playHint')}</small>
          </span>
        </Link>
      }
      floating={
        <a
          className="fab-wa"
          href={`https://wa.me/${BILLING.adminWhatsapp}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          <ShellIconSvg name="chat" />
          <span>{t('fab.contact')}</span>
        </a>
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
