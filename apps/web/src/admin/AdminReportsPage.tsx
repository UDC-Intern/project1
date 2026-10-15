import { useCallback, useState } from 'react';
import { childReport, levelStats, users } from '../api/admin';
import { useAsync } from '../hooks/useAsync';
import { useT } from '../i18n';
import { formatDateTime, formatDuration } from '../lib/format';
import { ErrorState, LoadingState } from '../ui/states';

function ChildReportView({ childId }: { childId: string }) {
  const t = useT('admin');
  const load = useCallback(() => childReport(childId), [childId]);
  const { data, error, loading, reload } = useAsync(load);
  if (loading) return <LoadingState />;
  if (error || !data) return <ErrorState onRetry={reload} />;
  return (
    <div className="uk-stack">
      <h3>{data.child.nickname}</h3>
      <p style={{ margin: 0 }}>
        {t('reports.accuracy')}:{' '}
        {data.weekAccuracy === null ? t('reports.noAccuracy') : `${data.weekAccuracy}%`}
      </p>
      <div className="uk-table-wrap">
        <table className="uk-table">
          <caption style={{ textAlign: 'left' }}>{t('reports.topics')}</caption>
          <tbody>
            {data.topics.map((topic) => (
              <tr key={topic.topicId}>
                <td>{topic.title}</td>
                <td>{topic.mastery}</td>
                <td>
                  <span className="uk-badge">{t(`status.${topic.status}`)}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {data.recentRounds.length > 0 && (
        <div className="uk-table-wrap">
          <table className="uk-table">
            <caption style={{ textAlign: 'left' }}>{t('reports.recent')}</caption>
            <tbody>
              {data.recentRounds.map((r) => (
                <tr key={r.roundId}>
                  <td>{r.levelTitle}</td>
                  <td>{r.score}</td>
                  <td>{formatDuration(r.durationMs)}</td>
                  <td>{formatDateTime(r.finishedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export function AdminReportsPage() {
  const t = useT('admin');
  const loadStats = useCallback(() => levelStats(), []);
  const loadUsers = useCallback(() => users(''), []);
  const stats = useAsync(loadStats);
  const people = useAsync(loadUsers);
  const [childId, setChildId] = useState('');

  const children = people.data?.parents.flatMap((p) => p.children) ?? [];

  return (
    <div className="uk-stack">
      <h1>{t('reports.title')}</h1>

      <section className="uk-stack">
        <h2>{t('reports.levels')}</h2>
        {stats.loading ? (
          <LoadingState />
        ) : !stats.data || stats.data.levels.length === 0 ? (
          <p>{t('reports.noLevels')}</p>
        ) : (
          <div className="uk-table-wrap">
            <table className="uk-table">
              <thead>
                <tr>
                  <th scope="col">{t('reports.level')}</th>
                  <th scope="col">{t('reports.topic')}</th>
                  <th scope="col">{t('reports.rounds')}</th>
                  <th scope="col">{t('reports.passRate')}</th>
                  <th scope="col">{t('reports.avg')}</th>
                </tr>
              </thead>
              <tbody>
                {stats.data.levels.map((l) => (
                  <tr key={l.levelId}>
                    <td>{l.levelTitle}</td>
                    <td>{l.topicTitle}</td>
                    <td>{l.rounds}</td>
                    <td>{l.passRate}%</td>
                    <td>{l.avgScore}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="uk-stack">
        <h2>{t('reports.child')}</h2>
        <label className="uk-field" style={{ maxWidth: 320 }}>
          {t('reports.pick')}
          <select
            value={childId}
            onChange={(e) => setChildId(e.target.value)}
            style={{ minHeight: 44, font: 'inherit' }}
          >
            <option value="" />
            {children.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nickname}
              </option>
            ))}
          </select>
        </label>
        {childId && <ChildReportView childId={childId} />}
      </section>
    </div>
  );
}
