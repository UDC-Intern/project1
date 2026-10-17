import { useState, type FormEvent } from 'react';
import type { PaymentMethodInput } from '@udakids/engine';
import type { PaymentMethodRow } from '../../api/adminTypes';
import { useApiCall, useFetch } from '../../auth/useApi';
import { t } from '../../i18n';
import {
  Button,
  Card,
  Checkbox,
  PageHeader,
  RequiredNote,
  SelectField,
  Table,
  TextArea,
  TextField,
  type Column,
} from '../../ui/ui';
import {
  ActionNotice,
  ActiveBadge,
  Icon,
  Loadable,
  RowActions,
  useAction,
  useConfirm,
} from '../common';

type Kind = PaymentMethodRow['kind'];
const EMPTY: PaymentMethodInput = {
  kind: 'bank',
  name: '',
  number: '',
  holder: '',
  instructions: '',
  active: true,
  sort: 0,
};

const kindLabel = (k: Kind) =>
  k === 'bank' ? t('admin.pay.kindBank') : t('admin.pay.kindEwallet');

function MethodEditor({
  editing,
  onSaved,
  onCancel,
}: {
  editing: PaymentMethodRow | null;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const call = useApiCall('staff');
  const action = useAction();
  const [form, setForm] = useState<PaymentMethodInput>(() =>
    editing
      ? {
          kind: editing.kind,
          name: editing.name,
          number: editing.number,
          holder: editing.holder,
          instructions: editing.instructions ?? '',
          active: editing.active,
          sort: editing.sort,
        }
      : EMPTY,
  );
  const set = <K extends keyof PaymentMethodInput>(k: K, v: PaymentMethodInput[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    const body = { ...form, sort: Number(form.sort) || 0 };
    const out = await action.run(
      () =>
        editing
          ? call<PaymentMethodRow>(`/admin/payment-methods/${editing.id}`, { method: 'PUT', body })
          : call<PaymentMethodRow>('/admin/payment-methods', { method: 'POST', body }),
      t('admin.pay.saved', { name: form.name }),
    );
    if (out) {
      if (!editing) setForm(EMPTY);
      onSaved();
    }
  }

  return (
    <Card
      title={
        editing ? t('admin.pay.editTitle', { name: editing.name }) : t('admin.pay.createTitle')
      }
    >
      <ActionNotice error={action.error} done={action.done} />
      <form onSubmit={submit}>
        <RequiredNote />
        <div className="adm-fields">
          <SelectField
            label={t('admin.pay.kind')}
            value={form.kind}
            onChange={(v) => set('kind', v as Kind)}
            options={[
              { value: 'bank', label: t('admin.pay.kindBank') },
              { value: 'ewallet', label: t('admin.pay.kindEwallet') },
            ]}
          />
          <TextField
            label={t('admin.pay.provider')}
            hint={t('admin.pay.providerHint')}
            required
            minLength={2}
            maxLength={40}
            value={form.name}
            onChange={(e) => set('name', e.target.value)}
          />
          <TextField
            label={t('admin.pay.accountNumber')}
            required
            minLength={4}
            maxLength={40}
            value={form.number}
            onChange={(e) => set('number', e.target.value)}
          />
          <TextField
            label={t('admin.pay.accountName')}
            required
            minLength={2}
            maxLength={60}
            value={form.holder}
            onChange={(e) => set('holder', e.target.value)}
          />
          <TextField
            label={t('admin.pkg.sort')}
            type="number"
            min={0}
            max={999}
            value={String(form.sort)}
            onChange={(e) => set('sort', Number(e.target.value))}
          />
        </div>
        <TextArea
          className="adm-textarea"
          label={t('admin.pay.instructions')}
          hint={t('admin.pay.instructionsHint')}
          maxLength={300}
          rows={2}
          value={form.instructions}
          onChange={(e) => set('instructions', e.target.value)}
        />
        <Checkbox
          label={t('admin.pay.active')}
          checked={form.active}
          onChange={(e) => set('active', e.target.checked)}
        />
        <div className="ui-row">
          <Button type="submit" disabled={action.busy}>
            {editing ? (
              t('admin.save')
            ) : (
              <>
                <Icon name="plus" />
                {t('admin.pay.create')}
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

/** Rekening dan e-wallet tujuan transfer: daftar, tambah, ubah, hapus. */
export function PaymentMethodsPage() {
  const list = useFetch<PaymentMethodRow[]>('staff', '/admin/payment-methods');
  const call = useApiCall('staff');
  const action = useAction();
  const { ask, dialog } = useConfirm();
  const [editing, setEditing] = useState<PaymentMethodRow | null>(null);

  async function remove(m: PaymentMethodRow) {
    const yes = await ask({
      title: t('admin.pay.deleteTitle'),
      message: t('admin.pay.deleteConfirm', { name: `${m.name} ${m.number}` }),
      confirmLabel: t('admin.pay.deleteYes'),
    });
    if (!yes) return;
    const out = await action.run(
      () => call(`/admin/payment-methods/${m.id}`, { method: 'DELETE' }).then(() => true),
      t('admin.pay.deleted', { name: m.name }),
    );
    if (out) {
      if (editing?.id === m.id) setEditing(null);
      list.reload();
    }
  }

  const columns: Column<PaymentMethodRow>[] = [
    {
      key: 'provider',
      label: t('admin.pay.provider'),
      render: (m) => (
        <>
          <strong>{m.name}</strong>
          <div className="ui-muted">{kindLabel(m.kind)}</div>
        </>
      ),
    },
    {
      key: 'account',
      label: t('admin.pay.account'),
      render: (m) => (
        <>
          <span className="adm-code-small">{m.number}</span>
          <div className="ui-muted">{t('admin.pay.onBehalf', { name: m.holder })}</div>
        </>
      ),
    },
    {
      key: 'instructions',
      label: t('admin.pay.instructions'),
      render: (m) => m.instructions || '—',
    },
    {
      key: 'active',
      label: t('admin.col.status'),
      render: (m) => <ActiveBadge active={m.active} />,
    },
    {
      key: 'actions',
      label: t('admin.col.actions'),
      render: (m) => (
        <RowActions slots={[76, 40]}>
          <Button variant="ghost" size="sm" onClick={() => setEditing(m)}>
            {t('admin.edit')}
          </Button>
          <Button
            variant="danger"
            size="sm"
            disabled={action.busy}
            aria-label={t('admin.pay.deleteLabel', { name: m.name })}
            title={t('admin.pay.deleteLabel', { name: m.name })}
            onClick={() => void remove(m)}
          >
            <Icon name="trash" />
          </Button>
        </RowActions>
      ),
    },
  ];

  return (
    <>
      <PageHeader title={t('admin.pay.title')} subtitle={t('admin.pay.subtitle')} />
      <Card title={t('admin.pay.listTitle')}>
        <ActionNotice error={action.error} done={action.done} />
        <Loadable loading={list.loading} error={list.error} hasData={!!list.data}>
          {() => (
            <Table
              rows={list.data!}
              columns={columns}
              rowKey={(m) => m.id}
              empty={t('admin.pay.empty')}
              pageSize={10}
            />
          )}
        </Loadable>
      </Card>
      <MethodEditor
        key={editing?.id ?? 'new'}
        editing={editing}
        onSaved={() => {
          setEditing(null);
          list.reload();
        }}
        onCancel={() => setEditing(null)}
      />
      {dialog}
    </>
  );
}
