import { useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { parentRegister } from '../api/auth';
import { ApiError } from '../api/client';
import { useSession } from '../auth/store';
import { Momo } from '../components/Momo';
import { useT } from '../i18n';
import { FormField } from '../ui/FormField';

export function ParentRegister() {
  const t = useT('parent');
  const navigate = useNavigate();
  const session = useSession((s) => s.session);
  const signIn = useSession((s) => s.signIn);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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
      const res = await parentRegister({ name, email, password, consent: true });
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
      <Momo size={72} mood="happy" />
      <h1>{t('register.title')}</h1>
      <form className="uk-stack" onSubmit={(e) => void onSubmit(e)} noValidate>
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
        <FormField
          label={t('register.password')}
          type="password"
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
          <p role="alert" style={{ color: 'var(--uk-danger)', margin: 0 }}>
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
    </main>
  );
}
