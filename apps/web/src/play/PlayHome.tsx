import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { subjectNameOf } from '@udakids/engine';
import { book, home, profile } from '../api/catalog';
import { speak } from '../audio/speech';
import { DoorIcon, PlayIcon, StarIcon, TrophyIcon } from '../components/Icons';
import { Momo } from '../components/Momo';
import { useSession } from '../auth/store';
import { useAsync } from '../hooks/useAsync';
import { t } from '../i18n';
import { mapelOf } from '../lib/mapel';
import { ErrorState, LoadingState } from '../ui/states';
import { PetaBelajar } from './peta/PetaBelajar';
import type { PlayStatus, Shelf } from './peta/types';
import { SpeakButton } from './SpeakButton';
import { AutoSpeak } from './AutoSpeak';
import { BOOK_KEY, GRADE_KEY, remember, remembered } from './libraryChoice';
import { restoreParent } from './parentReturn';

const STATUS: Record<string, PlayStatus> = {
  passed: 'passed',
  open: 'open',
  locked: 'locked',
  soon: 'locked',
  premium: 'paid',
};

const gradeLabel = (g: number) => t(`play.grade.sd${g}` as 'play.grade.sd1');

/** Beranda anak: satu tombol besar untuk lanjut belajar, lalu pilih kelas dan buku, lalu Peta Belajar. */
export function PlayHome() {
  const navigate = useNavigate();
  const name = useSession((s) => s.session?.name ?? '');
  const signOut = useSession((s) => s.signOut);
  // Alamat lama /play/buku/:slug mengirim bukunya lewat state navigasi.
  const routedBook = (useLocation().state as { book?: string } | null)?.book;

  const loadHome = useCallback(() => home(), []);
  const loadMe = useCallback(() => profile(), []);
  const h = useAsync(loadHome);
  const me = useAsync(loadMe);
  const [grade, setGrade] = useState(() => Number(remembered(GRADE_KEY)) || 0);
  const [bookSlug, setBookSlug] = useState(() => routedBook ?? remembered(BOOK_KEY));
  useEffect(() => {
    if (routedBook) remember(BOOK_KEY, routedBook);
  }, [routedBook]);

  const books = useMemo(() => h.data?.books ?? [], [h.data]);
  const grades = useMemo(
    () => [...new Set(books.map((b) => b.grade))].sort((a, b) => a - b),
    [books],
  );
  // Buku yang terakhir dibuka (mis. dari Detail Topik) menentukan kelasnya, supaya kembali ke peta yang sama.
  const savedBook = books.find((b) => b.slug === bookSlug);
  const activeGrade = savedBook?.grade ?? (grades.includes(grade) ? grade : (grades[0] ?? 1));
  const gradeBooks = books.filter((b) => b.grade === activeGrade);
  const active =
    gradeBooks.find((b) => b.slug === bookSlug) ??
    gradeBooks.find((b) => b.subject === savedBook?.subject) ??
    gradeBooks[0];
  const activeSlug = active?.slug;

  const loadBook = useCallback(
    () => (activeSlug ? book(activeSlug) : Promise.resolve(null)),
    [activeSlug],
  );
  const detail = useAsync(loadBook);

  const momoColor = me.data?.momoColor ?? 'blue';

  const { shelves, statuses, nextCode } = useMemo(() => {
    const topics = detail.data?.topics ?? [];
    const list: Shelf[] = topics.map((tp) => ({
      code: tp.code,
      title: tp.title,
      intro: tp.lesson,
      tips: tp.tips,
      href: `/play/topik/${tp.id}`,
      skills: tp.levels.map((l) => ({ id: l.id, order: l.number, title: l.title })),
    }));
    const map: Record<string, PlayStatus> = {};
    for (const tp of topics) for (const l of tp.levels) map[l.id] = STATUS[l.status] ?? 'locked';
    const next = topics.find((tp) => tp.levels.some((l) => l.status === 'open'))?.code;
    return { shelves: list, statuses: map, nextCode: next };
  }, [detail.data]);

  // Di layar sempit deretan kelas bisa digeser: kelas yang aktif digeser ke tengah supaya terlihat.
  const gradeNav = useRef<HTMLElement>(null);
  useEffect(() => {
    const nav = gradeNav.current;
    const chip = nav?.querySelector<HTMLElement>('.is-on');
    if (!nav || !chip) return;
    const a = nav.getBoundingClientRect();
    const b = chip.getBoundingClientRect();
    nav.scrollLeft += b.left - a.left - (a.width - b.width) / 2;
  }, [activeGrade, grades.length]);

  const chooseGrade = (g: number) => {
    speak(gradeLabel(g));
    setGrade(g);
    remember(GRADE_KEY, String(g));
    const inGrade = books.filter((b) => b.grade === g);
    const next = inGrade.find((b) => b.subject === active?.subject) ?? inGrade[0];
    if (next) {
      setBookSlug(next.slug);
      remember(BOOK_KEY, next.slug);
    }
  };

  const top = (
    <header className="kid-top">
      <Link to="/play/profil" className="me-chip" aria-label={t('play.home.profile', { name })}>
        <Momo color={momoColor} mood="happy" size={44} />
        <span className="me-name">{name}</span>
        <span className="me-points">
          <StarIcon />
          {me.data?.totalScore ?? 0}
        </span>
      </Link>
      <nav className="top-actions">
        <Link to="/play/peringkat" className="icon-btn" aria-label={t('play.home.board')}>
          <TrophyIcon size={26} />
          <span>{t('play.home.board')}</span>
        </Link>
        <button
          type="button"
          className="icon-btn"
          aria-label={t('play.home.done')}
          onClick={() => {
            signOut();
            navigate(restoreParent() ? '/orang-tua' : '/play/masuk');
          }}
        >
          <DoorIcon size={26} />
          <span>{t('play.home.doneShort')}</span>
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
  const nextShelf = shelves.find((s) => s.code === nextCode);
  const target = resume
    ? {
        to: `/play/topik/${resume.topicId}`,
        title: resume.title,
        say: t('play.home.resumeSay', { name, topic: resume.title, n: 1 }),
      }
    : nextShelf
      ? {
          to: nextShelf.href,
          title: nextShelf.title,
          say: t('play.home.nextSay', { name, topic: nextShelf.title, n: 1 }),
        }
      : null;

  const premium = (detail.data?.topics ?? []).some((tp) =>
    tp.levels.some((l) => l.number > 1 && l.status === 'passed'),
  );

  return (
    <main className="home" data-mapel={mapelOf(active?.subject)}>
      {top}
      {target && <AutoSpeak text={target.say} />}

      {target && (
        <section className="continue-card">
          <Momo color={momoColor} mood="happy" size={96} />
          <div className="continue-body">
            <div className="kid-say">
              <SpeakButton text={target.say} />
              <p>{resume ? t('play.home.resume') : t('play.home.next')}</p>
            </div>
            <p className="continue-what">
              <strong>{target.title}</strong>
            </p>
          </div>
          <div className="continue-actions">
            <Link className="kid-btn big-play" to={target.to}>
              <PlayIcon size={26} />
              {resume ? t('play.home.resumeButton') : t('play.home.play')}
            </Link>
          </div>
        </section>
      )}

      {grades.length > 1 && (
        <nav ref={gradeNav} className="grade-chips" aria-label={t('play.library.grades')}>
          {grades.map((g) => (
            <button
              key={g}
              type="button"
              aria-pressed={g === activeGrade}
              className={`grade-chip${g === activeGrade ? ' is-on' : ''}`}
              onClick={() => chooseGrade(g)}
            >
              {gradeLabel(g)}
            </button>
          ))}
        </nav>
      )}

      {gradeBooks.length > 1 && (
        <nav className="book-tabs library-books" aria-label={t('play.library.books')}>
          {gradeBooks.map((b) => (
            <button
              key={b.slug}
              type="button"
              aria-pressed={b.slug === active?.slug}
              aria-label={b.title}
              className={`book-tab${b.slug === active?.slug ? ' is-on' : ''}`}
              onClick={() => {
                speak(b.title);
                setBookSlug(b.slug);
                remember(BOOK_KEY, b.slug);
              }}
            >
              {subjectNameOf(b.subject)}
            </button>
          ))}
        </nav>
      )}

      <h2 className="home-h2">
        {active ? `${active.title} · ` : ''}
        {t('play.peta.title')}
      </h2>
      {detail.loading && <LoadingState />}
      {detail.error && <ErrorState onRetry={detail.reload} />}
      {active && detail.data && (
        <PetaBelajar
          book={{ title: active.title, slug: active.slug }}
          shelves={shelves}
          statuses={statuses}
          nextCode={nextCode}
          premium={premium}
          momoColor={momoColor}
        />
      )}
    </main>
  );
}
