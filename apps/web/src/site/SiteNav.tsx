import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Momo } from '../components/Momo';
import { APP_NAME } from '../config/app';
import { useT } from '../i18n';

/** Navigasi atas situs publik: tautan bagian, lalu dua pintu masuk. Di ponsel menjadi menu tombol. */
export function SiteNav() {
  const t = useT('site');
  const [open, setOpen] = useState(false);
  const onHome = useLocation().pathname === '/';
  const base = onHome ? '' : '/';
  return (
    <header className="site-nav">
      <Link to="/" className="site-brand" aria-label={APP_NAME}>
        <Momo mood="happy" size={40} />
        <span>{APP_NAME}</span>
      </Link>
      <button
        type="button"
        className="site-burger"
        aria-expanded={open}
        aria-controls="site-menu"
        onClick={() => setOpen((o) => !o)}
      >
        <span className="sr-only">{t('nav.menu')}</span>
        <svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true">
          <path
            d={open ? 'M5 5l14 14M19 5L5 19' : 'M4 7h16M4 12h16M4 17h16'}
            stroke="currentColor"
            strokeWidth="2.6"
            strokeLinecap="round"
          />
        </svg>
      </button>
      <nav
        id="site-menu"
        className={`site-menu${open ? ' is-open' : ''}`}
        aria-label={APP_NAME}
        onClick={() => setOpen(false)}
      >
        <a href={`${base}#tentang`}>{t('nav.about')}</a>
        <a href={`${base}#buku`}>{t('nav.books')}</a>
        <a href={`${base}#kurikulum`}>{t('nav.subjects')}</a>
        <a href={`${base}#fitur-baru`}>{t('nav.news')}</a>
        <a href={`${base}#cara`}>{t('nav.how')}</a>
        <a href={`${base}#pintu`}>{t('nav.doors')}</a>
        <a href={`${base}#harga`}>{t('nav.price')}</a>
        <a href={`${base}#aman`}>{t('nav.safe')}</a>
        <Link to="/orang-tua/masuk" className="site-btn ghost">
          {t('nav.parent')}
        </Link>
        <Link to="/play/masuk" className="site-btn">
          {t('nav.child')}
        </Link>
      </nav>
    </header>
  );
}
