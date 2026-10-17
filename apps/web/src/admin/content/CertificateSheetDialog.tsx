import { useEffect, useRef, useState, type FormEvent } from 'react';
import {
  certificateSettingsSchema,
  type AppSettings,
  type CertificateDesign,
  type CertificateSettings,
} from '@udakids/engine';
import { settingsChanged, useSettings } from '../../api/settings';
import { useApiCall } from '../../auth/useApi';
import { CertificateSheet } from '../../components/certificate/CertificateSheet';
import { verifyUrlOf } from '../../components/certificate/sheet';
import { t } from '../../i18n';
import { Dialog } from '../../ui/Dialog';
import { Button, Checkbox, TextField } from '../../ui/ui';
import { ActionNotice, useAction } from '../common';
import { SignatureEditor } from './SignatureEditor';

const SAMPLE_NUMBER = 'CERT-7KQ2MX';
const FORM_ID = 'cert-sheet-form';

/**
 * Dialog "Atur isi lembar" di halaman Sertifikat Juara: teks tetap lembar (penerbit, judul, penanda tangan,
 * kurikulum) dan pilihan yang tampil, dengan pratinjau langsung. Disimpan ke Pengaturan
 * (`PUT /admin/settings/certificate`) dan berlaku untuk semua sertifikat, termasuk yang sudah terbit.
 */
export function CertificateSheetDialog({
  design,
  onClose,
  onSaved,
}: {
  /** Desain yang sedang dipakai, untuk pratinjau. */
  design: CertificateDesign;
  onClose: () => void;
  onSaved: () => void;
}) {
  const current = useSettings().certificate;
  const [form, setForm] = useState<CertificateSettings>(current);
  const call = useApiCall('staff');
  const action = useAction();
  const box = useRef<HTMLDivElement>(null);
  const parsed = certificateSettingsSchema.safeParse(form);
  const set = <K extends keyof CertificateSettings>(k: K, v: CertificateSettings[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  useEffect(() => {
    box.current?.querySelector<HTMLElement>('input')?.focus();
  }, []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const out = await action.run(() =>
      call<AppSettings>('/admin/settings/certificate', { method: 'PUT', body: form }),
    );
    if (out) {
      settingsChanged(out);
      onSaved();
    }
  }

  /** `name`: nama lengkap untuk pembaca layar bila label yang tampil dipersingkat (mis. "Jabatan"). */
  const field = (
    k: keyof CertificateSettings,
    label: string,
    max: number,
    hint?: string,
    name?: string,
  ) => (
    <TextField
      label={label}
      aria-label={name}
      hint={hint}
      maxLength={max}
      value={String(form[k])}
      onChange={(e) => set(k, e.target.value as never)}
    />
  );

  return (
    <Dialog wide title={t('admin.certSettings.dialogTitle')} onClose={onClose}>
      <div ref={box} className="certs-editor">
        <p className="ui-muted">{t('admin.certSettings.dialogHint')}</p>
        <ActionNotice error={action.error} />
        <div className="certs-editor-body">
          <form id={FORM_ID} onSubmit={submit}>
            <fieldset className="certs-editor-group">
              <legend>{t('admin.certSettings.groupHead')}</legend>
              {field(
                'issuer',
                t('admin.certSettings.issuer'),
                40,
                t('admin.certSettings.issuerHint'),
              )}
              {field('tagline', t('admin.certSettings.tagline'), 50)}
              <div className="certs-editor-pair">
                {field('title', t('admin.certSettings.title'), 24)}
                {field('subtitle', t('admin.certSettings.subtitle'), 32)}
              </div>
            </fieldset>
            <fieldset className="certs-editor-group">
              <legend>{t('admin.certSettings.groupSigners')}</legend>
              <div className="certs-editor-pair">
                {field(
                  'signer2Name',
                  t('admin.certSettings.signer2Name'),
                  60,
                  t('admin.certSettings.signer2Hint'),
                )}
                {field(
                  'signer2Role',
                  t('admin.certSettings.role'),
                  40,
                  undefined,
                  t('admin.certSettings.signer2Role'),
                )}
              </div>
              <SignatureEditor
                value={{ type: form.signatureType, image: form.signatureImage }}
                onChange={(v) =>
                  setForm((f) => ({ ...f, signatureType: v.type, signatureImage: v.image }))
                }
              />
              <Checkbox
                label={t('admin.certSettings.showStamp')}
                checked={form.showStamp}
                onChange={(e) => set('showStamp', e.target.checked)}
              />
              <p className="ui-hint">{t('admin.certSettings.showStampHint')}</p>
            </fieldset>
            <fieldset className="certs-editor-group">
              <legend>{t('admin.certSettings.groupShow')}</legend>
              {field(
                'curriculum',
                t('admin.certSettings.curriculum'),
                60,
                t('admin.certSettings.curriculumHint'),
              )}
              <Checkbox
                label={t('admin.certSettings.showScore')}
                checked={form.showScore}
                onChange={(e) => set('showScore', e.target.checked)}
              />
              <Checkbox
                label={t('admin.certSettings.showQr')}
                checked={form.showQr}
                onChange={(e) => set('showQr', e.target.checked)}
              />
              <p className="ui-hint">{t('admin.certSettings.showQrHint')}</p>
              <Checkbox
                label={t('admin.certSettings.useFullName')}
                checked={form.useFullName}
                onChange={(e) => set('useFullName', e.target.checked)}
              />
              <p className="ui-hint">{t('admin.certSettings.useFullNameHint')}</p>
            </fieldset>
          </form>
          <figure className="adm-cert-preview">
            <figcaption className="ui-muted">{t('admin.certSettings.preview')}</figcaption>
            {parsed.success ? (
              <CertificateSheet
                data={{
                  childName: t('admin.certSettings.sampleName'),
                  bookTitle: t('admin.certSettings.sampleBook'),
                  levels: 40,
                  topics: 10,
                  design,
                  number: SAMPLE_NUMBER,
                  issuedAt: new Date().toISOString(),
                  averageScore: 92,
                  settings: parsed.data,
                  verifyUrl: parsed.data.showQr ? verifyUrlOf(SAMPLE_NUMBER) : null,
                }}
              />
            ) : (
              <p className="ui-muted">{t('admin.certSettings.previewInvalid')}</p>
            )}
          </figure>
        </div>
        <div className="dlg-actions">
          <Button variant="ghost" onClick={onClose}>
            {t('admin.certSettings.close')}
          </Button>
          <Button type="submit" form={FORM_ID} disabled={action.busy || !parsed.success}>
            {action.busy ? t('admin.certSettings.saving') : t('admin.certSettings.save')}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
