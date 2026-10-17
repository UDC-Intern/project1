import { useRef, useState } from 'react';
import {
  COUNT_ITEMS,
  VISUAL_COUNT_MAX,
  VISUAL_GROUPS_MAX,
  objectsTotal,
  type CountItem,
  type ObjectsVisual,
  type Visual,
} from '@udakids/engine';
import { CountObjects, OBJECT_LABELS } from '../../components/CountObjects';
import { t, type MessageKey } from '../../i18n';
import { Stepper } from '../../ui/controls';
import { Select } from '../../ui/Select';
import { Button, TextField } from '../../ui/ui';
import { Icon } from '../common';
import {
  processQuestionImage,
  QUESTION_IMAGE_MIME,
  type QuestionImageProblem,
} from './questionImageFile';

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const ITEM_OPTIONS = COUNT_ITEMS.map((value) => ({ value, label: cap(OBJECT_LABELS[value]) }));
const START: ObjectsVisual = { item: 'apple', count: 3 };

const groupsOf = (v: ObjectsVisual) => v.groups ?? [v.count ?? 1];
/** Satu kelompok disimpan sebagai `count`; dua atau tiga kelompok sebagai `groups`. */
const objectsOf = (item: CountItem, groups: number[]): ObjectsVisual =>
  groups.length === 1 ? { item, count: groups[0]! } : { item, groups };

/**
 * Gambar yang menyertai satu soal: benda hitung (pilih jenis benda dan jumlahnya, digandakan otomatis, boleh beberapa
 * kelompok), gambar dari galeri aset atau ilustrasi AI yang disetujui, atau gambar unggahan sendiri. Soal boleh juga
 * tanpa gambar. Pratinjau di atas sama dengan yang dilihat anak.
 */
export function VisualEditor({
  n,
  visual,
  onChange,
  onGallery,
}: {
  /** Nomor soal (mulai 1), untuk nama tombol bagi pembaca layar. */
  n: number;
  visual: Visual | undefined;
  onChange: (visual: Visual | undefined) => void;
  onGallery: () => void;
}) {
  const file = useRef<HTMLInputElement>(null);
  const [problem, setProblem] = useState<QuestionImageProblem | null>(null);
  const [busy, setBusy] = useState(false);

  const objects = visual && visual.kind !== 'image' ? visual : null;
  const image = visual && visual.kind === 'image' ? visual : null;
  const groups = objects ? groupsOf(objects) : [];
  const total = objects ? objectsTotal(objects) : 0;
  const forQuestion = (text: string) => `${text}, ${t('admin.bank.question', { n })}`;

  const setGroups = (next: number[]) => objects && onChange(objectsOf(objects.item, next));

  async function upload(files: FileList | null) {
    const chosen = files?.[0];
    if (!chosen) return;
    setProblem(null);
    setBusy(true);
    const result = await processQuestionImage(chosen).catch(
      () => ({ ok: false, problem: 'read' }) as const,
    );
    setBusy(false);
    if (file.current) file.current.value = '';
    if (!result.ok) {
      setProblem(result.problem);
      return;
    }
    onChange({ kind: 'image', url: result.dataUrl });
  }

  return (
    <div className="bank-visual" role="group" aria-label={forQuestion(t('admin.bank.visualTitle'))}>
      <div className="bank-visual-head">
        <strong>{t('admin.bank.visualTitle')}</strong>
        <small className="ui-hint">
          {objects
            ? t('admin.bank.visualKindObjects')
            : image
              ? t('admin.bank.visualKindImage')
              : t('admin.bank.visualNone')}
        </small>
      </div>

      {visual && (
        <div className="bank-visual-preview">
          <CountObjects visual={visual} maxHeight={140} />
        </div>
      )}

      {objects && (
        <>
          <div className="bank-visual-fields">
            <div className="ui-field">
              <span className="bank-visual-label">{t('admin.bank.visualItem')}</span>
              <Select
                value={objects.item}
                options={ITEM_OPTIONS}
                aria-label={forQuestion(t('admin.bank.visualItem'))}
                onChange={(item) => onChange(objectsOf(item as CountItem, groups))}
              />
            </div>
            {groups.map((count, g) => (
              <div className="ui-field" key={g}>
                <span className="bank-visual-label">
                  {groups.length > 1
                    ? t('admin.bank.visualGroupCount', { n: g + 1 })
                    : t('admin.bank.visualCount')}
                </span>
                <div className="ui-row">
                  <Stepper
                    label={forQuestion(
                      groups.length > 1
                        ? t('admin.bank.visualGroupCount', { n: g + 1 })
                        : t('admin.bank.visualCount'),
                    )}
                    value={count}
                    min={1}
                    max={VISUAL_COUNT_MAX - (total - count)}
                    onChange={(v) => setGroups(groups.map((x, k) => (k === g ? v : x)))}
                  />
                  {groups.length > 1 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label={forQuestion(t('admin.bank.visualRemoveGroup', { n: g + 1 }))}
                      title={t('admin.bank.visualRemoveGroup', { n: g + 1 })}
                      onClick={() => setGroups(groups.filter((_, k) => k !== g))}
                    >
                      <Icon name="trash" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
          <div className="bank-visual-actions">
            <small className="ui-hint" role="status">
              {t('admin.bank.visualTotal', { n: total, item: OBJECT_LABELS[objects.item] })}{' '}
              {t('admin.bank.visualAnswerNote')}
            </small>
            {groups.length < VISUAL_GROUPS_MAX && total < VISUAL_COUNT_MAX && (
              <Button
                variant="ghost"
                size="sm"
                aria-label={forQuestion(t('admin.bank.visualAddGroup'))}
                onClick={() => setGroups([...groups, 1])}
              >
                <Icon name="plus" />
                {t('admin.bank.visualAddGroup')}
              </Button>
            )}
          </div>
        </>
      )}

      {image && (
        <TextField
          label={t('admin.bank.visualLabel')}
          hint={t('admin.bank.visualLabelHint')}
          maxLength={80}
          value={image.label ?? ''}
          aria-label={forQuestion(t('admin.bank.visualLabel'))}
          onChange={(e) => {
            const label = e.target.value;
            onChange(label ? { ...image, label } : { kind: 'image', url: image.url });
          }}
        />
      )}

      <div className="bank-visual-actions">
        <Button
          variant="secondary"
          size="sm"
          aria-pressed={!!objects}
          aria-label={forQuestion(t('admin.bank.visualObjects'))}
          onClick={() => !objects && onChange({ ...START })}
        >
          {t('admin.bank.visualObjects')}
        </Button>
        <Button
          variant="secondary"
          size="sm"
          aria-label={forQuestion(t('admin.bank.visualGallery'))}
          onClick={onGallery}
        >
          {t('admin.bank.visualGallery')}
        </Button>
        <Button
          variant="secondary"
          size="sm"
          disabled={busy}
          aria-label={forQuestion(t('admin.bank.visualUpload'))}
          onClick={() => file.current?.click()}
        >
          {busy ? t('admin.bank.visualUploading') : t('admin.bank.visualUpload')}
        </Button>
        {visual && (
          <Button
            variant="ghost"
            size="sm"
            aria-label={forQuestion(t('admin.bank.visualRemove'))}
            onClick={() => {
              setProblem(null);
              onChange(undefined);
            }}
          >
            <Icon name="trash" />
            {t('admin.bank.visualRemove')}
          </Button>
        )}
        <input
          ref={file}
          type="file"
          hidden
          tabIndex={-1}
          accept={QUESTION_IMAGE_MIME.join(',')}
          aria-label={forQuestion(t('admin.bank.visualUpload'))}
          onChange={(e) => void upload(e.target.files)}
        />
      </div>
      {problem && (
        <p className="ui-error" role="alert">
          {t(`admin.bank.visualErr.${problem}` as MessageKey)}
        </p>
      )}
    </div>
  );
}
