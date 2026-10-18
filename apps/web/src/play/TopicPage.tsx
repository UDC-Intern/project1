import type { TopicDetail } from '@udakids/engine';
import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { topic } from '../api/catalog';
import { AnswerOptions } from '../components/AnswerOptions';
import { CountObjects } from '../components/CountObjects';
import { CheckIcon, LockIcon, PlayIcon, StarIcon } from '../components/Icons';
import { Keypad } from '../components/Keypad';
import { ListenButton } from '../components/ListenButton';
import { Momo } from '../components/Momo';
import { PageHead } from '../components/PageHead';
import { useAsync } from '../hooks/useAsync';
import { useT } from '../i18n';
import { mapelOfSlug } from '../lib/mapel';
import { ErrorState, LoadingState } from '../ui/states';
import { AutoSpeak } from './AutoSpeak';
import { BOOK_KEY, remember } from './libraryChoice';
import { PremiumNotice } from './PremiumNotice';

type Level = TopicDetail['levels'][number];
type Example = NonNullable<TopicDetail['example']>;

function LevelCard({ level, isNext }: { level: Level; isNext: boolean }) {
  const t = useT('play');
  const label = `${t('level.word', { n: level.number })}: ${level.title}`;
  const body = (
    <>
      <span className="level-num">{level.number}</span>
      <span className="level-title">{level.title}</span>
      <span className="level-status">
        {level.status === 'passed' && (
          <>
            <CheckIcon size={20} /> {t('level.passed')}
            {level.bestScore !== null && (
              <>
                {' · '}
                <StarIcon size={18} /> {level.bestScore}
              </>
            )}
          </>
        )}
        {level.status === 'locked' && (
          <>
            <LockIcon size={20} /> {t('level.locked')}
          </>
        )}
        {level.status === 'premium' && (
          <>
            <LockIcon size={20} /> {t('premium.ask')}
          </>
        )}
        {level.status === 'soon' && t('soon')}
        {level.status === 'open' &&
          (level.bestScore !== null
            ? t('level.best', { score: level.bestScore })
            : isNext
              ? t('level.now')
              : null)}
      </span>
    </>
  );

  if (level.status === 'open' || level.status === 'passed') {
    return (
      <Link
        to={`/play/latihan/${level.id}`}
        className={`level-card is-${level.status}${isNext ? ' is-next' : ''}`}
        aria-label={label}
      >
        {body}
      </Link>
    );
  }
  return (
    <div className="level-card is-locked" aria-disabled="true" aria-label={label}>
      {body}
    </div>
  );
}

/** Contoh soal dari level 1: bisa dicoba, jawaban dan petunjuk tampil, tidak dinilai dan tidak disimpan. */
function ExampleBox({ example }: { example: Example }) {
  const t = useT('play');
  const [shown, setShown] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [value, setValue] = useState('');
  const [result, setResult] = useState<{ chosen: string; isCorrect: boolean } | null>(null);

  if (!shown) {
    return (
      <button type="button" className="kid-btn secondary" onClick={() => setShown(true)}>
        {t('example.open')}
      </button>
    );
  }

  const isNumber = example.type === 'number';
  const evaluate = (chosen: string) =>
    setResult({ chosen, isCorrect: chosen.trim() === example.answer });
  const reset = () => {
    setResult(null);
    setSelected(null);
    setValue('');
  };

  return (
    <div className="example">
      <p className="example-label">{t('example.label')}</p>
      <div className="item-prompt">
        <p>{example.prompt}</p>
      </div>
      {example.visual && <CountObjects visual={example.visual} />}
      {isNumber ? (
        <>
          <Keypad value={value} onChange={setValue} disabled={result !== null} />
          {!result && (
            <button
              type="button"
              className="kid-btn"
              disabled={value === ''}
              onClick={() => evaluate(value)}
            >
              {t('example.check')}
            </button>
          )}
        </>
      ) : (
        <AnswerOptions
          options={example.options ?? []}
          selected={selected}
          onSelect={(v) => {
            setSelected(v);
            evaluate(v);
          }}
          disabled={result !== null}
          result={
            result
              ? {
                  chosen: result.chosen,
                  isCorrect: result.isCorrect,
                  correctAnswer: result.isCorrect ? null : example.answer,
                }
              : null
          }
        />
      )}
      {result && (
        <div
          className={`example-feedback ${result.isCorrect ? 'is-right' : 'is-wrong'}`}
          role="status"
        >
          <strong>{result.isCorrect ? t('feedback.correct') : t('feedback.retry')}</strong>
          <span>{example.explanation}</span>
          <button type="button" className="kid-link" onClick={reset}>
            {t('example.again')}
          </button>
        </div>
      )}
    </div>
  );
}

export function TopicPage() {
  const t = useT('play');
  const { id = '' } = useParams();
  const load = useCallback(() => topic(id), [id]);
  const { data, error, loading, reload } = useAsync(load);
  const bookSlug = data?.topic.bookSlug;

  // Tombol kembali membuka Peta Belajar di beranda: buku topik ini yang tampil di sana.
  useEffect(() => {
    if (bookSlug) remember(BOOK_KEY, bookSlug);
  }, [bookSlug]);

  if (loading) return <LoadingState />;
  if (error || !data || !bookSlug) return <ErrorState onRetry={reload} />;

  const open = data.levels.find((l) => l.status === 'open');
  const sentences = data.topic.lesson.split(/(?<=[.!?])\s+/).filter(Boolean);
  const intro = sentences[0] ?? data.topic.lesson;
  const tips = sentences.slice(1);

  return (
    <main className="library topic-page" data-mapel={mapelOfSlug(bookSlug)}>
      <AutoSpeak text={`${data.topic.title}. ${intro}`} />
      <PageHead title={data.topic.title} />

      <section className="lesson" aria-labelledby="lesson-title">
        <div className="lesson-head">
          <Momo mood="happy" size={72} />
          <h2 id="lesson-title">{t('topic.lesson')}</h2>
          <ListenButton text={[intro, ...tips].join('. ')} audioUrl={data.topic.lessonAudioUrl} />
        </div>
        <p className="lesson-intro">{intro}</p>
        {tips.length > 0 && (
          <ul className="lesson-tips" aria-label={t('topic.tips')}>
            {tips.map((tip) => (
              <li key={tip}>
                <StarIcon size={22} />
                <span>{tip}</span>
              </li>
            ))}
          </ul>
        )}
        {data.example && <ExampleBox example={data.example} />}
      </section>

      <section aria-labelledby="levels-title">
        <div className="levels-head">
          <h2 id="levels-title">{t('topic.levels')}</h2>
          <p className="levels-rule">{t('topic.rule', { total: 10, pass: 70 })}</p>
        </div>
        <ol className="level-path">
          {data.levels.map((level) => (
            <li key={level.id}>
              <LevelCard level={level} isNext={level === open} />
            </li>
          ))}
        </ol>
      </section>

      {!open && data.levels.some((l) => l.status === 'premium') && <PremiumNotice />}

      <div className="topic-cta">
        {open ? (
          <Link className="kid-btn big-play" to={`/play/latihan/${open.id}`}>
            <PlayIcon size={26} />
            {t('topic.start', { n: open.number })}
          </Link>
        ) : (
          <Link className="kid-btn secondary" to="/play">
            {t('back')}
          </Link>
        )}
      </div>
    </main>
  );
}
