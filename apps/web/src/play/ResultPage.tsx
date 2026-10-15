import { shuffle } from '@udakids/engine';
import { useCallback } from 'react';
import { Link, useParams } from 'react-router-dom';
import { result } from '../api/practice';
import { Momo } from '../components/Momo';
import { Plant } from '../components/Plant';
import { useAsync } from '../hooks/useAsync';
import { useT } from '../i18n';
import { formatDuration } from '../lib/format';
import { ErrorState, LoadingState } from '../ui/states';

const TOTAL = 10;

export function ResultPage() {
  const t = useT('play');
  const { roundId = '' } = useParams();
  const load = useCallback(() => result(roundId), [roundId]);
  const { data, error, loading, reload } = useAsync(load);

  if (loading) return <LoadingState />;
  if (error || !data) return <ErrorState onRetry={reload} />;

  const group = data.score >= 100 ? 'high' : data.score >= 70 ? 'mid' : 'low';
  const praiseKey = shuffle(['1', '2', '3', '4'], data.roundId)[0]!;
  const topicId = data.levelId.split(':').slice(0, 2).join(':');
  const grew = data.plant.stageAfter > data.plant.stageBefore;
  const next = data.nextLevel;

  return (
    <div className="uk-stack">
      <div className="uk-row">
        <Momo mood={data.passed ? 'happy' : 'encourage'} size={96} />
        <div>
          <h1 style={{ margin: 0 }}>{t('result.title')}</h1>
          <p className="uk-score">{data.score}</p>
        </div>
      </div>

      <section className="uk-card uk-card--big">
        <p style={{ margin: 0 }}>{t('result.correct', { correct: data.correct, total: TOTAL })}</p>
        <p style={{ margin: 0 }}>{t('result.time', { time: formatDuration(data.durationMs) })}</p>
        <p style={{ margin: 'var(--uk-space-3) 0 0' }}>
          <strong>{t(`praise.${group}.${praiseKey}`)}</strong>
        </p>
      </section>

      <section className="uk-card uk-row">
        <Plant stage={data.plant.stageAfter} size={96} />
        <div>
          <strong>{data.plant.title}</strong>
          <p style={{ margin: 0 }}>{grew ? t('result.grew') : t('result.growing')}</p>
        </div>
      </section>

      <div className="uk-row">
        {data.passed && next && next.status === 'open' && (
          <Link className="uk-btn uk-btn--big" to={`/play/main/${next.id}`}>
            {t('result.next')}
          </Link>
        )}
        {data.passed && next && next.status === 'premium' && (
          <p style={{ margin: 0 }}>{t('premium.ask')}</p>
        )}
        {!data.passed && (
          <Link className="uk-btn uk-btn--big" to={`/play/main/${data.levelId}`}>
            {t('result.retry')}
          </Link>
        )}
        <Link className="uk-btn uk-btn--big uk-btn--ghost" to={`/play/topik/${topicId}`}>
          {t('result.back')}
        </Link>
      </div>
    </div>
  );
}
