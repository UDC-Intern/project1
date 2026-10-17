import { topicInputSchema } from '@udakids/engine';
import { t } from '../../i18n';
import { Button, TextArea, TextField } from '../../ui/ui';
import { Icon } from '../common';

/** Isian formulir topik baru (semua teks; dirapikan saat dikirim). */
export type TopicDraft = {
  code: string;
  title: string;
  lesson: string;
  /** Satu hal penting per baris. */
  tips: string;
  levels: string[];
};

export const newTopicDraft = (): TopicDraft => ({
  code: '',
  title: '',
  lesson: '',
  tips: '',
  levels: ['Level 1', 'Level 2', 'Level 3', 'Level 4'],
});

/** Isian menjadi badan permintaan: kode kosong berarti otomatis, baris kosong di hal penting dibuang. */
export function topicPayload(d: TopicDraft) {
  const code = d.code.trim();
  return {
    ...(code && { code }),
    title: d.title,
    lesson: d.lesson,
    tips: d.tips
      .split('\n')
      .map((x) => x.trim())
      .filter(Boolean),
    levels: d.levels.map((title) => ({ title })),
  };
}

export type FieldIssue = { path: string; message: string };

/** Isu isian topik menurut skema engine (sama dengan yang diperiksa server). `prefix`: awalan jalur, mis. "topic.". */
export function topicIssues(d: TopicDraft, prefix = ''): FieldIssue[] {
  const result = topicInputSchema.safeParse(topicPayload(d));
  return result.success
    ? []
    : result.error.issues.map((i) => ({ path: prefix + i.path.join('.'), message: i.message }));
}

export const issueAt = (issues: readonly FieldIssue[], path: string) =>
  issues.find((i) => i.path === path)?.message;

/** Kolom isian satu topik: kode, judul, materi, hal penting, dan judul level. Dipakai tambah topik dan tambah buku. */
export function TopicFormFields({
  draft,
  onChange,
  issues,
  prefix = '',
  autoCode,
}: {
  draft: TopicDraft;
  onChange: (next: TopicDraft) => void;
  /** Isu yang ditampilkan (kosong sebelum pengguna mencoba menyimpan). */
  issues: readonly FieldIssue[];
  prefix?: string;
  /** Kode yang akan dipakai bila kolom kode dikosongkan. */
  autoCode: string;
}) {
  const set = (patch: Partial<TopicDraft>) => onChange({ ...draft, ...patch });
  const setLevel = (i: number, title: string) =>
    set({ levels: draft.levels.map((x, k) => (k === i ? title : x)) });
  return (
    <>
      <div className="syl-form-head">
        <TextField
          label={t('admin.catalog.form.code')}
          hint={`${t('admin.catalog.form.codeHint')} (${autoCode})`}
          maxLength={4}
          placeholder={autoCode}
          value={draft.code}
          error={issueAt(issues, `${prefix}code`)}
          onChange={(e) => set({ code: e.target.value.toUpperCase() })}
        />
        <TextField
          label={t('admin.catalog.form.title')}
          required
          maxLength={60}
          value={draft.title}
          error={issueAt(issues, `${prefix}title`)}
          onChange={(e) => set({ title: e.target.value })}
        />
      </div>
      <TextArea
        label={t('admin.catalog.form.lesson')}
        hint={t('admin.catalog.form.lessonHint')}
        rows={3}
        maxLength={600}
        value={draft.lesson}
        error={issueAt(issues, `${prefix}lesson`)}
        onChange={(e) => set({ lesson: e.target.value })}
      />
      <TextArea
        label={t('admin.catalog.form.tips')}
        hint={t('admin.catalog.form.tipsHint')}
        rows={3}
        value={draft.tips}
        error={issues.find((i) => i.path.startsWith(`${prefix}tips`))?.message}
        onChange={(e) => set({ tips: e.target.value })}
      />
      <fieldset className="syl-form-group">
        <legend>{t('admin.catalog.form.levels')}</legend>
        <p className="syl-form-hint">{t('admin.catalog.form.levelsHint')}</p>
        <div className="syl-form-levels">
          {draft.levels.map((title, i) => (
            <div key={i} className="syl-form-level">
              <TextField
                label={t('admin.catalog.form.levelN', { n: i + 1 })}
                maxLength={60}
                value={title}
                error={issueAt(issues, `${prefix}levels.${i}.title`)}
                onChange={(e) => setLevel(i, e.target.value)}
              />
              <Button
                variant="danger"
                disabled={draft.levels.length <= 1}
                aria-label={t('admin.catalog.form.levelRemove', { n: i + 1 })}
                title={t('admin.catalog.form.levelRemove', { n: i + 1 })}
                onClick={() => set({ levels: draft.levels.filter((_, k) => k !== i) })}
              >
                <Icon name="trash" />
              </Button>
            </div>
          ))}
        </div>
        {issueAt(issues, `${prefix}levels`) && (
          <p className="ui-error">{issueAt(issues, `${prefix}levels`)}</p>
        )}
        <Button
          variant="ghost"
          size="sm"
          disabled={draft.levels.length >= 12}
          onClick={() => set({ levels: [...draft.levels, `Level ${draft.levels.length + 1}`] })}
          style={{ marginBottom: 12 }}
        >
          <Icon name="plus" />
          {t('admin.catalog.form.levelAdd')}
        </Button>
      </fieldset>
    </>
  );
}
