import { useState, type FormEvent } from 'react';
import type { AuthResult } from '@udakids/engine';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { parentGoogle, parentLogin } from '../api/auth';
import { ApiError } from '../api/client';
import { setSession } from '../auth/session';
import { useSession } from '../auth/store';
import { useT } from '../i18n';
import { AuthLayout } from '../site/AuthLayout';
import { FormField, PasswordField } from '../ui/FormField';
import { GoogleButton } from './GoogleButton';
import { GoogleConsent, type PendingGoogle } from './GoogleConsent';

export function ParentLogin() {
  const t = useT('parent');
  const navigate = useNavigate();
  const session = useSession((s) => s.session);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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
  }

  async function onGoogle(credential: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await parentGoogle({ credential });
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
    setBusy(true);
    setError(null);
    try {
      const res = await parentLogin({ email, password });
      setSession('parent', {
        token: res.token,
        user: res.user,
        familyCode: res.user.familyCode ?? undefined,
      });
      navigate('/orang-tua', { replace: true });
    } catch (err) {
      if (err instanceof ApiError && err.body.reason === 'email_not_verified') {
        navigate(`/orang-tua/verifikasi?email=${encodeURIComponent(email.trim().toLowerCase())}`, {
          replace: true,
        });
        return;
      }
      setError(err instanceof ApiError ? err.message : t('error.generic'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthLayout variant="parent" title={t('login.title')} text={t('auth.text')}>
      {pendingGoogle ? (
        <GoogleConsent
          pending={pendingGoogle}
          onDone={finishGoogle}
          onCancel={() => setPendingGoogle(null)}
        />
      ) : (
        <>
          <h1>{t('login.title')}</h1>
          <form className="uk-stack" onSubmit={(e) => void onSubmit(e)} noValidate>
            <GoogleButton
              text="signin_with"
              onCredential={(credential) => void onGoogle(credential)}
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
              autoComplete="current-password"
              required
            />
            {error && (
              <p role="alert" style={{ color: 'var(--bahaya)', margin: 0 }}>
                {error}
              </p>
            )}
            <button type="submit" className="uk-btn" disabled={busy}>
              {t('login.submit')}
            </button>
            <p style={{ margin: 0 }}>
              {t('login.noAccount')} <Link to="/orang-tua/daftar">{t('register.submit')}</Link>
            </p>
          </form>
        </>
      )}
    </AuthLayout>
  );
}
