import { useCallback } from 'react';
import { Link, useParams } from 'react-router-dom';
import { book } from '../api/catalog';
import { Plant } from '../components/Plant';
import { useAsync } from '../hooks/useAsync';
import { useT } from '../i18n';
import { ErrorState, LoadingState } from '../ui/states';

export function BookPage() {
  const t = useT('play');
  const { slug = '' } = useParams();
  const load = useCallback(() => book(slug), [slug]);
  const { data, error, loading, reload } = useAsync(load);

  if (loading) return <LoadingState />;
  if (error || !data) return <ErrorState onRetry={reload} />;

  return (
    <div className="uk-stack">
      <h1>{data.book.title}</h1>
      <div className="uk-grid">
        {data.topics.map((topic) => (
          <Link key={topic.id} className="uk-card uk-card--big" to={`/play/topik/${topic.id}`}>
            <Plant stage={topic.stage} size={88} />
            <h2>{topic.title}</h2>
            <p style={{ margin: 0 }}>
              {t('book.progress', { passed: topic.levelsPassed, total: topic.levelsTotal })}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
