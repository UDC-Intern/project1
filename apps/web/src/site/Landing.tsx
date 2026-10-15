import { Link } from 'react-router-dom';
import { Momo } from '../components/Momo';
import { APP_NAME } from '../config/app';
import { useT } from '../i18n';

/** Kerangka awal. Isi landing (10 besar, tombol masuk) dibuat di M5. */
export function Landing() {
  const t = useT('site');
  return (
    <main
      className="uk-empty"
      style={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}
    >
      <div>
        <Momo mood="happy" size={128} />
        <h1>{APP_NAME}</h1>
        <p style={{ fontSize: 'var(--uk-text-child)' }}>{t('landing.tagline')}</p>
        {import.meta.env.DEV && (
          <Link className="uk-btn uk-btn--ghost" to="/gaya">
            {t('style.title')}
          </Link>
        )}
      </div>
    </main>
  );
}
