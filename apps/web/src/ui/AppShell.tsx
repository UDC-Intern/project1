import { useEffect, useRef, useState, type ReactNode } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { t } from '../i18n';
import './shell.css';

/** Ikon menu (SVG isi, 24×24) — tanpa emoji. */
const PATHS = {
  home: 'M4 11l8-7 8 7v9h-5v-6H9v6H4z',
  chart: 'M4 20V10h3v10zm6.5 0V4h3v16zM17 20v-7h3v7z',
  book: 'M5 4h9a3 3 0 013 3v13H8a3 3 0 01-3-3zm2 2v11a1 1 0 001 1h7V7a1 1 0 00-1-1z',
  grid: 'M4 4h7v7H4zm9 0h7v7h-7zM4 13h7v7H4zm9 0h7v7h-7z',
  map: 'M9 4l6 2 5-2v16l-5 2-6-2-5 2V6zm1 2.4v11.2l4 1.3V7.7z',
  badge: 'M12 3a4 4 0 110 8 4 4 0 010-8zm-7 17c0-3.9 3.1-6 7-6s7 2.1 7 6z',
  users:
    'M9 4a3.5 3.5 0 110 7 3.5 3.5 0 010-7zm7.5 1.5a2.8 2.8 0 110 5.6 2.8 2.8 0 010-5.6zM2.5 20c0-3.6 3-5.5 6.5-5.5s6.5 1.9 6.5 5.5zm14 0c0-1.9-.7-3.4-1.9-4.4 3 .1 5.9 1.4 5.9 4.4z',
  school: 'M3 4h18v12H3zm2 2v8h14V6zm2 13l3-3h4l3 3z',
  report: 'M6 3h9l4 4v14H6zm2 9v6h2v-6zm4-3v9h2V9zm4 5v4h2v-4z',
  image: 'M4 5h16v14H4zm2 2v8l4-4 3 3 2-2 3 3V7zm9 1.5a1.5 1.5 0 110 3 1.5 1.5 0 010-3z',
  speaker: 'M4 9h4l5-4v14l-5-4H4zm12 .2a4 4 0 010 5.6l-1.4-1.4a2 2 0 000-2.8z',
  mail: 'M3 5h18v14H3zm2 2v.6l7 4.6 7-4.6V7zm0 3v7h14v-7l-7 4.6z',
  receipt: 'M6 3h12v18l-3-2-3 2-3-2-3 2zm3 5v2h6V8zm0 4v2h6v-2z',
  tag: 'M3 12V4h8l10 10-8 8zm4-6a1.5 1.5 0 100 3 1.5 1.5 0 000-3z',
  bank: 'M12 3l9 5v2H3V8zM5 11h2v7H5zm4 0h2v7H9zm4 0h2v7h-2zm4 0h2v7h-2zM3 19h18v2H3z',
  gear: 'M10.5 2h3l.5 2.6 2 .9 2.2-1.5 2.1 2.1-1.5 2.2.9 2 2.6.5v3l-2.6.5-.9 2 1.5 2.2-2.1 2.1-2.2-1.5-2 .9-.5 2.6h-3l-.5-2.6-2-.9-2.2 1.5-2.1-2.1 1.5-2.2-.9-2L2 13.5v-3l2.6-.5.9-2L4 5.8l2.1-2.1 2.2 1.5 2-.9zM12 9a3 3 0 100 6 3 3 0 000-6z',
  wallet: 'M4 6h14a2 2 0 012 2v10a2 2 0 01-2 2H4zm11 6v3h5v-3zM4 4h12v2H4z',
  percent:
    'M17.6 4.9l1.5 1.5L6.4 19.1l-1.5-1.5zM7 4a3 3 0 110 6 3 3 0 010-6zm10 10a3 3 0 110 6 3 3 0 010-6z',
  plus: 'M11 5h2v6h6v2h-6v6h-2v-6H5v-2h6z',
  flag: 'M5 21V4h11l-2 4 2 4H7v9z',
  trophy:
    'M7 3h10v2h3v3a4 4 0 01-4 4h-.4A5 5 0 0113 14.9V17h3v3H8v-3h3v-2.1A5 5 0 018.4 12H8a4 4 0 01-4-4V5h3zm0 4H6v1a2 2 0 001 1.7zm10 0v2.7A2 2 0 0018 8V7z',
  search:
    'M10 3a7 7 0 015.6 11.2l4.6 4.6-1.4 1.4-4.6-4.6A7 7 0 1110 3zm0 2a5 5 0 100 10 5 5 0 000-10z',
  play: 'M8 5v14l11-7z',
  logout: 'M10 4H5v16h5v-2H7V6h3zm5 3l-1.4 1.4 2.6 2.6H9v2h7.2l-2.6 2.6L15 17l5-5z',
  menu: 'M4 6h16v2H4zm0 5h16v2H4zm0 5h16v2H4z',
  close:
    'M6.4 5L12 10.6 17.6 5 19 6.4 13.4 12l5.6 5.6-1.4 1.4-5.6-5.6L6.4 19 5 17.6 10.6 12 5 6.4z',
  collapse:
    'M4 4h16a1 1 0 011 1v14a1 1 0 01-1 1H4a1 1 0 01-1-1V5a1 1 0 011-1zm1 2v12h4V6zm6 0v12h8V6zm4.6 3.4L14.2 11h3.3v2h-3.3l1.4 1.6-1.4 1.4-3.6-4 3.6-4z',
  expand:
    'M4 4h16a1 1 0 011 1v14a1 1 0 01-1 1H4a1 1 0 01-1-1V5a1 1 0 011-1zm1 2v12h4V6zm6 0v12h8V6zm2.4 2l3.6 4-3.6 4-1.4-1.4 1.4-1.6H11v-2h3.4L13 9.4z',
} as const;
export type ShellIcon = keyof typeof PATHS;

export function ShellIconSvg({ name, size = 22 }: { name: ShellIcon; size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" aria-hidden>
      <path d={PATHS[name]} />
    </svg>
  );
}

export type ShellNavItem = {
  to: string;
  label: string;
  icon: ShellIcon;
  end?: boolean;
  /** Angka kecil di menu (mis. pesanan menunggu). */
  badge?: number;
  /** Label lengkap untuk pembaca layar bila ada badge. */
  badgeLabel?: string;
};
export type ShellNav = (ShellNavItem | { group: string })[];

const DESKTOP = '(min-width: 900px)';
const readCollapsed = (key: string) => {
  try {
    return localStorage.getItem(key) === '1';
  } catch {
    return false;
  }
};

/**
 * Kerangka area dewasa (orang tua, admin, guru): sidebar yang bisa disembunyikan/ditampilkan.
 * - Layar lebar: sidebar penuh ↔ rel ikon (pilihan diingat per perangkat).
 * - Tablet/HP: laci dari kiri lewat tombol menu; tutup dengan Esc, ketuk latar, atau memilih menu.
 */
export function AppShell({
  id,
  theme = 'light',
  brand,
  nav,
  navLabel,
  extra,
  topbar,
  user,
  onLogout,
  children,
}: {
  /** Kunci unik area, mis. "parent" — dipakai untuk mengingat pilihan sembunyikan. */
  id: string;
  theme?: 'light' | 'dark';
  brand: ReactNode;
  nav: ShellNav;
  navLabel: string;
  /** Konten tambahan di bawah menu (mis. tombol "Anak main sekarang"). */
  extra?: ReactNode;
  /** Aksi di kanan atas konten (mis. lonceng notifikasi admin). */
  topbar?: ReactNode;
  user: { name: string; caption: string };
  onLogout: () => void;
  children: ReactNode;
}) {
  const storeKey = `lc.sidebar.${id}`;
  const { pathname } = useLocation();
  const [collapsed, setCollapsed] = useState(() => readCollapsed(storeKey));
  const [open, setOpen] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  const sideId = `shell-side-${id}`;

  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('keydown', onKey);
    document.body.classList.add('shell-no-scroll');
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.classList.remove('shell-no-scroll');
    };
  }, [open]);

  const toggleCollapsed = () => {
    const next = !collapsed;
    setCollapsed(next);
    try {
      localStorage.setItem(storeKey, next ? '1' : '0');
    } catch {
      /* abaikan */
    }
  };
  // Di layar kecil laci selalu tampil penuh walau mode rel aktif di desktop.
  const isDesktop =
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia(DESKTOP).matches
      : true;
  const rail = collapsed && !open;

  return (
    <div
      className={`ui-shell shell shell-${theme}${rail ? ' is-rail' : ''}${open ? ' is-open' : ''}`}
    >
      <header className="shell-mobilebar">
        <button
          type="button"
          className="shell-iconbtn"
          aria-expanded={open}
          aria-controls={sideId}
          aria-label={t('common.shell.open')}
          onClick={() => setOpen(true)}
        >
          <ShellIconSvg name="menu" />
        </button>
        <div className="shell-brand">{brand}</div>
      </header>

      <div className="shell-backdrop" hidden={!open} onClick={() => setOpen(false)} />

      <aside id={sideId} className="shell-side" aria-label={navLabel}>
        <div className="shell-side-head">
          <div className="shell-brand">{brand}</div>
          <button
            ref={closeRef}
            type="button"
            className="shell-iconbtn shell-close"
            aria-label={t('common.shell.close')}
            onClick={() => setOpen(false)}
          >
            <ShellIconSvg name="close" />
          </button>
          <button
            type="button"
            className="shell-iconbtn shell-collapse"
            aria-controls={sideId}
            aria-expanded={!collapsed}
            aria-label={collapsed ? t('common.shell.expand') : t('common.shell.collapse')}
            title={collapsed ? t('common.shell.expand') : t('common.shell.collapse')}
            onClick={toggleCollapsed}
          >
            <ShellIconSvg name={collapsed ? 'expand' : 'collapse'} />
          </button>
        </div>

        <nav className="shell-nav">
          {nav.map((n) =>
            'group' in n ? (
              <div key={n.group} className="shell-group">
                <span>{n.group}</span>
              </div>
            ) : (
              <NavLink
                key={n.to}
                to={n.to}
                end={n.end}
                title={rail && isDesktop ? n.label : undefined}
                aria-label={n.badge ? (n.badgeLabel ?? `${n.label}, ${n.badge}`) : undefined}
              >
                <ShellIconSvg name={n.icon} />
                <span className="shell-label">{n.label}</span>
                {!!n.badge && (
                  <span className="shell-badge" aria-hidden>
                    {n.badge}
                  </span>
                )}
              </NavLink>
            ),
          )}
        </nav>

        {extra && <div className="shell-extra">{extra}</div>}

        <div className="shell-foot">
          <span className="shell-user shell-label">
            <small>{user.caption}</small>
            <strong>{user.name}</strong>
          </span>
          <button
            type="button"
            className="shell-logout"
            onClick={onLogout}
            title={rail ? t('common.shell.logout') : undefined}
          >
            <ShellIconSvg name="logout" />
            <span className="shell-label">{t('common.shell.logout')}</span>
          </button>
        </div>
      </aside>

      <main className="ui-main shell-main">
        {topbar && <div className="shell-topbar">{topbar}</div>}
        {children}
      </main>
    </div>
  );
}
