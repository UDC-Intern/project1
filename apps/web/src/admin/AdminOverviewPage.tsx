import { INSIGHT_RANGES, formatRupiah, type InsightRange } from '@udakids/engine';
import { useCallback, useState } from 'react';
import { insights, overview } from '../api/admin';
import { Momo } from '../components/Momo';
import { useAsync } from '../hooks/useAsync';
import { useT } from '../i18n';
import { PageHeader } from '../ui/ui';
import {
  ColumnChart,
  CountUp,
  Donut,
  Funnel,
  Heatmap,
  Kpi,
  LineChart,
  Meter,
  Ring,
} from '../ui/adminCharts';
import { ErrorState, LoadingState } from '../ui/states';

const shortDate = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
const HOUR_LABELS = Array.from({ length: 16 }, (_, i) => String(i + 6).padStart(2, '0'));

export function AdminOverviewPage() {
  const t = useT('admin');
  const [range, setRange] = useState<InsightRange>('7d');
  const loadInsights = useCallback(() => insights(range), [range]);
  const loadOverview = useCallback(() => overview(), []);
  const ins = useAsync(loadInsights);
  const sys = useAsync(loadOverview);

  if (ins.loading && !ins.data) return <LoadingState />;
  if (ins.error || !ins.data) return <ErrorState onRetry={ins.reload} />;
  const d = ins.data;
  const labels = d.days.map(shortDate);
  const weekdays = [1, 2, 3, 4, 5, 6, 7].map((n) => t(`weekday.${n}`));

  return (
    <div className="uk-stack">
      <PageHeader
        title={t('overview.title')}
        actions={
          <div className="range-tabs" role="group" aria-label={t('overview.title')}>
            {INSIGHT_RANGES.map((r) => (
              <button key={r} type="button" aria-pressed={r === range} onClick={() => setRange(r)}>
                {t(`overview.range.${r}`)}
              </button>
            ))}
          </div>
        }
      />

      {d.sample && (
        <p className="sample-note" role="note">
          {t('overview.sample')}
        </p>
      )}

      <div className="kpi-row">
        <Kpi
          label={t('kpi.active')}
          hint={
            sys.data ? `${sys.data.children} ${t('overview.children').toLowerCase()}` : undefined
          }
        >
          <CountUp value={d.kpis.activeChildren} />
        </Kpi>
        <Kpi label={t('kpi.answered')}>
          <CountUp value={d.kpis.answered} />
        </Kpi>
        <Kpi
          label={t('kpi.accuracy')}
          hint={d.kpis.accuracy === null ? t('kpi.noAccuracy') : undefined}
        >
          {d.kpis.accuracy === null ? (
            '-'
          ) : (
            <span className="uk-row">
              <Ring percent={d.kpis.accuracy} label={t('kpi.accuracy')} />
              <Meter percent={d.kpis.accuracy} label={t('kpi.accuracy')} />
            </span>
          )}
        </Kpi>
        <Kpi label={t('kpi.revenue')}>
          <CountUp value={d.kpis.revenue} format={formatRupiah} />
        </Kpi>
      </div>

      <div className="panel-grid">
        <section className="panel wide">
          <h2>{t('chart.activity')}</h2>
          <LineChart
            labels={labels}
            series={[
              { label: t('chart.rounds'), values: d.activity.map((a) => a.rounds) },
              {
                label: t('chart.answers'),
                values: d.activity.map((a) => Math.round(a.answers / 10)),
                color: 'var(--sawah)',
              },
            ]}
          />
        </section>

        <section className="panel">
          <h2>{t('chart.revenue')}</h2>
          <ColumnChart
            labels={labels}
            values={d.revenueSeries.map((r) => r.amount)}
            format={formatRupiah}
          />
        </section>

        <section className="panel">
          <h2>{t('chart.funnel')}</h2>
          <Funnel steps={d.funnel} />
        </section>

        <section className="panel">
          <h2>{t('chart.subjects')}</h2>
          <Donut slices={d.subjects} />
        </section>

        <section className="panel">
          <h2>{t('chart.live')}</h2>
          {d.live.length === 0 ? (
            <p style={{ margin: 0 }}>{t('chart.liveNone')}</p>
          ) : (
            <ul className="live-list">
              {d.live.map((p) => (
                <li key={p.nickname}>
                  <Momo color={p.momoColor} size={36} />
                  <span>
                    {p.nickname}
                    <br />
                    <small>{p.level}</small>
                  </span>
                  <span className="live-dot" aria-hidden="true" />
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="panel wide">
          <h2>{t('chart.heatmap')}</h2>
          <Heatmap matrix={d.heatmap} rowLabels={weekdays} colLabels={HOUR_LABELS} />
        </section>

        <section className="panel">
          <h2>{t('chart.hardest')}</h2>
          {d.hardestSkills.length === 0 ? (
            <p style={{ margin: 0 }}>{t('overview.noRounds')}</p>
          ) : (
            <ul className="rank-bars">
              {d.hardestSkills.map((s) => (
                <li key={s.title}>
                  <span>
                    <strong>{s.title}</strong>{' '}
                    <small>
                      {t('chart.accuracy')} {s.accuracy}% ·{' '}
                      {t('chart.answersCount', { n: s.answers })}
                    </small>
                  </span>
                  <Meter percent={s.accuracy} label={s.title} />
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="panel">
          <h2>{t('chart.distractors')}</h2>
          {d.popularDistractors.length === 0 ? (
            <p style={{ margin: 0 }}>{t('overview.noRounds')}</p>
          ) : (
            <div className="uk-table-wrap">
              <table className="uk-table">
                <tbody>
                  {d.popularDistractors.map((x) => (
                    <tr key={`${x.prompt}|${x.chosen}`}>
                      <td>{x.prompt}</td>
                      <td>
                        <strong>{x.chosen}</strong> {t('chart.chosen')}
                      </td>
                      <td>{t('chart.times', { n: x.count })}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
