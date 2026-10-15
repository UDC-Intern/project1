import { useCallback, useState } from 'react';
import { revokePremium, setPremium, users } from '../api/admin';
import { ApiError } from '../api/client';
import { useAsync } from '../hooks/useAsync';
import { useT } from '../i18n';
import { formatDate } from '../lib/format';
import { Dialog } from '../ui/Dialog';
import { ErrorState, LoadingState } from '../ui/states';

type Child = Awaited<ReturnType<typeof users>>['parents'][number]['children'][number];

function inDays(days: number): string {
  const d = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  return d.toISOString().slice(0, 10);
}

export function AdminUsersPage() {
  const t = useT('admin');
  const [query, setQuery] = useState('');
  const load = useCallback(() => users(query), [query]);
  const { data, error, loading, reload } = useAsync(load);
  const [target, setTarget] = useState<Child | null>(null);
  const [date, setDate] = useState(inDays(30));
  const [message, setMessage] = useState<string | null>(null);

  async function activate() {
    if (!target) return;
    setMessage(null);
    try {
      await setPremium(target.id, new Date(`${date}T23:59:59`).toISOString());
      setTarget(null);
      reload();
    } catch (err) {
      setMessage(err instanceof ApiError ? err.message : t('error.generic'));
    }
  }

  async function revoke(child: Child) {
    await revokePremium(child.id);
    reload();
  }

  return (
    <div className="uk-stack">
      <h1>{t('users.title')}</h1>
      <label className="uk-field" style={{ maxWidth: 360 }}>
        {t('users.search')}
        <input value={query} onChange={(e) => setQuery(e.target.value)} />
      </label>

      {loading && !data && <LoadingState />}
      {error && <ErrorState onRetry={reload} />}
      {data && data.parents.length === 0 && <p>{t('users.none')}</p>}

      {data?.parents.map((p) => (
        <article key={p.id} className="uk-card uk-stack">
          <div>
            <strong>{p.name}</strong> ({p.email})
            <div>
              {t('users.code')}: {p.familyCode}
            </div>
          </div>
          <div className="uk-table-wrap">
            <table className="uk-table">
              <tbody>
                {p.children.map((c) => (
                  <tr key={c.id}>
                    <td>{c.nickname}</td>
                    <td>
                      <span className="uk-badge">
                        {c.plan === 'premium' && c.until
                          ? t('users.premium', { date: formatDate(c.until) })
                          : t('users.free')}
                      </span>
                    </td>
                    <td>
                      <div className="uk-row">
                        <button
                          type="button"
                          className="uk-btn uk-btn--ghost"
                          onClick={() => {
                            setTarget(c);
                            setMessage(null);
                          }}
                        >
                          {t('users.setPremium')}
                        </button>
                        {c.plan === 'premium' && (
                          <button
                            type="button"
                            className="uk-btn uk-btn--danger"
                            onClick={() => void revoke(c)}
                          >
                            {t('users.revoke')}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>
      ))}

      {target && (
        <Dialog
          title={t('users.dialogTitle', { nickname: target.nickname })}
          onClose={() => setTarget(null)}
        >
          <div className="uk-stack">
            <label className="uk-field">
              {t('users.until')}
              <input
                type="date"
                value={date}
                min={inDays(1)}
                onChange={(e) => setDate(e.target.value)}
              />
            </label>
            {message && <p role="alert">{message}</p>}
            <div className="uk-row">
              <button type="button" className="uk-btn" onClick={() => void activate()}>
                {t('users.activate')}
              </button>
              <button
                type="button"
                className="uk-btn uk-btn--ghost"
                onClick={() => setTarget(null)}
              >
                {t('users.cancel')}
              </button>
            </div>
          </div>
        </Dialog>
      )}
    </div>
  );
}
