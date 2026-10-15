import { useEffect, useState, type ChangeEvent } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { formatRupiah, type OrderStatus } from '@udakids/engine';
import { errorMessage } from '../api/client';
import { useApiCall, useFetch } from '../auth/useApi';
import { t } from '../i18n';
import { Button, Card, Notice, PageHeader, Spinner, Table, TextField, formatDate } from '../ui/ui';
import type { Order } from './billingTypes';
import {
  Amount,
  CopyButton,
  StatusBadge,
  durationText,
  scopeText,
  useBookTitles,
} from './billingUi';
import { fetchProof, proofProblem, uploadProof } from './upload';

const canUpload = (s: OrderStatus) =>
  s === 'awaiting_payment' || s === 'awaiting_review' || s === 'rejected';

const hasObjectUrl = () => typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function';

/** Riwayat transaksi orang tua. */
export function OrdersPage() {
  const { data, error, loading, reload } = useFetch<Order[]>('parent', '/parent/orders');
  return (
    <>
      <PageHeader
        title={t('parent.orders.title')}
        subtitle={t('parent.orders.subtitle')}
        actions={
          <Link className="ui-btn ui-btn-secondary" to="/orang-tua/paket">
            {t('parent.nav.packages')}
          </Link>
        }
      />
      {loading && !data ? (
        <Spinner label={t('parent.loading')} />
      ) : error ? (
        <Notice tone="error">
          {t('parent.orders.loadError')} {errorMessage(error)}{' '}
          <Button variant="ghost" onClick={reload}>
            {t('parent.dash.retry')}
          </Button>
        </Notice>
      ) : (
        <Card>
          <Table
            rows={data ?? []}
            rowKey={(o) => o.id}
            empty={t('parent.orders.empty')}
            columns={[
              {
                key: 'number',
                label: t('parent.orders.number'),
                render: (o) => (
                  <Link to={`/orang-tua/transaksi/${o.id}`} className="pa-mono">
                    {o.number}
                  </Link>
                ),
              },
              {
                key: 'date',
                label: t('parent.orders.date'),
                render: (o) => formatDate(o.createdAt),
              },
              {
                key: 'package',
                label: t('parent.orders.package'),
                render: (o) => o.packageSnapshot.name,
              },
              {
                key: 'amount',
                label: t('parent.orders.amount'),
                render: (o) => formatRupiah(o.amount),
              },
              {
                key: 'status',
                label: t('parent.orders.status'),
                render: (o) => <StatusBadge status={o.status} />,
              },
            ]}
          />
        </Card>
      )}
    </>
  );
}

const STEPS = ['created', 'proof', 'paid'] as const;

function Timeline({ status }: { status: OrderStatus }) {
  if (status === 'expired' || status === 'cancelled') return null;
  const reached =
    status === 'awaiting_payment' || status === 'rejected'
      ? 0
      : status === 'awaiting_review'
        ? 1
        : 2;
  return (
    <ol className="pa-timeline" aria-label={t('parent.order.timeline')}>
      {STEPS.map((s, i) => (
        <li
          key={s}
          className={i <= reached ? 'pa-step done' : 'pa-step'}
          aria-current={i === reached ? 'step' : undefined}
        >
          <span className="pa-step-dot" aria-hidden>
            {i + 1}
          </span>
          {t(`parent.order.step.${s}`)}
        </li>
      ))}
    </ol>
  );
}

function StatusNotice({ order }: { order: Order }) {
  switch (order.status) {
    case 'awaiting_payment':
      return (
        <Notice tone="info">
          {t('parent.order.payBefore', { when: formatDate(order.expiresAt) })}
        </Notice>
      );
    case 'awaiting_review':
      return <Notice tone="info">{t('parent.order.reviewing')}</Notice>;
    case 'paid':
      return <Notice tone="success">{t('parent.order.paid')}</Notice>;
    case 'rejected':
      return (
        <Notice tone="warning">
          {t('parent.order.rejected', { note: order.note ?? t('parent.order.noReason') })}
        </Notice>
      );
    case 'expired':
      return <Notice tone="info">{t('parent.order.expired')}</Notice>;
    case 'cancelled':
      return <Notice tone="info">{t('parent.order.cancelled')}</Notice>;
  }
}

function PaymentCard({ order }: { order: Order }) {
  const m = order.methodSnapshot;
  const final = order.priceNormal - order.discount;
  return (
    <Card title={t('parent.order.payTitle')}>
      <div className="pa-pay">
        <p className="pa-pay-label">{t('parent.order.amountLabel')}</p>
        <div className="pa-pay-amount-row">
          <Amount value={order.amount} className="pa-amount-big" />
          <CopyButton text={String(order.amount)} label={t('parent.order.copyAmount')} />
        </div>
        <p className="ui-hint">{t('parent.order.exact')}</p>
        <dl className="pa-breakdown">
          <dt>{t('parent.order.priceNormal')}</dt>
          <dd>{formatRupiah(order.priceNormal)}</dd>
          {order.discount > 0 && (
            <>
              <dt>{t('parent.order.discount')}</dt>
              <dd>−{formatRupiah(order.discount)}</dd>
            </>
          )}
          {order.discount > 0 && (
            <>
              <dt>{t('parent.order.priceFinal')}</dt>
              <dd>{formatRupiah(final)}</dd>
            </>
          )}
          <dt>{t('parent.order.uniqueCode')}</dt>
          <dd>+{formatRupiah(order.uniqueCode)}</dd>
          <dt>{t('parent.order.total')}</dt>
          <dd>
            <strong>{formatRupiah(order.amount)}</strong>
          </dd>
        </dl>
      </div>
      <div className="pa-pay-method">
        <h3>
          {t('parent.order.to', {
            kind:
              m.kind === 'bank' ? t('parent.billing.kindBank') : t('parent.billing.kindEwallet'),
            provider: m.provider,
          })}
        </h3>
        <div className="pa-pay-amount-row">
          <span className="pa-mono pa-account">{m.accountNumber}</span>
          <CopyButton text={m.accountNumber} label={t('parent.order.copyAccount')} />
        </div>
        <p>{t('parent.billing.accountName', { name: m.accountName })}</p>
        {m.instructions && <p className="pa-instructions">{m.instructions}</p>}
      </div>
    </Card>
  );
}

function ProofCard({ order, onUpdated }: { order: Order; onUpdated: (o: Order) => void }) {
  const [file, setFile] = useState<File>();
  const [preview, setPreview] = useState<string>();
  const [problem, setProblem] = useState<string>();
  const [error, setError] = useState<string>();
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [view, setView] = useState<{ url?: string; mime: string }>();
  const [viewError, setViewError] = useState<string>();

  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview);
    },
    [preview],
  );
  useEffect(
    () => () => {
      if (view?.url) URL.revokeObjectURL(view.url);
    },
    [view],
  );

  function choose(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    setSent(false);
    setError(undefined);
    setPreview(undefined);
    if (!f) {
      setFile(undefined);
      setProblem(undefined);
      return;
    }
    const p = proofProblem(f);
    setProblem(p);
    setFile(p ? undefined : f);
    if (!p && f.type.startsWith('image/') && hasObjectUrl()) setPreview(URL.createObjectURL(f));
  }

  async function send() {
    if (!file) {
      setProblem(t('parent.order.proofMissing'));
      return;
    }
    setBusy(true);
    setError(undefined);
    try {
      const updated = await uploadProof(order.id, file);
      setSent(true);
      setFile(undefined);
      setPreview(undefined);
      setView(undefined);
      onUpdated(updated);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function show() {
    setViewError(undefined);
    try {
      const blob = await fetchProof(order.id);
      setView({
        mime: blob.type || order.proofMime || '',
        ...(hasObjectUrl() && { url: URL.createObjectURL(blob) }),
      });
    } catch (err) {
      setViewError(errorMessage(err));
    }
  }

  const upload = canUpload(order.status);
  if (!upload && !order.proofAt) return null;

  return (
    <Card title={t('parent.order.proofTitle')}>
      {sent && <Notice tone="success">{t('parent.order.proofSent')}</Notice>}
      {order.proofAt && (
        <div className="ui-row pa-gap">
          <span>{t('parent.order.proofAt', { when: formatDate(order.proofAt) })}</span>
          <Button variant="ghost" onClick={show}>
            {t('parent.order.proofView')}
          </Button>
        </div>
      )}
      {viewError && <Notice tone="error">{viewError}</Notice>}
      {view?.url &&
        (view.mime.startsWith('image/') ? (
          <img className="pa-proof-img" src={view.url} alt={t('parent.order.proofAlt')} />
        ) : (
          <p>
            <a href={view.url} target="_blank" rel="noreferrer">
              {t('parent.order.proofOpenPdf')}
            </a>
          </p>
        ))}
      {upload && (
        <>
          {error && <Notice tone="error">{error}</Notice>}
          <TextField
            type="file"
            accept="image/*,application/pdf"
            label={order.proofAt ? t('parent.order.proofReplace') : t('parent.order.proofChoose')}
            hint={t('parent.order.proofHint')}
            error={problem}
            onChange={choose}
          />
          {preview && (
            <img className="pa-proof-img" src={preview} alt={t('parent.order.proofPreview')} />
          )}
          <Button disabled={busy || !file} onClick={send}>
            {busy ? t('parent.order.proofSending') : t('parent.order.proofSend')}
          </Button>
        </>
      )}
    </Card>
  );
}

function CancelOrder({ order, onUpdated }: { order: Order; onUpdated: (o: Order) => void }) {
  const call = useApiCall('parent');
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  if (order.status !== 'awaiting_payment') return null;

  async function cancel() {
    setBusy(true);
    setError(undefined);
    try {
      onUpdated(await call<Order>(`/parent/orders/${order.id}/cancel`, { method: 'POST' }));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
      setConfirming(false);
    }
  }

  return (
    <div className="pa-gap">
      {error && <Notice tone="error">{error}</Notice>}
      {confirming ? (
        <div className="pa-confirm" role="alertdialog" aria-labelledby={`cancel-${order.id}`}>
          <p id={`cancel-${order.id}`}>{t('parent.order.cancelConfirm')}</p>
          <div className="ui-row">
            <Button variant="danger" disabled={busy} onClick={cancel}>
              {t('parent.order.cancelYes')}
            </Button>
            <Button variant="ghost" disabled={busy} onClick={() => setConfirming(false)}>
              {t('parent.order.cancelNo')}
            </Button>
          </div>
        </div>
      ) : (
        <Button variant="ghost" onClick={() => setConfirming(true)}>
          {t('parent.order.cancel')}
        </Button>
      )}
    </div>
  );
}

/** Detail pesanan: jumlah transfer + kode unik, rekening tujuan, unggah bukti, status. */
export function OrderPage() {
  const { id } = useParams();
  const created = (useLocation().state as { created?: boolean } | null)?.created === true;
  const { data, error, loading, reload, setData } = useFetch<Order>(
    'parent',
    id ? `/parent/orders/${id}` : null,
  );
  const title = useBookTitles(data?.packageSnapshot.scope === 'books');

  if (loading && !data) return <Spinner label={t('parent.loading')} />;
  if (error || !data) {
    return (
      <>
        <Notice tone="error">
          {t('parent.order.loadError')} {errorMessage(error)}{' '}
          <Button variant="ghost" onClick={reload}>
            {t('parent.dash.retry')}
          </Button>
        </Notice>
        <Link to="/orang-tua/transaksi">{t('parent.order.back')}</Link>
      </>
    );
  }
  const order = data;
  const snap = order.packageSnapshot;
  const showPayment = order.status === 'awaiting_payment' || order.status === 'rejected';

  return (
    <>
      <p className="pa-back">
        <Link to="/orang-tua/transaksi">{t('parent.order.back')}</Link>
      </p>
      <PageHeader
        title={t('parent.order.title', { number: order.number })}
        subtitle={`${snap.name} · ${scopeText(snap.scope, snap.books, title)} · ${durationText(snap.durationDays)}`}
        actions={<StatusBadge status={order.status} />}
      />
      {created && order.status === 'awaiting_payment' && (
        <Notice tone="success">{t('parent.order.created')}</Notice>
      )}
      <Timeline status={order.status} />
      <StatusNotice order={order} />
      {showPayment && <PaymentCard order={order} />}
      <ProofCard order={order} onUpdated={setData} />
      <CancelOrder order={order} onUpdated={setData} />
      <p className="ui-hint">
        {t('parent.order.createdAt', { when: formatDate(order.createdAt) })}
      </p>
    </>
  );
}
