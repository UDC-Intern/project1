import { useCallback, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { book, home, profile } from '../api/catalog';
import { useSession } from '../auth/store';
import { DoorIcon, PlayIcon, StarIcon, TrophyIcon } from '../components/Icons';
import { ListenButton } from '../components/ListenButton';
import { Momo } from '../components/Momo';
import { useAsync } from '../hooks/useAsync';
import { useT } from '../i18n';
import { ErrorState, LoadingState } from '../ui/states';
import { TopicGrid } from './TopicGrid';

/** Beranda anak: satu tombol besar untuk lanjut belajar, lalu pilih buku dan topik. */
export function PlayHome() {
  const t = useT('play');
  const navigate = useNavigate();
  const name = useSession((s) => s.session?.name ?? '');
  const signOut = useSession((s) => s.signOut);

  const loadHome = useCallback(() => home(), []);
  const loadMe = useCallback(() => profile(), []);
  const h = useAsync(loadHome);
  const me = useAsync(loadMe);
  const [picked, setPicked] = useState<string | null>(null);
  const active = picked ?? h.data?.books[0]?.slug ?? '';

  const loadBook = useCallback(() => (active ? book(active) : Promise.resolve(null)), [active]);
  const detail = useAsync(loadBook);

  const top = (
    <header className="kid-top">
      <Link to="/play/profil" className="me-chip" aria-label={t('home.profile', { name })}>
        <Momo color={me.data?.momoColor ?? 'blue'} mood="happy" size={44} />
        <span>{name}</span>
        <span className="me-points">
          <StarIcon />
          {me.data?.totalScore ?? 0}
        </span>
      </Link>
      <nav className="top-actions">
        <Link to="/play/peringkat" className="icon-btn" aria-label={t('home.board')}>
          <TrophyIcon size={26} />
          <span>{t('home.board')}</span>
        </Link>
        <button
          type="button"
          className="icon-btn"
          aria-label={t('home.done')}
          onClick={() => {
            signOut();
            navigate('/play/masuk');
          }}
        >
          <DoorIcon size={26} />
          <span>{t('home.done')}</span>
        </button>
      </nav>
    </header>
  );

  if (h.loading) {
    return (
      <main className="home">
        {top}
        <LoadingState />
      </main>
    );
  }
  if (h.error || !h.data) {
    return (
      <main className="home">
        {top}
        <ErrorState onRetry={h.reload} />
      </main>
    );
  }

  const resume = h.data.continue;
  const firstTopic = detail.data?.topics.find((tp) => tp.levelsPassed < tp.levelsTotal);
  const target = resume
    ? {
        to: `/play/topik/${resume.topicId}`,
        title: resume.title,
        say: t('home.resumeSay', { topic: resume.title }),
      }
    : firstTopic
      ? { to: `/play/topik/${firstTopic.id}`, title: firstTopic.title, say: t('home.startSay') }
      : null;

  return (
    <main className="home" data-mapel={active.startsWith('sains') ? 'sains' : 'matematika'}>
      {top}

      {target && (
        <section className="continue-card">
          <Momo color={me.data?.momoColor ?? 'blue'} mood="happy" size={96} />
          <div className="continue-body">
            <div className="kid-say">
              <ListenButton />
              <p>{target.say}</p>
            </div>
            <p className="continue-what">
              <strong>{target.title}</strong>
            </p>
          </div>
          <div className="continue-actions">
            <Link className="kid-btn big-play" to={target.to}>
              <PlayIcon size={26} />
              {resume ? t('home.continue') : t('home.start')}
            </Link>
          </div>
        </section>
      )}

      {h.data.books.length > 1 && (
        <nav className="cat-chips" aria-label={t('home.books')}>
          {h.data.books.map((b) => (
            <button
              key={b.slug}
              type="button"
              aria-pressed={b.slug === active}
              className={`chip${b.slug === active ? ' is-on' : ''}`}
              onClick={() => setPicked(b.slug)}
            >
              {b.title}
            </button>
          ))}
        </nav>
      )}

      <h2 className="home-h2">{t('home.topics.title')}</h2>
      {detail.loading && <LoadingState />}
      {detail.data && <TopicGrid topics={detail.data.topics} />}
    </main>
  );
}
