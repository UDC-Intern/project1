import { useCallback } from 'react';
import { Link } from 'react-router-dom';
import { home } from '../api/catalog';
import { useSession } from '../auth/store';
import { Momo } from '../components/Momo';
import { useAsync } from '../hooks/useAsync';
import { useT } from '../i18n';
import { ErrorState, LoadingState } from '../ui/states';

export function PlayHome() {
  const t = useT('play');
  const name = useSession((s) => s.session?.name ?? '');
  const load = useCallback(() => home(), []);
  const { data, error, loading, reload } = useAsync(load);

  if (loading) return <LoadingState />;
  if (error || !data) return <ErrorState onRetry={reload} />;

  return (
    <div className="uk-stack">
      <div className="uk-row">
        <Momo mood="happy" size={72} />
        <h1 style={{ margin: 0 }}>{t('home.hello', { name })}</h1>
      </div>

      {data.continue && (
        <Link className="uk-btn uk-btn--big" to={`/play/topik/${data.continue.topicId}`}>
          {t('home.continue')}: {data.continue.title}
        </Link>
      )}

      <div className="uk-grid">
        {data.books.map((b) => (
          <Link key={b.slug} className="uk-card uk-card--big" to={`/play/buku/${b.slug}`}>
            <h2>{b.title}</h2>
            <p style={{ margin: 0 }}>
              {t('home.topics', { started: b.topicsStarted, total: b.topicsTotal })}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
