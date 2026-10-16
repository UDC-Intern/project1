import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
  durationShort,
  durationWords,
  type ChildInsights,
  type Color,
  type DayActivity,
  type PlanStatus,
} from '@udakids/engine';
import { Momo } from '../components/Momo';
import { t } from '../i18n';
import { CountUp, Kpi, Ring, useMounted } from '../ui/charts';
import { PlanBadge } from '../ui/PlanBadge';
import { formatDate } from '../ui/ui';

/** Data `GET /parent/overview` (D-038). */
export type OverviewChild = {
  id: string;
  nickname: string;
  momoColor: string;
  lastActiveAt: string | null;
  className: string | null;
  /** Status Free / Premium (D-041). */
  plan?: PlanStatus;
  insights: ChildInsights;
};

const weekday = (date: string) =>
  new Date(`${date}T00:00:00Z`).toLocaleDateString('id-ID', { weekday: 'short', timeZone: 'UTC' });

/** Grafik batang 7 hari: tinggi = jumlah ronde; bagian hijau = ronde lulus. */
export function WeekBars({ week }: { week: DayActivity[] }) {
  const on = useMounted();
  const max = Math.max(1, ...week.map((d) => d.rounds));
  return (
    <ol className="pd-bars" aria-label={t('parent.ov.weekChart')}>
      {week.map((d, i) => {
        const h = (d.rounds / max) * 100;
        const passedH = d.rounds ? (d.passed / d.rounds) * 100 : 0;
        const today = i === week.length - 1;
        return (
          <li
            key={d.date}
            className={`pd-bar${today ? ' is-today' : ''}${d.rounds === 0 ? ' is-empty' : ''}`}
            aria-label={t('parent.ov.dayLabel', {
              day: weekday(d.date),
              rounds: d.rounds,
              passed: d.passed,
              minutes: d.minutes,
            })}
          >
            <span className="pd-bar-count" aria-hidden>
              {d.rounds > 0 ? d.rounds : ''}
            </span>
            <span className="pd-bar-track" aria-hidden>
              <span
                className="pd-bar-fill"
                style={{
                  height: on ? `${Math.max(h, d.rounds ? 8 : 0)}%` : '0%',
                  transitionDelay: `${i * 60}ms`,
                }}
              >
                <span className="pd-bar-pass" style={{ height: `${passedH}%` }} />
              </span>
            </span>
            <span className="pd-bar-day" aria-hidden>
              {today ? t('parent.ov.today') : weekday(d.date)}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function Icon({
  name,
}: {
  name: 'star' | 'flag' | 'clock' | 'play' | 'up' | 'down' | 'leaf' | 'target' | 'lock';
}) {
  const p: Record<typeof name, ReactNode> = {
    star: <path d="M12 3l2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.6 6.6 19.5l1.2-6L3.3 9.3l6.1-.7z" />,
    flag: <path d="M5 21V4h11l-2 4 2 4H7v9z" />,
    clock: (
      <>
        <circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" strokeWidth="2.4" />
        <path
          d="M12 7v5.5l3.5 2"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
        />
      </>
    ),
    play: <path d="M8 5v14l11-7z" />,
    up: <path d="M12 5l7 8h-4.5v6h-5v-6H5z" />,
    down: <path d="M12 19l-7-8h4.5V5h5v6H19z" />,
    leaf: <path d="M5 19c0-8 5-13 14-14-1 9-6 14-14 14zm0 0l7-7" />,
    target: (
      <>
        <circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" strokeWidth="2.4" />
        <circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" strokeWidth="2.4" />
        <circle cx="12" cy="12" r="1.4" />
      </>
    ),
    lock: <path d="M7 11V8a5 5 0 0110 0v3h1v9H6v-9zm2 0h6V8a3 3 0 00-6 0z" />,
  };
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden>
      {p[name]}
    </svg>
  );
}
export { Icon as ProgressIcon };

function TrendChip({ trend }: { trend: ChildInsights['trend'] }) {
  if (!trend) return <span className="pd-chip is-muted">{t('parent.ov.trendNone')}</span>;
  if (trend.before === null)
    return <span className="pd-chip">{t('parent.ov.trendFirst', { score: trend.now })}</span>;
  const delta = trend.now - trend.before;
  if (Math.abs(delta) < 3)
    return <span className="pd-chip">{t('parent.ov.trendFlat', { score: trend.now })}</span>;
  return (
    <span className={`pd-chip ${delta > 0 ? 'is-up' : 'is-down'}`}>
      <Icon name={delta > 0 ? 'up' : 'down'} />
      {t(delta > 0 ? 'parent.ov.trendUp' : 'parent.ov.trendDown', {
        delta: Math.abs(delta),
        score: trend.now,
      })}
    </span>
  );
}

function Insight({
  icon,
  tone,
  title,
  children,
}: {
  icon: Parameters<typeof Icon>[0]['name'];
  tone: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <li className={`pd-insight tone-${tone} pd-rise`}>
      <span className="pd-insight-icon" aria-hidden>
        <Icon name={icon} />
      </span>
      <div>
        <strong>{title}</strong>
        <p>{children}</p>
      </div>
    </li>
  );
}

/** Panel progres satu anak. `actions` = tombol kelola (laporan, ubah, sandi, hapus). */
export function ChildProgress({ child, actions }: { child: OverviewChild; actions: ReactNode }) {
  const ins = child.insights;
  const empty = ins.totals.played === 0;
  return (
    <article className="pd-child" aria-labelledby={`child-${child.id}`}>
      <header className="pd-child-head">
        <div className="pd-avatar pd-bob" aria-hidden>
          <Momo color={child.momoColor as Color} mood={empty ? 'curious' : 'proud'} size={84} />
        </div>
        <div className="pd-child-id">
          <h2 id={`child-${child.id}`}>{child.nickname}</h2>
          <p className="ui-muted">
            {child.lastActiveAt
              ? t('parent.child.lastActive', { when: formatDate(child.lastActiveAt) })
              : t('parent.child.never')}
            {' · '}
            {child.className
              ? t('parent.child.class', { name: child.className })
              : t('parent.child.noClass')}
          </p>
        </div>
        <div className="pd-head-chips">
          {child.plan && <PlanBadge plan={child.plan} detail />}
          {child.plan?.tier === 'free' && (
            <Link className="pd-upgrade" to="/orang-tua/paket">
              {t('parent.ov.seePackages')}
            </Link>
          )}
          {!empty && <TrendChip trend={ins.trend} />}
        </div>
      </header>

      {empty ? (
        <div className="pd-empty pd-rise">
          <h3>{t('parent.ov.emptyTitle', { name: child.nickname })}</h3>
          <ol>
            <li>{t('parent.ov.empty1')}</li>
            <li>{t('parent.ov.empty2')}</li>
            <li>{t('parent.ov.empty3', { name: child.nickname })}</li>
          </ol>
          <Link className="ui-btn ui-btn-primary" to="/play">
            {t('parent.dash.play')}
          </Link>
        </div>
      ) : (
        <>
          <div className="pd-kpis">
            <Kpi
              i={0}
              tone="grape"
              icon={<Icon name="star" />}
              label={t('parent.ov.points')}
              value={<CountUp value={ins.totals.points} />}
            />
            <Kpi
              i={1}
              tone="leaf"
              icon={<Icon name="flag" />}
              label={t('parent.ov.passed')}
              value={<CountUp value={ins.totals.passed} />}
            />
            <Kpi
              i={2}
              tone="sky"
              icon={<Icon name="play" />}
              label={t('parent.ov.played')}
              value={<CountUp value={ins.totals.played} />}
            />
            <Kpi
              i={3}
              tone="grape"
              icon={<Icon name="target" />}
              label={t('parent.ov.answered')}
              value={<CountUp value={ins.totals.answered} />}
            />
            <Kpi
              i={4}
              tone="sun"
              icon={<Icon name="clock" />}
              label={t('parent.ov.time')}
              value={
                ins.totals.timeMs > 0 ? (
                  // Ringkas di kartu; teks lengkap untuk tooltip dan pembaca layar.
                  <span title={durationWords(ins.totals.timeMs)}>
                    <span aria-hidden>{durationShort(ins.totals.timeMs)}</span>
                    <span className="pd-sr-only">{durationWords(ins.totals.timeMs)}</span>
                  </span>
                ) : (
                  t('parent.ov.zeroTime')
                )
              }
            />
          </div>

          <div className="pd-grid">
            <section className="pd-panel pd-rise" aria-labelledby={`week-${child.id}`}>
              <div className="pd-panel-head">
                <h3 id={`week-${child.id}`}>{t('parent.ov.weekTitle')}</h3>
                <span className="ui-muted">{t('parent.ov.activeDays', { n: ins.activeDays })}</span>
              </div>
              <WeekBars week={ins.week} />
              <p className="pd-week-sum">
                {t('parent.ov.weekSum', {
                  rounds: ins.weekRounds,
                  passed: ins.weekPassed,
                  minutes: ins.weekMinutes,
                })}
              </p>
              <p className="pd-legend" aria-hidden>
                <span className="pd-dot is-pass" /> {t('parent.ov.legendPass')}
                <span className="pd-dot is-try" /> {t('parent.ov.legendTry')}
              </p>
            </section>

            <section className="pd-panel" aria-labelledby={`ins-${child.id}`}>
              <h3 id={`ins-${child.id}`}>{t('parent.ov.insightTitle')}</h3>
              <ul className="pd-insights">
                {ins.next && (
                  <Insight
                    icon={ins.next.paid ? 'lock' : 'target'}
                    tone="grape"
                    title={t('parent.ov.nextTitle')}
                  >
                    {t('parent.ov.next', {
                      level: ins.next.level,
                      topic: ins.next.topic,
                      book: ins.next.book,
                    })}{' '}
                    {ins.next.paid ? (
                      <Link to="/orang-tua/paket">{t('parent.ov.nextPaid')}</Link>
                    ) : (
                      t('parent.ov.nextOpen')
                    )}
                  </Insight>
                )}
                {ins.strength && (
                  <Insight icon="star" tone="leaf" title={t('parent.ov.strengthTitle')}>
                    {t('parent.ov.strength', {
                      topic: ins.strength.topic,
                      score: ins.strength.best ?? 0,
                    })}
                  </Insight>
                )}
                {ins.focus && (
                  <Insight icon="leaf" tone="sun" title={t('parent.ov.focusTitle')}>
                    {t('parent.ov.focus', {
                      topic: ins.focus.topic,
                      level: ins.focus.level ?? 1,
                      best: ins.focus.best ?? 0,
                      attempts: ins.focus.attempts ?? 1,
                    })}
                  </Insight>
                )}
                <Insight icon="clock" tone="sky" title={t('parent.ov.habitTitle')}>
                  {ins.activeDays >= 4
                    ? t('parent.ov.habitGreat', { n: ins.activeDays })
                    : ins.activeDays >= 1
                      ? t('parent.ov.habitOk', { n: ins.activeDays })
                      : t('parent.ov.habitNone')}
                </Insight>
              </ul>
            </section>
          </div>

          {ins.books.length > 0 && (
            <section className="pd-panel" aria-labelledby={`books-${child.id}`}>
              <h3 id={`books-${child.id}`}>{t('parent.ov.booksTitle')}</h3>
              <ul className="pd-books">
                {ins.books.map((b) => (
                  <li key={`${b.domain}/${b.grade}`} className="pd-book pd-rise">
                    <Ring
                      percent={b.percent}
                      label={t('parent.ov.bookRing', { book: b.title, percent: b.percent })}
                    />
                    <div className="pd-book-body">
                      <strong>{b.title}</strong>
                      <span className="ui-muted">
                        {t('parent.ov.bookLevels', { passed: b.passed, levels: b.levels })}
                      </span>
                      <span className="pd-meter" aria-hidden>
                        <span style={{ width: `${b.percent}%` }} />
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {ins.recent.length > 0 && (
            <section className="pd-panel" aria-labelledby={`recent-${child.id}`}>
              <h3 id={`recent-${child.id}`}>{t('parent.ov.recentTitle')}</h3>
              <ul className="pd-recent">
                {ins.recent.map((r) => (
                  <li key={`${r.skillId}@${r.ts}`} className="pd-rise">
                    <span className={`pd-score ${r.passed ? 'is-pass' : 'is-try'}`}>{r.score}</span>
                    <div>
                      <strong>
                        {t('parent.ov.recentLevel', { level: r.level })} · {r.title}
                      </strong>
                      <span className="ui-muted">
                        {r.book} · {formatDate(new Date(r.ts).toISOString())}
                        {r.durationMs ? ` · ${durationWords(r.durationMs)}` : ''}
                      </span>
                    </div>
                    <span className="pd-result">
                      {r.passed ? t('parent.ov.passedTag') : t('parent.ov.tryTag')}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
      <div className="pa-child-actions">{actions}</div>
    </article>
  );
}
