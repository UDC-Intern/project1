import { useState, type FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { staffLogin } from '../api/auth';
import { ApiError } from '../api/client';
import { useSession } from '../auth/store';
import { useT } from '../i18n';
import { AuthLayout } from '../site/AuthLayout';
import { FormField, PasswordField } from '../ui/FormField';

export function StaffLogin() {
  const t = useT('admin');
  const navigate = useNavigate();
  const session = useSession((s) => s.session);
  const signIn = useSession((s) => s.signIn);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (session?.role === 'admin') return <Navigate to="/admin" replace />;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await staffLogin({ email, password });
      signIn({ token: res.token, role: 'admin', name: res.user.name, id: res.user.id });
      navigate('/admin', { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('error.generic'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthLayout variant="staff" title={t('login.title')} text={t('auth.text')}>
      <h1>{t('login.title')}</h1>
      <form className="uk-stack" onSubmit={(e) => void onSubmit(e)} noValidate>
        <FormField
          label={t('login.email')}
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="username"
        />
        <PasswordField
          label={t('login.password')}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
        />
        {error && (
          <p role="alert" style={{ color: 'var(--bahaya)', margin: 0 }}>
            {error}
          </p>
        )}
        <button type="submit" className="uk-btn" disabled={busy}>
          {t('login.submit')}
        </button>
      </form>
    </AuthLayout>
  );
}
