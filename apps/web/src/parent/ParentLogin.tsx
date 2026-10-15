import { useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { parentLogin } from '../api/auth';
import { ApiError } from '../api/client';
import { useSession } from '../auth/store';
import { Momo } from '../components/Momo';
import { useT } from '../i18n';
import { FormField } from '../ui/FormField';

export function ParentLogin() {
  const t = useT('parent');
  const navigate = useNavigate();
  const session = useSession((s) => s.session);
  const signIn = useSession((s) => s.signIn);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (session?.role === 'parent') return <Navigate to="/orang-tua" replace />;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await parentLogin({ email, password });
      signIn({ token: res.token, role: 'parent', name: res.user.name });
      navigate('/orang-tua', { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('error.generic'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="uk-auth">
      <Momo size={72} />
      <h1>{t('login.title')}</h1>
      <form className="uk-stack" onSubmit={(e) => void onSubmit(e)} noValidate>
        <FormField
          label={t('register.email')}
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          required
        />
        <FormField
          label={t('register.password')}
          type="password"
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
    </main>
  );
}
