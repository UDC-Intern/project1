import { shuffle } from '@udakids/engine';
import { useCallback } from 'react';
import { Link, useParams } from 'react-router-dom';
import { result } from '../api/practice';
import { ClockIcon, PlayIcon } from '../components/Icons';
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
    <main className="kid-screen">
      <section className={`result-card ${data.passed ? 'is-passed' : 'is-failed'}`}>
        <Momo mood={data.passed ? 'happy' : 'encourage'} size={120} />
        <h1 className="sr-only">{t('result.title')}</h1>
        <p className="result-score">{data.score}</p>
        <p className="result-summary">
          {t('result.summary', { correct: data.correct, total: TOTAL })}
        </p>
        <p className="result-time">
          <ClockIcon size={24} />
          {t('result.time', { time: formatDuration(data.durationMs) })}
        </p>
        <p className="result-message">{t(`praise.${group}.${praiseKey}`)}</p>

        <div className="result-plant">
          <Plant stage={data.plant.stageAfter} size={80} />
          <span>
            <strong>{data.plant.title}</strong>
            <br />
            {grew ? t('result.grew') : t('result.growing')}
          </span>
        </div>

        <div className="result-actions">
          {data.passed && next && next.status === 'open' && (
            <Link className="kid-btn big-play" to={`/play/latihan/${next.id}`}>
              <PlayIcon size={26} />
              {t('result.next')}
            </Link>
          )}
          {data.passed && next && next.status === 'premium' && (
            <p className="kid-note">{t('premium.ask')}</p>
          )}
          {!data.passed && (
            <Link className="kid-btn big-play" to={`/play/latihan/${data.levelId}`}>
              <PlayIcon size={26} />
              {t('result.retry')}
            </Link>
          )}
          <div className="result-more">
            <Link className="kid-link" to={`/play/topik/${topicId}`}>
              {t('result.back')}
            </Link>
            <Link className="kid-link" to="/play">
              {t('nav.learn')}
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
