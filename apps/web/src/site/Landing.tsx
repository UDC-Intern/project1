import { useCallback } from 'react';
import { Link } from 'react-router-dom';
import { leaderboardTop } from '../api/leaderboard';
import { StarIcon } from '../components/Icons';
import { Momo } from '../components/Momo';
import { APP_NAME } from '../config/app';
import { useAsync } from '../hooks/useAsync';
import { useT } from '../i18n';

export function Landing() {
  const t = useT('site');
  const load = useCallback(() => leaderboardTop(), []);
  const { data } = useAsync(load);

  return (
    <main className="uk-landing">
      <header className="uk-landing-hero">
        <Momo mood="happy" size={140} />
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '3rem', margin: 0 }}>
          {APP_NAME}
        </h1>
        <p className="kid-say" style={{ margin: 0 }}>
          {t('landing.tagline')}
        </p>
        <div className="kid-row">
          <Link className="kid-btn big-play" to="/play/masuk">
            {t('landing.child')}
          </Link>
          <Link className="kid-btn secondary" to="/orang-tua/masuk">
            {t('landing.parent')}
          </Link>
        </div>
        <p style={{ margin: 0 }}>
          <Link to="/orang-tua/daftar">{t('landing.register')}</Link>
          {' · '}
          <Link to="/masuk/staf">{t('landing.staff')}</Link>
        </p>
      </header>

      <section aria-labelledby="top10">
        <h2 id="top10" style={{ fontFamily: 'var(--font-display)' }}>
          {t('landing.top')}
        </h2>
        {!data || data.entries.length === 0 ? (
          <p>{t('landing.topEmpty')}</p>
        ) : (
          <ol className="board-table">
            {data.entries.map((e) => (
              <li key={`${e.rank}-${e.nickname}`} className={`board-row place-${e.rank}`}>
                <span className="board-pos">{e.rank}</span>
                <span className="board-name">
                  <Momo color={e.momoColor} size={40} />
                  <strong>{e.nickname}</strong>
                </span>
                <span className="board-points">
                  <StarIcon />
                  {e.score}
                </span>
              </li>
            ))}
          </ol>
        )}
      </section>

      {import.meta.env.DEV && (
        <p style={{ textAlign: 'center' }}>
          <Link to="/gaya">{t('style.title')}</Link>
        </p>
      )}
    </main>
  );
}
