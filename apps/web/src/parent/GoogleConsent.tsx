import { useState, type FormEvent } from 'react';
import type { AuthResult } from '@udakids/engine';
import { parentGoogle } from '../api/auth';
import { ApiError } from '../api/client';
import { FormField } from '../ui/FormField';

export type PendingGoogle = { credential: string; email: string; name: string };

export function GoogleConsent({
  pending,
  onDone,
  onCancel,
  referralCode,
}: {
  pending: PendingGoogle;
  onDone: (result: AuthResult) => void;
  onCancel: () => void;
  referralCode?: string;
}) {
  const [name, setName] = useState(pending.name);
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) return setError('Isi nama terlebih dahulu.');
    if (!consent) return setError('Centang persetujuan dulu, ya.');
    setBusy(true);
    setError(null);
    try {
      const result = await parentGoogle({
        credential: pending.credential,
        consent: true,
        name: name.trim(),
        ...(referralCode ? { referralCode } : {}),
      });
      if ('needsConsent' in result) throw new Error('Persetujuan belum tersimpan. Coba lagi.');
      onDone(result);
    } catch (cause) {
      setError(
        cause instanceof ApiError || cause instanceof Error ? cause.message : 'Coba lagi, ya.',
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="uk-stack" onSubmit={(event) => void submit(event)} noValidate>
      <h1>Satu langkah lagi</h1>
      <p>
        Akun Google {pending.email} belum terdaftar. Periksa nama dan setujui pendaftaran untuk
        melanjutkan.
      </p>
      <FormField
        label="Nama orang tua"
        value={name}
        onChange={(event) => setName(event.target.value)}
        maxLength={60}
        required
      />
      <label className="uk-check">
        <input
          type="checkbox"
          checked={consent}
          onChange={(event) => setConsent(event.target.checked)}
        />
        <span>Saya setuju membuat akun UdaKids dengan email Google ini.</span>
      </label>
      {error && (
        <p role="alert" style={{ color: 'var(--bahaya)', margin: 0 }}>
          {error}
        </p>
      )}
      <button className="uk-btn" type="submit" disabled={busy}>
        Lanjutkan
      </button>
      <button className="auth-back" type="button" onClick={onCancel} disabled={busy}>
        Kembali
      </button>
    </form>
  );
}
