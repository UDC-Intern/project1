import type { ParentCertificates } from '@udakids/engine';
import { useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { report } from '../api/parent';
import { useFetch } from '../auth/useApi';
import { Momo } from '../components/Momo';
import { Plant } from '../components/Plant';
import { useAsync } from '../hooks/useAsync';
import { t as tt, useT } from '../i18n';
import { formatDateTime, formatDuration } from '../lib/format';
import { ErrorState, LoadingState } from '../ui/states';
import { CertificateBooks } from './Certificates';

export function ChildReportPage() {
  const t = useT('parent');
  const { id = '' } = useParams();
  const load = useCallback(() => report(id), [id]);
  const { data, error, loading, reload } = useAsync(load);
  const certs = useFetch<ParentCertificates>('parent', '/parent/certificates');
  const certChild = certs.data?.children.find((c) => c.id === id);

  if (loading) return <LoadingState />;
  if (error || !data) return <ErrorState onRetry={reload} />;

  return (
    <div className="uk-stack">
      <div className="uk-row">
        <Momo color={data.child.momoColor} size={64} />
        <h1 style={{ margin: 0 }}>{t('report.title', { nickname: data.child.nickname })}</h1>
      </div>

      <div className="uk-stats">
        <div className="uk-stat">
          <strong>{data.weekAccuracy === null ? '-' : `${data.weekAccuracy}%`}</strong>
          {data.weekAccuracy === null ? t('report.noAccuracy') : t('report.accuracy')}
        </div>
      </div>

      <section className="uk-stack">
        <h2>{t('report.topics')}</h2>
        <div className="uk-table-wrap">
          <table className="uk-table">
            <thead>
              <tr>
                <th scope="col">{t('report.topic')}</th>
                <th scope="col">{t('report.book')}</th>
                <th scope="col">{t('report.score')}</th>
                <th scope="col">{t('report.status')}</th>
                <th scope="col">
                  <span className="sr-only" style={{ position: 'absolute', left: -9999 }}>
                    Tanaman
                  </span>
                </th>
              </tr>
            </thead>
            <tbody>
              {data.topics.map((topic) => (
                <tr key={topic.topicId}>
                  <td>{topic.title}</td>
                  <td>{topic.bookTitle}</td>
                  <td>{topic.mastery}</td>
                  <td>
                    <span className="uk-badge">{t(`status.${topic.status}`)}</span>
                  </td>
                  <td>
                    <Plant stage={topic.stage} size={32} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="uk-stack">
        <h2>{t('report.recent')}</h2>
        {data.recentRounds.length === 0 ? (
          <p>{t('report.noRecent')}</p>
        ) : (
          <div className="uk-table-wrap">
            <table className="uk-table">
              <tbody>
                {data.recentRounds.map((r) => (
                  <tr key={r.roundId}>
                    <td>{r.levelTitle}</td>
                    <td>{r.score}</td>
                    <td>{r.passed ? t('report.passed') : t('report.retry')}</td>
                    <td>{formatDuration(r.durationMs)}</td>
                    <td>{formatDateTime(r.finishedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {certChild && (
        <section className="uk-stack">
          <h2>{tt('parent.cert.title')}</h2>
          <CertificateBooks child={certChild} />
        </section>
      )}

      <section className="uk-stack">
        <h2>{t('report.suggestions')}</h2>
        {data.suggestions.length === 0 ? (
          <p>{t('report.noSuggestions')}</p>
        ) : (
          <ul>
            {data.suggestions.map((s) => (
              <li key={s.topicId}>{s.title}</li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
