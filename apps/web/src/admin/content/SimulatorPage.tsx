import { scoreRound, type PreviewResult } from '@udakids/engine';
import { useCallback, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { catalog, preview } from '../../api/admin';
import { errorMessage } from '../../api/client';
import { useSettings } from '../../api/settings';
import { speak, stopSpeaking } from '../../audio/speech';
import { AnswerOptions } from '../../components/AnswerOptions';
import { CountObjects } from '../../components/CountObjects';
import { Keypad } from '../../components/Keypad';
import { Momo } from '../../components/Momo';
import { RoundProgress } from '../../components/RoundProgress';
import { useAsync } from '../../hooks/useAsync';
import { t, type MessageKey } from '../../i18n';
import { ShellIconSvg } from '../../ui/AppShell';
import { ErrorState, LoadingState } from '../../ui/states';
import {
  Badge,
  Button,
  Card,
  Empty,
  Notice,
  PageHeader,
  SelectField,
  TextField,
} from '../../ui/ui';

type Question = PreviewResult['questions'][number];
type Answer = { chosen: string; isCorrect: boolean };
type Mode = 'play' | 'key';

const randomSeed = () => Math.floor(Math.random() * 1_000_000);

/** Satu soal seperti yang dilihat anak: dibacakan, dijawab, lalu diberi umpan balik dan petunjuk. */
function PlayQuestion({
  q,
  answer,
  onAnswer,
}: {
  q: Question;
  answer: Answer | undefined;
  onAnswer: (given: string) => void;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [value, setValue] = useState('');
  const isNumber = q.type === 'number';
  return (
    <div className="sim-question">
      <div className="sim-prompt">
        <p>{q.prompt}</p>
        <button
          type="button"
          className="ui-btn ui-btn-ghost sim-listen"
          aria-label={t('admin.sim.listen')}
          onClick={() => speak(q.prompt, { voice: undefined })}
        >
          <ShellIconSvg name="speaker" size={20} />
        </button>
      </div>
      {q.visual && <CountObjects visual={q.visual} />}
      {isNumber ? (
        <div className="sim-number">
          <Keypad value={answer ? answer.chosen : value} onChange={setValue} disabled={!!answer} />
          <Button disabled={!!answer || value === ''} onClick={() => onAnswer(value)}>
            {t('admin.sim.check')}
          </Button>
        </div>
      ) : (
        <AnswerOptions
          options={q.options ?? []}
          selected={selected}
          disabled={!!answer}
          onSelect={(v) => {
            setSelected(v);
            onAnswer(v);
          }}
          result={
            answer
              ? { chosen: answer.chosen, isCorrect: answer.isCorrect, correctAnswer: q.answer }
              : null
          }
        />
      )}
      {answer && (
        <div className={`sim-feedback ${answer.isCorrect ? 'is-right' : 'is-wrong'}`} role="status">
          <strong>{answer.isCorrect ? t('admin.sim.right') : t('admin.sim.wrong')}</strong>
          {!answer.isCorrect && <p>{t('admin.sim.correctAnswer', { answer: q.answer })}</p>}
          <p className="ui-muted">{q.explanation}</p>
        </div>
      )}
    </div>
  );
}

/** Bank Soal & Latihan: pilih level, lalu coba ronde 10 soal seperti anak atau lihat kunci jawabannya. */
export function SimulatorPage() {
  const load = useCallback(() => catalog(), []);
  const cat = useAsync(load);
  const billing = useSettings().billing;
  const [bookSlug, setBookSlug] = useState('');
  const [topicId, setTopicId] = useState('');
  const [levelId, setLevelId] = useState('');
  const [seed, setSeed] = useState(1);
  const [mode, setMode] = useState<Mode>('play');
  const [round, setRound] = useState<PreviewResult | null>(null);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  const books = useMemo(() => cat.data?.books ?? [], [cat.data]);
  const book = books.find((b) => b.slug === bookSlug) ?? books[0];
  const topic = book?.topics.find((x) => x.id === topicId) ?? book?.topics[0];
  const level = topic?.levels.find((l) => l.id === levelId) ?? topic?.levels[0];

  async function start(nextSeed = seed) {
    if (!level) return;
    stopSpeaking();
    setBusy(true);
    setError(undefined);
    try {
      const r = await preview(level.id, nextSeed);
      setRound(r);
      setIndex(0);
      setAnswers([]);
      if (mode === 'play' && r.questions[0]) speak(r.questions[0].prompt);
    } catch (err) {
      setRound(null);
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  function answer(given: string) {
    const q = round!.questions[index]!;
    const isCorrect = given.trim() === q.answer;
    setAnswers((a) => [...a, { chosen: given, isCorrect }]);
    speak(isCorrect ? t('admin.sim.right') : `${t('admin.sim.wrong')} ${q.explanation}`);
  }

  function next() {
    const n = index + 1;
    setIndex(n);
    const q = round?.questions[n];
    if (q) speak(q.prompt);
    else stopSpeaking();
  }

  if (cat.loading && !cat.data) return <LoadingState />;
  if (cat.error || !cat.data) return <ErrorState onRetry={cat.reload} />;

  const free = level ? !billing.paywall || level.isFree : false;
  const total = round?.questions.length ?? 0;
  const correct = answers.filter((a) => a.isCorrect).length;
  const finished = round !== null && answers.length === total && index >= total;
  const result = finished ? scoreRound(correct, total - correct, total) : null;
  const pick = (patch: { book?: string; topic?: string; level?: string }) => {
    if (patch.book !== undefined) {
      setBookSlug(patch.book);
      setTopicId('');
      setLevelId('');
    }
    if (patch.topic !== undefined) {
      setTopicId(patch.topic);
      setLevelId('');
    }
    if (patch.level !== undefined) setLevelId(patch.level);
    setRound(null);
    stopSpeaking();
  };

  return (
    <>
      <PageHeader title={t('admin.sim.title')} subtitle={t('admin.sim.subtitle')} />
      <div className="sim-layout">
        <Card title={t('admin.sim.pickTitle')}>
          <div className="sim-pickers">
            <SelectField
              label={t('admin.sim.book')}
              value={book?.slug ?? ''}
              onChange={(e) => pick({ book: e.target.value })}
              options={books.map((b) => ({ value: b.slug, label: b.title }))}
            />
            <SelectField
              label={t('admin.sim.topic')}
              value={topic?.id ?? ''}
              onChange={(e) => pick({ topic: e.target.value })}
              options={(book?.topics ?? []).map((x) => ({
                value: x.id,
                label: `${x.code}. ${x.title}`,
              }))}
            />
          </div>
          <fieldset className="sim-levels">
            <legend>{t('admin.sim.level')}</legend>
            {(topic?.levels ?? []).map((l) => {
              const isFree = !billing.paywall || l.isFree;
              return (
                <button
                  key={l.id}
                  type="button"
                  className={`sim-level${l.id === level?.id ? ' is-on' : ''}`}
                  aria-pressed={l.id === level?.id}
                  onClick={() => pick({ level: l.id })}
                >
                  <span className="adm-level-num">{l.number}</span>
                  <span className="sim-level-text">
                    <strong>{l.title}</strong>
                    <small>
                      {l.generator === null
                        ? t('admin.sim.noGenerator')
                        : isFree
                          ? t('admin.sim.free')
                          : t('admin.sim.premium')}
                    </small>
                  </span>
                </button>
              );
            })}
          </fieldset>
          <div className="sim-seed">
            <TextField
              label={t('admin.sim.seed')}
              hint={t('admin.sim.seedHint')}
              type="number"
              min={0}
              value={String(seed)}
              onChange={(e) => setSeed(Math.max(0, Number(e.target.value) || 0))}
            />
            <Button variant="secondary" onClick={() => setSeed(randomSeed())}>
              <ShellIconSvg name="play" size={18} />
              {t('admin.sim.random')}
            </Button>
          </div>
          <div className="dir-tabs" role="group" aria-label={t('admin.sim.modeLabel')}>
            {(['play', 'key'] as const).map((m) => (
              <button
                key={m}
                type="button"
                className={`ins-chip${m === mode ? ' is-on' : ''}`}
                aria-pressed={m === mode}
                onClick={() => {
                  setMode(m);
                  setRound(null);
                  stopSpeaking();
                }}
              >
                {t(`admin.sim.mode.${m}` as MessageKey)}
              </button>
            ))}
          </div>
          <Button
            disabled={busy || !level || level.generator === null}
            onClick={() => void start()}
          >
            {mode === 'play' ? t('admin.sim.start') : t('admin.sim.showKey')}
          </Button>
          {level && (
            <dl className="sim-meta">
              <dt>{t('admin.sim.metaGenerator')}</dt>
              <dd>
                <code className="adm-code-small">{level.generator ?? '—'}</code>
              </dd>
              <dt>{t('admin.sim.metaAccess')}</dt>
              <dd>
                <Badge tone={free ? 'success' : 'warning'}>
                  {free ? t('admin.sim.free') : t('admin.sim.premium')}
                </Badge>{' '}
                <Link to="/admin/konten">{t('admin.sim.editLevel')}</Link>
              </dd>
              <dt>{t('admin.sim.metaRule')}</dt>
              <dd>{t('admin.sim.rule')}</dd>
            </dl>
          )}
        </Card>

        <section className="sim-stage" aria-label={t('admin.sim.stage')}>
          {error && <Notice tone="error">{error}</Notice>}
          {!round ? (
            <div className="sim-empty">
              <Momo mood="curious" size={110} />
              <p>{t('admin.sim.empty')}</p>
            </div>
          ) : mode === 'key' ? (
            <ol className="sim-key">
              {round.questions.map((q) => (
                <li key={q.index}>
                  <div className="sim-key-head">
                    <span className="adm-level-num">{q.index + 1}</span>
                    <Badge tone="info">{t(`admin.sim.type.${q.type}` as MessageKey)}</Badge>
                  </div>
                  <strong>{q.prompt}</strong>
                  {q.visual && <CountObjects visual={q.visual} />}
                  {q.options && (
                    <ul className="sim-options">
                      {q.options.map((o) => (
                        <li key={o} className={o === q.answer ? 'is-answer' : undefined}>
                          {o}
                        </li>
                      ))}
                    </ul>
                  )}
                  <p>
                    {t('admin.sim.answer')}: <strong>{q.answer}</strong>
                  </p>
                  <p className="ui-muted">{q.explanation}</p>
                </li>
              ))}
            </ol>
          ) : result ? (
            <div className="sim-result" role="status">
              <Momo mood={result.passed ? 'proud' : 'encourage'} size={110} />
              <strong className="sim-score">{result.score}</strong>
              <p>{t('admin.sim.resultLine', { correct, total })}</p>
              <Badge tone={result.passed ? 'success' : 'warning'}>
                {result.passed ? t('admin.sim.passed') : t('admin.sim.notPassed')}
              </Badge>
              <div className="ui-row">
                <Button onClick={() => void start(seed)}>{t('admin.sim.again')}</Button>
                <Button
                  variant="secondary"
                  onClick={() => {
                    const s = randomSeed();
                    setSeed(s);
                    void start(s);
                  }}
                >
                  {t('admin.sim.newSeed')}
                </Button>
              </div>
            </div>
          ) : (
            <div className="sim-phone">
              <RoundProgress
                total={total}
                current={index}
                results={answers.map((a) => a.isCorrect)}
              />
              <PlayQuestion
                key={`${round.seed}:${index}`}
                q={round.questions[index]!}
                answer={answers[index]}
                onAnswer={answer}
              />
              {answers[index] && (
                <Button className="sim-next" onClick={next}>
                  {index === total - 1 ? t('admin.sim.finish') : t('admin.sim.next')}
                </Button>
              )}
            </div>
          )}
          {round && mode === 'key' && round.questions.length === 0 && (
            <Empty>{t('admin.sim.noQuestions')}</Empty>
          )}
        </section>
      </div>
    </>
  );
}
