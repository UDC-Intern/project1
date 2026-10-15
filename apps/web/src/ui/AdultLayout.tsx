import { useState, type ReactNode } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { MenuIcon } from '../components/Icons';
import { useT } from '../i18n';

export type NavItem = { to: string; label: string; end?: boolean };

/** Sidebar kiri dan konten kanan. Di ponsel sidebar menjadi menu yang dibuka lewat tombol. */
export function AdultLayout({
  title,
  items,
  variant = 'parent',
  footer,
}: {
  title: string;
  items: NavItem[];
  variant?: 'parent' | 'admin';
  footer?: ReactNode;
}) {
  const t = useT('common');
  const [open, setOpen] = useState(false);
  return (
    <div className="uk-adult-layout">
      <aside
        className={`uk-sidebar${variant === 'admin' ? ' uk-sidebar--admin' : ''}`}
        data-open={open}
      >
        <strong style={{ padding: 'var(--space-2) var(--space-3)' }}>{title}</strong>
        {items.map((item) => (
          <NavLink key={item.to} to={item.to} end={item.end} onClick={() => setOpen(false)}>
            {item.label}
          </NavLink>
        ))}
        {footer}
      </aside>
      <div>
        <button
          type="button"
          className="uk-btn uk-btn--ghost uk-menu-toggle"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
        >
          <MenuIcon />
          {t('menu')}
        </button>
        <main className="uk-adult-main">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
