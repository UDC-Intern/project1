import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import type { AppSettings, BillingSettings, ContactSettings } from '@udakids/engine';
import type { DemoDataSummary } from '../../api/adminTypes';
import { isMocked } from '../../api/mode';
import { currentSettings, settingsChanged } from '../../api/settings';
import { useApiCall, useFetch } from '../../auth/useApi';
import { t, type MessageKey } from '../../i18n';
import { Button, Card, formatDate, PageHeader, TextField } from '../../ui/ui';
import { ActionNotice, Loadable, notifyOrdersChanged, useAction, useConfirm } from '../common';

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

/**
 * Pembayaran: berapa lama pesanan menunggu dibayar. Kunci berbayar dan level gratis ada di Silabus Belajar;
 * bagian `billing` yang sama disimpan utuh, jadi aturan akses di sana tidak berubah.
 */
function PaymentForm({ initial }: { initial: BillingSettings }) {
  const { action, save } = useSave('billing', t('admin.catalog.pay.saved'));
  const [hours, setHours] = useState(initial.orderExpiryHours);

  async function submit(e: FormEvent) {
    e.preventDefault();
    // Aturan akses diambil dari pengaturan terbaru, bukan dari isian awal halaman ini.
    const out = await save({ ...currentSettings().billing, orderExpiryHours: hours });
    if (out) setHours(out.orderExpiryHours);
  }

  return (
    <Card title={t('admin.catalog.pay.cardTitle')}>
      <ActionNotice error={action.error} done={action.done} />
      <form onSubmit={submit}>
        <TextField
          label={t('admin.catalog.pay.expiry')}
          hint={t('admin.catalog.pay.expiryHint')}
          type="number"
          required
          min={1}
          max={168}
          value={String(hours)}
          onChange={(e) => setHours(Number(e.target.value))}
        />
        <p className="ui-muted" style={{ marginBottom: 14 }}>
          {t('admin.catalog.pay.freeLevels')}{' '}
          <Link to="/admin/konten">{t('admin.catalog.pay.openCatalog')}</Link>
        </p>
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
  const { ask, dialog } = useConfirm();
  const info = useFetch<DemoDataSummary>('staff', '/admin/demo-data');

  async function clearAll() {
    const yes = await ask({
      title: t('admin.demo.clearTitle'),
      message: t('admin.demo.clearConfirm'),
      confirmLabel: t('admin.demo.clearYes'),
    });
    if (yes) await change('DELETE', t('admin.demo.cleared'));
  }

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
                  <Button variant="danger" disabled={action.busy} onClick={() => void clearAll()}>
                    {t('admin.demo.clear')}
                  </Button>
                )}
              </div>
            </>
          );
        }}
      </Loadable>
      {dialog}
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
            <PaymentForm initial={s.data!.billing} />
            <ContactForm initial={s.data!.contact} />
          </>
        )}
      </Loadable>
      {isMocked('admin') && <DemoDataCard />}
    </>
  );
}
