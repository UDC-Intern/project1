import { useCallback } from 'react';
import { overview } from '../api/admin';
import { useAsync } from '../hooks/useAsync';
import { useT } from '../i18n';
import { ErrorState, LoadingState } from '../ui/states';

export function AdminOverviewPage() {
  const t = useT('admin');
  const load = useCallback(() => overview(), []);
  const { data, error, loading, reload } = useAsync(load);

  if (loading) return <LoadingState />;
  if (error || !data) return <ErrorState onRetry={reload} />;

  return (
    <div className="uk-stack">
      <h1>{t('overview.title')}</h1>
      <div className="uk-stats">
        <div className="uk-stat">
          <strong>{data.parents}</strong>
          {t('overview.parents')}
        </div>
        <div className="uk-stat">
          <strong>{data.children}</strong>
          {t('overview.children')}
        </div>
        <div className="uk-stat">
          <strong>{data.roundsToday}</strong>
          {t('overview.roundsToday')}
        </div>
        <div className="uk-stat">
          <strong>{data.activeChildren7d}</strong>
          {t('overview.active')}
        </div>
      </div>

      <section className="uk-stack">
        <h2>{t('overview.hardest')}</h2>
        {data.hardestTopics.length === 0 ? (
          <p>{t('overview.noRounds')}</p>
        ) : (
          <div className="uk-table-wrap">
            <table className="uk-table">
              <tbody>
                {data.hardestTopics.map((topic) => (
                  <tr key={topic.topicId}>
                    <td>{topic.title}</td>
                    <td>
                      {t('overview.passRate')}: {topic.passRate}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
