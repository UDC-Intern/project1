import { useEffect, useState, type FormEvent } from 'react';
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { parentResend, parentVerify } from '../api/auth';
import { ApiError } from '../api/client';
import { setSession } from '../auth/session';
import { AuthLayout } from '../site/AuthLayout';
import { FormField } from '../ui/FormField';

const RESEND_SECONDS = 60;

export function ParentVerify() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const location = useLocation();
  const email = (params.get('email') ?? '').trim().toLowerCase();
  const [code, setCode] = useState('');
  const [wait, setWait] = useState(
    (location.state as { sent?: boolean } | null)?.sent ? RESEND_SECONDS : 0,
  );
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (wait <= 0) return;
    const timer = window.setTimeout(() => setWait((seconds) => seconds - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [wait]);

  if (!email) return <Navigate to="/orang-tua/daftar" replace />;

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!/^\d{6}$/.test(code)) return setError('Masukkan enam angka dari email.');
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      const result = await parentVerify({ email, code });
      setSession('parent', {
        token: result.token,
        user: result.user,
        familyCode: result.user.familyCode ?? undefined,
      });
      navigate('/orang-tua/anak/baru', { replace: true });
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'Kode belum bisa diperiksa. Coba lagi.');
      setCode('');
    } finally {
      setBusy(false);
    }
  }

  async function resend() {
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      await parentResend({ email });
      setWait(RESEND_SECONDS);
      setInfo(
        'Jika akun ini menunggu verifikasi, kode baru sudah dikirim. Periksa juga folder spam.',
      );
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'Kode belum bisa dikirim. Coba lagi.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthLayout
      variant="parent"
      title="Verifikasi email"
      text="Satu langkah lagi untuk mulai belajar bersama UdaKids."
    >
      <h1>Periksa email kamu</h1>
      <p>
        Kami mengirim kode enam angka ke <strong>{email}</strong>. Kode berlaku 15 menit. Periksa
        folder spam jika belum terlihat.
      </p>
      <form className="uk-stack" onSubmit={(event) => void submit(event)} noValidate>
        <FormField
          label="Kode verifikasi"
          className="auth-verify-code"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]*"
          maxLength={6}
          value={code}
          onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
          required
        />
        {error && (
          <p role="alert" style={{ color: 'var(--bahaya)', margin: 0 }}>
            {error}
          </p>
        )}
        {info && (
          <p role="status" style={{ color: 'var(--hijau)', margin: 0 }}>
            {info}
          </p>
        )}
        <button className="uk-btn" type="submit" disabled={busy || code.length !== 6}>
          Verifikasi
        </button>
      </form>
      <button
        className="auth-back"
        type="button"
        onClick={() => void resend()}
        disabled={busy || wait > 0}
      >
        {wait > 0 ? `Kirim ulang dalam ${wait} detik` : 'Kirim ulang kode'}
      </button>
      <p>
        Salah alamat email? <Link to="/orang-tua/daftar">Daftar lagi</Link>
      </p>
    </AuthLayout>
  );
}
