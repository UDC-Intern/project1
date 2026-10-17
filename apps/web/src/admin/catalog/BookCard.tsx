import { useId, useState } from 'react';
import type { CatalogBook, CatalogLevel, CatalogTopic } from '../../api/adminTypes';
import { useApiCall } from '../../auth/useApi';
import { t, type MessageKey } from '../../i18n';
import { ShellIconSvg } from '../../ui/AppShell';
import { Badge, Button } from '../../ui/ui';
import { ActionNotice, ConfirmDialog, Icon, useAction } from '../common';
import { LevelPills } from './LevelPills';
import { TopicPanel } from './TopicPanel';

/** Satu baris topik: kode, judul, ringkasan level, dan panel sunting yang terbuka bila diketuk. */
function TopicRow({
  topic,
  topicCount,
  open,
  paywall,
  onToggle,
  onBooks,
  onNotice,
  onWrite,
}: {
  topic: CatalogTopic;
  topicCount: number;
  open: boolean;
  paywall: boolean;
  onToggle: () => void;
  onBooks: (books: CatalogBook[]) => void;
  onNotice: (message: string) => void;
  onWrite: (level: CatalogLevel) => void;
}) {
  const panelId = useId();
  const free = topic.levels.filter((l) => l.free).length;
  return (
    <li className={`syl-topic${open ? ' is-open' : ''}`}>
      <button
        type="button"
        className="syl-topic-toggle"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        aria-label={t('admin.catalog.topic.toggle', { title: topic.title })}
        onClick={onToggle}
      >
        <span className="syl-code" aria-hidden>
          {topic.code}
        </span>
        <span className="syl-topic-title">
          <strong>{topic.title}</strong>
          <small>
            {t('admin.catalog.topic.counts', { levels: topic.levels.length, free })}
            {topic.custom && <Badge tone="info">{t('admin.catalog.book.custom')}</Badge>}
          </small>
        </span>
        <LevelPills levels={topic.levels} />
        <svg className="syl-chevron" viewBox="0 0 24 24" aria-hidden>
          <path
            d="M9 6l6 6-6 6"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      {open && (
        <div id={panelId}>
          <TopicPanel
            topic={topic}
            paywall={paywall}
            topicCount={topicCount}
            onBooks={onBooks}
            onNotice={onNotice}
            onWrite={onWrite}
          />
        </div>
      )}
    </li>
  );
}

/** Satu buku yang bisa dibuka: topik-topiknya, tombol tambah topik, dan hapus (hanya buku buatan admin). */
export function BookCard({
  book,
  open,
  paywall,
  onToggle,
  onAddTopic,
  onBooks,
  onNotice,
  onWrite,
}: {
  book: CatalogBook;
  open: boolean;
  paywall: boolean;
  onToggle: () => void;
  onAddTopic: () => void;
  onBooks: (books: CatalogBook[]) => void;
  onNotice: (message: string) => void;
  onWrite: (level: CatalogLevel) => void;
}) {
  const bodyId = useId();
  const call = useApiCall('staff');
  const action = useAction();
  const [openTopic, setOpenTopic] = useState<string | null>(null);
  const [removing, setRemoving] = useState(false);
  const levels = book.topics.reduce((n, x) => n + x.levels.length, 0);

  async function remove() {
    const out = await action.run(() =>
      call<CatalogBook[]>(`/admin/books/${encodeURIComponent(book.slug)}`, { method: 'DELETE' }),
    );
    setRemoving(false);
    if (!out) return;
    onBooks(out);
    onNotice(t('admin.catalog.book.deleted', { title: book.title }));
  }

  return (
    <li className="syl-book">
      <div className="syl-book-head">
        <button
          type="button"
          className="syl-book-toggle"
          aria-expanded={open}
          aria-controls={open ? bodyId : undefined}
          aria-label={t('admin.catalog.book.toggle', { title: book.title })}
          onClick={onToggle}
        >
          <svg className="syl-chevron" viewBox="0 0 24 24" aria-hidden>
            <path
              d="M9 6l6 6-6 6"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span
            className={`syl-book-icon${book.subject === 'science' ? ' is-science' : ''}`}
            aria-hidden
          >
            <ShellIconSvg name="book" size={22} />
          </span>
          <span className="syl-book-title">
            <strong>{book.title}</strong>
            <span className="syl-book-badges">
              <Badge tone="muted">
                {t(`admin.catalog.book.subject.${book.subject}` as MessageKey)}
              </Badge>
              <Badge tone="muted">{t('admin.catalog.book.grade', { n: book.grade })}</Badge>
              <span className="ui-muted">
                {t('admin.catalog.book.counts', { topics: book.topics.length, levels })}
              </span>
              {book.custom && <Badge tone="info">{t('admin.catalog.book.custom')}</Badge>}
            </span>
          </span>
        </button>
        <div className="syl-book-actions">
          <Button variant="secondary" size="sm" onClick={onAddTopic}>
            <Icon name="plus" />
            {t('admin.catalog.addTopic')}
          </Button>
          {book.custom && (
            <Button
              variant="danger"
              size="sm"
              disabled={book.used || action.busy}
              title={book.used ? t('admin.catalog.topic.usedHint') : undefined}
              aria-label={t('admin.catalog.book.deleteLabel', { title: book.title })}
              onClick={() => setRemoving(true)}
            >
              <Icon name="trash" />
              {t('admin.catalog.book.delete')}
            </Button>
          )}
        </div>
      </div>
      {open && (
        <div id={bodyId} className="syl-book-body">
          <ActionNotice error={action.error} />
          {book.topics.length === 0 ? (
            <p className="syl-empty">{t('admin.catalog.book.noTopics')}</p>
          ) : (
            <ul className="syl-topics">
              {book.topics.map((topic) => (
                <TopicRow
                  key={topic.id}
                  topic={topic}
                  topicCount={book.topics.length}
                  open={openTopic === topic.id}
                  paywall={paywall}
                  onToggle={() => setOpenTopic(openTopic === topic.id ? null : topic.id)}
                  onBooks={onBooks}
                  onNotice={onNotice}
                  onWrite={onWrite}
                />
              ))}
            </ul>
          )}
        </div>
      )}
      <ConfirmDialog
        open={removing}
        title={t('admin.catalog.book.deleteTitle', { title: book.title })}
        message={t('admin.catalog.book.deleteText')}
        confirmLabel={t('admin.catalog.book.delete')}
        busy={action.busy}
        onConfirm={() => void remove()}
        onCancel={() => setRemoving(false)}
      />
    </li>
  );
}
