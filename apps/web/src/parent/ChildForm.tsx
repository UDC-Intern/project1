import { useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  MOMO_COLORS,
  childProfileSchema,
  childUpdateSchema,
  type Color,
  type PinPicture,
  MAX_CHILDREN_PER_PARENT,
} from '@udakids/engine';
import { errorMessage } from '../api/client';
import type { ChildProfile } from '../api/types';
import { useApiCall, useFetch } from '../auth/useApi';
import { t } from '../i18n';
import { familySteps, Stepper } from '../site/AuthLayout';
import { Momo } from '../components/Momo';
import { ShellIconSvg } from '../ui/AppShell';
import { Button, Notice, RequiredNote, Spinner, TextField } from '../ui/ui';
import { ColorPicker } from './ColorPicker';
import { fieldErrors, serverFieldErrors } from './form';
import { PinSetter } from './PinSetter';
import { ChildCount, ChildLimitDialog, isChildLimitError } from './ChildLimit';

export type ChildFormMode = 'new' | 'edit' | 'pin';

const isColor = (c: string): c is Color => (MOMO_COLORS as readonly string[]).includes(c);

function Form({
  mode,
  child,
  count,
}: {
  mode: ChildFormMode;
  child?: ChildProfile;
  /** Banyak anak di akun (mode new): info "3 dari 7 anak". */
  count?: number;
}) {
  const navigate = useNavigate();
  const welcome = (useLocation().state as { welcome?: boolean } | null)?.welcome === true;
  const call = useApiCall('parent');
  const [nickname, setNickname] = useState(child?.nickname ?? '');
  const [color, setColor] = useState<Color>(
    child && isColor(child.momoColor) ? child.momoColor : MOMO_COLORS[0],
  );
  const [pin, setPin] = useState<PinPicture[] | null>(null);
  const [classCode] = useState(child?.classCode ?? '');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [limitOpen, setLimitOpen] = useState(false);
  const withPin = mode !== 'edit';
  const withProfile = mode !== 'pin';

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(undefined);
    const input = {
      ...(withProfile && { nickname, momoColor: color }),
      ...(withPin && pin && { pin }),
      // Kode kelas (D-022): kosong saat membuat = tanpa kelas; dikosongkan saat mengubah = keluar kelas.
      ...(withProfile &&
        (classCode.trim()
          ? { classCode: classCode.trim().toUpperCase() }
          : mode === 'edit' && child?.classCode
            ? { classCode: null }
            : {})),
    };
    const parsed =
      mode === 'new' ? childProfileSchema.safeParse(input) : childUpdateSchema.safeParse(input);
    const next = parsed.success ? {} : fieldErrors(parsed.error.issues);
    if (withPin && !pin) next.pin = t('parent.form.pinMissing');
    setErrors(next);
    if (!parsed.success || Object.keys(next).length > 0) return;
    setBusy(true);
    try {
      const saved =
        mode === 'new'
          ? await call<ChildProfile>('/parent/children', { body: parsed.data })
          : await call<ChildProfile>(`/parent/children/${child!.id}`, {
              method: 'PATCH',
              body: parsed.data,
            });
      navigate('/orang-tua', { state: { saved: saved?.nickname ?? nickname, welcome } });
    } catch (err) {
      setBusy(false);
      // Batas 7 anak tercapai (mis. anak ditambahkan dari perangkat lain) → pop-up akun terpisah (D-063).
      if (isChildLimitError(err)) {
        setError(t('parent.dash.childLimit', { n: MAX_CHILDREN_PER_PARENT }));
        setLimitOpen(true);
        return;
      }
      setErrors(serverFieldErrors(err));
      setError(errorMessage(err));
    }
  }

  const title =
    mode === 'new'
      ? t('parent.form.newTitle')
      : mode === 'edit'
        ? t('parent.form.editTitle', { name: child?.nickname ?? '' })
        : t('parent.form.pinTitle', { name: child?.nickname ?? '' });

  const subtitle =
    mode === 'new'
      ? t('parent.form.newLead')
      : mode === 'edit'
        ? t('parent.form.editLead')
        : t('parent.form.pinLead');
  // Nomor bagian mengikuti bagian yang tampil (mode pin hanya punya sandi gambar).
  let step = 0;
  const num = () => ++step;

  return (
    <div className="cf">
      {welcome && mode === 'new' && <Stepper current={3} labels={familySteps()} />}
      <ChildLimitDialog open={limitOpen} onClose={() => setLimitOpen(false)} />
      <header className="cf-head">
        <div>
          <h1>{title}</h1>
          <p>{subtitle}</p>
        </div>
        {mode === 'new' && count !== undefined && <ChildCount count={count} className="cf-count" />}
      </header>
      {error && <Notice tone="error">{error}</Notice>}
      <div className={`cf-layout${withProfile ? '' : ' is-single'}`}>
        <form className="cf-form" onSubmit={submit} noValidate>
          {withProfile && (
            <section className="cf-section" aria-labelledby="cf-profile">
              <h2 id="cf-profile">
                <span className="cf-num">{num()}</span>
                {t('parent.form.sectionProfile')}
              </h2>
              <RequiredNote />
              <TextField
                required
                label={t('parent.form.nickname')}
                hint={t('parent.form.nicknameHint')}
                autoComplete="off"
                maxLength={20}
                value={nickname}
                error={errors.nickname}
                onChange={(e) => setNickname(e.target.value)}
              />
              <ColorPicker
                label={t('parent.form.color')}
                hint={t('parent.form.colorHint')}
                value={color}
                onChange={setColor}
              />
            </section>
          )}
          {withPin && (
            <section className="cf-section" aria-labelledby="cf-pin">
              <h2 id="cf-pin">
                <span className="cf-num">{num()}</span>
                {t('parent.form.sectionPin')}
              </h2>
              <fieldset
                className="pa-pin-field"
                aria-describedby={errors.pin ? 'pa-pin-error' : undefined}
              >
                <legend>{t('parent.form.pin')}</legend>
                <PinSetter onChange={setPin} />
                {errors.pin && (
                  <p id="pa-pin-error" className="ui-error pa-field-error" role="alert">
                    {errors.pin}
                  </p>
                )}
              </fieldset>
            </section>
          )}
          <div className="cf-actions">
            <Link className="ui-btn ui-btn-ghost" to="/orang-tua">
              {t('parent.cancel')}
            </Link>
            <Button type="submit" disabled={busy}>
              {busy
                ? t('parent.saving')
                : mode === 'new'
                  ? t('parent.form.submitNew')
                  : mode === 'edit'
                    ? t('parent.form.submitEdit')
                    : t('parent.form.submitPin')}
            </Button>
          </div>
        </form>
        {withProfile && (
          <aside className="cf-side" aria-label={t('parent.form.preview')}>
            <div className="cf-preview">
              <span className="cf-preview-label">{t('parent.form.preview')}</span>
              <Momo color={color} mood="happy" size={132} />
              <strong className="cf-preview-name">
                {nickname.trim() || t('parent.form.previewName')}
              </strong>
              <small>{t('parent.form.previewHint')}</small>
            </div>
            <div className="cf-privacy">
              <ShellIconSvg name="badge" />
              <p>{t('parent.form.privacy')}</p>
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}

/** Akun sudah punya 7 anak: tanpa formulir, pop-up "buat akun terpisah" langsung terbuka. */
function LimitReached() {
  const [open, setOpen] = useState(true);
  return (
    <div className="pa-form">
      <ChildLimitDialog open={open} onClose={() => setOpen(false)} />
      <Notice tone="warning">{t('parent.dash.childLimit', { n: MAX_CHILDREN_PER_PARENT })}</Notice>
      <div className="ui-row">
        <Button variant="secondary" onClick={() => setOpen(true)}>
          {t('parent.limit.newAccount')}
        </Button>
        <Link to="/orang-tua">{t('parent.back')}</Link>
      </div>
    </div>
  );
}

/** Tambah anak (mode new), ubah nama/warna (edit), atau ganti sandi gambar (pin). */
export function ChildForm({ mode }: { mode: ChildFormMode }) {
  const { id } = useParams();
  const list = useFetch<ChildProfile[]>('parent', '/parent/children');
  if (mode === 'new') {
    // Batas 7 anak per akun (D-063): tunggu daftar anak, lalu beri tahu sebelum orang tua mengisi formulir.
    if (list.loading && !list.data) return <Spinner label={t('parent.loading')} />;
    const count = list.data?.length ?? 0;
    if (count >= MAX_CHILDREN_PER_PARENT) return <LimitReached />;
    return <Form mode="new" count={list.data ? count : undefined} />;
  }
  if (list.loading) return <Spinner label={t('parent.loading')} />;
  const child = list.data?.find((c) => c.id === id);
  if (!child) {
    return (
      <>
        <Notice tone="error">
          {list.error ? errorMessage(list.error) : t('parent.child.notFound')}
        </Notice>
        <Link to="/orang-tua">{t('parent.back')}</Link>
      </>
    );
  }
  return <Form key={child.id} mode={mode} child={child} />;
}
