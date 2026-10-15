import type { StartRoundResult } from '@udakids/engine';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { topic as loadTopic } from '../api/catalog';
import { ApiError } from '../api/client';
import { answer as sendAnswer, finish, startRound } from '../api/practice';
import { AnswerOptions } from '../components/AnswerOptions';
import { CountObjects } from '../components/CountObjects';
import { BackIcon, CheckIcon } from '../components/Icons';
import { Keypad } from '../components/Keypad';
import { ListenButton } from '../components/ListenButton';
import { Momo } from '../components/Momo';
import { RoundProgress } from '../components/RoundProgress';
import { Stopwatch } from '../components/Stopwatch';
import { useAsync } from '../hooks/useAsync';
import { useT } from '../i18n';
import { ErrorState, LoadingState } from '../ui/states';

type Feedback = {
  isCorrect: boolean;
  hint: string | null;
  correctAnswer: string | null;
  chosen: string;
};

export function RoundPage() {
  const t = useT('play');
  const navigate = useNavigate();
  const { levelId = '' } = useParams();
  const topicId = levelId.split(':').slice(0, 2).join(':');

  const loadMeta = useCallback(() => loadTopic(topicId), [topicId]);
  const meta = useAsync(loadMeta);
  const level = meta.data?.levels.find((l) => l.id === levelId);

  const [round, setRound] = useState<StartRoundResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [index, setIndex] = useState(0);
  const [results, setResults] = useState<boolean[]>([]);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    startRound(levelId).then(setRound, (err: unknown) =>
      setError(err instanceof ApiError ? err.message : t('error.generic')),
    );
  }, [levelId, t]);

  if (error)
    return (
      <main className="kid-screen">
        <ErrorState message={error} />
        <Link className="kid-btn" to={`/play/topik/${topicId}`}>
          {t('result.back')}
        </Link>
      </main>
    );
  if (!round)
    return (
      <main className="kid-screen">
        <Momo mood="happy" size={140} />
        <p className="kid-note">{t('round.loading')}</p>
        <LoadingState />
      </main>
    );

  const total = round.questions.length;
  const question = round.questions[index]!;
  const isLast = index === total - 1;
  const isNumber = question.type === 'number';
  const draft = isNumber ? value : (selected ?? '');

  async function check() {
    if (busy || feedback || draft === '') return;
    setBusy(true);
    try {
      const res = await sendAnswer(round!.roundId, { questionIndex: index, answer: draft });
      setFeedback({ ...res, chosen: draft });
      setResults((r) => [...r, res.isCorrect]);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('error.generic'));
    } finally {
      setBusy(false);
    }
  }

  async function next() {
    if (!isLast) {
      setIndex(index + 1);
      setFeedback(null);
      setSelected(null);
      setValue('');
      return;
    }
    setBusy(true);
    try {
      await finish(round!.roundId);
      navigate(`/play/hasil/${round!.roundId}`, { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('error.generic'));
      setBusy(false);
    }
  }

  const topicTitle = meta.data?.topic.title;

  return (
    <main className="practice" data-mapel={levelId.startsWith('sains') ? 'sains' : 'matematika'}>
      <header className="practice-head">
        <Link to={`/play/topik/${topicId}`} className="kid-link" aria-label={t('round.quit')}>
          <BackIcon size={30} />
        </Link>
        <div className="practice-title">
          <strong>{level?.title ?? ''}</strong>
          {topicTitle && (
            <span>
              {topicTitle} · {t('level.word', { n: level?.number ?? '' })}
            </span>
          )}
        </div>
        <div className="practice-meta">
          <Stopwatch running={feedback === null} />
        </div>
      </header>

      <RoundProgress total={total} current={index} results={results} />

      <div className="item">
        <div className="item-prompt">
          <ListenButton />
          <p>{question.prompt}</p>
        </div>
        {question.visual && <CountObjects visual={question.visual} />}

        {isNumber ? (
          <Keypad value={value} onChange={setValue} disabled={busy || feedback !== null} />
        ) : (
          <AnswerOptions
            options={question.options ?? []}
            selected={selected}
            onSelect={setSelected}
            disabled={busy || feedback !== null}
            result={feedback}
          />
        )}

        {!feedback && (
          <button
            type="button"
            className="check-btn"
            aria-label={t('round.check')}
            disabled={busy || draft === ''}
            onClick={() => void check()}
          >
            <CheckIcon size={44} />
          </button>
        )}
      </div>

      {feedback && (
        <div className={`feedback ${feedback.isCorrect ? 'is-right' : 'is-wrong'}`} role="status">
          <Momo mood={feedback.isCorrect ? 'happy' : 'encourage'} size={72} />
          <div className="feedback-body">
            <div className="kid-say">
              <p>{feedback.isCorrect ? t('feedback.correct') : t('feedback.retry')}</p>
            </div>
            {feedback.hint && (
              <div className="feedback-show">{t('round.hint', { hint: feedback.hint })}</div>
            )}
            {feedback.correctAnswer && (
              <div className="feedback-show">
                {t('round.answer', { answer: feedback.correctAnswer })}
              </div>
            )}
          </div>
          <button
            type="button"
            className="kid-btn next-btn"
            disabled={busy}
            onClick={() => void next()}
            autoFocus
          >
            {isLast ? t('round.finish') : t('next')}
          </button>
        </div>
      )}
    </main>
  );
}
