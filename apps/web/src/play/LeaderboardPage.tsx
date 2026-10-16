import type { LeaderboardEntry, LeaderboardMode } from '@udakids/engine';
import { useCallback, useState } from 'react';
import { home } from '../api/catalog';
import { leaderboard } from '../api/leaderboard';
import { CrownIcon, StarIcon } from '../components/Icons';
import { Momo } from '../components/Momo';
import { PageHead } from '../components/PageHead';
import { useAsync } from '../hooks/useAsync';
import { useT } from '../i18n';
import { formatDuration } from '../lib/format';
import { Dialog } from '../ui/Dialog';
import { ErrorState, LoadingState } from '../ui/states';
import { AutoSpeak } from './AutoSpeak';

const MODES: LeaderboardMode[] = ['average', 'total', 'mock'];

function Detail({ entry, onClose }: { entry: LeaderboardEntry; onClose: () => void }) {
  const t = useT('play');
  return (
    <Dialog title={t('rank.detail.title', { name: entry.nickname })} onClose={onClose}>
      <dl className="rank-detail">
        <div>
          <dt>{t('rank.detail.rank')}</dt>
          <dd>{entry.rank}</dd>
        </div>
        <div>
          <dt>{t('rank.detail.points')}</dt>
          <dd>{entry.points}</dd>
        </div>
        <div>
          <dt>{t('rank.detail.average')}</dt>
          <dd>{Math.round(entry.average)}</dd>
        </div>
        <div>
          <dt>{t('rank.detail.rounds')}</dt>
          <dd>{entry.rounds}</dd>
        </div>
        <div>
          <dt>{t('rank.detail.questions')}</dt>
          <dd>{entry.questions}</dd>
        </div>
        <div>
          <dt>{t('rank.detail.time')}</dt>
          <dd>{formatDuration(entry.timeMs)}</dd>
        </div>
      </dl>
      <button type="button" className="kid-btn secondary" onClick={onClose}>
        {t('rank.detail.close')}
      </button>
    </Dialog>
  );
}

export function LeaderboardPage() {
  const t = useT('play');
  const [book, setBook] = useState<string | null>(null);
  const [mode, setMode] = useState<LeaderboardMode>('average');
  const [picked, setPicked] = useState<LeaderboardEntry | null>(null);

  const loadBooks = useCallback(() => home(), []);
  const books = useAsync(loadBooks);
  const load = useCallback(() => leaderboard(book, mode), [book, mode]);
  const { data, error, loading, reload } = useAsync(load);

  const podium = data?.entries.slice(0, 3) ?? [];
  const rest = data?.entries.slice(3) ?? [];
  const mineInList = data?.entries.some((e) => e.isMe) ?? false;
  const unit = mode === 'average' ? t('rank.unit.average') : t('rank.unit.total');

  const say = !data
    ? t('rank.say.loading')
    : data.me
      ? t('rank.say.me', { rank: data.me.rank, total: data.total })
      : t('rank.say.none');

  return (
    <main className="library board-page">
      {data && <AutoSpeak text={`${t('rank.title')}. ${say}`} />}
      <PageHead title={t('rank.title')} />

      <nav className="rank-modes" aria-label={t('rank.modes')}>
        {MODES.map((m) => (
          <button
            key={m}
            type="button"
            className={`chip${mode === m ? ' is-on' : ''}`}
            aria-pressed={mode === m}
            onClick={() => setMode(m)}
          >
            {t(`rank.mode.${m}`)}
          </button>
        ))}
      </nav>

      <nav className="cat-chips rank-scopes" aria-label={t('rank.scopes')}>
        <button
          type="button"
          className={`chip${book === null ? ' is-on' : ''}`}
          aria-pressed={book === null}
          onClick={() => setBook(null)}
        >
          {t('rank.total')}
        </button>
        {books.data?.books.map((b) => (
          <button
            key={b.slug}
            type="button"
            className={`chip${book === b.slug ? ' is-on' : ''}`}
            aria-pressed={book === b.slug}
            onClick={() => setBook(b.slug)}
          >
            {b.title}
          </button>
        ))}
      </nav>

      <p className="kid-say">
        <Momo mood={data?.me && data.me.rank <= 3 ? 'happy' : 'neutral'} size={56} />
        <span>{say}</span>
      </p>

      {loading && <LoadingState />}
      {!loading && (error || !data) && <ErrorState onRetry={reload} />}
      {!loading && data && mode === 'mock' && <p className="kid-note">{t('rank.mock.empty')}</p>}
      {!loading && data && mode !== 'mock' && (
        <>
          {data.entries.length === 0 ? (
            <p className="kid-note">{t('rank.empty')}</p>
          ) : (
            <>
              <ul className="podium">
                {podium.map((e) => (
                  <li key={`${e.rank}-${e.nickname}`} className={`podium-spot place-${e.rank}`}>
                    {e.rank === 1 && (
                      <span className="podium-crown">
                        <CrownIcon size={44} />
                      </span>
                    )}
                    <Momo color={e.momoColor} size={e.rank === 1 ? 104 : 72} mood="happy" />
                    <span className="podium-name">{e.nickname}</span>
                    <span className="podium-points">
                      <StarIcon size={18} />
                      {Math.round(e.score)}
                      <small>{unit}</small>
                    </span>
                    <button
                      type="button"
                      className="podium-detail"
                      aria-label={t('rank.detail.open', { name: e.nickname })}
                      onClick={() => setPicked(e)}
                    >
                      {t('rank.detail.button')}
                    </button>
                    <span className="podium-block">{e.rank}</span>
                  </li>
                ))}
              </ul>
              <ol className="board-table rank-list" start={4}>
                {rest.map((e) => (
                  <li
                    key={`${e.rank}-${e.nickname}`}
                    className={`board-row${e.isMe ? ' is-me' : ''}`}
                  >
                    <span className="board-pos">{e.rank}</span>
                    <span className="board-name">
                      <Momo color={e.momoColor} size={44} />
                      <strong>{e.nickname}</strong>
                      {e.isMe && <span className="me-tag">{t('rank.me')}</span>}
                    </span>
                    <span className="board-points">
                      <StarIcon />
                      {Math.round(e.score)}
                      <button
                        type="button"
                        className="rank-info"
                        aria-label={t('rank.detail.open', { name: e.nickname })}
                        onClick={() => setPicked(e)}
                      >
                        i
                      </button>
                    </span>
                  </li>
                ))}
              </ol>
            </>
          )}
          {data.me && !mineInList && (
            <section className="rank-mine" aria-label={t('rank.mine')}>
              <span className="board-pos">{data.me.rank}</span>
              <span className="board-name">
                <Momo color={data.me.momoColor} size={44} />
                <strong>{data.me.nickname}</strong>
                <span className="me-tag">{t('rank.me')}</span>
              </span>
              <span className="board-points">
                <StarIcon />
                {Math.round(data.me.score)}
              </span>
            </section>
          )}
        </>
      )}
      {picked && <Detail entry={picked} onClose={() => setPicked(null)} />}
    </main>
  );
}
