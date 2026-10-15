import type { PaymentMethod } from '@udakids/engine';
import { useCallback, useState } from 'react';
import { adminMethods, updateMethod } from '../api/billing';
import { ApiError } from '../api/client';
import { useAsync } from '../hooks/useAsync';
import { useT } from '../i18n';
import { PageHeader } from '../ui/AppShell';
import { ErrorState, LoadingState } from '../ui/states';

function MethodRow({ method }: { method: PaymentMethod }) {
  const t = useT('admin');
  const [number, setNumber] = useState(method.number);
  const [holder, setHolder] = useState(method.holder);
  const [active, setActive] = useState(method.active);
  const [message, setMessage] = useState<string | null>(null);

  async function save() {
    setMessage(null);
    try {
      await updateMethod(method.id, { number, holder, active });
      setMessage(t('content.saved'));
    } catch (err) {
      setMessage(err instanceof ApiError ? err.message : t('error.generic'));
    }
  }

  return (
    <tr>
      <td>
        <strong>{method.name}</strong>
        <br />
        <small>{method.kind === 'bank' ? 'Transfer bank' : 'E-wallet'}</small>
      </td>
      <td>
        <input
          aria-label={`${t('methods.number')} ${method.name}`}
          value={number}
          onChange={(e) => setNumber(e.target.value)}
        />
      </td>
      <td>
        <input
          aria-label={`${t('methods.holder')} ${method.name}`}
          value={holder}
          onChange={(e) => setHolder(e.target.value)}
        />
      </td>
      <td>
        <label className="uk-check">
          <input
            type="checkbox"
            aria-label={`${t('methods.active')} ${method.name}`}
            checked={active}
            onChange={(e) => setActive(e.target.checked)}
          />
        </label>
      </td>
      <td>
        <button type="button" className="uk-btn" onClick={() => void save()}>
          {t('packages.save')}
        </button>
        {message && <small role="status"> {message}</small>}
      </td>
    </tr>
  );
}

export function AdminMethodsPage() {
  const t = useT('admin');
  const load = useCallback(() => adminMethods(), []);
  const { data, error, loading, reload } = useAsync(load);

  if (loading && !data) return <LoadingState />;
  if (error || !data) return <ErrorState onRetry={reload} />;

  return (
    <div className="uk-stack">
      <PageHeader title={t('methods.title')} subtitle={t('methods.subtitle')} />
      <div className="uk-table-wrap">
        <table className="uk-table">
          <thead>
            <tr>
              <th scope="col">{t('methods.name')}</th>
              <th scope="col">{t('methods.number')}</th>
              <th scope="col">{t('methods.holder')}</th>
              <th scope="col">{t('methods.active')}</th>
              <th scope="col" />
            </tr>
          </thead>
          <tbody>
            {data.map((m) => (
              <MethodRow key={m.id} method={m} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
