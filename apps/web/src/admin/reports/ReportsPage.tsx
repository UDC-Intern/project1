import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { ChildSummaryRow, LevelStat } from '../../api/adminTypes';
import { useFetch } from '../../auth/useApi';
import { t } from '../../i18n';
import {
  Badge,
  Card,
  Checkbox,
  formatDate,
  PageHeader,
  SelectField,
  Table,
  type Column,
} from '../../ui/ui';
import { childReportPath, ColorDot, Loadable, percent } from '../common';

export type LevelSort = 'accuracy-asc' | 'accuracy-desc' | 'answered-desc' | 'order';

/** Urutkan dan saring statistik level. Ketepatan kosong (belum dijawab) selalu di akhir. */
export function sortLevelStats(
  rows: LevelStat[],
  opts: { sort: LevelSort; book: string; answeredOnly: boolean },
): LevelStat[] {
  const out = rows.filter(
    (r) => (opts.book === '' || r.bookSlug === opts.book) && (!opts.answeredOnly || r.answered > 0),
  );
  const order = rows.map((r) => r.id);
  const acc = (r: LevelStat, dir: 1 | -1) => (r.accuracy === null ? Infinity : dir * r.accuracy);
  const byOrder = (a: LevelStat, b: LevelStat) => order.indexOf(a.id) - order.indexOf(b.id);
  return [...out].sort((a, b) => {
    switch (opts.sort) {
      case 'accuracy-asc':
        return acc(a, 1) - acc(b, 1) || byOrder(a, b);
      case 'accuracy-desc':
        return acc(a, -1) - acc(b, -1) || byOrder(a, b);
      case 'answered-desc':
        return b.answered - a.answered || byOrder(a, b);
      default:
        return byOrder(a, b);
    }
  });
}

function LevelStats() {
  const stats = useFetch<LevelStat[]>('staff', '/admin/reports/levels');
  const [sort, setSort] = useState<LevelSort>('accuracy-asc');
  const [book, setBook] = useState('');
  const [answeredOnly, setAnsweredOnly] = useState(true);
  const rows = useMemo(
    () => sortLevelStats(stats.data ?? [], { sort, book, answeredOnly }),
    [stats.data, sort, book, answeredOnly],
  );
  const books = useMemo(
    () =>
      [...new Map((stats.data ?? []).map((s) => [s.bookSlug, s.bookTitle])).entries()].map(
        ([value, label]) => ({ value, label }),
      ),
    [stats.data],
  );
  const columns: Column<LevelStat>[] = [
    {
      key: 'level',
      label: t('admin.col.level'),
      render: (s) => (
        <>
          <strong>
            {s.topicCode}.{s.number} · {s.title}
          </strong>
          <div className="ui-muted">
            {s.topicTitle} · {s.bookTitle}
          </div>
        </>
      ),
    },
    { key: 'answered', label: t('admin.col.answered'), render: (s) => s.answered },
    { key: 'accuracy', label: t('admin.col.accuracy'), render: (s) => percent(s.accuracy) },
    { key: 'learners', label: t('admin.col.learners'), render: (s) => s.learners },
    { key: 'passed', label: t('admin.col.passedKids'), render: (s) => s.passed },
    {
      key: 'wrong',
      label: t('admin.col.topWrong'),
      render: (s) =>
        s.topWrong.length ? (
          <span className="adm-tags">
            {s.topWrong.map((w) => (
              <Badge key={w.answer} tone="warning">
                {w.answer} ×{w.count}
              </Badge>
            ))}
          </span>
        ) : (
          '—'
        ),
    },
  ];
  return (
    <Card title={t('admin.report.levelsTitle')}>
      <div className="adm-fields">
        <SelectField
          label={t('admin.report.sort')}
          value={sort}
          onChange={(v) => setSort(v as LevelSort)}
          options={[
            { value: 'accuracy-asc', label: t('admin.report.sortAccAsc') },
            { value: 'accuracy-desc', label: t('admin.report.sortAccDesc') },
            { value: 'answered-desc', label: t('admin.report.sortAnswered') },
            { value: 'order', label: t('admin.report.sortOrder') },
          ]}
        />
        <SelectField
          label={t('admin.report.book')}
          value={book}
          onChange={setBook}
          options={[{ value: '', label: t('admin.filter.all') }, ...books]}
        />
      </div>
      <Checkbox
        label={t('admin.report.answeredOnly')}
        checked={answeredOnly}
        onChange={(e) => setAnsweredOnly(e.target.checked)}
      />
      <Loadable loading={stats.loading} error={stats.error} hasData={!!stats.data}>
        {() => (
          <Table
            key={`${sort}|${book}|${answeredOnly}`}
            rows={rows}
            columns={columns}
            rowKey={(s) => s.id}
            empty={t('admin.report.levelsEmpty')}
            pageSize={10}
          />
        )}
      </Loadable>
    </Card>
  );
}

function ChildrenStats() {
  const kids = useFetch<ChildSummaryRow[]>('staff', '/admin/children');
  const columns: Column<ChildSummaryRow>[] = [
    {
      key: 'nick',
      label: t('admin.col.child'),
      render: (c) => (
        <Link to={childReportPath(c.id)}>
          <ColorDot color={c.momoColor} />
          {c.nickname}
        </Link>
      ),
    },
    { key: 'parent', label: t('admin.col.parent'), render: (c) => c.parentName },
    { key: 'answered', label: t('admin.col.answered'), render: (c) => c.answered },
    {
      key: 'accuracy',
      label: t('admin.col.accuracy'),
      render: (c) => (c.answered ? percent((c.correct / c.answered) * 100) : '—'),
    },
    { key: 'passed', label: t('admin.col.passedLevels'), render: (c) => c.passed },
    { key: 'last', label: t('admin.col.lastActive'), render: (c) => formatDate(c.lastActiveAt) },
    {
      key: 'active',
      label: t('admin.col.status'),
      render: (c) => (c.active ? '' : <Badge tone="muted">{t('admin.user.inactive')}</Badge>),
    },
  ];
  return (
    <Card title={t('admin.report.childrenTitle')}>
      <Loadable loading={kids.loading} error={kids.error} hasData={!!kids.data}>
        {() => (
          <Table
            rows={[...kids.data!].sort((a, b) => b.answered - a.answered)}
            columns={columns}
            rowKey={(c) => c.id}
            empty={t('admin.report.childrenEmpty')}
            pageSize={10}
          />
        )}
      </Loadable>
    </Card>
  );
}

/** Laporan: statistik per level (jawaban keliru terbanyak) dan daftar anak menuju laporan anak. */
export function ReportsPage() {
  return (
    <>
      <PageHeader title={t('admin.report.title')} subtitle={t('admin.report.subtitle')} />
      <LevelStats />
      <ChildrenStats />
    </>
  );
}
