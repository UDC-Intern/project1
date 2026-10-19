import { emailSchema } from '@udakids/engine';
import { useState, type FormEvent } from 'react';
import type { StaffUser } from '../../api/adminTypes';
import { useSession } from '../../auth/session';
import { useApiCall, useFetch } from '../../auth/useApi';
import { t } from '../../i18n';
import {
  Badge,
  Button,
  Card,
  formatDate,
  PageHeader,
  PasswordField,
  Table,
  TextField,
  type Column,
} from '../../ui/ui';
import {
  ActionNotice,
  ActiveBadge,
  Icon,
  Loadable,
  RowActions,
  RowGap,
  useAction,
} from '../common';
import { MIN_PASSWORD, PasswordSetter } from './PasswordSetter';

function CreateStaff({ onCreated }: { onCreated: (u: StaffUser) => void }) {
  const call = useApiCall('staff');
  const action = useAction();
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [emailError, setEmailError] = useState<string>();
  async function submit(e: FormEvent) {
    e.preventDefault();
    // Format email dicek sama seperti server (rapikan, huruf kecil, format).
    const parsed = emailSchema.safeParse(form.email);
    if (!parsed.success) {
      setEmailError(t('admin.staff.emailInvalid'));
      return;
    }
    setEmailError(undefined);
    const out = await action.run(
      () => call<StaffUser>('/admin/staff', { method: 'POST', body: form }),
      t('admin.staff.created', { name: form.name }),
    );
    if (out) {
      onCreated(out);
      setForm({ name: '', email: '', password: '' });
    }
  }
  return (
    <Card title={t('admin.staff.createTitle')}>
      <ActionNotice error={action.error} done={action.done} />
      <form onSubmit={submit}>
        <div className="adm-fields">
          <TextField
            label={t('admin.user.name')}
            required
            maxLength={60}
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
          <TextField
            label={t('admin.user.email')}
            type="email"
            required
            maxLength={254}
            autoComplete="off"
            error={emailError}
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
          <PasswordField
            label={t('admin.user.password')}
            hint={t('admin.user.passwordHint', { n: MIN_PASSWORD })}
            autoComplete="new-password"
            required
            minLength={MIN_PASSWORD}
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
          />
        </div>
        <Button type="submit" disabled={action.busy}>
          <Icon name="plus" />
          {t('admin.staff.create')}
        </Button>
      </form>
    </Card>
  );
}

/** Akun staf admin: daftar, tambah, nonaktifkan, dan atur password. */
export function StaffPage() {
  const staff = useFetch<StaffUser[]>('staff', '/admin/staff');
  const me = useSession('staff');
  const call = useApiCall('staff');
  const action = useAction();

  async function patch(
    u: StaffUser,
    body: { active: boolean } | { password: string },
    done: string,
  ) {
    const out = await action.run(
      () => call<StaffUser>(`/admin/staff/${u.id}`, { method: 'PATCH', body }),
      done,
    );
    if (out) staff.setData((xs) => xs?.map((x) => (x.id === u.id ? { ...x, ...out } : x)));
    return !!out;
  }

  const columns: Column<StaffUser>[] = [
    {
      key: 'name',
      label: t('admin.user.name'),
      render: (u) => (
        <>
          <strong>{u.name}</strong>{' '}
          {u.id === me?.user.id && <Badge tone="info">{t('admin.staff.you')}</Badge>}
          <div className="ui-muted">{u.email}</div>
        </>
      ),
    },
    {
      key: 'active',
      label: t('admin.col.status'),
      render: (u) => <ActiveBadge active={u.active} />,
    },
    { key: 'created', label: t('admin.col.created'), render: (u) => formatDate(u.createdAt) },
    {
      key: 'actions',
      label: t('admin.col.actions'),
      render: (u) => (
        <RowActions slots={[116, 128]} label={t('admin.staff.actionsFor', { name: u.name })}>
          {u.id !== me?.user.id ? (
            <Button
              variant={u.active ? 'danger' : 'secondary'}
              size="sm"
              disabled={action.busy}
              onClick={() =>
                void patch(
                  u,
                  { active: !u.active },
                  u.active
                    ? t('admin.staff.deactivated', { name: u.name })
                    : t('admin.staff.activated', { name: u.name }),
                )
              }
            >
              {u.active ? t('admin.user.deactivate') : t('admin.user.activate')}
            </Button>
          ) : (
            <RowGap />
          )}
          <PasswordSetter
            busy={action.busy}
            onSubmit={(password) =>
              patch(u, { password }, t('admin.user.passwordSet', { name: u.name }))
            }
          />
        </RowActions>
      ),
    },
  ];

  return (
    <>
      <PageHeader title={t('admin.staff.title')} subtitle={t('admin.staff.subtitle')} />
      <Card title={t('admin.staff.listTitle')}>
        <ActionNotice error={action.error} done={action.done} />
        <Loadable loading={staff.loading} error={staff.error} hasData={!!staff.data}>
          {() => <Table rows={staff.data!} columns={columns} rowKey={(u) => u.id} pageSize={10} />}
        </Loadable>
      </Card>
      <CreateStaff onCreated={(u) => staff.setData((xs) => [...(xs ?? []), u])} />
    </>
  );
}
