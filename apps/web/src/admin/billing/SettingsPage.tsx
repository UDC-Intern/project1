import { useCallback, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import {
  certificateSettingsSchema,
  type AppSettings,
  type BillingSettings,
  type CertificateDesign,
  type CertificateSettings,
  type ContactSettings,
} from '@udakids/engine';
import { certificates } from '../../api/admin';
import { settingsChanged } from '../../api/settings';
import { useApiCall, useFetch } from '../../auth/useApi';
import { CertificateSheet } from '../../components/certificate/CertificateSheet';
import { verifyUrlOf } from '../../components/certificate/sheet';
import { useAsync } from '../../hooks/useAsync';
import { t } from '../../i18n';
import { Button, Card, Checkbox, PageHeader, TextField } from '../../ui/ui';
import { ActionNotice, Loadable, useAction } from '../common';

/** Simpan satu bagian pengaturan; halaman lain yang memakainya ikut diperbarui. */
function useSave<K extends keyof AppSettings>(part: K, success: string) {
  const call = useApiCall('staff');
  const action = useAction();
  const save = async (body: AppSettings[K]) => {
    const out = await action.run(
      () => call<AppSettings>(`/admin/settings/${part}`, { method: 'PUT', body }),
      success,
    );
    if (out) settingsChanged(out);
    return out?.[part];
  };
  return { action, save };
}

function BillingForm({ initial }: { initial: BillingSettings }) {
  const { action, save } = useSave('billing', t('admin.billing.saved'));
  const [form, setForm] = useState(initial);
  const set = <K extends keyof BillingSettings>(k: K, v: BillingSettings[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    const out = await save(form);
    if (out) setForm(out);
  }

  return (
    <Card title={t('admin.billing.cardTitle')}>
      <ActionNotice error={action.error} done={action.done} />
      <form onSubmit={submit}>
        <Checkbox
          label={t('admin.billing.paywall')}
          checked={form.paywall}
          onChange={(e) => set('paywall', e.target.checked)}
        />
        <p className="ui-hint">{t('admin.billing.paywallHint')}</p>
        <div className="adm-fields">
          <TextField
            label={t('admin.billing.freeLevels')}
            hint={t('admin.billing.freeLevelsHint')}
            type="number"
            required
            min={1}
            max={12}
            value={String(form.freeLevels)}
            onChange={(e) => set('freeLevels', Number(e.target.value))}
          />
          <TextField
            label={t('admin.billing.expiry')}
            hint={t('admin.billing.expiryHint')}
            type="number"
            required
            min={1}
            max={168}
            value={String(form.orderExpiryHours)}
            onChange={(e) => set('orderExpiryHours', Number(e.target.value))}
          />
        </div>
        <Button type="submit" disabled={action.busy}>
          {t('admin.save')}
        </Button>
      </form>
    </Card>
  );
}

/** Kontak WhatsApp admin (tombol melayang) dan grup WhatsApp orang tua. */
function ContactForm({ initial }: { initial: ContactSettings }) {
  const { action, save } = useSave('contact', t('admin.contact.saved'));
  const [form, setForm] = useState(initial);
  const set = <K extends keyof ContactSettings>(k: K, v: ContactSettings[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    const out = await save(form);
    if (out) setForm(out);
  }

  return (
    <Card title={t('admin.contact.cardTitle')}>
      <ActionNotice error={action.error} done={action.done} />
      <form onSubmit={submit}>
        <TextField
          label={t('admin.contact.adminWhatsapp')}
          hint={t('admin.contact.adminWhatsappHint')}
          inputMode="url"
          placeholder="08123456789"
          value={form.adminWhatsapp}
          onChange={(e) => set('adminWhatsapp', e.target.value)}
        />
        <TextField
          label={t('admin.contact.adminMessage')}
          hint={t('admin.contact.adminMessageHint')}
          maxLength={200}
          value={form.adminMessage}
          onChange={(e) => set('adminMessage', e.target.value)}
        />
        <TextField
          label={t('admin.contact.groupWhatsapp')}
          hint={t('admin.contact.groupWhatsappHint')}
          inputMode="url"
          placeholder="https://chat.whatsapp.com/…"
          value={form.groupWhatsapp}
          onChange={(e) => set('groupWhatsapp', e.target.value)}
        />
        <Button type="submit" disabled={action.busy}>
          {t('admin.save')}
        </Button>
      </form>
    </Card>
  );
}

const SAMPLE_NUMBER = 'CERT-7KQ2MX';

/** Isi tetap lembar sertifikat: penerbit, judul, penanda tangan, dan baris tambahan, dengan pratinjau langsung. */
function CertificateForm({
  initial,
  design,
}: {
  initial: CertificateSettings;
  design: CertificateDesign;
}) {
  const { action, save } = useSave('certificate', t('admin.certSettings.saved'));
  const [form, setForm] = useState(initial);
  const set = <K extends keyof CertificateSettings>(k: K, v: CertificateSettings[K]) =>
    setForm((f) => ({ ...f, [k]: v }));
  const parsed = certificateSettingsSchema.safeParse(form);
  const field = (k: keyof CertificateSettings, label: string, max: number, hint?: string) => (
    <TextField
      label={label}
      hint={hint}
      maxLength={max}
      value={String(form[k])}
      onChange={(e) => set(k, e.target.value as never)}
    />
  );

  async function submit(e: FormEvent) {
    e.preventDefault();
    const out = await save(form);
    if (out) setForm(out);
  }

  return (
    <Card
      title={t('admin.certSettings.cardTitle')}
      actions={
        <Link className="ui-btn ui-btn-ghost" to="/admin/sertifikat">
          {t('admin.certSettings.designs')}
        </Link>
      }
    >
      <ActionNotice error={action.error} done={action.done} />
      <div className="adm-cert-settings">
        <form onSubmit={submit}>
          <div className="adm-fields">
            {field(
              'issuer',
              t('admin.certSettings.issuer'),
              40,
              t('admin.certSettings.issuerHint'),
            )}
            {field('tagline', t('admin.certSettings.tagline'), 50)}
            {field('title', t('admin.certSettings.title'), 24)}
            {field('subtitle', t('admin.certSettings.subtitle'), 32)}
            {field('signer1Name', t('admin.certSettings.signer1Name'), 40)}
            {field('signer1Role', t('admin.certSettings.signer1Role'), 40)}
            {field(
              'signer2Name',
              t('admin.certSettings.signer2Name'),
              60,
              t('admin.certSettings.signer2Hint'),
            )}
            {field('signer2Role', t('admin.certSettings.signer2Role'), 40)}
            {field(
              'curriculum',
              t('admin.certSettings.curriculum'),
              60,
              t('admin.certSettings.curriculumHint'),
            )}
          </div>
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
          <Button type="submit" disabled={action.busy || !parsed.success}>
            {t('admin.save')}
          </Button>
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
    </Card>
  );
}

/** Pengaturan: akses berbayar, kontak WhatsApp, dan isi lembar sertifikat. */
export function SettingsPage() {
  const s = useFetch<AppSettings>('staff', '/admin/settings');
  // Pratinjau lembar memakai desain yang sedang aktif (dipilih di halaman Sertifikat).
  const loadDesign = useCallback(() => certificates().then((c) => c.design), []);
  const design = useAsync(loadDesign).data ?? 'klasik';
  return (
    <>
      <PageHeader title={t('admin.settings.title')} subtitle={t('admin.settings.subtitle')} />
      <Loadable loading={s.loading} error={s.error} hasData={!!s.data}>
        {() => (
          <>
            <BillingForm initial={s.data!.billing} />
            <ContactForm initial={s.data!.contact} />
            <CertificateForm initial={s.data!.certificate} design={design} />
          </>
        )}
      </Loadable>
    </>
  );
}
