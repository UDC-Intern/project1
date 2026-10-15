import { useEffect, useRef, useState, type ReactNode } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useT } from '../i18n';
import { applyTheme, storedTheme, type Theme } from './theme';

/** Ikon menu: garis tebal 2 px di kotak 24, dibuat sendiri. */
const PATHS = {
  home: 'M4 11l8-7 8 7M6 10v10h12V10',
  plus: 'M12 5v14M5 12h14',
  tag: 'M3 12V4h8l10 10-8 8zM8 8h.01',
  user: 'M12 12a4 4 0 100-8 4 4 0 000 8zM4 21a8 8 0 0116 0',
  users:
    'M9 11a3.5 3.5 0 100-7 3.5 3.5 0 000 7zM2.5 20a6.5 6.5 0 0113 0M16 5a3 3 0 010 6M18 14.5a6 6 0 013.5 5.5',
  chart: 'M5 20V11M12 20V4M19 20v-6',
  book: 'M5 4h10a3 3 0 013 3v13H8a3 3 0 01-3-3zM8 20V6',
  grid: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
  spark: 'M12 3l2 6 6 2-6 2-2 6-2-6-6-2 6-2z',
  report: 'M6 3h9l4 4v14H6zM9 12h6M9 16h6',
  play: 'M8 5v14l11-7z',
  logout: 'M10 4H5v16h5M15 8l4 4-4 4M19 12H9',
  menu: 'M4 6h16M4 12h16M4 18h16',
  close: 'M6 6l12 12M18 6L6 18',
  collapse: 'M4 5h16v14H4zM9 5v14',
  wallet: 'M4 7h14a2 2 0 012 2v9a2 2 0 01-2 2H4zM4 7V6a2 2 0 012-2h10M16 13h4',
  receipt: 'M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6',
  badge: 'M12 12a4 4 0 100-8 4 4 0 000 8zM5 21c0-4 3-6 7-6s7 2 7 6z',
  moon: 'M20 14.5A8.5 8.5 0 019.5 4 8.5 8.5 0 1020 14.5z',
  sun: 'M12 16a4 4 0 100-8 4 4 0 000 8zM12 2v2M12 20v2M4 12H2M22 12h-2M5 5l1.5 1.5M17.5 17.5L19 19M5 19l1.5-1.5M17.5 6.5L19 5',
  chat: 'M4 5h16v11H9l-5 4z',
} as const;
export type ShellIcon = keyof typeof PATHS;

export function ShellIconSvg({ name, size = 22 }: { name: ShellIcon; size?: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={PATHS[name]} />
    </svg>
  );
}

export type ShellNavItem = {
  to: string;
  label: string;
  icon: ShellIcon;
  end?: boolean;
  /** Angka kecil di menu, mis. pesanan yang perlu tindakan. */
  badge?: number;
  badgeLabel?: string;
};
export type ShellNav = (ShellNavItem | { group: string })[];

const readCollapsed = (key: string) => {
  try {
    return localStorage.getItem(key) === '1';
  } catch {
    return false;
  }
};

/**
 * Kerangka area dewasa (orang tua dan admin). Layar lebar: sidebar penuh atau rel ikon (diingat per perangkat).
 * Ponsel dan tablet: laci dari kiri lewat tombol menu, ditutup dengan Esc, ketuk latar, atau memilih menu.
 */
export function AppShell({
  id,
  theme = 'light',
  brand,
  nav,
  navLabel,
  extra,
  floating,
  user,
  onLogout,
  children,
}: {
  id: string;
  theme?: 'light' | 'dark';
  brand: ReactNode;
  nav: ShellNav;
  navLabel: string;
  extra?: ReactNode;
  /** Elemen mengambang di pojok kanan bawah, mis. tombol hubungi admin. */
  floating?: ReactNode;
  user: { name: string; caption: string };
  onLogout: () => void;
  children: ReactNode;
}) {
  const t = useT('common');
  const storeKey = `udakids.sidebar.${id}`;
  const { pathname } = useLocation();
  const [collapsed, setCollapsed] = useState(() => readCollapsed(storeKey));
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Theme>(storedTheme);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);
  useEffect(() => applyTheme(mode, false), [mode]);

  const toggle = () => {
    const next = !collapsed;
    setCollapsed(next);
    try {
      localStorage.setItem(storeKey, next ? '1' : '0');
    } catch {
      /* diabaikan */
    }
  };
  const toggleTheme = () => {
    const next: Theme = mode === 'dark' ? 'light' : 'dark';
    setMode(next);
    applyTheme(next);
  };

  return (
    <div
      className={`shell shell-${theme}${collapsed ? ' is-collapsed' : ''}${open ? ' is-open' : ''}`}
    >
      <header className="shell-top">
        <button
          type="button"
          className="shell-iconbtn"
          aria-label={t('menu')}
          aria-expanded={open}
          aria-controls={`shell-side-${id}`}
          onClick={() => setOpen(true)}
        >
          <ShellIconSvg name="menu" />
        </button>
        <div className="shell-brand">{brand}</div>
      </header>

      {open && <div className="shell-backdrop" onClick={() => setOpen(false)} aria-hidden="true" />}

      <aside id={`shell-side-${id}`} className="shell-side" aria-label={navLabel}>
        <div className="shell-side-head">
          <div className="shell-brand">{brand}</div>
          <button
            ref={closeRef}
            type="button"
            className="shell-iconbtn shell-close"
            aria-label={t('close')}
            onClick={() => setOpen(false)}
          >
            <ShellIconSvg name="close" />
          </button>
        </div>

        <nav className="shell-nav" aria-label={navLabel}>
          {nav.map((item, i) =>
            'group' in item ? (
              <p key={`g-${i}`} className="shell-group">
                {item.group}
              </p>
            ) : (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className="shell-link"
                title={item.label}
                aria-label={
                  item.badge ? (item.badgeLabel ?? `${item.label}, ${item.badge}`) : undefined
                }
              >
                <ShellIconSvg name={item.icon} />
                <span className="shell-label">{item.label}</span>
                {item.badge ? (
                  <span className="shell-badge" aria-hidden="true">
                    {item.badge}
                  </span>
                ) : null}
              </NavLink>
            ),
          )}
        </nav>

        {extra}

        <div className="shell-user">
          <span className="shell-label">
            <small>{user.caption}</small>
            <strong>{user.name}</strong>
          </span>
          <div className="shell-tools">
            <button
              type="button"
              className="shell-iconbtn"
              aria-pressed={mode === 'dark'}
              aria-label={mode === 'dark' ? t('theme.light') : t('theme.dark')}
              title={mode === 'dark' ? t('theme.light') : t('theme.dark')}
              onClick={toggleTheme}
            >
              <ShellIconSvg name={mode === 'dark' ? 'sun' : 'moon'} />
            </button>
            <button
              type="button"
              className="shell-iconbtn"
              aria-label={t('logout')}
              title={t('logout')}
              onClick={onLogout}
            >
              <ShellIconSvg name="logout" />
            </button>
          </div>
        </div>

        <button
          type="button"
          className="shell-iconbtn shell-collapse"
          aria-pressed={collapsed}
          aria-label={collapsed ? t('sidebar.show') : t('sidebar.hide')}
          title={collapsed ? t('sidebar.show') : t('sidebar.hide')}
          onClick={toggle}
        >
          <ShellIconSvg name="collapse" />
        </button>
      </aside>

      <div className="shell-main">{children}</div>
      {floating}
    </div>
  );
}

/** Judul halaman dewasa dengan keterangan dan tempat aksi. */
export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="page-header">
      <div>
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {actions && <div className="page-header-actions">{actions}</div>}
    </header>
  );
}
