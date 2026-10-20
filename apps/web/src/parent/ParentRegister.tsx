import { useEffect, useState, type FormEvent } from 'react';
import type { AuthResult } from '@udakids/engine';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { parentGoogle, parentRegister } from '../api/auth';
import { ApiError } from '../api/client';
import { setSession } from '../auth/session';
import { useSession } from '../auth/store';
import { useT } from '../i18n';
import { AuthLayout } from '../site/AuthLayout';
import { FormField, PasswordField } from '../ui/FormField';
import { GoogleButton } from './GoogleButton';
import { GoogleConsent, type PendingGoogle } from './GoogleConsent';
import { forgetReferral, readReferral, rememberReferral } from '../site/referral';

export function ParentRegister() {
  const t = useT('parent');
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const refParam = params.get('ref') ?? readReferral();
  const ref = /^[A-Za-z2-9]{6}$/.test(refParam) ? refParam.toUpperCase() : null;
  useEffect(() => {
    if (ref) rememberReferral(ref);
  }, [ref]);
  const session = useSession((s) => s.session);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [pendingGoogle, setPendingGoogle] = useState<PendingGoogle | null>(null);

  function finishGoogle(res: AuthResult) {
    setSession('parent', {
      token: res.token,
      user: res.user,
      familyCode: res.user.familyCode ?? undefined,
    });
    navigate('/orang-tua', { replace: true });
    forgetReferral();
  }

  async function onGoogle(credential: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await parentGoogle({ credential, ...(ref ? { referralCode: ref } : {}) });
      if ('needsConsent' in res) {
        setPendingGoogle({ credential, email: res.email, name: res.name });
        return;
      }
      finishGoogle(res);
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
      if ('verificationRequired' in res) {
        navigate(`/orang-tua/verifikasi?email=${encodeURIComponent(res.email)}`, {
          replace: true,
          state: { sent: true },
        });
        return;
      }
      setSession('parent', {
        token: res.token,
        user: res.user,
        familyCode: res.user.familyCode ?? undefined,
      });
      navigate('/orang-tua', { replace: true });
      forgetReferral();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('error.generic'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthLayout variant="parent" title={t('register.title')} text={t('auth.text')}>
      {pendingGoogle ? (
        <GoogleConsent
          pending={pendingGoogle}
          referralCode={ref ?? undefined}
          onDone={finishGoogle}
          onCancel={() => setPendingGoogle(null)}
        />
      ) : (
        <>
          <h1>{t('register.title')}</h1>
          {ref && <p>{t('register.referral', { code: ref })}</p>}
          <form className="uk-stack" onSubmit={(e) => void onSubmit(e)} noValidate>
            <GoogleButton
              text="signup_with"
              onCredential={(credential) => void onGoogle(credential)}
            />
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
              <input
                type="checkbox"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
              />
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
        </>
      )}
    </AuthLayout>
  );
}
