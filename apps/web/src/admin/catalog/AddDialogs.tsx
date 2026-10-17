import { useState, type FormEvent } from 'react';
import {
  SYLLABUS_GRADES,
  SYLLABUS_SUBJECTS,
  bookInputSchema,
  bookSlugOf,
  bookTitleOf,
  nextTopicCode,
  type SyllabusSubject,
} from '@udakids/engine';
import type { CatalogBook } from '../../api/adminTypes';
import { useApiCall } from '../../auth/useApi';
import { t, type MessageKey } from '../../i18n';
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

/** `POST /admin/books`: buku baru untuk satu pasangan mapel dan kelas, langsung dengan topik pertamanya. */
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
  const [subject, setSubject] = useState<SyllabusSubject>('math');
  const [grade, setGrade] = useState(5);
  // Judul mengikuti mapel dan kelas sampai pengguna mengetiknya sendiri.
  const [title, setTitle] = useState<string | null>(null);
  const [topic, setTopic] = useState<TopicDraft>(newTopicDraft);
  const [tried, setTried] = useState(false);

  const shownTitle = title ?? bookTitleOf(subject, grade);
  const exists = books.some((b) => b.slug === bookSlugOf(subject, grade));
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
        <div className="adm-fields">
          <SelectField
            label={t('admin.catalog.addBook.subject')}
            value={subject}
            onChange={(v) => setSubject(v as SyllabusSubject)}
            options={SYLLABUS_SUBJECTS.map((s) => ({
              value: s,
              label: t(`admin.catalog.book.subject.${s}` as MessageKey),
            }))}
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
        <TextField
          label={t('admin.catalog.addBook.name')}
          required
          maxLength={60}
          value={shownTitle}
          error={tried ? issues.find((i) => i.path === 'title')?.message : undefined}
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
