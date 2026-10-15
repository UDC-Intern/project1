import { useCallback, useState } from 'react';
import { home } from '../api/catalog';
import { leaderboard } from '../api/leaderboard';
import { StarIcon } from '../components/Icons';
import { Momo } from '../components/Momo';
import { PageHead } from '../components/PageHead';
import { useAsync } from '../hooks/useAsync';
import { useT } from '../i18n';
import { ErrorState, LoadingState } from '../ui/states';

export function LeaderboardPage() {
  const t = useT('play');
  const [book, setBook] = useState<string | null>(null);

  const loadBooks = useCallback(() => home(), []);
  const books = useAsync(loadBooks);
  const load = useCallback(() => leaderboard(book), [book]);
  const { data, error, loading, reload } = useAsync(load);

  const podium = data?.entries.slice(0, 3) ?? [];
  const rest = data?.entries.slice(3) ?? [];

  return (
    <main className="library board-page">
      <PageHead title={t('rank.title')} />

      <nav className="cat-chips" aria-label={t('rank.title')}>
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

      {loading && <LoadingState />}
      {!loading && (error || !data) && <ErrorState onRetry={reload} />}
      {!loading && data && (
        <>
          {data.me && <p className="kid-note">{t('rank.yourRank', { rank: data.me.rank })}</p>}
          {data.entries.length === 0 ? (
            <p className="kid-note">{t('rank.empty')}</p>
          ) : (
            <>
              <ul className="podium">
                {podium.map((e) => (
                  <li key={`${e.rank}-${e.nickname}`} className={`podium-spot place-${e.rank}`}>
                    <Momo color={e.momoColor} size={e.rank === 1 ? 72 : 56} mood="happy" />
                    <span className="podium-name">{e.nickname}</span>
                    <span className="podium-points">
                      <StarIcon size={18} />
                      {e.score}
                    </span>
                    <span className="podium-block">{e.rank}</span>
                  </li>
                ))}
              </ul>
              <ol className="board-table" start={4}>
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
                      {e.score}
                    </span>
                  </li>
                ))}
              </ol>
            </>
          )}
        </>
      )}
    </main>
  );
}
