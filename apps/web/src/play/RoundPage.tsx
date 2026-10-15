import type { StartRoundResult } from '@udakids/engine';
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { answer as sendAnswer, finish, startRound } from '../api/practice';
import { ApiError } from '../api/client';
import { AnswerOptions } from '../components/AnswerOptions';
import { BigButton } from '../components/BigButton';
import { CountObjects } from '../components/CountObjects';
import { Keypad } from '../components/Keypad';
import { ListenButton } from '../components/ListenButton';
import { Momo } from '../components/Momo';
import { RoundProgress } from '../components/RoundProgress';
import { Stopwatch } from '../components/Stopwatch';
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

  const [round, setRound] = useState<StartRoundResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [index, setIndex] = useState(0);
  const [results, setResults] = useState<boolean[]>([]);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
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
      <div className="uk-stack">
        <ErrorState message={error} />
        <Link className="uk-btn uk-btn--big uk-btn--ghost" to={`/play/topik/${topicId}`}>
          {t('result.back')}
        </Link>
      </div>
    );
  if (!round) return <LoadingState />;

  const total = round.questions.length;
  const question = round.questions[index]!;
  const isLast = index === total - 1;

  async function submit(chosen: string) {
    if (busy || feedback) return;
    setBusy(true);
    try {
      const res = await sendAnswer(round!.roundId, { questionIndex: index, answer: chosen });
      setFeedback({ ...res, chosen });
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

  return (
    <div className="uk-stack">
      <div className="uk-round-head">
        <RoundProgress total={total} current={index} results={results} />
        <Stopwatch running={!busy || feedback === null} />
      </div>

      <section className="uk-card uk-question">
        <p className="uk-question-text">{question.prompt}</p>
        {question.visual && <CountObjects visual={question.visual} />}
        <div>
          <ListenButton />
        </div>
      </section>

      {question.type === 'number' ? (
        <Keypad
          value={value}
          onChange={setValue}
          onSubmit={() => void submit(value)}
          disabled={busy || feedback !== null}
        />
      ) : (
        <AnswerOptions
          options={question.options ?? []}
          onPick={(v) => void submit(v)}
          disabled={busy || feedback !== null}
          chosen={feedback?.chosen ?? null}
          correctAnswer={feedback?.correctAnswer ?? null}
        />
      )}

      {feedback && (
        <div
          className={`uk-feedback ${feedback.isCorrect ? 'uk-feedback--correct' : 'uk-feedback--retry'}`}
          role="status"
        >
          <div className="uk-row">
            <Momo mood={feedback.isCorrect ? 'happy' : 'encourage'} size={64} />
            <div>
              <strong>{feedback.isCorrect ? t('feedback.correct') : t('feedback.retry')}</strong>
              {feedback.hint && (
                <p style={{ margin: 0 }}>{t('round.hint', { hint: feedback.hint })}</p>
              )}
              {feedback.correctAnswer && (
                <p style={{ margin: 0 }}>{t('round.answer', { answer: feedback.correctAnswer })}</p>
              )}
            </div>
          </div>
          <div style={{ marginTop: 'var(--uk-space-3)' }}>
            <BigButton onClick={() => void next()} disabled={busy}>
              {isLast ? t('round.finish') : t('next')}
            </BigButton>
          </div>
        </div>
      )}

      <div>
        <Link className="uk-btn uk-btn--big uk-btn--ghost" to={`/play/topik/${topicId}`}>
          {t('round.quit')}
        </Link>
      </div>
    </div>
  );
}
