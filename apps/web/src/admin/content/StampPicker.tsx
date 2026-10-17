import { useId, useRef, useState } from 'react';
import type { Stamp } from '@udakids/engine';
import { useApiCall, useFetch } from '../../auth/useApi';
import { t, type MessageKey } from '../../i18n';
import { Segmented } from '../../ui/controls';
import { Button, Notice, SelectField, TextField } from '../../ui/ui';
import { ActionNotice, useAction } from '../common';
import { STAMP_MIME, processStampFile, type StampProblem } from './stampFile';

/** Stempel yang baru diunggah dan baru masuk riwayat saat pengaturan lembar disimpan. */
export type PendingStamp = { name: string; image: string };

const BUILTIN = 'builtin';
const PENDING = '__pending__';
const CURRENT = '__current__';

/** Nama stempel dari nama berkas: tanpa ekstensi, spasi dirapikan, paling banyak 40 huruf. */
export const stampNameOf = (fileName: string) =>
  fileName
    .replace(/\.[A-Za-z0-9]+$/, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 40);

/**
 * Pilihan stempel di dialog "Atur isi lembar": pakai stempel yang sudah ada (segel emas bawaan atau yang pernah
 * diunggah, dari riwayat `/admin/stamps`) atau unggah gambar stempel baru. Pratinjau lembar di sebelahnya langsung
 * memakai pilihan ini; stempel baru masuk riwayat saat admin menyimpan pengaturan.
 */
export function StampPicker({
  image,
  pending,
  onPick,
  onUpload,
}: {
  /** Gambar stempel yang dipilih; kosong berarti segel emas bawaan. */
  image: string;
  pending: PendingStamp | null;
  onPick: (image: string) => void;
  onUpload: (stamp: PendingStamp) => void;
}) {
  const id = useId();
  const call = useApiCall('staff');
  const history = useFetch<Stamp[]>('staff', '/admin/stamps');
  const remove = useAction();
  const [mode, setMode] = useState<'existing' | 'upload'>('existing');
  const [name, setName] = useState(pending?.name ?? '');
  const [problem, setProblem] = useState<StampProblem | null>(null);
  const [busy, setBusy] = useState(false);
  const file = useRef<HTMLInputElement>(null);

  const library = history.data ?? [];
  const inLibrary = library.find((s) => s.image === image);
  const isPending = !!pending && !inLibrary && pending.image === image;
  const selected =
    image === '' ? BUILTIN : inLibrary ? inLibrary.id : isPending ? PENDING : CURRENT;

  const options = [
    { value: BUILTIN, label: t('admin.certSettings.stamp.builtin') },
    ...library.map((s) => ({ value: s.id, label: s.name })),
    ...(isPending
      ? [{ value: PENDING, label: t('admin.certSettings.stamp.pending', { name: pending.name }) }]
      : []),
    ...(selected === CURRENT
      ? [{ value: CURRENT, label: t('admin.certSettings.stamp.current') }]
      : []),
  ];

  function choose(value: string) {
    if (value === BUILTIN) onPick('');
    else if (value === PENDING && pending) onPick(pending.image);
    else {
      const stamp = library.find((s) => s.id === value);
      if (stamp) onPick(stamp.image);
    }
  }

  async function upload(files: FileList | null) {
    const chosen = files?.[0];
    if (!chosen) return;
    setProblem(null);
    setBusy(true);
    const result = await processStampFile(chosen).catch(
      () => ({ ok: false, problem: 'read' }) as const,
    );
    setBusy(false);
    if (file.current) file.current.value = '';
    if (!result.ok) {
      setProblem(result.problem);
      return;
    }
    const label = name.trim() || stampNameOf(chosen.name) || t('admin.certSettings.stamp.pick');
    setName(label);
    onUpload({ name: label, image: result.dataUrl });
  }

  async function removeFromHistory(stamp: Stamp) {
    const out = await remove.run(
      () => call<Stamp[]>(`/admin/stamps/${encodeURIComponent(stamp.id)}`, { method: 'DELETE' }),
      t('admin.certSettings.stamp.removed'),
    );
    if (out) {
      history.setData(out);
      // Stempel yang baru saja dihapus dari riwayat tetap dipakai lembar sampai admin memilih yang lain.
    }
  }

  return (
    <div className="stamp-picker">
      <Segmented
        label={t('admin.certSettings.stamp.source')}
        value={mode}
        onChange={setMode}
        options={[
          { value: 'existing', label: t('admin.certSettings.stamp.existing') },
          { value: 'upload', label: t('admin.certSettings.stamp.upload') },
        ]}
      />

      {mode === 'existing' && (
        <>
          <SelectField
            label={t('admin.certSettings.stamp.pick')}
            hint={t('admin.certSettings.stamp.existingHint')}
            value={selected}
            options={options}
            onChange={choose}
          />
          <div className="stamp-row">
            {image && (
              <img
                className="stamp-thumb"
                src={image}
                alt={t('admin.certSettings.stamp.previewAlt')}
              />
            )}
            {inLibrary && (
              <Button
                variant="ghost"
                size="sm"
                disabled={remove.busy}
                onClick={() => void removeFromHistory(inLibrary)}
              >
                {t('admin.certSettings.stamp.remove')}
              </Button>
            )}
          </div>
          <ActionNotice error={remove.error} done={remove.done} />
        </>
      )}

      {mode === 'upload' && (
        <>
          <TextField
            label={t('admin.certSettings.stamp.name')}
            hint={t('admin.certSettings.stamp.nameHint')}
            maxLength={40}
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (isPending && pending)
                onUpload({ name: e.target.value.trim() || pending.name, image: pending.image });
            }}
          />
          <input
            ref={file}
            id={`${id}-file`}
            className="sign-file"
            type="file"
            accept={STAMP_MIME.join(',')}
            aria-label={t('admin.certSettings.stamp.file')}
            tabIndex={-1}
            onChange={(e) => void upload(e.target.files)}
          />
          <div className="stamp-row">
            <Button
              variant="secondary"
              size="sm"
              disabled={busy}
              onClick={() => file.current?.click()}
            >
              {isPending
                ? t('admin.certSettings.stamp.change')
                : t('admin.certSettings.stamp.choose')}
            </Button>
            {busy && <small className="ui-hint">{t('admin.certSettings.stamp.processing')}</small>}
            {isPending && pending && (
              <img
                className="stamp-thumb"
                src={pending.image}
                alt={t('admin.certSettings.stamp.previewAlt')}
              />
            )}
          </div>
          <small className="ui-hint">{t('admin.certSettings.stamp.uploadHint')}</small>
          {problem && (
            <Notice tone="error">
              {t(`admin.certSettings.stamp.error.${problem}` as MessageKey)}
            </Notice>
          )}
        </>
      )}
    </div>
  );
}
