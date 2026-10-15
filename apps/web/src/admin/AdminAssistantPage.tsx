import { useCallback, useState } from 'react';
import { aiAssist, aiJobs, catalog } from '../api/admin';
import { ApiError } from '../api/client';
import { useAsync } from '../hooks/useAsync';
import { useT } from '../i18n';
import { formatDateTime } from '../lib/format';
import { ErrorState, LoadingState } from '../ui/states';

export function AdminAssistantPage() {
  const t = useT('admin');
  const loadCatalog = useCallback(() => catalog(), []);
  const loadJobs = useCallback(() => aiJobs(), []);
  const cat = useAsync(loadCatalog);
  const jobs = useAsync(loadJobs);

  const [topicId, setTopicId] = useState('matematika-kelas-1:A');
  const [purpose, setPurpose] = useState<'lesson' | 'curriculum'>('lesson');
  const [draft, setDraft] = useState('');
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (cat.loading) return <LoadingState />;
  if (cat.error || !cat.data) return <ErrorState onRetry={cat.reload} />;

  const topics = cat.data.books.flatMap((b) =>
    b.topics.map((tp) => ({ id: tp.id, label: `${b.title}: ${tp.code}. ${tp.title}` })),
  );

  async function ask() {
    setBusy(true);
    setError(null);
    setCopied(false);
    try {
      const res = await aiAssist(topicId, purpose);
      setDraft(res.draft);
      jobs.reload();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('error.generic'));
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(draft);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="uk-stack">
      <h1>{t('assistant.title')}</h1>
      <p style={{ margin: 0 }}>{t('assistant.hint')}</p>

      <div className="uk-row">
        <label className="uk-field">
          {t('assistant.topic')}
          <select
            value={topicId}
            onChange={(e) => setTopicId(e.target.value)}
            style={{ minHeight: 44, font: 'inherit' }}
          >
            {topics.map((tp) => (
              <option key={tp.id} value={tp.id}>
                {tp.label}
              </option>
            ))}
          </select>
        </label>
        <label className="uk-field">
          {t('assistant.purpose')}
          <select
            value={purpose}
            onChange={(e) => setPurpose(e.target.value as 'lesson' | 'curriculum')}
            style={{ minHeight: 44, font: 'inherit' }}
          >
            <option value="lesson">{t('assistant.lesson')}</option>
            <option value="curriculum">{t('assistant.curriculum')}</option>
          </select>
        </label>
        <button type="button" className="uk-btn" disabled={busy} onClick={() => void ask()}>
          {t('assistant.ask')}
        </button>
      </div>

      {error && <p role="alert">{error}</p>}

      {draft && (
        <section className="uk-card uk-stack">
          <h2>{t('assistant.draft')}</h2>
          <p style={{ margin: 0 }}>{draft}</p>
          <div>
            <button type="button" className="uk-btn uk-btn--ghost" onClick={() => void copy()}>
              {copied ? t('assistant.copied') : t('assistant.copy')}
            </button>
          </div>
        </section>
      )}

      <section className="uk-stack">
        <h2>{t('assistant.jobs')}</h2>
        {!jobs.data || jobs.data.jobs.length === 0 ? (
          <p>{t('assistant.noJobs')}</p>
        ) : (
          <div className="uk-table-wrap">
            <table className="uk-table">
              <tbody>
                {jobs.data.jobs.map((j) => (
                  <tr key={j.id}>
                    <td>{formatDateTime(j.createdAt)}</td>
                    <td>{j.topicTitle}</td>
                    <td>
                      {j.purpose === 'lesson' ? t('assistant.lesson') : t('assistant.curriculum')}
                    </td>
                    <td>{j.adminName}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
