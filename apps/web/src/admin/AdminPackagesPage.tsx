import type { BillingPackage } from '@udakids/engine';
import { useCallback, useState } from 'react';
import { adminPackages, updatePackage } from '../api/billing';
import { ApiError } from '../api/client';
import { useAsync } from '../hooks/useAsync';
import { useT } from '../i18n';
import { PageHeader } from '../ui/AppShell';
import { ErrorState, LoadingState } from '../ui/states';

function PackageRow({ pkg, onSaved }: { pkg: BillingPackage; onSaved: () => void }) {
  const t = useT('admin');
  const [name, setName] = useState(pkg.name);
  const [listPrice, setListPrice] = useState(String(pkg.listPrice));
  const [price, setPrice] = useState(String(pkg.price));
  const [active, setActive] = useState(pkg.active);
  const [message, setMessage] = useState<string | null>(null);

  async function save() {
    setMessage(null);
    try {
      await updatePackage(pkg.id, {
        name,
        listPrice: Number(listPrice),
        price: Number(price),
        active,
      });
      setMessage(t('content.saved'));
      onSaved();
    } catch (err) {
      setMessage(err instanceof ApiError ? err.message : t('error.generic'));
    }
  }

  return (
    <tr>
      <td>
        <input
          aria-label={`${t('packages.name')} ${pkg.name}`}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </td>
      <td>
        {pkg.durationDays === null
          ? t('packages.forever')
          : t('packages.days', { n: pkg.durationDays })}
      </td>
      <td>
        <input
          type="number"
          min={0}
          aria-label={`${t('packages.list')} ${pkg.name}`}
          value={listPrice}
          onChange={(e) => setListPrice(e.target.value)}
        />
      </td>
      <td>
        <input
          type="number"
          min={0}
          aria-label={`${t('packages.price')} ${pkg.name}`}
          value={price}
          onChange={(e) => setPrice(e.target.value)}
        />
      </td>
      <td>
        <label className="uk-check">
          <input
            type="checkbox"
            aria-label={`${t('packages.active')} ${pkg.name}`}
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

export function AdminPackagesPage() {
  const t = useT('admin');
  const load = useCallback(() => adminPackages(), []);
  const { data, error, loading, reload } = useAsync(load);

  if (loading && !data) return <LoadingState />;
  if (error || !data) return <ErrorState onRetry={reload} />;

  return (
    <div className="uk-stack">
      <PageHeader title={t('packages.title')} subtitle={t('packages.subtitle')} />
      <div className="uk-table-wrap">
        <table className="uk-table">
          <thead>
            <tr>
              <th scope="col">{t('packages.name')}</th>
              <th scope="col">{t('orders.col.package')}</th>
              <th scope="col">{t('packages.list')}</th>
              <th scope="col">{t('packages.price')}</th>
              <th scope="col">{t('packages.active')}</th>
              <th scope="col" />
            </tr>
          </thead>
          <tbody>
            {data.map((p) => (
              <PackageRow key={p.id} pkg={p} onSaved={() => undefined} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
