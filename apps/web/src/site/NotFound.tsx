import { Link } from 'react-router-dom';
import { Momo } from '../components/Momo';
import { useT } from '../i18n';

export function NotFound() {
  const t = useT();
  return (
    <main
      className="uk-empty"
      style={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}
    >
      <div>
        <Momo mood="encourage" size={128} />
        <h1>{t('notFound.title')}</h1>
        <p style={{ fontSize: 'var(--uk-text-child)' }}>{t('notFound.hint')}</p>
        <Link className="uk-btn uk-btn--big" to="/">
          {t('notFound.home')}
        </Link>
      </div>
    </main>
  );
}
