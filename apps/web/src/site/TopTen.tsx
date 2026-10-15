import type { LeaderboardEntry } from '@udakids/engine';
import { useCallback, useState } from 'react';
import { leaderboardTop } from '../api/leaderboard';
import { Momo } from '../components/Momo';
import { useAsync } from '../hooks/useAsync';
import { useT } from '../i18n';
import { formatDuration } from '../lib/format';

type Board = 'average' | 'total';
const BOARDS: Board[] = ['average', 'total'];
const num = (n: number) => n.toLocaleString('id-ID');

/**
 * 10 besar di landing: podium 1-2-3 lalu daftar 4-10. Dua papan, sama dengan papan peringkat di aplikasi:
 * nilai peringkat (rata-rata tertimbang) dan total skor. Hanya nama panggilan dan warna Momo yang tampil.
 */
export function TopTenSection() {
  const t = useT('site');
  const [board, setBoard] = useState<Board>('average');
  const load = useCallback(() => leaderboardTop(board), [board]);
  const { data, loading } = useAsync(load);

  const top = data?.entries ?? [];
  const podium = top.slice(0, 3);
  const rest = top.slice(3);

  const metric = (e: LeaderboardEntry) =>
    board === 'total' ? t('top.metric.points', { n: num(e.points) }) : String(Math.round(e.score));
  const detail = (e: LeaderboardEntry) =>
    board === 'total'
      ? t('top.detail.total', { n: num(e.rounds), q: num(e.questions) })
      : t('top.detail.average', {
          n: num(e.rounds),
          q: num(e.questions),
          avg: Math.round(e.average),
        });

  return (
    <section id="peringkat" className="site-section topten" aria-labelledby="topten-title">
      <h2 id="topten-title">{t('top.title')}</h2>
      <p className="section-lead">{t('top.sub')}</p>
      <div className="topten-card">
        <div className="topten-tabs" role="tablist" aria-label={t('top.title')}>
          {BOARDS.map((b) => (
            <button
              key={b}
              type="button"
              role="tab"
              aria-selected={b === board}
              className={`topten-tab${b === board ? ' is-on' : ''}`}
              onClick={() => setBoard(b)}
            >
              {t(`top.board.${b}`)}
            </button>
          ))}
        </div>
        <div className="topten-head">
          <span className="topten-live">
            <span className="topten-dot" aria-hidden="true" />
            {t('top.live')}
          </span>
        </div>
        {loading && !data ? (
          <p className="topten-empty">{t('top.loading')}</p>
        ) : top.length === 0 ? (
          <p className="topten-empty">{t('top.empty')}</p>
        ) : (
          <>
            <ol className="topten-podium" aria-label={t('top.podium')}>
              {[podium[1], podium[0], podium[2]].map((r, i) =>
                !r ? (
                  <li
                    key={`kosong-${i}`}
                    className={`tp-spot slot-${i} is-empty`}
                    aria-hidden="true"
                  />
                ) : (
                  <li
                    key={`${r.rank}-${r.nickname}`}
                    className={`tp-spot slot-${i} place-${r.rank}`}
                  >
                    {r.rank === 1 && (
                      <span className="tp-crown" aria-hidden="true">
                        ★
                      </span>
                    )}
                    <Momo color={r.momoColor} mood="happy" size={i === 1 ? 92 : 72} />
                    <strong className="tp-name">{r.nickname}</strong>
                    <span className="tp-metric">{metric(r)}</span>
                    {board === 'average' && (
                      <small className="tp-metric-label">{t('top.ratingLabel')}</small>
                    )}
                    <small className="tp-detail">
                      {detail(r)} · {formatDuration(r.timeMs)}
                    </small>
                    <span className="tp-block">{r.rank}</span>
                  </li>
                ),
              )}
            </ol>
            {rest.length > 0 && (
              <ol className="topten-list" start={4}>
                {rest.map((r) => (
                  <li key={`${r.rank}-${r.nickname}`}>
                    <span className="topten-pos">{r.rank}</span>
                    <Momo color={r.momoColor} mood="happy" size={36} />
                    <span className="tl-name">
                      <strong>{r.nickname}</strong>
                      <small>
                        {detail(r)} · {formatDuration(r.timeMs)}
                      </small>
                    </span>
                    <span className="tl-metric">
                      {metric(r)}
                      {board === 'average' && <small>{t('top.ratingLabel')}</small>}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </>
        )}
        <p className="topten-note">{t(`top.rule.${board}`)}</p>
      </div>
    </section>
  );
}
