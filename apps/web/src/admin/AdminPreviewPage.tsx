import { useCallback, useState } from 'react';
import { catalog, preview } from '../api/admin';
import { ApiError } from '../api/client';
import { CountObjects } from '../components/CountObjects';
import { useAsync } from '../hooks/useAsync';
import { useT } from '../i18n';
import { ErrorState, LoadingState } from '../ui/states';

type Result = Awaited<ReturnType<typeof preview>>;

export function AdminPreviewPage() {
  const t = useT('admin');
  const load = useCallback(() => catalog(), []);
  const { data, error, loading, reload } = useAsync(load);
  const [levelId, setLevelId] = useState('matematika-kelas-1:A:1');
  const [seed, setSeed] = useState(1);
  const [result, setResult] = useState<Result | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  if (loading) return <LoadingState />;
  if (error || !data) return <ErrorState onRetry={reload} />;

  const levels = data.books.flatMap((b) =>
    b.topics.flatMap((tp) =>
      tp.levels.map((l) => ({
        id: l.id,
        label: `${b.title} / ${tp.code}. ${tp.title} / Level ${l.number}`,
        generator: l.generator,
      })),
    ),
  );

  async function show() {
    setMessage(null);
    try {
      setResult(await preview(levelId, seed));
    } catch (err) {
      setResult(null);
      setMessage(err instanceof ApiError ? err.message : t('error.generic'));
    }
  }

  return (
    <div className="uk-stack">
      <h1>{t('preview.title')}</h1>
      <p style={{ margin: 0 }}>{t('preview.hint')}</p>
      <div className="uk-row">
        <label className="uk-field">
          {t('preview.level')}
          <select
            value={levelId}
            onChange={(e) => setLevelId(e.target.value)}
            style={{ minHeight: 44, font: 'inherit' }}
          >
            {levels.map((l) => (
              <option key={l.id} value={l.id}>
                {l.label}
                {l.generator ? '' : ` (${t('preview.noGenerator')})`}
              </option>
            ))}
          </select>
        </label>
        <label className="uk-field">
          {t('preview.seed')}
          <input
            type="number"
            min={0}
            value={seed}
            onChange={(e) => setSeed(Math.max(0, Number(e.target.value) || 0))}
          />
        </label>
        <button
          type="button"
          className="uk-btn uk-btn--ghost"
          onClick={() => setSeed(Math.floor(Math.random() * 1_000_000))}
        >
          {t('preview.random')}
        </button>
        <button type="button" className="uk-btn" onClick={() => void show()}>
          {t('preview.show')}
        </button>
      </div>

      {message && <p role="alert">{message}</p>}

      {result && (
        <ol className="uk-stack" style={{ paddingLeft: 20 }}>
          {result.questions.map((q) => (
            <li key={q.index}>
              <div className="uk-card uk-stack">
                <strong>{q.prompt}</strong>
                {q.visual && <CountObjects visual={q.visual} />}
                {q.options && <span>{q.options.join(' | ')}</span>}
                <span>
                  {t('preview.answer')}: <strong>{q.answer}</strong>
                </span>
                <span>
                  {t('preview.explanation')}: {q.explanation}
                </span>
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
