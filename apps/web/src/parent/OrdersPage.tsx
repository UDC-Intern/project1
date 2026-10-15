import { formatRupiah } from '@udakids/engine';
import { useCallback } from 'react';
import { Link } from 'react-router-dom';
import { orders } from '../api/billing';
import { useAsync } from '../hooks/useAsync';
import { useT } from '../i18n';
import { formatDateTime } from '../lib/format';
import { PageHeader } from '../ui/AppShell';
import { StatusBadge } from '../ui/StatusBadge';
import { ErrorState, LoadingState } from '../ui/states';

export function OrdersPage() {
  const t = useT('parent');
  const load = useCallback(() => orders(), []);
  const { data, error, loading, reload } = useAsync(load);

  if (loading) return <LoadingState />;
  if (error || !data) return <ErrorState onRetry={reload} />;

  return (
    <div className="uk-stack">
      <PageHeader
        title={t('orders.title')}
        subtitle={t('orders.subtitle')}
        actions={
          <Link className="uk-btn uk-btn--ghost" to="/orang-tua/paket">
            {t('orders.toPlan')}
          </Link>
        }
      />
      {data.length === 0 ? (
        <p>{t('orders.empty')}</p>
      ) : (
        <div className="uk-table-wrap">
          <table className="uk-table">
            <thead>
              <tr>
                <th scope="col">{t('orders.col.number')}</th>
                <th scope="col">{t('orders.col.date')}</th>
                <th scope="col">{t('orders.col.package')}</th>
                <th scope="col">{t('orders.col.amount')}</th>
                <th scope="col">{t('orders.col.status')}</th>
              </tr>
            </thead>
            <tbody>
              {data.map((o) => (
                <tr key={o.id}>
                  <td>
                    <Link to={`/orang-tua/transaksi/${o.id}`}>{o.number}</Link>
                  </td>
                  <td>{formatDateTime(o.createdAt)}</td>
                  <td>{o.packageName}</td>
                  <td>{formatRupiah(o.total)}</td>
                  <td>
                    <StatusBadge status={o.status} label={t(`status.${o.status}`)} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
