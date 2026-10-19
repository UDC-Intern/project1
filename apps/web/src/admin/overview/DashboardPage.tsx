import { INSIGHT_RANGES, formatRupiah, type InsightRange } from '@udakids/engine';
import { useCallback, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { insights } from '../../api/admin';
import type { AdminDashboard } from '../../api/adminTypes';
import { useFetch } from '../../auth/useApi';
import { Momo } from '../../components/Momo';
import { useAsync } from '../../hooks/useAsync';
import { t, type MessageKey } from '../../i18n';
import {
  ColumnChart,
  Donut,
  Funnel,
  Heatmap,
  LineChart,
  heatLevel,
  type HeatmapCell,
} from '../../ui/adminCharts';
import { ShellIconSvg, type ShellIcon } from '../../ui/AppShell';
import { CountUp, Kpi, Meter } from '../../ui/charts';
import { ErrorState, LoadingState } from '../../ui/states';
import { Badge, Empty, Notice, PageHeader, formatDate } from '../../ui/ui';

const shortDate = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
const longDate = (iso: string) =>
  new Date(`${iso}T12:00:00+07:00`).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Asia/Jakarta',
  });
/** 24 jam penuh, 00 sampai 23 (WIB). */
const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
const WEEKDAYS = ['sen', 'sel', 'rab', 'kam', 'jum', 'sab', 'min'] as const;
const HEAT_TONE = { busy: 'danger', medium: 'warning', quiet: 'muted' } as const;

/** Tiga kalimat sebuah sel heatmap: hari dan jam lengkap, jumlah ronde, dan jumlah anak aktif. */
function heatText(d: { heatmapChildren: number[][] }, cell: HeatmapCell): [string, string, string] {
  const hour = HOURS[cell.col] ?? '00';
  return [
    t('admin.dash.heat.when', {
      day: t(`admin.dash.dayFull.${WEEKDAYS[cell.row] ?? 'sen'}` as MessageKey),
      from: `${hour}:00`,
      to: `${hour}:59`,
    }),
    t('admin.dash.heat.rounds', { n: cell.value.toLocaleString('id-ID') }),
    t('admin.dash.heat.kids', {
      n: (d.heatmapChildren[cell.row]?.[cell.col] ?? 0).toLocaleString('id-ID'),
    }),
  ];
}

const ORDER_TONE: Record<string, 'success' | 'warning' | 'info' | 'muted'> = {
  paid: 'success',
  awaiting_review: 'warning',
  awaiting_payment: 'info',
  rejected: 'muted',
  expired: 'muted',
  cancelled: 'muted',
};

type Note = { tone: 'sun' | 'coral' | 'leaf' | 'sky'; icon: ShellIcon; text: string; to?: string };

/** Catatan singkat yang bisa langsung ditindaklanjuti admin. */
function notesOf(d: AdminDashboard, hardest: { title: string; accuracy: number } | undefined) {
  const notes: Note[] = [];
  const c = d.counts;
  if (c.pendingOrders > 0)
    notes.push({
      tone: 'sun',
      icon: 'receipt',
      text: t('admin.dash.notePending', { n: c.pendingOrders }),
      to: '/admin/transaksi',
    });
  if (c.waitingCertificates > 0)
    notes.push({
      tone: 'sky',
      icon: 'award',
      text: t('admin.dash.noteCertificates', { n: c.waitingCertificates }),
      to: '/admin/sertifikat',
    });
  if (c.illustrationsToReview > 0)
    notes.push({
      tone: 'sky',
      icon: 'image',
      text: t('admin.dash.noteIllustrations', { n: c.illustrationsToReview }),
      to: '/admin/ilustrasi',
    });
  if (hardest)
    notes.push({
      tone: 'coral',
      icon: 'chart',
      text: t('admin.dash.noteHardest', { title: hardest.title, pct: hardest.accuracy }),
      to: '/admin/laporan',
    });
  if (notes.length === 0)
    notes.push({ tone: 'leaf', icon: 'home', text: t('admin.dash.noteCalm') });
  return notes;
}

function Panel({
  title,
  sub,
  action,
  wide,
  children,
}: {
  title: string;
  sub?: string;
  action?: { to: string; label: string };
  wide?: boolean;
  children: ReactNode;
}) {
  return (
    <section className={`ins-panel dash-panel${wide ? ' is-wide' : ''}`}>
      <header className="dash-panel-head">
        <div>
          <h2>{title}</h2>
          {sub && <small className="ui-muted">{sub}</small>}
        </div>
        {action && <Link to={action.to}>{action.label}</Link>}
      </header>
      {children}
    </section>
  );
}

/** Ringkasan admin: angka utama, catatan tindak lanjut, grafik belajar dan penjualan, serta kabar terbaru. */
export function DashboardPage() {
  const [range, setRange] = useState<InsightRange>('7d');
  const load = useCallback(() => insights(range), [range]);
  const ins = useAsync(load);
  const dash = useFetch<AdminDashboard>('staff', `/admin/dashboard?range=${range}`);

  const header = (
    <PageHeader
      title={t('admin.dash.title')}
      subtitle={t('admin.dash.subtitle')}
      actions={
        <div className="dir-tabs" role="group" aria-label={t('admin.dash.range')}>
          {INSIGHT_RANGES.map((r) => (
            <button
              key={r}
              type="button"
              className={`ins-chip${r === range ? ' is-on' : ''}`}
              aria-pressed={r === range}
              onClick={() => setRange(r)}
            >
              {t(`admin.dash.range.${r}` as MessageKey)}
            </button>
          ))}
        </div>
      }
    />
  );

  if ((ins.loading && !ins.data) || (dash.loading && !dash.data))
    return (
      <>
        {header}
        <LoadingState />
      </>
    );
  if (ins.error || !ins.data || dash.error || !dash.data)
    return (
      <>
        {header}
        <ErrorState
          onRetry={() => {
            ins.reload();
            dash.reload();
          }}
        />
      </>
    );

  const d = ins.data;
  const s = dash.data;
  const labels = d.days.map(shortDate);
  // Data contoh tidak dipakai untuk catatan tindak lanjut.
  const hardest = d.sample ? undefined : d.hardestSkills[0];
  const bookMax = Math.max(1, ...s.books.map((b) => b.rounds));

  return (
    <>
      {header}
      {d.sample && <Notice tone="info">{t('admin.dash.sample')}</Notice>}

      <div className="ins-kpis dash-kpis">
        <Kpi
          i={0}
          tone="leaf"
          icon={<ShellIconSvg name="users" />}
          label={t('admin.dash.kActive')}
          value={<CountUp value={d.kpis.activeChildren} />}
          hint={t('admin.dash.kActiveHint', { n: s.counts.children })}
        />
        <Kpi
          i={1}
          tone="sky"
          icon={<ShellIconSvg name="book" />}
          label={t('admin.dash.kAnswered')}
          value={<CountUp value={d.kpis.answered} />}
          hint={
            d.kpis.accuracy === null
              ? t('admin.dash.kNoAccuracy')
              : t('admin.dash.kAccuracy', { pct: d.kpis.accuracy })
          }
        />
        <Kpi
          i={2}
          tone="grape"
          icon={<ShellIconSvg name="trophy" />}
          label={t('admin.dash.kPassRate')}
          value={s.passRate === null ? '–' : `${s.passRate}%`}
          hint={t('admin.dash.kPassRateHint', { n: s.rounds })}
        />
        <Kpi
          i={3}
          tone="sun"
          icon={<ShellIconSvg name="wallet" />}
          label={t('admin.dash.kRevenue')}
          value={<CountUp value={d.kpis.revenue} format={formatRupiah} />}
          hint={t(`admin.dash.range.${range}` as MessageKey)}
        />
        <Kpi
          i={4}
          tone="coral"
          icon={<ShellIconSvg name="receipt" />}
          label={t('admin.dash.kPending')}
          value={<CountUp value={s.counts.pendingOrders} />}
          hint={t('admin.dash.kPendingHint', { n: s.counts.awaitingPayment })}
        />
        <Kpi
          i={5}
          tone="sun"
          icon={<ShellIconSvg name="tag" />}
          label={t('admin.dash.kPremium')}
          value={<CountUp value={s.counts.premiumChildren} />}
          hint={t('admin.dash.kPremiumHint', { n: s.counts.families })}
        />
        <Kpi
          i={6}
          tone="leaf"
          icon={<ShellIconSvg name="award" />}
          label={t('admin.dash.kCertificates')}
          value={<CountUp value={s.counts.certificates} />}
          hint={t('admin.dash.kCertificatesHint', { n: s.counts.waitingCertificates })}
        />
        <Kpi
          i={7}
          tone="grape"
          icon={<ShellIconSvg name="play" />}
          label={t('admin.dash.kLive')}
          value={<CountUp value={d.live.length} />}
          hint={t('admin.dash.kLiveHint')}
        />
      </div>

      <section className="dash-notes" aria-label={t('admin.dash.notes')}>
        {notesOf(s, hardest).map((n) => (
          <div key={n.text} className={`dash-note tone-${n.tone}`}>
            <span className="dash-note-icon" aria-hidden>
              <ShellIconSvg name={n.icon} size={20} />
            </span>
            <p>{n.to ? <Link to={n.to}>{n.text}</Link> : n.text}</p>
          </div>
        ))}
      </section>

      <div className="dash-grid">
        <Panel title={t('admin.dash.activity')} sub={t('admin.dash.activitySub')} wide>
          <LineChart
            labels={labels}
            series={[
              { label: t('admin.dash.rounds'), values: d.activity.map((a) => a.rounds) },
              {
                label: t('admin.dash.answersTen'),
                values: d.activity.map((a) => Math.round(a.answers / 10)),
                color: 'var(--sawah)',
              },
            ]}
          />
        </Panel>

        <Panel
          title={t('admin.dash.books')}
          sub={t('admin.dash.booksSub')}
          action={{ to: '/admin/laporan', label: t('admin.dash.seeReports') }}
        >
          <ul className="dash-books">
            {s.books.map((b) => (
              <li key={b.slug}>
                <div className="dash-book-head">
                  <strong>{b.title}</strong>
                  <span>{b.passRate === null ? '–' : `${b.passRate}%`}</span>
                </div>
                <Meter value={b.rounds} max={bookMax} tone="sky" />
                <small className="ui-muted">
                  {t('admin.dash.bookMeta', {
                    rounds: b.rounds,
                    learners: b.learners,
                    finished: b.finished,
                  })}
                </small>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel title={t('admin.dash.revenue')} sub={t('admin.dash.revenueSub')}>
          <ColumnChart
            labels={labels}
            values={d.revenueSeries.map((r) => r.amount)}
            format={formatRupiah}
            describe={(i) => {
              const day = d.revenueSeries[i]!;
              return `${longDate(day.date)}, ${t('admin.dash.revenueOrders', { n: day.orders })}, ${formatRupiah(day.amount)}`;
            }}
            detail={(i) => {
              const day = d.revenueSeries[i]!;
              return (
                <>
                  <strong>{longDate(day.date)}</strong>
                  <span>{t('admin.dash.revenueOrders', { n: day.orders })}</span>
                  <span>{t('admin.dash.revenueTotal', { amount: formatRupiah(day.amount) })}</span>
                </>
              );
            }}
          />
        </Panel>

        <Panel
          title={t('admin.dash.funnel')}
          sub={t('admin.dash.funnelSub')}
          action={{ to: '/admin/keluarga', label: t('admin.dash.seeFamilies') }}
        >
          <Funnel steps={d.funnel} />
        </Panel>

        <Panel title={t('admin.dash.subjects')}>
          <Donut slices={d.subjects} />
        </Panel>

        <Panel
          title={t('admin.dash.orders')}
          action={{ to: '/admin/transaksi', label: t('admin.dash.seeOrders') }}
        >
          {s.recentOrders.length === 0 ? (
            <Empty>{t('admin.dash.noOrders')}</Empty>
          ) : (
            <ul className="dash-list">
              {s.recentOrders.map((o) => (
                <li key={o.id}>
                  <div>
                    <strong>{o.parentName}</strong>
                    <small className="ui-muted">
                      {o.packageName} · {formatDate(o.createdAt)}
                    </small>
                  </div>
                  <span className="dash-amount">{formatRupiah(o.total)}</span>
                  <Badge tone={ORDER_TONE[o.status] ?? 'muted'}>
                    {t(`admin.order.status.${o.status}` as MessageKey)}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title={t('admin.dash.heatmap')} sub={t('admin.dash.heatmapSub')} wide>
          <Heatmap
            matrix={d.heatmap}
            rowLabels={WEEKDAYS.map((w) => t(`admin.dash.day.${w}`))}
            colLabels={HOURS}
            ariaLabel={t('admin.dash.heatmapAria')}
            label={(cell) => heatText(d, cell).join('. ')}
            tip={(cell) => {
              const [when, rounds, kids] = heatText(d, cell);
              return (
                <>
                  <strong>{when}</strong>
                  <span>{rounds}</span>
                  <span>{kids}</span>
                  <Badge tone={HEAT_TONE[heatLevel(cell.value, cell.max)]}>
                    {t(`admin.dash.heat.${heatLevel(cell.value, cell.max)}` as MessageKey)}
                  </Badge>
                </>
              );
            }}
          />
          <div className="heatmap-legend" aria-hidden>
            <span>{t('admin.dash.heat.quiet')}</span>
            <span className="heatmap-scale" />
            <span>{t('admin.dash.heat.busy')}</span>
          </div>
        </Panel>

        <Panel
          title={t('admin.dash.hardest')}
          sub={t('admin.dash.hardestSub')}
          action={{ to: '/admin/soal', label: t('admin.dash.tryLevel') }}
        >
          {d.hardestSkills.length === 0 ? (
            <Empty>{t('admin.dash.noRounds')}</Empty>
          ) : (
            <ul className="dash-books">
              {d.hardestSkills.map((h) => (
                <li key={h.title}>
                  <div className="dash-book-head">
                    <strong>{h.title}</strong>
                    <span>{h.accuracy}%</span>
                  </div>
                  <Meter value={h.accuracy} max={100} tone="coral" />
                  <small className="ui-muted">{t('admin.dash.answers', { n: h.answers })}</small>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title={t('admin.dash.distractors')} sub={t('admin.dash.distractorsSub')}>
          {d.popularDistractors.length === 0 ? (
            <Empty>{t('admin.dash.noRounds')}</Empty>
          ) : (
            <ul className="dash-list">
              {d.popularDistractors.map((x) => (
                <li key={`${x.prompt}|${x.chosen}`}>
                  <div>
                    <strong>{x.prompt}</strong>
                    <small className="ui-muted">
                      {t('admin.dash.chosen', { answer: x.chosen })}
                    </small>
                  </div>
                  <span className="dash-amount">{t('admin.dash.times', { n: x.count })}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title={t('admin.dash.live')} sub={t('admin.dash.liveSub')}>
          {d.live.length === 0 ? (
            <Empty>{t('admin.dash.liveNone')}</Empty>
          ) : (
            <ul className="dash-list">
              {d.live.map((p) => (
                <li key={p.nickname}>
                  <Momo color={p.momoColor} size={36} />
                  <div>
                    <strong>{p.nickname}</strong>
                    <small className="ui-muted">{p.level}</small>
                  </div>
                  <span className="dash-live-dot" aria-hidden />
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </>
  );
}
