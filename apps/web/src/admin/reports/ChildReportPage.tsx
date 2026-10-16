import { Link, useParams } from 'react-router-dom';
import type { AdminChildReport, TopicStatus } from '../../api/adminTypes';
import { useFetch } from '../../auth/useApi';
import { Plant } from '../../components/Plant';
import { t } from '../../i18n';
import { Badge, Card, Empty, formatDate, PageHeader, Stat, Table, type Column } from '../../ui/ui';
import { ColorDot, Icon, Loadable, percent } from '../common';

type LevelRow = AdminChildReport['books'][number]['topics'][number]['levels'][number];

const STATUS_TONE: Record<TopicStatus, 'success' | 'info' | 'warning' | 'muted'> = {
  mastered: 'success',
  proficient: 'info',
  learning: 'warning',
  not_started: 'muted',
};

function StatusBadge({ status }: { status: TopicStatus }) {
  return <Badge tone={STATUS_TONE[status]}>{t(`admin.child.status.${status}`)}</Badge>;
}

function Meter({ value, label }: { value: number; label: string }) {
  const v = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div>
      <div className="ui-row" style={{ justifyContent: 'space-between' }}>
        <span>{label}</span>
        <strong>{v}/100</strong>
      </div>
      <div
        className="adm-meter"
        role="meter"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={v}
        aria-label={label}
      >
        <span style={{ width: `${v}%` }} />
      </div>
    </div>
  );
}

const acc = (correct: number, answered: number) =>
  answered ? percent((correct / answered) * 100) : '—';

/** Laporan satu anak untuk admin: angka utama, saran topik, dan rincian buku, topik, level. */
export function ChildReportPage() {
  const { id = '' } = useParams();
  const report = useFetch<AdminChildReport>(
    'staff',
    `/admin/children/${encodeURIComponent(id)}/report`,
  );

  const columns: Column<LevelRow>[] = [
    { key: 'number', label: t('admin.col.level'), render: (l) => `${l.number} · ${l.title}` },
    {
      key: 'passed',
      label: t('admin.col.status'),
      render: (l) =>
        l.passed ? (
          <Badge tone="success">{t('admin.child.passed')}</Badge>
        ) : l.answered ? (
          <Badge tone="warning">{t('admin.child.trying')}</Badge>
        ) : (
          <Badge tone="muted">{t('admin.child.status.not_started')}</Badge>
        ),
    },
    { key: 'best', label: t('admin.col.best'), render: (l) => l.best ?? '—' },
    {
      key: 'answered',
      label: t('admin.col.answered'),
      render: (l) => `${l.correct}/${l.answered}`,
    },
  ];

  return (
    <Loadable loading={report.loading} error={report.error} hasData={!!report.data}>
      {() => {
        const r = report.data!;
        return (
          <>
            <PageHeader
              title={
                <>
                  <ColorDot color={r.child.momoColor} />
                  {t('admin.child.title', { name: r.child.nickname })}
                </>
              }
              subtitle={t('admin.child.subtitle', {
                parent: r.child.parentName,
                last: formatDate(r.child.lastActiveAt),
              })}
              actions={
                <Link className="ui-btn ui-btn-ghost" to="/admin/laporan">
                  <Icon name="back" />
                  {t('admin.back')}
                </Link>
              }
            />
            <div className="ui-grid" style={{ marginBottom: 20 }}>
              <Stat
                label={t('admin.child.answered')}
                value={r.totals.answered}
                hint={t('admin.child.accuracy', { v: acc(r.totals.correct, r.totals.answered) })}
              />
              <Stat
                label={t('admin.child.passedLevels')}
                value={r.totals.passed}
                hint={t('admin.child.ofLevels', { n: r.totals.levels })}
              />
              <Stat
                label={t('admin.child.mastered')}
                value={r.totals.mastered}
                hint={t('admin.child.ofTopics', { n: r.totals.topics })}
              />
              <Stat
                label={t('admin.child.week')}
                value={r.week.answered}
                hint={t('admin.child.accuracy', { v: acc(r.week.correct, r.week.answered) })}
              />
            </div>
            <Card title={t('admin.child.recommendations')}>
              {r.recommendations.length === 0 ? (
                <Empty>{t('admin.child.noRecommendations')}</Empty>
              ) : (
                <ul className="adm-kids">
                  {r.recommendations.map((x) => (
                    <li key={x.topicId}>
                      <span className="ui-row">
                        <strong>{x.title}</strong>
                        <span className="ui-muted">{x.bookTitle}</span>
                        <StatusBadge status={x.status} />
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
            {r.books.map((b) => (
              <Card key={b.slug} title={b.title}>
                <Meter value={b.mastery} label={t('admin.child.mastery')} />
                <p className="ui-muted" style={{ margin: '8px 0 12px' }}>
                  {t('admin.child.bookCounts', {
                    passed: b.passed,
                    levels: b.levels,
                    mastered: b.mastered,
                  })}
                </p>
                {b.topics.map((topic) => (
                  <details key={topic.id} open={topic.levels.some((l) => l.answered > 0)}>
                    <summary className="adm-group-title" style={{ cursor: 'pointer' }}>
                      <span className="ui-row" style={{ display: 'inline-flex' }}>
                        <Plant stage={topic.stage} size={28} />
                        {topic.code} — {topic.title} <StatusBadge status={topic.status} />
                        <span className="ui-muted">
                          {t('admin.child.topicScore', { score: topic.mastery })}
                        </span>
                      </span>
                    </summary>
                    <Table rows={topic.levels} columns={columns} rowKey={(l) => l.id} />
                  </details>
                ))}
              </Card>
            ))}
          </>
        );
      }}
    </Loadable>
  );
}
