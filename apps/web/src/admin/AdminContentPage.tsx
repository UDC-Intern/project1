import { useCallback, useState } from 'react';
import { catalog, updateLevel, updateTopic } from '../api/admin';
import { ApiError } from '../api/client';
import { useAsync } from '../hooks/useAsync';
import { useT } from '../i18n';
import { FormField } from '../ui/FormField';
import { ErrorState, LoadingState } from '../ui/states';

type Catalog = Awaited<ReturnType<typeof catalog>>;
type Topic = Catalog['books'][number]['topics'][number];

function TopicEditor({ topic, onSaved }: { topic: Topic; onSaved: () => void }) {
  const t = useT('admin');
  const [title, setTitle] = useState(topic.title);
  const [lesson, setLesson] = useState(topic.lesson);
  const [levels, setLevels] = useState(topic.levels);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setError(null);
    setMessage(null);
    try {
      await updateTopic(topic.id, { title, lesson });
      for (const level of levels) {
        const original = topic.levels.find((l) => l.id === level.id)!;
        if (original.title !== level.title || original.isFree !== level.isFree)
          await updateLevel(level.id, { title: level.title, isFree: level.isFree });
      }
      setMessage(t('content.saved'));
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('error.generic'));
    }
  }

  return (
    <article className="uk-card uk-stack">
      <h3>
        {topic.code}. {topic.title}
      </h3>
      <FormField
        label={t('content.topicTitle')}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        maxLength={60}
      />
      <label className="uk-field">
        {t('content.lesson')}
        <textarea
          value={lesson}
          onChange={(e) => setLesson(e.target.value)}
          rows={4}
          maxLength={600}
          style={{ font: 'inherit', padding: 'var(--uk-space-2)' }}
        />
      </label>
      <div className="uk-table-wrap">
        <table className="uk-table">
          <tbody>
            {levels.map((level, i) => (
              <tr key={level.id}>
                <td>{level.number}</td>
                <td>
                  <input
                    aria-label={`${t('content.levelTitle')} ${level.number}`}
                    value={level.title}
                    maxLength={60}
                    onChange={(e) =>
                      setLevels(
                        levels.map((l, j) => (j === i ? { ...l, title: e.target.value } : l)),
                      )
                    }
                    style={{ width: '100%', font: 'inherit', padding: 4 }}
                  />
                </td>
                <td>
                  <label className="uk-check">
                    <input
                      type="checkbox"
                      aria-label={`${t('content.isFree')} ${level.number}`}
                      checked={level.isFree}
                      disabled={level.number === 1}
                      onChange={(e) =>
                        setLevels(
                          levels.map((l, j) => (j === i ? { ...l, isFree: e.target.checked } : l)),
                        )
                      }
                    />
                    <span>{level.isFree ? t('content.free') : t('content.premium')}</span>
                  </label>
                </td>
                <td>{level.generator ?? t('content.noGenerator')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {error && (
        <p role="alert" style={{ color: 'var(--uk-danger)', margin: 0 }}>
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="uk-note-ok" style={{ margin: 0 }}>
          {message}
        </p>
      )}
      <div>
        <button type="button" className="uk-btn" onClick={() => void save()}>
          {t('content.save')}
        </button>
      </div>
    </article>
  );
}

export function AdminContentPage() {
  const t = useT('admin');
  const load = useCallback(() => catalog(), []);
  const { data, error, loading, reload } = useAsync(load);

  if (loading && !data) return <LoadingState />;
  if (error || !data) return <ErrorState onRetry={reload} />;

  return (
    <div className="uk-stack">
      <h1>{t('content.title')}</h1>
      <p style={{ margin: 0 }}>{t('content.hint')}</p>
      {data.books.map((book) => (
        <section key={book.id} className="uk-stack">
          <h2>{book.title}</h2>
          {book.topics.map((topic) => (
            <TopicEditor key={topic.id} topic={topic} onSaved={() => undefined} />
          ))}
        </section>
      ))}
    </div>
  );
}
