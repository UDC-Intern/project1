import { ORDER_STATUSES, formatRupiah, type AdminOrder, type OrderStatus } from '@udakids/engine';
import { useCallback, useState } from 'react';
import { adminOrders, approveOrder, rejectOrder } from '../api/billing';
import { ApiError } from '../api/client';
import { useAsync } from '../hooks/useAsync';
import { useT } from '../i18n';
import { formatDateTime } from '../lib/format';
import { PageHeader } from '../ui/ui';
import { Dialog } from '../ui/Dialog';
import { StatusBadge } from '../ui/StatusBadge';
import { ErrorState, LoadingState } from '../ui/states';

export function AdminOrdersPage() {
  const t = useT('admin');
  const [status, setStatus] = useState<OrderStatus | null>(null);
  const load = useCallback(() => adminOrders(status), [status]);
  const { data, error, loading, reload } = useAsync(load);

  const [proof, setProof] = useState<AdminOrder | null>(null);
  const [rejecting, setRejecting] = useState<AdminOrder | null>(null);
  const [note, setNote] = useState('');
  const [message, setMessage] = useState<string | null>(null);

  async function approve(o: AdminOrder) {
    setMessage(null);
    try {
      await approveOrder(o.id);
      reload();
    } catch (err) {
      setMessage(err instanceof ApiError ? err.message : t('error.generic'));
    }
  }

  async function reject() {
    if (!rejecting) return;
    setMessage(null);
    try {
      await rejectOrder(rejecting.id, note);
      setRejecting(null);
      setNote('');
      reload();
    } catch (err) {
      setMessage(err instanceof ApiError ? err.message : t('error.generic'));
    }
  }

  return (
    <div className="uk-stack">
      <PageHeader title={t('orders.title')} subtitle={t('orders.subtitle')} />

      <label className="uk-field" style={{ maxWidth: 260 }}>
        {t('orders.filter')}
        <select
          value={status ?? ''}
          onChange={(e) => setStatus((e.target.value || null) as OrderStatus | null)}
          style={{ minHeight: 44, font: 'inherit' }}
        >
          <option value="">{t('orders.all')}</option>
          {ORDER_STATUSES.map((s) => (
            <option key={s} value={s}>
              {t(`status.${s}`)}
            </option>
          ))}
        </select>
      </label>

      {message && <p role="alert">{message}</p>}
      {loading && !data && <LoadingState />}
      {error && <ErrorState onRetry={reload} />}
      {data && data.length === 0 && <p>{t('orders.none')}</p>}

      {data && data.length > 0 && (
        <div className="uk-table-wrap">
          <table className="uk-table">
            <thead>
              <tr>
                <th scope="col">{t('orders.col.number')}</th>
                <th scope="col">{t('orders.col.date')}</th>
                <th scope="col">{t('orders.col.parent')}</th>
                <th scope="col">{t('orders.col.package')}</th>
                <th scope="col">{t('orders.col.total')}</th>
                <th scope="col">{t('orders.col.status')}</th>
                <th scope="col">{t('orders.col.action')}</th>
              </tr>
            </thead>
            <tbody>
              {data.map((o) => (
                <tr key={o.id}>
                  <td>{o.number}</td>
                  <td>{formatDateTime(o.createdAt)}</td>
                  <td>
                    {o.parentName}
                    <br />
                    <small>{o.parentEmail}</small>
                  </td>
                  <td>{o.packageName}</td>
                  <td>{formatRupiah(o.total)}</td>
                  <td>
                    <StatusBadge status={o.status} label={t(`status.${o.status}`)} />
                  </td>
                  <td>
                    <div className="uk-row">
                      {o.proofDataUrl ? (
                        <button
                          type="button"
                          className="uk-btn uk-btn--ghost"
                          onClick={() => setProof(o)}
                        >
                          {t('orders.preview')}
                        </button>
                      ) : (
                        <small>{t('orders.noProof')}</small>
                      )}
                      {o.status === 'awaiting_review' && (
                        <>
                          <button type="button" className="uk-btn" onClick={() => void approve(o)}>
                            {t('orders.approve')}
                          </button>
                          <button
                            type="button"
                            className="uk-btn uk-btn--danger"
                            onClick={() => setRejecting(o)}
                          >
                            {t('orders.reject')}
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {proof && (
        <Dialog
          title={t('orders.proofTitle', { number: proof.number })}
          onClose={() => setProof(null)}
        >
          <div className="uk-stack">
            {proof.proofDataUrl && (
              <img
                src={proof.proofDataUrl}
                alt={proof.proofName ?? 'Bukti transfer'}
                style={{ maxWidth: '100%', maxHeight: 360, objectFit: 'contain' }}
              />
            )}
            <button type="button" className="uk-btn" onClick={() => setProof(null)}>
              {t('orders.close')}
            </button>
          </div>
        </Dialog>
      )}

      {rejecting && (
        <Dialog title={t('orders.rejectTitle')} onClose={() => setRejecting(null)}>
          <div className="uk-stack">
            <label className="uk-field">
              {t('orders.rejectNote')}
              <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} />
            </label>
            {message && <p role="alert">{message}</p>}
            <div className="uk-row">
              <button type="button" className="uk-btn uk-btn--danger" onClick={() => void reject()}>
                {t('orders.rejectSend')}
              </button>
              <button
                type="button"
                className="uk-btn uk-btn--ghost"
                onClick={() => setRejecting(null)}
              >
                {t('orders.close')}
              </button>
            </div>
          </div>
        </Dialog>
      )}
    </div>
  );
}
