import type { LevelStatus, TopicDetail } from '@udakids/engine';
import { useCallback } from 'react';
import { Link, useParams } from 'react-router-dom';
import { topic } from '../api/catalog';
import { CheckIcon, LockIcon } from '../components/Icons';
import { ListenButton } from '../components/ListenButton';
import { useAsync } from '../hooks/useAsync';
import { useT } from '../i18n';
import { ErrorState, LoadingState } from '../ui/states';

type Level = TopicDetail['levels'][number];

function LevelCard({ level }: { level: Level }) {
  const t = useT('play');
  const status: LevelStatus = level.status;
  const disabled = status === 'locked' || status === 'premium' || status === 'soon';

  return (
    <div
      className="uk-card uk-card--big uk-level"
      data-status={status}
      aria-disabled={disabled || undefined}
    >
      <strong>{t('level.title', { n: level.number, title: level.title })}</strong>
      {status === 'passed' && (
        <p className="uk-level-note">
          <CheckIcon /> {t('level.passed')}
          {level.bestScore !== null && ` · ${t('level.best', { score: level.bestScore })}`}
        </p>
      )}
      {status === 'locked' && (
        <p className="uk-level-note">
          <LockIcon /> {t('level.locked')}
        </p>
      )}
      {status === 'premium' && (
        <p className="uk-level-note">
          <LockIcon /> {t('premium.ask')}
        </p>
      )}
      {status === 'soon' && <p className="uk-level-note">{t('soon')}</p>}
      {(status === 'open' || status === 'passed') && (
        <Link className="uk-btn uk-btn--big" to={`/play/main/${level.id}`}>
          {t('level.play')}
        </Link>
      )}
    </div>
  );
}

export function TopicPage() {
  const t = useT('play');
  const { id = '' } = useParams();
  const load = useCallback(() => topic(id), [id]);
  const { data, error, loading, reload } = useAsync(load);

  if (loading) return <LoadingState />;
  if (error || !data) return <ErrorState onRetry={reload} />;

  return (
    <div className="uk-stack">
      <Link className="uk-btn uk-btn--big uk-btn--ghost" to={`/play/buku/${data.topic.bookSlug}`}>
        {t('topic.back')}
      </Link>
      <h1>{data.topic.title}</h1>
      <section className="uk-card">
        <p style={{ fontSize: 'var(--uk-text-child)', margin: '0 0 var(--uk-space-3)' }}>
          {data.topic.lesson}
        </p>
        <ListenButton />
      </section>
      <div className="uk-stack">
        {data.levels.map((level) => (
          <LevelCard key={level.id} level={level} />
        ))}
      </div>
    </div>
  );
}
