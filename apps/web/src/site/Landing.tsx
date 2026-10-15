import { useCallback } from 'react';
import { Link } from 'react-router-dom';
import { leaderboardTop } from '../api/leaderboard';
import { StarIcon } from '../components/Icons';
import { Momo } from '../components/Momo';
import { APP_NAME } from '../config/app';
import { BASE_BOOKS, TOTAL_LEVELS } from '../content/books';
import { useAsync } from '../hooks/useAsync';
import { useT } from '../i18n';
import { Block, Cloud, Sprout, Star } from './Decor';
import { SiteNav } from './SiteNav';

const FEATURES = ['voice', 'safe', 'plant', 'report'] as const;

export function Landing() {
  const t = useT('site');
  const load = useCallback(() => leaderboardTop(), []);
  const { data } = useAsync(load);

  return (
    <div className="site">
      <SiteNav />
      <main>
        <section className="hero">
          <div className="hero-text">
            <p className="hero-kicker">
              <Star size={22} /> {t('hero.kicker')}
            </p>
            <h1>
              {t('hero.title1')} <span className="hl">{t('hero.title2')}</span>
            </h1>
            <p className="hero-lead">{t('hero.lead')}</p>
            <div className="hero-cta">
              <Link to="/play/masuk" className="site-btn big">
                {t('hero.play')}
              </Link>
              <Link to="/orang-tua/daftar" className="site-btn big ghost">
                {t('hero.register')}
              </Link>
            </div>
            <ul className="hero-facts">
              <li>
                <strong>2</strong> {t('hero.facts.books')}
              </li>
              <li>
                <strong>{TOTAL_LEVELS}</strong> {t('hero.facts.levels')}
              </li>
              <li>
                <strong>0</strong> {t('hero.facts.ads')}
              </li>
            </ul>
          </div>
          <div className="hero-art" aria-hidden="true">
            <div className="hero-blob" />
            <Cloud className="hero-cloud-1 float-a" width={110} />
            <Cloud className="hero-cloud-2 float-b" width={90} />
            <Star className="hero-star-1 spin" size={34} />
            <Star className="hero-star-2 spin" size={24} />
            <Block className="hero-blocks float-a" color="var(--gonjong)" />
            <div className="hero-momo float-b">
              <Momo mood="happy" size={230} />
            </div>
            <div className="hero-bubble">
              <strong>{t('hero.bubble.title')}</strong>
              <span>{t('hero.bubble.text')}</span>
            </div>
          </div>
        </section>

        <section id="fitur" className="site-section" aria-labelledby="fitur-title">
          <h2 id="fitur-title">{t('features.title')}</h2>
          <p className="section-lead">{t('features.lead')}</p>
          <div className="feature-grid">
            {FEATURES.map((key) => (
              <article key={key} className="feature-card">
                <Sprout size={48} />
                <h3>{t(`features.${key}.title`)}</h3>
                <p>{t(`features.${key}.text`)}</p>
              </article>
            ))}
          </div>
        </section>

        <section id="buku" className="site-section" aria-labelledby="buku-title">
          <h2 id="buku-title">{t('books.title')}</h2>
          <p className="section-lead">{t('books.lead')}</p>
          <div className="book-grid">
            {BASE_BOOKS.map((book) => (
              <article
                key={book.slug}
                className="book-card"
                data-mapel={book.subject === 'science' ? 'sains' : 'matematika'}
              >
                <h3>{book.title}</h3>
                <ul>
                  {book.topics.map((topic) => (
                    <li key={topic.code}>{topic.title}</li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </section>

        <section id="paket" className="site-section" aria-labelledby="paket-title">
          <h2 id="paket-title">{t('plans.title')}</h2>
          <p className="section-lead">{t('plans.lead')}</p>
          <div className="plan-grid">
            <article className="plan-card">
              <h3>{t('plans.free.title')}</h3>
              <ul>
                <li>{t('plans.free.1')}</li>
                <li>{t('plans.free.2')}</li>
                <li>{t('plans.free.3')}</li>
              </ul>
            </article>
            <article className="plan-card is-premium">
              <h3>{t('plans.premium.title')}</h3>
              <ul>
                <li>{t('plans.premium.1')}</li>
                <li>{t('plans.premium.2')}</li>
                <li>{t('plans.premium.3')}</li>
              </ul>
              <p className="plan-note">{t('plans.note')}</p>
            </article>
          </div>
        </section>

        <section id="peringkat" className="site-section" aria-labelledby="peringkat-title">
          <h2 id="peringkat-title">{t('landing.top')}</h2>
          {!data || data.entries.length === 0 ? (
            <p className="section-lead">{t('landing.topEmpty')}</p>
          ) : (
            <ol className="board-table site-board">
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

        <section className="site-band">
          <h2>{t('band.title')}</h2>
          <div className="hero-cta" style={{ justifyContent: 'center' }}>
            <Link to="/play/masuk" className="site-btn big alt">
              {t('hero.play')}
            </Link>
            <Link to="/orang-tua/daftar" className="site-btn big ghost light">
              {t('hero.register')}
            </Link>
          </div>
        </section>
      </main>

      <footer className="site-footer">
        <span>{APP_NAME}</span>
        <nav aria-label={t('footer.label')}>
          <Link to="/play/masuk">{t('nav.child')}</Link>
          <Link to="/orang-tua/masuk">{t('nav.parent')}</Link>
          <Link to="/masuk/staf">{t('landing.staff')}</Link>
          {import.meta.env.DEV && <Link to="/gaya">{t('style.title')}</Link>}
        </nav>
      </footer>
    </div>
  );
}
