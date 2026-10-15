import { useCallback } from 'react';
import { Link } from 'react-router-dom';
import { leaderboardTop } from '../api/leaderboard';
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
        <Momo mood="happy" size={128} />
        <h1>{APP_NAME}</h1>
        <p style={{ fontSize: 'var(--uk-text-child)', margin: 0 }}>{t('landing.tagline')}</p>
        <div className="uk-row" style={{ justifyContent: 'center' }}>
          <Link className="uk-btn uk-btn--big" to="/play/masuk">
            {t('landing.child')}
          </Link>
          <Link className="uk-btn uk-btn--big uk-btn--ghost" to="/orang-tua/masuk">
            {t('landing.parent')}
          </Link>
        </div>
        <p style={{ margin: 0 }}>
          <Link to="/orang-tua/daftar">{t('landing.register')}</Link>
          {' · '}
          <Link to="/masuk/staf">{t('landing.staff')}</Link>
        </p>
      </header>

      <section aria-labelledby="top10" className="uk-landing-board">
        <h2 id="top10">{t('landing.top')}</h2>
        {!data || data.entries.length === 0 ? (
          <p>{t('landing.topEmpty')}</p>
        ) : (
          <ol className="uk-rank-list">
            {data.entries.map((e) => (
              <li key={`${e.rank}-${e.nickname}`} className="uk-rank-row">
                <span className="uk-rank-no">{e.rank}</span>
                <Momo color={e.momoColor} size={40} />
                <strong style={{ flex: 1 }}>{e.nickname}</strong>
                <span>{e.score}</span>
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
