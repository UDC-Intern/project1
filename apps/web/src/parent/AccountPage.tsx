import { useState, type FormEvent } from 'react';
import {
  emailChangeConfirmSchema,
  emailChangeRequestSchema,
  parentProfileSchema,
  passwordChangeSchema,
  type SessionUser,
} from '@udakids/engine';
import { errorMessage } from '../api/client';
import { getSession, setSession } from '../auth/session';
import { useApiCall, useFetch } from '../auth/useApi';
import { t } from '../i18n';
import {
  Button,
  Card,
  formatDate,
  Notice,
  PageHeader,
  PasswordField,
  Spinner,
  TextField,
} from '../ui/ui';
import { fieldErrors, serverFieldErrors } from './form';

/** Data akun orang tua dari GET /parent/account. */
export type ParentAccount = {
  name: string;
  email: string;
  familyCode: string;
  mustChangePassword: boolean;
  passwordChangedAt: string | null;
  pendingEmail: string | null;
};

/** Hook kecil untuk status formulir: pesan sukses/galat + error per field. */
function useFormState() {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string>();
  const [done, setDone] = useState<string>();
  const [busy, setBusy] = useState(false);
  return { errors, setErrors, error, setError, done, setDone, busy, setBusy };
}

function ProfileCard({
  account,
  onSaved,
}: {
  account: ParentAccount;
  onSaved: (a: ParentAccount) => void;
}) {
  const call = useApiCall('parent');
  const f = useFormState();
  const [name, setName] = useState(account.name);

  async function submit(e: FormEvent) {
    e.preventDefault();
    f.setError(undefined);
    f.setDone(undefined);
    const parsed = parentProfileSchema.safeParse({ name });
    if (!parsed.success) return f.setErrors(fieldErrors(parsed.error.issues));
    f.setErrors({});
    f.setBusy(true);
    try {
      const next = await call<ParentAccount>('/parent/account', {
        method: 'PATCH',
        body: parsed.data,
      });
      onSaved(next);
      // Nama di menu samping ikut berubah.
      const s = getSession('parent');
      if (s) setSession('parent', { ...s, user: { ...s.user, name: next.name } });
      f.setDone(t('parent.account.profileSaved'));
    } catch (err) {
      f.setError(errorMessage(err));
      f.setErrors(serverFieldErrors(err));
    } finally {
      f.setBusy(false);
    }
  }

  return (
    <Card title={t('parent.account.profile')} className="acct-card">
      <p className="acct-intro">{t('parent.account.profileIntro')}</p>
      {f.error && <Notice tone="error">{f.error}</Notice>}
      {f.done && <Notice tone="success">{f.done}</Notice>}
      <form onSubmit={submit} noValidate>
        <TextField
          required
          label={t('parent.account.name')}
          autoComplete="name"
          maxLength={60}
          value={name}
          error={f.errors.name}
          onChange={(e) => setName(e.target.value)}
        />
        <div className="acct-actions">
          <Button type="submit" disabled={f.busy || name.trim() === account.name}>
            {f.busy ? t('parent.loading') : t('parent.account.saveProfile')}
          </Button>
        </div>
      </form>
    </Card>
  );
}

function EmailCard({
  account,
  onSaved,
}: {
  account: ParentAccount;
  onSaved: (a: ParentAccount) => void;
}) {
  const call = useApiCall('parent');
  const f = useFormState();
  const [email, setEmail] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [code, setCode] = useState('');
  const [pending, setPending] = useState(account.pendingEmail);

  async function request(e: FormEvent) {
    e.preventDefault();
    f.setError(undefined);
    f.setDone(undefined);
    const parsed = emailChangeRequestSchema.safeParse({ email, currentPassword });
    if (!parsed.success) return f.setErrors(fieldErrors(parsed.error.issues));
    f.setErrors({});
    f.setBusy(true);
    try {
      const res = await call<{ pendingEmail: string; mockCode?: string }>('/parent/account/email', {
        body: parsed.data,
      });
      setPending(res.pendingEmail);
      setCurrentPassword('');
      f.setDone(
        t('parent.account.emailCodeSent', { email: res.pendingEmail }) +
          (res.mockCode ? ` Kode mode tiruan: ${res.mockCode}.` : ''),
      );
    } catch (err) {
      f.setError(errorMessage(err));
      f.setErrors(serverFieldErrors(err));
    } finally {
      f.setBusy(false);
    }
  }

  async function confirm(e: FormEvent) {
    e.preventDefault();
    f.setError(undefined);
    f.setDone(undefined);
    const parsed = emailChangeConfirmSchema.safeParse({ code });
    if (!parsed.success) return f.setErrors({ code: t('parent.verify.codeInvalid') });
    f.setErrors({});
    f.setBusy(true);
    try {
      const next = await call<ParentAccount>('/parent/account/email/verify', { body: parsed.data });
      onSaved(next);
      setPending(null);
      setEmail('');
      setCode('');
      f.setDone(t('parent.account.emailChanged', { email: next.email }));
    } catch (err) {
      f.setError(errorMessage(err));
      setCode('');
    } finally {
      f.setBusy(false);
    }
  }

  return (
    <Card title={t('parent.account.email')} className="acct-card">
      <p className="acct-intro">
        {t('parent.account.emailNow')} <strong className="acct-break">{account.email}</strong>
      </p>
      {f.error && <Notice tone="error">{f.error}</Notice>}
      {f.done && <Notice tone="success">{f.done}</Notice>}
      {pending ? (
        <form onSubmit={confirm} noValidate>
          <Notice tone="info">{t('parent.account.emailPending', { email: pending })}</Notice>
          <TextField
            required
            label={t('parent.verify.code')}
            hint={t('parent.account.emailCodeHint')}
            className="pa-otp"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]*"
            maxLength={6}
            value={code}
            error={f.errors.code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
          />
          <div className="acct-actions">
            <Button type="submit" disabled={f.busy || code.length !== 6}>
              {f.busy ? t('parent.loading') : t('parent.account.emailConfirm')}
            </Button>
            <Button
              variant="ghost"
              disabled={f.busy}
              onClick={() => {
                setPending(null);
                f.setDone(undefined);
                f.setError(undefined);
              }}
            >
              {t('parent.account.emailRestart')}
            </Button>
          </div>
        </form>
      ) : (
        <form onSubmit={request} noValidate>
          <TextField
            required
            label={t('parent.account.newEmail')}
            type="email"
            autoComplete="email"
            value={email}
            error={f.errors.email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <PasswordField
            required
            label={t('parent.account.currentPassword')}
            autoComplete="current-password"
            value={currentPassword}
            error={f.errors.currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
          />
          <div className="acct-actions">
            <Button type="submit" disabled={f.busy}>
              {f.busy ? t('parent.loading') : t('parent.account.emailSend')}
            </Button>
          </div>
        </form>
      )}
    </Card>
  );
}

function PasswordCard({
  account,
  onSaved,
}: {
  account: ParentAccount;
  onSaved: (a: ParentAccount) => void;
}) {
  const call = useApiCall('parent');
  const f = useFormState();
  const [currentPassword, setCurrentPassword] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');

  async function submit(e: FormEvent) {
    e.preventDefault();
    f.setError(undefined);
    f.setDone(undefined);
    const parsed = passwordChangeSchema.safeParse({ currentPassword, password });
    const next = parsed.success ? {} : fieldErrors(parsed.error.issues);
    if (confirm !== password && !next.password) next.confirm = t('parent.register.confirmMismatch');
    f.setErrors(next);
    if (!parsed.success || Object.keys(next).length > 0) return;
    f.setBusy(true);
    try {
      const res = await call<{ token: string; user: SessionUser }>('/parent/account/password', {
        body: parsed.data,
      });
      // Token lama ditolak server setelah password diganti; simpan token baru.
      const s = getSession('parent');
      setSession('parent', { token: res.token, user: res.user, familyCode: s?.familyCode });
      setCurrentPassword('');
      setPassword('');
      setConfirm('');
      onSaved({
        ...account,
        mustChangePassword: false,
        passwordChangedAt: new Date().toISOString(),
      });
      f.setDone(t('parent.account.passwordSaved'));
    } catch (err) {
      f.setError(errorMessage(err));
      f.setErrors(serverFieldErrors(err));
    } finally {
      f.setBusy(false);
    }
  }

  return (
    <Card title={t('parent.account.password')} className="acct-card">
      <p className="acct-intro">{t('parent.account.passwordNote')}</p>
      {account.mustChangePassword && (
        <Notice tone="warning">{t('parent.account.mustChange')}</Notice>
      )}
      {f.error && <Notice tone="error">{f.error}</Notice>}
      {f.done && <Notice tone="success">{f.done}</Notice>}
      <form onSubmit={submit} noValidate>
        <PasswordField
          required
          label={
            account.mustChangePassword
              ? t('parent.account.tempPassword')
              : t('parent.account.currentPassword')
          }
          autoComplete="current-password"
          value={currentPassword}
          error={f.errors.currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
        />
        <PasswordField
          required
          label={t('parent.forgot.newPassword')}
          hint={t('parent.register.passwordHint')}
          autoComplete="new-password"
          value={password}
          error={f.errors.password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <PasswordField
          required
          label={t('parent.register.confirm')}
          autoComplete="new-password"
          value={confirm}
          error={f.errors.confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />
        <div className="acct-actions">
          <Button type="submit" disabled={f.busy}>
            {f.busy ? t('parent.loading') : t('parent.account.savePassword')}
          </Button>
        </div>
      </form>
    </Card>
  );
}

/** Ringkasan akun di atas: inisial, nama, email, kode keluarga, dan kapan password terakhir diganti. */
function Summary({ account }: { account: ParentAccount }) {
  const initial = account.name.trim().charAt(0).toUpperCase() || '?';
  return (
    <section className="acct-summary" aria-label={t('parent.account.summary')}>
      <span className="acct-avatar" aria-hidden>
        {initial}
      </span>
      <div className="acct-who">
        <strong className="acct-name">{account.name}</strong>
        <span className="acct-email acct-break">{account.email}</span>
      </div>
      <dl className="acct-facts">
        <div>
          <dt>{t('parent.account.familyCode')}</dt>
          <dd className="acct-code">{account.familyCode}</dd>
        </div>
        <div>
          <dt>{t('parent.account.passwordChanged')}</dt>
          <dd>
            {account.passwordChangedAt
              ? formatDate(account.passwordChangedAt)
              : t('parent.account.passwordNever')}
          </dd>
        </div>
      </dl>
    </section>
  );
}

/** Halaman "Akun saya": nama, email (dengan kode ke email baru), dan password. */
export function AccountPage() {
  const {
    data: account,
    error,
    loading,
    setData: save,
  } = useFetch<ParentAccount>('parent', '/parent/account');
  return (
    <>
      <PageHeader title={t('parent.account.title')} subtitle={t('parent.account.subtitle')} />
      {loading && !account && <Spinner />}
      {error ? <Notice tone="error">{errorMessage(error)}</Notice> : null}
      {account && (
        <div className="acct">
          <Summary account={account} />
          <div className="acct-grid">
            <PasswordCard account={account} onSaved={save} />
            <div className="acct-col">
              <ProfileCard account={account} onSaved={save} />
              <EmailCard account={account} onSaved={save} />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
