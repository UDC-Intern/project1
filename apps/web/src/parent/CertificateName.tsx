import { certificateNameInputSchema } from '@udakids/engine';
import { useState, type FormEvent } from 'react';
import { errorMessage } from '../api/client';
import { useApiCall } from '../auth/useApi';
import { t } from '../i18n';
import { Button, Checkbox, Notice, TextField } from '../ui/ui';
import { serverFieldErrors } from './form';

export type CertificateNameState = { name: string; consent: boolean };

/**
 * Pemeriksaan isian nama sertifikat sebelum dikirim. Mengisi pertama kali butuh centang persetujuan;
 * `saved` adalah nama yang sudah tersimpan (null bila belum ada).
 */
export function checkCertificateName(
  value: CertificateNameState,
  saved: string | null | undefined,
): Record<string, string> {
  const parsed = certificateNameInputSchema.safeParse(value.name);
  if (!parsed.success) return { certificateName: parsed.error.issues[0]!.message };
  if (parsed.data && !saved && !value.consent)
    return { certificateConsent: t('parent.form.certConsentMissing') };
  return {};
}

/** Isian nama lengkap khusus sertifikat beserta persetujuan orang tua (hanya saat mengisi pertama kali). */
export function CertificateNameFields({
  nickname,
  saved,
  value,
  onChange,
  errors,
}: {
  nickname: string;
  saved: string | null | undefined;
  value: CertificateNameState;
  onChange: (next: CertificateNameState) => void;
  errors: Record<string, string>;
}) {
  const needConsent = !saved && value.name.trim() !== '';
  return (
    <>
      <TextField
        label={t('parent.form.certName')}
        hint={t('parent.form.certNameHint')}
        autoComplete="off"
        maxLength={60}
        value={value.name}
        error={errors.certificateName}
        onChange={(e) => onChange({ ...value, name: e.target.value })}
      />
      {needConsent && (
        <>
          <Checkbox
            required
            label={t('parent.form.certConsent', { name: nickname })}
            checked={value.consent}
            aria-invalid={errors.certificateConsent ? true : undefined}
            onChange={(e) => onChange({ ...value, consent: e.target.checked })}
          />
          {errors.certificateConsent && (
            <small className="ui-error" role="alert">
              {errors.certificateConsent}
            </small>
          )}
        </>
      )}
      {saved && <small className="ui-hint">{t('parent.form.certConsented')}</small>}
    </>
  );
}

/** Formulir singkat di halaman Sertifikat untuk anak yang sertifikatnya masih memakai nama panggilan. */
export function CertificateNameForm({
  childId,
  nickname,
  onSaved,
}: {
  childId: string;
  nickname: string;
  onSaved: (name: string) => void;
}) {
  const call = useApiCall('parent');
  const [value, setValue] = useState<CertificateNameState>({ name: '', consent: false });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(undefined);
    const next = checkCertificateName(value, null);
    setErrors(next);
    if (Object.keys(next).length > 0) return;
    setBusy(true);
    try {
      await call(`/parent/children/${encodeURIComponent(childId)}`, {
        method: 'PATCH',
        body: { certificateName: value.name, certificateConsent: value.consent },
      });
      onSaved(value.name.trim().replace(/\s+/g, ' '));
    } catch (err) {
      setErrors(serverFieldErrors(err));
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="cert-pa-name" onSubmit={submit} noValidate>
      <p>{t('parent.cert.nameNickname', { name: nickname })}</p>
      {error && <Notice tone="error">{error}</Notice>}
      <CertificateNameFields
        nickname={nickname}
        saved={null}
        value={value}
        onChange={setValue}
        errors={errors}
      />
      <Button type="submit" variant="secondary" disabled={busy || !value.name.trim()}>
        {busy ? t('parent.saving') : t('parent.cert.nameSave')}
      </Button>
    </form>
  );
}
