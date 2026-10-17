import { useMemo, useState, type FormEvent } from 'react';
import {
  SYLLABUS_GRADES,
  SUBJECT_PRESETS,
  bookInputSchema,
  bookSlugOf,
  bookTitleOf,
  nextTopicCode,
  subjectCodeOf,
} from '@udakids/engine';
import type { CatalogBook } from '../../api/adminTypes';
import { useApiCall } from '../../auth/useApi';
import { t } from '../../i18n';
import { Dialog } from '../../ui/Dialog';
import { Button, Notice, SelectField, TextField } from '../../ui/ui';
import { ActionNotice, useAction } from '../common';
import {
  newTopicDraft,
  topicIssues,
  topicPayload,
  TopicFormFields,
  type FieldIssue,
  type TopicDraft,
} from './TopicForm';
import { CUSTOM_SUBJECT, subjectOptions } from './subjects';

/** Daftar isu isian di atas tombol simpan, setelah pengguna mencoba menyimpan. */
function IssueList({ issues }: { issues: readonly FieldIssue[] }) {
  if (issues.length === 0) return null;
  return (
    <Notice tone="error">
      {t('admin.catalog.form.errors')}
      <ul className="syl-errors">
        {issues.map((i, n) => (
          <li key={n}>{i.message}</li>
        ))}
      </ul>
    </Notice>
  );
}

/** `POST /admin/books/:slug/topics`: topik baru di akhir sebuah buku. */
export function AddTopicDialog({
  book,
  onClose,
  onDone,
}: {
  book: CatalogBook;
  onClose: () => void;
  onDone: (books: CatalogBook[], title: string) => void;
}) {
  const call = useApiCall('staff');
  const action = useAction();
  const [draft, setDraft] = useState<TopicDraft>(newTopicDraft);
  const [tried, setTried] = useState(false);
  const issues = topicIssues(draft);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setTried(true);
    if (issues.length > 0) return;
    const out = await action.run(() =>
      call<CatalogBook[]>(`/admin/books/${encodeURIComponent(book.slug)}/topics`, {
        method: 'POST',
        body: topicPayload(draft),
      }),
    );
    if (out) onDone(out, draft.title.trim());
  }

  return (
    <Dialog wide title={t('admin.catalog.addTopic.title', { book: book.title })} onClose={onClose}>
      <form onSubmit={submit} noValidate>
        <TopicFormFields
          draft={draft}
          onChange={setDraft}
          issues={tried ? issues : []}
          autoCode={nextTopicCode(book.topics.map((x) => x.code))}
        />
        {tried && <IssueList issues={issues} />}
        <ActionNotice error={action.error} />
        <div className="dlg-actions">
          <Button variant="ghost" onClick={onClose}>
            {t('admin.catalog.dialog.cancel')}
          </Button>
          <Button type="submit" disabled={action.busy}>
            {t('admin.catalog.addTopic.submit')}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

/**
 * `POST /admin/books`: buku baru untuk satu pasangan mapel dan kelas, langsung dengan topik pertamanya. Mapel dipilih
 * dari yang sudah ada (ditambah mapel standar) atau ditulis sendiri lewat "tambah mata pelajaran lainnya".
 */
export function AddBookDialog({
  books,
  onClose,
  onDone,
}: {
  books: readonly CatalogBook[];
  onClose: () => void;
  onDone: (books: CatalogBook[], title: string) => void;
}) {
  const call = useApiCall('staff');
  const action = useAction();
  const choices = useMemo(
    () => [
      ...subjectOptions(books),
      { value: CUSTOM_SUBJECT, label: t('admin.catalog.addBook.subjectCustom') },
    ],
    [books],
  );
  const [choice, setChoice] = useState<string>(SUBJECT_PRESETS[0]);
  const [customName, setCustomName] = useState('');
  const [grade, setGrade] = useState(5);
  // Judul mengikuti mapel dan kelas sampai pengguna mengetiknya sendiri.
  const [title, setTitle] = useState<string | null>(null);
  const [topic, setTopic] = useState<TopicDraft>(newTopicDraft);
  const [tried, setTried] = useState(false);

  const custom = choice === CUSTOM_SUBJECT;
  const typed = custom ? customName.trim() : choice;
  // Nilai yang disimpan: kode lama untuk Matematika dan Sains, selain itu nama yang rapi.
  const subject = typed ? subjectCodeOf(typed) : '';
  const shownTitle = title ?? (subject ? bookTitleOf(subject, grade) : '');
  const slug = subject ? bookSlugOf(subject, grade) : '';
  const exists = !!slug && books.some((b) => b.slug === slug);
  const payload = { subject, grade, title: shownTitle, topic: topicPayload(topic) };
  const parsed = bookInputSchema.safeParse(payload);
  const issues: FieldIssue[] = [
    ...(parsed.success
      ? []
      : parsed.error.issues
          .filter((i) => i.path[0] !== 'topic')
          .map((i) => ({ path: i.path.join('.'), message: i.message }))),
    ...topicIssues(topic, 'topic.'),
    ...(exists ? [{ path: 'exists', message: t('admin.catalog.addBook.exists') }] : []),
  ];
  const issueAt = (path: string) =>
    tried ? issues.find((i) => i.path === path)?.message : undefined;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setTried(true);
    if (issues.length > 0) return;
    const out = await action.run(() =>
      call<CatalogBook[]>('/admin/books', { method: 'POST', body: payload }),
    );
    if (out) onDone(out, shownTitle);
  }

  return (
    <Dialog wide title={t('admin.catalog.addBook.title')} onClose={onClose}>
      <form onSubmit={submit} noValidate>
        <p className="ui-muted" style={{ marginBottom: 14 }}>
          {t('admin.catalog.addBook.hint')}
        </p>
        <div className="adm-fields syl-subject-fields">
          <SelectField
            label={t('admin.catalog.addBook.subject')}
            value={choice}
            onChange={setChoice}
            options={choices}
          />
          <SelectField
            label={t('admin.catalog.addBook.grade')}
            value={String(grade)}
            onChange={(v) => setGrade(Number(v))}
            options={SYLLABUS_GRADES.map((g) => ({
              value: String(g),
              label: t('admin.catalog.book.grade', { n: g }),
            }))}
            error={exists ? t('admin.catalog.addBook.exists') : undefined}
          />
        </div>
        {custom && (
          <TextField
            label={t('admin.catalog.addBook.customName')}
            hint={slug ? t('admin.catalog.addBook.customHint', { slug }) : undefined}
            placeholder={t('admin.catalog.addBook.customPlaceholder')}
            required
            autoFocus
            maxLength={40}
            value={customName}
            error={issueAt('subject')}
            onChange={(e) => setCustomName(e.target.value)}
          />
        )}
        <TextField
          label={t('admin.catalog.addBook.name')}
          required
          maxLength={60}
          value={shownTitle}
          error={issueAt('title')}
          onChange={(e) => setTitle(e.target.value)}
        />
        <fieldset className="syl-form-group">
          <legend>{t('admin.catalog.addBook.firstTopic')}</legend>
          <TopicFormFields
            draft={topic}
            onChange={setTopic}
            issues={tried ? issues : []}
            prefix="topic."
            autoCode={nextTopicCode([])}
          />
        </fieldset>
        {tried && <IssueList issues={issues} />}
        <ActionNotice error={action.error} />
        <div className="dlg-actions">
          <Button variant="ghost" onClick={onClose}>
            {t('admin.catalog.dialog.cancel')}
          </Button>
          <Button type="submit" disabled={action.busy || exists}>
            {t('admin.catalog.addBook.submit')}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
