import { useState, type FormEvent } from 'react';
import { formatRupiah, type PackageInput } from '@udakids/engine';
import type { PackageRow } from '../../api/adminTypes';
import { useApiCall, useFetch } from '../../auth/useApi';
import { t } from '../../i18n';
import {
  Button,
  Card,
  Checkbox,
  PageHeader,
  RequiredNote,
  Table,
  TextArea,
  TextField,
  type Column,
} from '../../ui/ui';
import { ActionNotice, ActiveBadge, confirmAction, Icon, Loadable, useAction } from '../common';

type Form = {
  name: string;
  description: string;
  durationDays: string;
  listPrice: string;
  price: string;
  active: boolean;
  sort: string;
};

const EMPTY: Form = {
  name: '',
  description: '',
  durationDays: '',
  listPrice: '',
  price: '',
  active: true,
  sort: '0',
};

const toForm = (p: PackageRow): Form => ({
  name: p.name,
  description: p.description ?? '',
  durationDays: p.durationDays === null ? '' : String(p.durationDays),
  listPrice: String(p.listPrice),
  price: String(p.price),
  active: p.active,
  sort: String(p.sort),
});

/** Angka bulat dari isian (titik ribuan diabaikan); kosong atau tidak valid: NaN. */
export function parseAmount(v: string): number {
  const s = v.replace(/[.\s]/g, '');
  return /^\d+$/.test(s) ? Number(s) : NaN;
}

/** Formulir menjadi body API (pemeriksaan akhir oleh server). */
export function toPackageInput(f: Form): PackageInput {
  return {
    name: f.name.trim(),
    description: f.description.trim(),
    durationDays: f.durationDays.trim() === '' ? null : Number(f.durationDays),
    listPrice: parseAmount(f.listPrice),
    price: parseAmount(f.price),
    active: f.active,
    sort: Number(f.sort) || 0,
  };
}

function PriceCell({ p }: { p: Pick<PackageRow, 'pricing'> }) {
  const { normal, discount, final, discountActive } = p.pricing;
  return (
    <div className="adm-price">
      {discountActive && (
        <s
          className="ui-muted"
          aria-label={t('admin.pkg.normalPrice', { price: formatRupiah(normal) })}
        >
          {formatRupiah(normal)}
        </s>
      )}
      <strong>{formatRupiah(final)}</strong>
      {discountActive && (
        <small className="adm-price-cut">
          {t('admin.pkg.discountCut', { amount: formatRupiah(discount) })}
        </small>
      )}
    </div>
  );
}

function PackageEditor({
  editing,
  onSaved,
  onCancel,
}: {
  editing: PackageRow | null;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const call = useApiCall('staff');
  const action = useAction();
  const [form, setForm] = useState<Form>(editing ? toForm(editing) : EMPTY);
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }));
  const input = toPackageInput(form);
  const valid = Number.isFinite(input.listPrice) && Number.isFinite(input.price) && input.price > 0;
  const tooHigh = valid && input.price > input.listPrice;

  async function submit(e: FormEvent) {
    e.preventDefault();
    const out = await action.run(
      () =>
        editing
          ? call<PackageRow>(`/admin/packages/${editing.id}`, { method: 'PUT', body: input })
          : call<PackageRow>('/admin/packages', { method: 'POST', body: input }),
      editing
        ? t('admin.pkg.saved', { name: input.name })
        : t('admin.pkg.created', { name: input.name }),
    );
    if (out) {
      if (!editing) setForm(EMPTY);
      onSaved();
    }
  }

  return (
    <Card
      title={
        editing ? t('admin.pkg.editTitle', { name: editing.name }) : t('admin.pkg.createTitle')
      }
    >
      <ActionNotice error={action.error} done={action.done} />
      <form onSubmit={submit}>
        <RequiredNote />
        <div className="adm-fields">
          <TextField
            label={t('admin.pkg.name')}
            required
            minLength={3}
            maxLength={40}
            value={form.name}
            onChange={(e) => set('name', e.target.value)}
          />
          <TextField
            label={t('admin.pkg.listPrice')}
            hint={t('admin.pkg.listPriceHint')}
            required
            inputMode="numeric"
            value={form.listPrice}
            onChange={(e) => set('listPrice', e.target.value)}
          />
          <TextField
            label={t('admin.pkg.price')}
            hint={t('admin.pkg.priceHint')}
            required
            inputMode="numeric"
            value={form.price}
            error={tooHigh ? t('admin.pkg.priceTooHigh') : undefined}
            onChange={(e) => set('price', e.target.value)}
          />
          <TextField
            label={t('admin.pkg.duration')}
            hint={t('admin.pkg.durationHint')}
            type="number"
            min={1}
            max={3650}
            value={form.durationDays}
            onChange={(e) => set('durationDays', e.target.value)}
          />
          <TextField
            label={t('admin.pkg.sort')}
            hint={t('admin.pkg.sortHint')}
            type="number"
            min={0}
            max={999}
            value={form.sort}
            onChange={(e) => set('sort', e.target.value)}
          />
        </div>
        <TextArea
          className="adm-textarea"
          label={t('admin.pkg.description')}
          maxLength={300}
          rows={2}
          value={form.description}
          onChange={(e) => set('description', e.target.value)}
        />
        <Checkbox
          label={t('admin.pkg.active')}
          checked={form.active}
          onChange={(e) => set('active', e.target.checked)}
        />

        <div className="adm-price-preview" aria-live="polite">
          <strong>{t('admin.pkg.preview')}</strong>
          {valid && !tooHigh ? (
            <dl>
              <div>
                <dt>{t('admin.pkg.normal')}</dt>
                <dd>{formatRupiah(input.listPrice)}</dd>
              </div>
              <div>
                <dt>{t('admin.pkg.discountShort')}</dt>
                <dd>
                  {input.listPrice > input.price
                    ? `− ${formatRupiah(input.listPrice - input.price)}`
                    : '—'}
                </dd>
              </div>
              <div>
                <dt>{t('admin.pkg.final')}</dt>
                <dd>
                  <strong>{formatRupiah(input.price)}</strong>
                </dd>
              </div>
            </dl>
          ) : (
            <span className="ui-muted"> {t('admin.pkg.previewEmpty')}</span>
          )}
        </div>

        <div className="ui-row">
          <Button type="submit" disabled={action.busy || tooHigh}>
            {editing ? (
              t('admin.save')
            ) : (
              <>
                <Icon name="plus" />
                {t('admin.pkg.create')}
              </>
            )}
          </Button>
          {editing && (
            <Button variant="ghost" onClick={onCancel}>
              {t('admin.cancel')}
            </Button>
          )}
        </div>
      </form>
    </Card>
  );
}

/** Paket: daftar dengan harga dan jumlah terjual, tambah, ubah, dan hapus. */
export function PackagesPage() {
  const list = useFetch<PackageRow[]>('staff', '/admin/packages');
  const call = useApiCall('staff');
  const action = useAction();
  const [editing, setEditing] = useState<PackageRow | null>(null);
  const [deleted, setDeleted] = useState<string>();

  async function remove(p: PackageRow) {
    if (!confirmAction(t('admin.pkg.deleteConfirm', { name: p.name }))) return;
    setDeleted(undefined);
    const out = await action.run(() =>
      call<{ deleted: boolean; deactivated: boolean }>(`/admin/packages/${p.id}`, {
        method: 'DELETE',
      }),
    );
    if (!out) return;
    // Paket yang sudah pernah dipesan hanya dinonaktifkan (riwayat tetap utuh).
    setDeleted(
      out.deactivated
        ? t('admin.pkg.deactivated', { name: p.name })
        : t('admin.pkg.deleted', { name: p.name }),
    );
    if (editing?.id === p.id) setEditing(null);
    list.reload();
  }

  const columns: Column<PackageRow>[] = [
    {
      key: 'name',
      label: t('admin.pkg.name'),
      render: (p) => (
        <>
          <strong>{p.name}</strong>
          {p.description && <div className="ui-muted">{p.description}</div>}
        </>
      ),
    },
    { key: 'price', label: t('admin.pkg.colPrice'), render: (p) => <PriceCell p={p} /> },
    {
      key: 'duration',
      label: t('admin.pkg.colDuration'),
      render: (p) =>
        p.durationDays === null
          ? t('admin.pkg.forever')
          : t('admin.pkg.days', { n: p.durationDays }),
    },
    {
      key: 'active',
      label: t('admin.col.status'),
      render: (p) => <ActiveBadge active={p.active} />,
    },
    { key: 'sold', label: t('admin.pkg.sold'), render: (p) => p.sold },
    {
      key: 'actions',
      label: t('admin.col.actions'),
      render: (p) => (
        <div className="ui-row">
          <Button variant="secondary" onClick={() => setEditing(p)}>
            {t('admin.edit')}
          </Button>
          <Button
            variant="danger"
            disabled={action.busy}
            aria-label={t('admin.pkg.deleteLabel', { name: p.name })}
            onClick={() => void remove(p)}
          >
            <Icon name="trash" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader title={t('admin.pkg.title')} subtitle={t('admin.pkg.subtitle')} />
      <Card title={t('admin.pkg.listTitle')}>
        <ActionNotice error={action.error} done={deleted} />
        <Loadable loading={list.loading} error={list.error} hasData={!!list.data}>
          {() => (
            <Table
              rows={list.data!}
              columns={columns}
              rowKey={(p) => p.id}
              empty={t('admin.pkg.empty')}
              pageSize={10}
            />
          )}
        </Loadable>
      </Card>
      <PackageEditor
        key={editing?.id ?? 'new'}
        editing={editing}
        onSaved={() => {
          setEditing(null);
          list.reload();
        }}
        onCancel={() => setEditing(null)}
      />
    </>
  );
}
