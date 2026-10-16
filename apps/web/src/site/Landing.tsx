import { formatRupiah } from '@udakids/engine';
import { useCallback } from 'react';
import { Link } from 'react-router-dom';
import { publicPackages } from '../api/billing';
import { useSettings } from '../api/settings';
import { CertificateSheet } from '../components/certificate/CertificateSheet';
import { Momo } from '../components/Momo';
import { APP_NAME, CHARACTER_NAME } from '../config/app';
import { useAsync } from '../hooks/useAsync';
import { BASE_BOOKS, TOTAL_LEVELS } from '../content/books';
import { useT } from '../i18n';
import { BookSlider } from './BookSlider';
import {
  Blocks,
  Cloud,
  GonjongArc,
  Icon,
  MarawaIcon,
  ProgramCard,
  RebungBand,
  Star,
  type FeatureIcon,
} from './Decor';
import { SiteNav } from './SiteNav';
import { TopTenSection } from './TopTen';

const TONES = ['sun', 'coral', 'sky', 'grape', 'leaf', 'teal'] as const;
const MAX_CHILDREN = 3;
const QUESTIONS_PER_ROUND = 10;

const subjectKey = (subject: string) => (subject === 'science' ? 'sains' : 'math');
const subjectIcon = (subject: string): FeatureIcon => (subject === 'science' ? 'science' : 'math');
const topicCount = (b: (typeof BASE_BOOKS)[number]) => b.topics.length;
const levelCount = (b: (typeof BASE_BOOKS)[number]) =>
  b.topics.reduce((n, t) => n + t.levels.length, 0);
const bookGrade = (grade: string) => {
  const m = grade.match(/^sd(\d+)$/);
  return m ? `Kelas ${m[1]}` : grade === 'kelas-1' ? 'Kelas 1' : grade;
};

function AboutNameSection() {
  const t = useT('site');
  const cards = [
    {
      key: 'uda',
      icon: <Momo mood="happy" size={64} />,
      title: t('about.udaTitle'),
      body: t('about.udaBody', { name: CHARACTER_NAME }),
    },
    {
      key: 'gonjong',
      icon: <GonjongArc width={96} />,
      title: t('about.gonjongTitle'),
      body: t('about.gonjongBody', { app: APP_NAME }),
    },
    {
      key: 'marawa',
      icon: <MarawaIcon />,
      title: t('about.marawaTitle'),
      body: t('about.marawaBody'),
    },
  ];
  return (
    <section id="tentang" className="site-section about-name" aria-labelledby="about-name-title">
      <RebungBand />
      <h2 id="about-name-title">{t('about.title', { app: APP_NAME })}</h2>
      <p className="section-lead">{t('about.lead', { app: APP_NAME, name: CHARACTER_NAME })}</p>
      <ul className="about-name-cards">
        {cards.map((c) => (
          <li key={c.key} className="about-name-card">
            <span className="about-name-icon">{c.icon}</span>
            <h3>{c.title}</h3>
            <p>{c.body}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

function SubjectsSection() {
  const t = useT('site');
  const subjects = ['math', 'science'].map((subject) => {
    const books = BASE_BOOKS.filter((b) => b.subject === subject);
    return { subject, books, levels: books.reduce((n, b) => n + levelCount(b), 0) };
  });
  return (
    <section id="kurikulum" className="site-section subjects" aria-labelledby="subjects-title">
      <h2 id="subjects-title">{t('subjects.title')}</h2>
      <p className="section-lead">{t('subjects.lead', { app: APP_NAME })}</p>
      <div className="subject-grid">
        {subjects.map((s, i) => (
          <article key={s.subject} className={`subject-card tone-${TONES[i % TONES.length]}`}>
            <header className="subject-head">
              <Icon name={subjectIcon(s.subject)} size={52} />
              <div>
                <h3>{t(`subject.${subjectKey(s.subject)}`)}</h3>
                <p className="subject-meta">
                  {t('subjects.meta', {
                    books: s.books.length,
                    levels: s.levels,
                    span: t('subjects.span'),
                  })}
                </p>
              </div>
            </header>
            <ul className="subject-books">
              {s.books.map((b) => (
                <li key={b.slug}>{b.title}</li>
              ))}
            </ul>
          </article>
        ))}
      </div>
    </section>
  );
}

function PricingSection() {
  const t = useT('site');
  const free = useSettings().billing.freeLevels;
  // Paket dan harga dari menu admin (Paket), bukan angka tetap.
  const load = useCallback(() => publicPackages(), []);
  const packages = useAsync(load).data ?? [];
  return (
    <section id="harga" className="site-section pricing" aria-labelledby="harga-title">
      <h2 id="harga-title">{t('price.title')}</h2>
      <p className="section-lead">{t('price.lead', { free })}</p>
      <div className="price-grid">
        <article className="price-card is-free">
          <h3>{t('price.freeTitle')}</h3>
          <p className="price-amount">{t('price.freeAmount')}</p>
          <ul>
            <li>{t('price.free1', { free })}</li>
            <li>{t('price.free2')}</li>
            <li>{t('price.free3')}</li>
          </ul>
          <Link to="/orang-tua/daftar" className="site-btn">
            {t('hero.register')}
          </Link>
        </article>
        {packages.map((p) => {
          const saved = p.listPrice - p.price;
          return (
            <article key={p.id} className="price-card">
              {saved > 0 && (
                <span className="price-badge">
                  {t('price.save', { amount: formatRupiah(saved) })}
                </span>
              )}
              <h3>{p.name}</h3>
              <p className="price-amount">
                {saved > 0 && <s>{formatRupiah(p.listPrice)}</s>}{' '}
                <strong>{formatRupiah(p.price)}</strong>
              </p>
              <p className="price-term">
                {p.durationDays === null
                  ? t('price.forever')
                  : t('price.days', { n: p.durationDays })}
              </p>
              <ul>
                <li>{t('price.allBooks')}</li>
                <li>{t('price.family')}</li>
                <li>{t('price.cert')}</li>
              </ul>
              <Link to="/orang-tua/daftar" className="site-btn ghost">
                {t('price.buy')}
              </Link>
            </article>
          );
        })}
      </div>
      <p className="price-note">{t('price.note')}</p>
    </section>
  );
}

function NewFeaturesSection() {
  const t = useT('site');
  const { certificate } = useSettings();
  return (
    <section id="fitur-baru" className="site-section news" aria-labelledby="news-title">
      <p className="news-kicker">{t('news.kicker')}</p>
      <h2 id="news-title">{t('news.title')}</h2>
      <div className="news-grid">
        <article className="news-card news-aff" aria-labelledby="news-pay-title">
          <span className="news-badge">{t('news.badge')}</span>
          <h3 id="news-pay-title">{t('news.pay.title')}</h3>
          <p>{t('news.pay.lead')}</p>
          <ol className="news-steps">
            <li>
              <strong>1</strong>
              <span>{t('news.pay.step1')}</span>
            </li>
            <li>
              <strong>2</strong>
              <span>{t('news.pay.step2')}</span>
            </li>
            <li>
              <strong>3</strong>
              <span>{t('news.pay.step3')}</span>
            </li>
          </ol>
          <div className="news-actions">
            <Link to="/orang-tua/daftar" className="site-btn">
              {t('news.pay.cta')}
            </Link>
            <Link to="/orang-tua/paket" className="site-btn ghost">
              {t('news.pay.have')}
            </Link>
          </div>
          <small className="news-note">{t('news.pay.note')}</small>
        </article>
        <article className="news-card news-kids" aria-labelledby="news-kids-title">
          <Icon name="family" size={56} />
          <h3 id="news-kids-title">{t('news.kids.title', { n: MAX_CHILDREN })}</h3>
          <p>{t('news.kids.text', { n: MAX_CHILDREN })}</p>
          <ul className="news-list">
            <li>{t('news.kids.point1')}</li>
            <li>{t('news.kids.point2', { n: MAX_CHILDREN })}</li>
            <li>{t('news.kids.point3')}</li>
          </ul>
        </article>
        <article className="news-card news-cert" aria-labelledby="news-cert-title">
          <div className="news-cert-text">
            <Icon name="trophy" size={56} />
            <h3 id="news-cert-title">{t('news.cert.title')}</h3>
            <p>{t('news.cert.text')}</p>
            <ul className="news-list">
              <li>{t('news.cert.point1')}</li>
              <li>{t('news.cert.point2')}</li>
              <li>{t('news.cert.point3')}</li>
            </ul>
          </div>
          <div className="news-cert-sheet">
            <CertificateSheet
              data={{
                childName: t('news.cert.sampleName'),
                bookTitle: BASE_BOOKS[0]!.title,
                levels: levelCount(BASE_BOOKS[0]!),
                topics: topicCount(BASE_BOOKS[0]!),
                design: 'klasik',
                number: null,
                issuedAt: null,
                settings: certificate,
              }}
            />
          </div>
        </article>
      </div>
    </section>
  );
}

export function Landing() {
  const t = useT('site');
  const fmt = (n: number) => n.toLocaleString('id-ID');

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
                <strong>{BASE_BOOKS.length}</strong> {t('hero.facts.books')}
              </li>
              <li>
                <strong>{fmt(TOTAL_LEVELS)}</strong> {t('hero.facts.levels')}
              </li>
              <li>
                <strong>{fmt(TOTAL_LEVELS * QUESTIONS_PER_ROUND)}</strong> {t('hero.facts.total')}
              </li>
              <li>
                <strong>{QUESTIONS_PER_ROUND}</strong> {t('hero.facts.perRound')}
              </li>
            </ul>
          </div>

          <div className="hero-art" aria-hidden="true">
            <div className="hero-blob" />
            <Cloud className="float-a hero-cloud-1" width={130} />
            <Cloud className="float-b hero-cloud-2" width={90} />
            <Star className="spin hero-star-1" size={36} />
            <Star className="spin hero-star-2" size={24} color="#ff7a59" />
            <div className="hero-momo float-b">
              <Momo mood="happy" size={230} />
            </div>
            <div className="hero-cards">
              <ProgramCard dir="right" color="#ff7a59" className="float-a" />
              <ProgramCard dir="up" color="#4aa8ff" className="float-b" />
              <ProgramCard dir="right" color="#46b97a" className="float-a" />
            </div>
            <Blocks className="hero-blocks float-b" />
            <div className="hero-bubble float-a">
              <strong>{t('hero.bubble.title')}</strong>
              <span>{t('hero.bubble.text')}</span>
            </div>
          </div>
        </section>

        <AboutNameSection />
        <TopTenSection />

        <section id="pintu" className="site-section doors">
          <h2>{t('doors.title')}</h2>
          <p className="section-lead">{t('doors.lead')}</p>
          <div className="door-grid">
            <article className="door tone-grape">
              <Icon name="child" size={64} />
              <h3>{t('doors.child.title')}</h3>
              <p>{t('doors.child.text')}</p>
              <div className="door-actions">
                <Link to="/play/masuk" className="site-btn">
                  {t('doors.child.login')}
                </Link>
              </div>
            </article>
            <article className="door tone-leaf">
              <Icon name="family" size={64} />
              <h3>{t('doors.parent.title')}</h3>
              <p>{t('doors.parent.text')}</p>
              <div className="door-actions">
                <Link to="/orang-tua/daftar" className="site-btn">
                  {t('doors.parent.register')}
                </Link>
                <Link to="/orang-tua/masuk" className="site-btn ghost">
                  {t('doors.parent.login')}
                </Link>
              </div>
            </article>
            <article className="door tone-sky">
              <Icon name="class" size={64} />
              <h3>{t('doors.staff.title')}</h3>
              <p>{t('doors.staff.text')}</p>
              <div className="door-actions">
                <Link to="/masuk/staf" className="site-btn">
                  {t('doors.staff.login')}
                </Link>
              </div>
            </article>
          </div>
        </section>

        <NewFeaturesSection />

        <section id="buku" className="site-section books">
          <h2>{t('books.title')}</h2>
          <p className="section-lead">{t('books.lead')}</p>
          <BookSlider
            items={BASE_BOOKS}
            render={(b, i) => (
              <article key={b.slug} className={`book-card tone-${TONES[i % TONES.length]}`}>
                <div className="book-spine" aria-hidden="true" />
                <Icon name={subjectIcon(b.subject)} size={48} />
                <h3>{b.title}</h3>
                <p className="book-age">{bookGrade(b.grade)}</p>
                <p className="book-desc">{b.topics.map((topic) => topic.title).join(', ')}</p>
                <span className="book-levels">
                  {t('books.meta', { topics: topicCount(b), n: levelCount(b) })}
                </span>
              </article>
            )}
          />
        </section>

        <SubjectsSection />

        <section id="cara" className="site-section how">
          <h2>{t('how.title')}</h2>
          <ol className="how-steps">
            {(['1', '2', '3', '4'] as const).map((n) => (
              <li key={n} className={`how-step step-${n}`}>
                <span className="how-num">{n}</span>
                <h3>{t(`how.${n}.title`)}</h3>
                <p>{t(`how.${n}.text`)}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="site-section champions">
          <div className="champ-text">
            <h2>{t('champ.title')}</h2>
            <p>{t('champ.text')}</p>
            <ul className="check-list">
              <li>
                <Icon name="timer" size={32} /> {t('champ.timer')}
              </li>
              <li>
                <Icon name="trophy" size={32} /> {t('champ.board')}
              </li>
            </ul>
          </div>
          <div className="champ-art" aria-hidden="true">
            <div className="mini-podium">
              <div className="mp mp-2">
                <Momo color="blue" mood="happy" size={70} />
                <span className="mp-pillar">2</span>
              </div>
              <div className="mp mp-1">
                <Momo color="yellow" mood="happy" size={86} />
                <span className="mp-pillar">1</span>
              </div>
              <div className="mp mp-3">
                <Momo color="green" mood="happy" size={62} />
                <span className="mp-pillar">3</span>
              </div>
            </div>
          </div>
        </section>

        <PricingSection />

        <section id="aman" className="site-section safe">
          <h2>{t('safe.title')}</h2>
          <div className="safe-grid">
            {(
              [
                ['shield', 'data'],
                ['noads', 'ads'],
                ['voice', 'voice'],
                ['trophy', 'kind'],
              ] as const
            ).map(([icon, key]) => (
              <div key={key} className="safe-item">
                <Icon name={icon} size={52} />
                <h3>{t(`safe.${key}.title`)}</h3>
                <p>{t(`safe.${key}.text`)}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="cta-band">
          <Momo mood="happy" size={110} />
          <div>
            <h2>{t('band.title', { character: CHARACTER_NAME })}</h2>
            <p>{t('band.text')}</p>
          </div>
          <div className="hero-cta">
            <Link to="/play/masuk" className="site-btn big">
              {t('hero.play')}
            </Link>
            <Link to="/orang-tua/daftar" className="site-btn big ghost light">
              {t('hero.register')}
            </Link>
          </div>
        </section>
      </main>

      <footer className="site-footer">
        <span>
          © {new Date().getFullYear()} {APP_NAME}
        </span>
        <nav aria-label={t('footer.label')}>
          <Link to="/play/masuk">{t('footer.child')}</Link>
          <Link to="/orang-tua/masuk">{t('footer.parent')}</Link>
          <Link to="/masuk/staf">{t('footer.staff')}</Link>
          {import.meta.env.DEV && <Link to="/gaya">{t('style.title')}</Link>}
        </nav>
      </footer>
    </div>
  );
}
