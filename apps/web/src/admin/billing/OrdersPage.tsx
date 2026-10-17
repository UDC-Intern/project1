import { useEffect, useState, type FormEvent } from 'react';
import { formatRupiah, type OrderStatus } from '@udakids/engine';
import { errorMessage } from '../../api/client';
import { useApiCall, useFetch } from '../../auth/useApi';
import { t, type MessageKey } from '../../i18n';
import type { Order } from '../../parent/billingTypes';
import {
  Badge,
  Button,
  Card,
  formatDate,
  Notice,
  PageHeader,
  Spinner,
  Table,
  TextField,
  type Column,
} from '../../ui/ui';
import {
  ActionNotice,
  confirmAction,
  Icon,
  Loadable,
  notifyOrdersChanged,
  useAction,
} from '../common';

/** Pesanan di panel admin: pesanan orang tua ditambah nama dan email orang tuanya. */
export type OrderRow = Order & { parentName?: string; parentEmail?: string };

type Filter = OrderStatus | 'all';

const STATUS: Record<
  OrderStatus,
  { label: MessageKey; tone: 'success' | 'warning' | 'info' | 'muted' }
> = {
  awaiting_review: { label: 'admin.order.status.awaiting_review', tone: 'info' },
  awaiting_payment: { label: 'admin.order.status.awaiting_payment', tone: 'warning' },
  paid: { label: 'admin.order.status.paid', tone: 'success' },
  rejected: { label: 'admin.order.status.rejected', tone: 'muted' },
  expired: { label: 'admin.order.status.expired', tone: 'muted' },
  cancelled: { label: 'admin.order.status.cancelled', tone: 'muted' },
};

const FILTERS: Filter[] = [
  'awaiting_review',
  'awaiting_payment',
  'paid',
  'rejected',
  'expired',
  'cancelled',
  'all',
];

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  const s = STATUS[status];
  return <Badge tone={s?.tone ?? 'muted'}>{s ? t(s.label) : status}</Badge>;
}

/** Bukti transfer yang diunggah orang tua, dibuka di tab baru bila diketuk. */
function Proof({ order }: { order: OrderRow }) {
  const proof = useFetch<{ dataUrl: string | null }>(
    'staff',
    order.proofMime ? `/admin/orders/${order.id}/proof` : null,
  );
  if (!order.proofMime) return <p className="ui-muted">{t('admin.order.noProof')}</p>;
  if (proof.error) return <Notice tone="error">{errorMessage(proof.error)}</Notice>;
  if (!proof.data) return <Spinner label={t('admin.loading')} />;
  if (!proof.data.dataUrl) return <p className="ui-muted">{t('admin.order.noProof')}</p>;
  return (
    <a href={proof.data.dataUrl} target="_blank" rel="noreferrer">
      <img
        className="adm-proof"
        src={proof.data.dataUrl}
        alt={t('admin.order.proofAlt', { number: order.number })}
      />
    </a>
  );
}

function OrderDetail({
  order,
  onChanged,
  onClose,
}: {
  order: OrderRow;
  onChanged: (o: OrderRow) => void;
  onClose: () => void;
}) {
  const call = useApiCall('staff');
  const action = useAction();
  const [reason, setReason] = useState('');
  const canApprove = order.status !== 'paid' && order.status !== 'cancelled';
  const canReject = order.status === 'awaiting_review' || order.status === 'awaiting_payment';

  async function approve() {
    if (
      !confirmAction(
        t('admin.order.approveConfirm', {
          number: order.number,
          amount: formatRupiah(order.amount),
        }),
      )
    )
      return;
    const out = await action.run(
      () => call<OrderRow>(`/admin/orders/${order.id}/approve`, { method: 'POST', body: {} }),
      t('admin.order.approved', { number: order.number }),
    );
    if (out) {
      notifyOrdersChanged();
      onChanged({ ...order, ...out });
    }
  }

  async function reject(e: FormEvent) {
    e.preventDefault();
    const out = await action.run(
      () =>
        call<OrderRow>(`/admin/orders/${order.id}/reject`, {
          method: 'POST',
          body: { reason: reason.trim() },
        }),
      t('admin.order.rejected', { number: order.number }),
    );
    if (out) {
      setReason('');
      notifyOrdersChanged();
      onChanged({ ...order, ...out });
    }
  }

  const m = order.methodSnapshot;
  return (
    <Card
      title={t('admin.order.detailTitle', { number: order.number })}
      actions={
        <Button variant="ghost" onClick={onClose}>
          {t('admin.order.closeDetail')}
        </Button>
      }
    >
      <ActionNotice error={action.error} done={action.done} />
      <div className="adm-two">
        <dl className="adm-summary">
          <dt>{t('admin.col.status')}</dt>
          <dd>
            <OrderStatusBadge status={order.status} />
          </dd>
          <dt>{t('admin.col.parent')}</dt>
          <dd>
            {order.parentName ?? '—'}
            <div className="ui-muted">{order.parentEmail}</div>
          </dd>
          <dt>{t('admin.order.package')}</dt>
          <dd>{order.packageSnapshot.name}</dd>
          <dt>{t('admin.order.amount')}</dt>
          <dd>
            <strong>{formatRupiah(order.amount)}</strong>
            <div className="ui-muted">
              {t('admin.order.breakdown', {
                normal: formatRupiah(order.priceNormal),
                discount: formatRupiah(order.discount),
              })}{' '}
              <mark className="adm-unique">+{order.uniqueCode}</mark>
            </div>
          </dd>
          <dt>{t('admin.order.method')}</dt>
          <dd>
            {m.provider} · <span className="adm-code-small">{m.accountNumber}</span>
            <div className="ui-muted">{t('admin.pay.onBehalf', { name: m.accountName })}</div>
          </dd>
          <dt>{t('admin.col.created')}</dt>
          <dd>{formatDate(order.createdAt)}</dd>
          {order.status === 'awaiting_payment' && (
            <>
              <dt>{t('admin.order.expires')}</dt>
              <dd>{formatDate(order.expiresAt)}</dd>
            </>
          )}
          {order.proofAt && (
            <>
              <dt>{t('admin.order.proofAt')}</dt>
              <dd>{formatDate(order.proofAt)}</dd>
            </>
          )}
          {order.reviewedAt && (
            <>
              <dt>{t('admin.order.reviewedAt')}</dt>
              <dd>{formatDate(order.reviewedAt)}</dd>
            </>
          )}
          {order.note && (
            <>
              <dt>{t('admin.order.note')}</dt>
              <dd>{order.note}</dd>
            </>
          )}
        </dl>
        <div>
          <h3 className="adm-group-title">{t('admin.order.proof')}</h3>
          <Proof order={order} />
        </div>
      </div>
      {(canApprove || canReject) && (
        <div className="adm-order-actions">
          {canApprove && (
            <Button disabled={action.busy} onClick={() => void approve()}>
              <Icon name="check" />
              {t('admin.order.approve')}
            </Button>
          )}
          {canReject && (
            <form className="adm-inline-form" onSubmit={reject}>
              <TextField
                label={t('admin.order.rejectReason')}
                required
                minLength={3}
                maxLength={200}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
              <Button type="submit" variant="danger" disabled={action.busy}>
                {t('admin.order.reject')}
              </Button>
            </form>
          )}
        </div>
      )}
    </Card>
  );
}

/** Transaksi: saring per status, buka detail, lihat bukti, setujui atau tolak dengan alasan. */
export function OrdersPage() {
  const [filter, setFilter] = useState<Filter>('awaiting_review');
  const [selected, setSelected] = useState<OrderRow | null>(null);
  const list = useFetch<OrderRow[]>(
    'staff',
    filter === 'all' ? '/admin/orders' : `/admin/orders?status=${filter}`,
  );
  // Detail yang terbuka mengikuti data terbaru setelah daftar dimuat ulang.
  useEffect(() => {
    if (!selected || !list.data) return;
    const fresh = list.data.find((o) => o.id === selected.id);
    if (fresh && fresh.status !== selected.status) setSelected(fresh);
  }, [list.data, selected]);

  const columns: Column<OrderRow>[] = [
    {
      key: 'number',
      label: t('admin.order.number'),
      render: (o) => (
        <>
          <span className="adm-code-small">{o.number}</span>
          <div className="ui-muted">{formatDate(o.createdAt)}</div>
        </>
      ),
    },
    {
      key: 'parent',
      label: t('admin.col.parent'),
      render: (o) => (
        <>
          {o.parentName ?? '—'}
          <div className="ui-muted">{o.parentEmail}</div>
        </>
      ),
    },
    { key: 'package', label: t('admin.order.package'), render: (o) => o.packageSnapshot.name },
    {
      key: 'amount',
      label: t('admin.order.amount'),
      render: (o) => (
        <>
          <strong>{formatRupiah(o.amount)}</strong>
          <div className="ui-muted">
            {t('admin.order.uniqueCode')} <mark className="adm-unique">+{o.uniqueCode}</mark>
          </div>
        </>
      ),
    },
    { key: 'method', label: t('admin.order.method'), render: (o) => o.methodSnapshot.provider },
    {
      key: 'status',
      label: t('admin.col.status'),
      render: (o) => <OrderStatusBadge status={o.status} />,
    },
    {
      key: 'actions',
      label: t('admin.col.actions'),
      render: (o) => (
        <Button
          variant="secondary"
          aria-label={t('admin.order.openLabel', { number: o.number })}
          onClick={() => setSelected(o)}
        >
          {t('admin.order.open')}
        </Button>
      ),
    },
  ];

  return (
    <>
      <PageHeader title={t('admin.order.title')} subtitle={t('admin.order.subtitle')} />
      <div className="adm-tabs" role="group" aria-label={t('admin.order.filterLabel')}>
        {FILTERS.map((f) => (
          <Button
            key={f}
            variant={f === filter ? 'primary' : 'secondary'}
            aria-pressed={f === filter}
            onClick={() => {
              setFilter(f);
              setSelected(null);
            }}
          >
            {f === 'all' ? t('admin.filter.all') : t(STATUS[f].label)}
          </Button>
        ))}
        <Button variant="ghost" onClick={list.reload} aria-label={t('admin.order.refresh')}>
          <Icon name="refresh" />
        </Button>
      </div>
      {selected && (
        <OrderDetail
          key={selected.id}
          order={selected}
          onClose={() => setSelected(null)}
          onChanged={(o) => {
            setSelected(o);
            list.reload();
          }}
        />
      )}
      <Card>
        <Loadable loading={list.loading} error={list.error} hasData={!!list.data}>
          {() => (
            <Table
              key={filter}
              rows={list.data!}
              columns={columns}
              rowKey={(o) => o.id}
              empty={t('admin.order.empty')}
              pageSize={10}
            />
          )}
        </Loadable>
      </Card>
    </>
  );
}
