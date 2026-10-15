import {
  MAX_PROOF_BYTES,
  PROOF_TYPES,
  formatRupiah,
  needsAction,
  splitTransfer,
  type Order,
} from '@udakids/engine';
import { useCallback, useState, type ChangeEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { cancelOrder, order as loadOrder, uploadProof } from '../api/billing';
import { ApiError } from '../api/client';
import { useAsync } from '../hooks/useAsync';
import { useT } from '../i18n';
import { formatDateTime } from '../lib/format';
import { PageHeader } from '../ui/AppShell';
import { StatusBadge } from '../ui/StatusBadge';
import { ErrorState, LoadingState } from '../ui/states';

function Steps({ status }: { status: Order['status'] }) {
  const t = useT('parent');
  const current = status === 'paid' ? 3 : status === 'proof_sent' ? 2 : 1;
  return (
    <ol className="order-steps" aria-label={t('order.how')}>
      {[1, 2, 3].map((n) => (
        <li
          key={n}
          className={
            n < current || status === 'paid' ? 'is-done' : n === current ? 'is-current' : ''
          }
          aria-current={n === current ? 'step' : undefined}
        >
          <span className="order-step-dot">{n}</span>
          <span>{t(`order.step.${n}`)}</span>
        </li>
      ))}
    </ol>
  );
}

function CopyButton({ text, label, done }: { text: string; label: string; done: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="uk-btn uk-btn--ghost"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
        } catch {
          setCopied(false);
        }
      }}
    >
      {copied ? done : label}
    </button>
  );
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export function OrderPage() {
  const t = useT('parent');
  const { id = '' } = useParams();
  const load = useCallback(() => loadOrder(id), [id]);
  const { data, error, loading, reload } = useAsync(load);
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (loading && !data) return <LoadingState />;
  if (error || !data) return <ErrorState onRetry={reload} />;

  const [head, tail] = splitTransfer(data.total);
  const canPay = data.status === 'awaiting_payment' || data.status === 'rejected';
  const duration =
    data.durationDays === null
      ? t('plan.duration.forever')
      : t('plan.duration.days', { n: data.durationDays });

  function onPick(e: ChangeEvent<HTMLInputElement>) {
    const picked = e.target.files?.[0] ?? null;
    setFileError(null);
    setFile(null);
    if (!picked) return;
    if (!(PROOF_TYPES as readonly string[]).includes(picked.type)) {
      setFileError(t('order.proof.type'));
      return;
    }
    if (picked.size > MAX_PROOF_BYTES) {
      setFileError(t('order.proof.big'));
      return;
    }
    setFile(picked);
  }

  async function send() {
    if (!file) return;
    setBusy(true);
    setMessage(null);
    try {
      await uploadProof(data!.id, {
        fileName: file.name,
        mime: file.type as (typeof PROOF_TYPES)[number],
        size: file.size,
        dataUrl: await readAsDataUrl(file),
      });
      setFile(null);
      reload();
    } catch (err) {
      setMessage(err instanceof ApiError ? err.message : t('error.generic'));
    } finally {
      setBusy(false);
    }
  }

  async function cancel() {
    try {
      await cancelOrder(data!.id);
      reload();
    } catch (err) {
      setMessage(err instanceof ApiError ? err.message : t('error.generic'));
    }
  }

  return (
    <div className="uk-stack">
      <nav aria-label="Breadcrumb" className="crumbs">
        <Link to="/orang-tua/transaksi">{t('order.crumb.orders')}</Link>
        <span aria-hidden="true"> › </span>
        <span>{t('order.crumb.order', { number: data.number })}</span>
      </nav>

      <PageHeader
        title={data.number}
        subtitle={t('order.sub', { name: data.packageName, duration })}
        actions={<StatusBadge status={data.status} label={t(`status.${data.status}`)} />}
      />

      {data.status === 'awaiting_payment' && (
        <p className="banner banner-ok" role="status">
          {t('order.created')}
        </p>
      )}
      {data.status === 'paid' && (
        <p className="banner banner-ok" role="status">
          {t('order.paid')}
        </p>
      )}
      {data.status === 'expired' && (
        <p className="banner banner-warn" role="status">
          {t('order.expired')}
        </p>
      )}
      {data.status === 'rejected' && data.rejectNote && (
        <p className="banner banner-warn" role="alert">
          {t('order.proof.rejected', { note: data.rejectNote })}
        </p>
      )}

      <Steps status={data.status} />

      {canPay && (
        <p className="banner banner-info">
          {t('order.payBefore', { date: formatDateTime(data.expiresAt) })}
        </p>
      )}

      <section className="uk-card uk-stack" aria-labelledby="how-title">
        <h2 id="how-title" style={{ margin: 0 }}>
          {t('order.how')}
        </h2>

        <div>
          <p style={{ margin: 0 }}>{t('order.amount')}</p>
          <p className="transfer-amount" aria-label={formatRupiah(data.total)}>
            <span>{head}</span>
            <mark>{tail}</mark>
          </p>
          <CopyButton
            text={String(data.total)}
            label={t('order.copyAmount')}
            done={t('order.copied')}
          />
          <p style={{ margin: '8px 0 0' }}>{t('order.exact')}</p>
        </div>

        <dl className="order-sum">
          <div>
            <dt>{t('order.sum.list')}</dt>
            <dd>{formatRupiah(data.listPrice)}</dd>
          </div>
          <div>
            <dt>{t('order.sum.discount')}</dt>
            <dd>-{formatRupiah(data.discount)}</dd>
          </div>
          <div>
            <dt>{t('order.sum.price')}</dt>
            <dd>{formatRupiah(data.price)}</dd>
          </div>
          <div>
            <dt>{t('order.sum.code')}</dt>
            <dd>{formatRupiah(data.uniqueCode)}</dd>
          </div>
          <div className="is-total">
            <dt>{t('order.sum.total')}</dt>
            <dd>{formatRupiah(data.total)}</dd>
          </div>
        </dl>

        <div className="method-box">
          <p style={{ margin: 0 }}>{t('order.to', { method: data.methodName })}</p>
          <p className="method-number">{data.methodNumber}</p>
          <CopyButton
            text={data.methodNumber}
            label={t('order.copyNumber')}
            done={t('order.copied')}
          />
          <p style={{ margin: '8px 0 0' }}>
            {t('order.holder')}: <strong>{data.methodHolder}</strong>
          </p>
        </div>
      </section>

      {canPay && (
        <section className="uk-card uk-stack" aria-labelledby="proof-title">
          <h2 id="proof-title" style={{ margin: 0 }}>
            {t('order.proof.title')}
          </h2>
          <p style={{ margin: 0 }}>{t('order.proof.hint')}</p>
          <label className="uk-field">
            {t('order.proof.file')}
            <input type="file" accept="image/jpeg,image/png,image/webp" onChange={onPick} />
          </label>
          {fileError && (
            <p role="alert" style={{ color: 'var(--bahaya)', margin: 0 }}>
              {fileError}
            </p>
          )}
          {message && <p role="alert">{message}</p>}
          <div className="uk-row">
            <button
              type="button"
              className="uk-btn"
              disabled={!file || busy}
              onClick={() => void send()}
            >
              {t('order.proof.send')}
            </button>
            <button type="button" className="uk-btn uk-btn--ghost" onClick={() => void cancel()}>
              {t('order.cancel')}
            </button>
          </div>
        </section>
      )}

      {data.status === 'proof_sent' && data.proofName && (
        <p className="banner banner-info" role="status">
          {t('order.proof.sent', { name: data.proofName })}
        </p>
      )}
      {needsAction(data.status) ? null : null}
    </div>
  );
}
