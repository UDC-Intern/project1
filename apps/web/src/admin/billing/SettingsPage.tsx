import { useState, type FormEvent } from 'react';
import type { AppSettings, BillingSettings, ContactSettings } from '@udakids/engine';
import type { DemoDataSummary } from '../../api/adminTypes';
import { isMocked } from '../../api/mode';
import { settingsChanged } from '../../api/settings';
import { useApiCall, useFetch } from '../../auth/useApi';
import { t, type MessageKey } from '../../i18n';
import { Button, Card, Checkbox, formatDate, PageHeader, TextField } from '../../ui/ui';
import { ActionNotice, confirmAction, Loadable, notifyOrdersChanged, useAction } from '../common';

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

/** Data contoh mode tiruan: muat ulang dengan tanggal hari ini, atau hapus untuk melihat halaman yang masih kosong. */
function DemoDataCard() {
  const call = useApiCall('staff');
  const action = useAction();
  const info = useFetch<DemoDataSummary>('staff', '/admin/demo-data');

  async function change(method: 'POST' | 'DELETE', done: string) {
    const out = await action.run(() => call<DemoDataSummary>('/admin/demo-data', { method }), done);
    if (out) {
      info.setData(out);
      notifyOrdersChanged();
    }
  }

  return (
    <Card title={t('admin.demo.title')}>
      <ActionNotice error={action.error} done={action.done} />
      <p className="ui-muted">{t('admin.demo.hint')}</p>
      <Loadable loading={info.loading} error={info.error} hasData={!!info.data}>
        {() => {
          const d = info.data!;
          return (
            <>
              <p>
                <strong>
                  {d.loaded
                    ? t('admin.demo.loadedAt', { date: formatDate(d.at) })
                    : t('admin.demo.empty')}
                </strong>
              </p>
              {d.loaded && (
                <ul className="adm-demo-counts" aria-label={t('admin.demo.counts')}>
                  {(Object.keys(d.counts) as (keyof DemoDataSummary['counts'])[]).map((k) => (
                    <li key={k}>
                      <strong>{d.counts[k].toLocaleString('id-ID')}</strong>
                      <span>{t(`admin.demo.count.${k}` as MessageKey)}</span>
                    </li>
                  ))}
                </ul>
              )}
              <div className="ui-row">
                <Button
                  disabled={action.busy}
                  onClick={() => void change('POST', t('admin.demo.reloaded'))}
                >
                  {d.loaded ? t('admin.demo.reload') : t('admin.demo.load')}
                </Button>
                {d.loaded && (
                  <Button
                    variant="danger"
                    disabled={action.busy}
                    onClick={() => {
                      if (confirmAction(t('admin.demo.clearConfirm')))
                        void change('DELETE', t('admin.demo.cleared'));
                    }}
                  >
                    {t('admin.demo.clear')}
                  </Button>
                )}
              </div>
            </>
          );
        }}
      </Loadable>
    </Card>
  );
}

/**
 * Pengaturan Sistem: akses berbayar, kontak WhatsApp, dan data contoh (mode tiruan). Isi lembar sertifikat diatur di
 * halaman Sertifikat Juara, suara narasi di Audio Narasi.
 */
export function SettingsPage() {
  const s = useFetch<AppSettings>('staff', '/admin/settings');
  return (
    <>
      <PageHeader title={t('admin.settings.title')} subtitle={t('admin.settings.subtitle')} />
      <Loadable loading={s.loading} error={s.error} hasData={!!s.data}>
        {() => (
          <>
            <BillingForm initial={s.data!.billing} />
            <ContactForm initial={s.data!.contact} />
          </>
        )}
      </Loadable>
      {isMocked('admin') && <DemoDataCard />}
    </>
  );
}
