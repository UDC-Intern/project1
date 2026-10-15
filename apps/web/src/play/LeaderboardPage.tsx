import { useCallback, useState } from 'react';
import { home } from '../api/catalog';
import { leaderboard } from '../api/leaderboard';
import { Momo } from '../components/Momo';
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

  return (
    <div className="uk-stack">
      <h1>{t('rank.title')}</h1>
      <div className="uk-tabs">
        <button
          type="button"
          className="uk-tab"
          aria-pressed={book === null}
          onClick={() => setBook(null)}
        >
          {t('rank.total')}
        </button>
        {books.data?.books.map((b) => (
          <button
            key={b.slug}
            type="button"
            className="uk-tab"
            aria-pressed={book === b.slug}
            onClick={() => setBook(b.slug)}
          >
            {b.title}
          </button>
        ))}
      </div>

      {loading && <LoadingState />}
      {!loading && (error || !data) && <ErrorState onRetry={reload} />}
      {!loading && data && (
        <>
          {data.me && <p style={{ margin: 0 }}>{t('rank.yourRank', { rank: data.me.rank })}</p>}
          {data.entries.length === 0 ? (
            <p>{t('rank.empty')}</p>
          ) : (
            <ol className="uk-rank-list">
              {data.entries.map((e) => (
                <li
                  key={`${e.rank}-${e.nickname}`}
                  className="uk-rank-row"
                  data-me={e.isMe === true}
                >
                  <span className="uk-rank-no">{e.rank}</span>
                  <Momo color={e.momoColor} size={44} />
                  <strong style={{ flex: 1 }}>
                    {e.nickname}
                    {e.isMe && <span className="uk-badge"> {t('rank.me')}</span>}
                  </strong>
                  <span>{e.score}</span>
                </li>
              ))}
            </ol>
          )}
        </>
      )}
    </div>
  );
}
