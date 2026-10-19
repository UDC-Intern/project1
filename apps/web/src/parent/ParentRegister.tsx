import { useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { parentGoogle, parentRegister } from '../api/auth';
import { ApiError } from '../api/client';
import { setSession } from '../auth/session';
import { useSession } from '../auth/store';
import { useT } from '../i18n';
import { AuthLayout } from '../site/AuthLayout';
import { FormField, PasswordField } from '../ui/FormField';
import { GoogleButton } from './GoogleButton';

export function ParentRegister() {
  const t = useT('parent');
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const refParam = params.get('ref') ?? '';
  const ref = /^[A-Za-z]{6}$/.test(refParam) ? refParam.toUpperCase() : null;
  const session = useSession((s) => s.session);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onGoogle(credential: string) {
    if (!consent) {
      setError(t('register.needConsent'));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await parentGoogle({ credential, consent: true, name, ...(ref ? { referralCode: ref } : {}) });
      if ('needsConsent' in res) throw new Error(t('register.needConsent'));
      setSession('parent', { token: res.token, user: res.user, familyCode: res.user.familyCode ?? undefined });
      navigate('/orang-tua', { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('error.generic'));
    } finally {
      setBusy(false);
    }
  }

  if (session?.role === 'parent') return <Navigate to="/orang-tua" replace />;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!consent) {
      setError(t('register.needConsent'));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await parentRegister({
        name,
        email,
        password,
        consent: true,
        ...(ref ? { referralCode: ref } : {}),
      });
      setSession('parent', {
        token: res.token,
        user: res.user,
        familyCode: res.user.familyCode ?? undefined,
      });
      navigate('/orang-tua', { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('error.generic'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthLayout variant="parent" title={t('register.title')} text={t('auth.text')}>
      <h1>{t('register.title')}</h1>
      {ref && <p>{t('register.referral', { code: ref })}</p>}
      <form className="uk-stack" onSubmit={(e) => void onSubmit(e)} noValidate>
        <GoogleButton text="signup_with" onCredential={(credential) => void onGoogle(credential)} />
        <FormField
          label={t('register.name')}
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoComplete="name"
          maxLength={60}
          required
        />
        <FormField
          label={t('register.email')}
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          required
        />
        <PasswordField
          label={t('register.password')}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
          minLength={8}
          required
        />
        <label className="uk-check">
          <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
          <span>{t('register.consent')}</span>
        </label>
        {error && (
          <p role="alert" style={{ color: 'var(--bahaya)', margin: 0 }}>
            {error}
          </p>
        )}
        <button type="submit" className="uk-btn" disabled={busy}>
          {t('register.submit')}
        </button>
        <p style={{ margin: 0 }}>
          {t('register.haveAccount')} <Link to="/orang-tua/masuk">{t('login.submit')}</Link>
        </p>
      </form>
    </AuthLayout>
  );
}
