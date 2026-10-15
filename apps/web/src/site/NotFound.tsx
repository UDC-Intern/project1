import { Link } from 'react-router-dom';
import { Momo } from '../components/Momo';
import { useT } from '../i18n';

export function NotFound() {
  const t = useT();
  return (
    <main className="kid-screen">
      <Momo mood="encourage" size={140} />
      <h1 style={{ fontFamily: 'var(--font-display)', margin: 0 }}>{t('notFound.title')}</h1>
      <p className="kid-note">{t('notFound.hint')}</p>
      <Link className="kid-btn" to="/">
        {t('notFound.home')}
      </Link>
    </main>
  );
}
