import { useCallback, useState, type FormEvent } from 'react';
import {
  account,
  changePassword,
  confirmEmailChange,
  MOCK_EMAIL_CODE,
  requestEmailChange,
  updateName,
} from '../api/account';
import { ApiError } from '../api/client';
import { useSession } from '../auth/store';
import { useAsync } from '../hooks/useAsync';
import { useT } from '../i18n';
import { isMocked } from '../api/mode';
import { formatDate } from '../lib/format';
import { PageHeader } from '../ui/AppShell';
import { FormField } from '../ui/FormField';
import { ErrorState, LoadingState } from '../ui/states';

type Notice = { kind: 'ok' | 'error'; text: string } | null;

function Notice({ notice }: { notice: Notice }) {
  if (!notice) return null;
  return (
    <p
      role={notice.kind === 'error' ? 'alert' : 'status'}
      style={{ margin: 0, color: notice.kind === 'error' ? 'var(--bahaya)' : 'var(--sawah)' }}
    >
      {notice.text}
    </p>
  );
}

export function AccountPage() {
  const t = useT('parent');
  const load = useCallback(() => account(), []);
  const { data, error, loading, reload } = useAsync(load);
  const session = useSession((s) => s.session);
  const signIn = useSession((s) => s.signIn);

  const [name, setName] = useState<string | null>(null);
  const [nameNotice, setNameNotice] = useState<Notice>(null);

  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [repeat, setRepeat] = useState('');
  const [reveal, setReveal] = useState(false);
  const [pwNotice, setPwNotice] = useState<Notice>(null);

  const [newEmail, setNewEmail] = useState('');
  const [emailPw, setEmailPw] = useState('');
  const [code, setCode] = useState('');
  const [mailNotice, setMailNotice] = useState<Notice>(null);

  if (loading && !data) return <LoadingState />;
  if (error || !data) return <ErrorState onRetry={reload} />;

  const fail = (err: unknown): Notice => ({
    kind: 'error',
    text: err instanceof ApiError ? err.message : t('error.generic'),
  });

  async function saveName(e: FormEvent) {
    e.preventDefault();
    try {
      const res = await updateName((name ?? data!.name).trim());
      if (session) signIn({ ...session, name: res.name });
      setName(null);
      setNameNotice({ kind: 'ok', text: t('account.profile.saved') });
      reload();
    } catch (err) {
      setNameNotice(fail(err));
    }
  }

  async function savePassword(e: FormEvent) {
    e.preventDefault();
    if (next !== repeat) {
      setPwNotice({ kind: 'error', text: t('account.password.mismatch') });
      return;
    }
    try {
      await changePassword({ currentPassword: current, newPassword: next });
      setCurrent('');
      setNext('');
      setRepeat('');
      setPwNotice({ kind: 'ok', text: t('account.password.saved') });
      reload();
    } catch (err) {
      setPwNotice(fail(err));
    }
  }

  async function sendCode(e: FormEvent) {
    e.preventDefault();
    try {
      const res = await requestEmailChange({ email: newEmail, currentPassword: emailPw });
      setEmailPw('');
      setMailNotice({
        kind: 'ok',
        text: t('account.email.sent', {
          email: res.pendingEmail ?? newEmail,
          code: isMocked('parent') ? MOCK_EMAIL_CODE : '••••••',
        }),
      });
      reload();
    } catch (err) {
      setMailNotice(fail(err));
    }
  }

  async function confirm(e: FormEvent) {
    e.preventDefault();
    try {
      await confirmEmailChange(code);
      setCode('');
      setNewEmail('');
      setMailNotice({ kind: 'ok', text: t('account.email.done') });
      reload();
    } catch (err) {
      setMailNotice(fail(err));
    }
  }

  const initial = (name ?? data.name).trim().charAt(0).toUpperCase() || '?';
  const pwType = reveal ? 'text' : 'password';

  return (
    <div className="uk-stack">
      <PageHeader title={t('account.title')} />

      <section className="uk-card account-head">
        <span className="account-avatar" aria-hidden="true">
          {initial}
        </span>
        <div>
          <h2 style={{ margin: 0 }}>{data.name}</h2>
          <p style={{ margin: 0 }}>{data.email}</p>
          <p style={{ margin: 0 }}>
            {t('account.family')}: <strong className="account-code">{data.familyCode}</strong>
          </p>
          <p style={{ margin: 0 }}>
            {t('account.passwordChanged')}:{' '}
            {data.passwordChangedAt ? formatDate(data.passwordChangedAt) : t('account.never')}
          </p>
        </div>
      </section>

      <div className="account-grid">
        <section className="uk-card uk-stack" aria-labelledby="acc-pw">
          <h2 id="acc-pw" style={{ margin: 0 }}>
            {t('account.password.title')}
          </h2>
          <form className="uk-stack" onSubmit={(e) => void savePassword(e)}>
            <FormField
              label={t('account.password.current')}
              type={pwType}
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              autoComplete="current-password"
              required
            />
            <FormField
              label={t('account.password.new')}
              type={pwType}
              value={next}
              onChange={(e) => setNext(e.target.value)}
              autoComplete="new-password"
              minLength={8}
              required
            />
            <small>{t('account.password.hint')}</small>
            <FormField
              label={t('account.password.repeat')}
              type={pwType}
              value={repeat}
              onChange={(e) => setRepeat(e.target.value)}
              autoComplete="new-password"
              required
            />
            <label className="uk-check">
              <input
                type="checkbox"
                checked={reveal}
                onChange={(e) => setReveal(e.target.checked)}
              />
              <span>{reveal ? t('account.hide') : t('account.show')}</span>
            </label>
            <Notice notice={pwNotice} />
            <button type="submit" className="uk-btn">
              {t('account.password.save')}
            </button>
          </form>
        </section>

        <section className="uk-card uk-stack" aria-labelledby="acc-profile">
          <h2 id="acc-profile" style={{ margin: 0 }}>
            {t('account.profile.title')}
          </h2>
          <form className="uk-stack" onSubmit={(e) => void saveName(e)}>
            <FormField
              label={t('account.profile.name')}
              value={name ?? data.name}
              onChange={(e) => setName(e.target.value)}
              maxLength={60}
              required
            />
            <Notice notice={nameNotice} />
            <button type="submit" className="uk-btn">
              {t('account.profile.save')}
            </button>
          </form>
        </section>

        <section className="uk-card uk-stack" aria-labelledby="acc-email">
          <h2 id="acc-email" style={{ margin: 0 }}>
            {t('account.email.title')}
          </h2>
          <p style={{ margin: 0 }}>
            {t('account.email.current')}: <strong>{data.email}</strong>
          </p>
          <form className="uk-stack" onSubmit={(e) => void sendCode(e)}>
            <FormField
              label={t('account.email.new')}
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              autoComplete="email"
              required
            />
            <FormField
              label={t('account.password.current')}
              type="password"
              value={emailPw}
              onChange={(e) => setEmailPw(e.target.value)}
              autoComplete="current-password"
              required
            />
            <button type="submit" className="uk-btn uk-btn--ghost">
              {t('account.email.send')}
            </button>
          </form>
          {data.pendingEmail && (
            <form className="uk-stack" onSubmit={(e) => void confirm(e)}>
              <FormField
                label={t('account.email.code')}
                value={code}
                onChange={(e) => setCode(e.target.value)}
                inputMode="numeric"
                maxLength={6}
                required
              />
              <button type="submit" className="uk-btn">
                {t('account.email.confirm')}
              </button>
            </form>
          )}
          <Notice notice={mailNotice} />
        </section>

        <section className="uk-card uk-stack" aria-labelledby="acc-privacy">
          <h2 id="acc-privacy" style={{ margin: 0 }}>
            {t('account.privacy.title')}
          </h2>
          <p style={{ margin: 0 }}>{t('account.privacy.text')}</p>
        </section>
      </div>
    </div>
  );
}
