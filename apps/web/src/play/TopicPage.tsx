import type { TopicDetail } from '@udakids/engine';
import { useCallback } from 'react';
import { Link, useParams } from 'react-router-dom';
import { topic } from '../api/catalog';
import { CheckIcon, LockIcon, PlayIcon } from '../components/Icons';
import { ListenButton } from '../components/ListenButton';
import { Momo } from '../components/Momo';
import { PageHead } from '../components/PageHead';
import { useAsync } from '../hooks/useAsync';
import { useT } from '../i18n';
import { ErrorState, LoadingState } from '../ui/states';

type Level = TopicDetail['levels'][number];

function LevelCard({ level, isNext }: { level: Level; isNext: boolean }) {
  const t = useT('play');
  const label = `${t('level.word', { n: level.number })}: ${level.title}`;
  const body = (
    <>
      <span className="level-num">{level.number}</span>
      <span className="level-title">{level.title}</span>
      <span className="level-status">
        {level.status === 'passed' && (
          <>
            <CheckIcon size={20} /> {t('level.passed')}
            {level.bestScore !== null && ` · ${level.bestScore}`}
          </>
        )}
        {level.status === 'locked' && (
          <>
            <LockIcon size={20} /> {t('level.locked')}
          </>
        )}
        {level.status === 'premium' && (
          <>
            <LockIcon size={20} /> {t('premium.ask')}
          </>
        )}
        {level.status === 'soon' && t('soon')}
        {level.status === 'open' &&
          (level.bestScore !== null
            ? t('level.best', { score: level.bestScore })
            : isNext
              ? t('level.now')
              : null)}
      </span>
    </>
  );

  if (level.status === 'open' || level.status === 'passed') {
    return (
      <Link
        to={`/play/main/${level.id}`}
        className={`level-card is-${level.status}${isNext ? ' is-next' : ''}`}
        aria-label={label}
      >
        {body}
      </Link>
    );
  }
  return (
    <div className="level-card is-locked" aria-disabled="true" aria-label={label}>
      {body}
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

  const open = data.levels.find((l) => l.status === 'open');
  const bookSlug = data.topic.bookSlug;

  return (
    <main
      className="library topic-page"
      data-mapel={bookSlug.startsWith('sains') ? 'sains' : 'matematika'}
    >
      <PageHead title={data.topic.title} back={`/play/buku/${bookSlug}`} />

      <section className="lesson" aria-labelledby="lesson-title">
        <div className="lesson-head">
          <Momo mood="happy" size={72} />
          <h2 id="lesson-title">{t('topic.lesson')}</h2>
          <ListenButton />
        </div>
        <p className="lesson-intro">{data.topic.lesson}</p>
      </section>

      <section aria-labelledby="levels-title">
        <div className="levels-head">
          <h2 id="levels-title">{t('topic.levels')}</h2>
          <p className="levels-rule">{t('topic.rule', { total: 10, pass: 70 })}</p>
        </div>
        <ol className="level-path">
          {data.levels.map((level) => (
            <li key={level.id}>
              <LevelCard level={level} isNext={level === open} />
            </li>
          ))}
        </ol>
      </section>

      <div className="topic-cta">
        {open ? (
          <Link className="kid-btn big-play" to={`/play/main/${open.id}`}>
            <PlayIcon size={26} />
            {t('topic.start', { n: open.number })}
          </Link>
        ) : (
          <Link className="kid-btn secondary" to="/play">
            {t('back')}
          </Link>
        )}
      </div>
    </main>
  );
}
