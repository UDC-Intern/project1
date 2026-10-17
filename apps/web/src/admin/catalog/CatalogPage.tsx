import { useState } from 'react';
import type { CatalogBook, CatalogLevel } from '../../api/adminTypes';
import { useSettings } from '../../api/settings';
import { useFetch } from '../../auth/useApi';
import { t } from '../../i18n';
import { ShellIconSvg } from '../../ui/AppShell';
import { CountUp, Kpi } from '../../ui/charts';
import { Button, Empty, Notice, PageHeader } from '../../ui/ui';
import { Icon, Loadable } from '../common';
import { AccessCard } from './AccessCard';
import { AddBookDialog, AddTopicDialog } from './AddDialogs';
import { BookCard } from './BookCard';
import './catalog.css';
import { Legend } from './LevelPills';
import { QuestionBankDialog } from './QuestionBankDialog';

/**
 * Silabus Belajar: aturan akses berbayar, lalu buku, topik, dan level. Admin bisa menambah buku, topik, dan level
 * baru, menulis bank soal level buatannya, mengatur judul, materi, "Tahukah kamu?", serta level mana yang gratis
 * atau Premium. Buku bawaan dari berkas konten tidak bisa dihapus; yang dibuat admin bisa selama belum dikerjakan.
 */
export function CatalogPage() {
  const catalogs = useFetch<CatalogBook[]>('staff', '/admin/catalogs');
  const paywall = useSettings().billing.paywall;
  const [opened, setOpened] = useState<Set<string> | null>(null);
  const [addingBook, setAddingBook] = useState(false);
  const [addingTopicTo, setAddingTopicTo] = useState<CatalogBook>();
  const [writing, setWriting] = useState<CatalogLevel>();
  const [notice, setNotice] = useState<string>();

  const books = catalogs.data;
  // Awalnya buku pertama terbuka; sesudah itu mengikuti ketukan admin.
  const open = opened ?? new Set(books?.[0] ? [books[0].slug] : []);
  const toggle = (slug: string) => {
    const next = new Set(open);
    if (next.has(slug)) next.delete(slug);
    else next.add(slug);
    setOpened(next);
  };

  const topics = books?.reduce((n, b) => n + b.topics.length, 0) ?? 0;
  const levels = books?.flatMap((b) => b.topics.flatMap((x) => x.levels)) ?? [];
  const freeLevels = levels.filter((l) => l.free).length;
  const noQuestions = levels.filter((l) => l.source === 'none').length;

  function changed(next: CatalogBook[], message?: string) {
    catalogs.setData(next);
    setNotice(message);
  }

  return (
    <>
      <PageHeader
        title={t('admin.catalog.title')}
        subtitle={t('admin.catalog.subtitle')}
        actions={
          <Button onClick={() => setAddingBook(true)} disabled={!books}>
            <Icon name="plus" />
            {t('admin.catalog.addBook')}
          </Button>
        }
      />
      {notice && <Notice tone="success">{notice}</Notice>}

      {books && (
        <div className="ins-kpis">
          <Kpi
            i={0}
            tone="grape"
            icon={<ShellIconSvg name="book" />}
            label={t('admin.catalog.kBooks')}
            value={<CountUp value={books.length} />}
            hint={t('admin.catalog.kBooksHint', { n: books.filter((b) => b.custom).length })}
          />
          <Kpi
            i={1}
            tone="sky"
            icon={<ShellIconSvg name="grid" />}
            label={t('admin.catalog.kTopics')}
            value={<CountUp value={topics} />}
            hint={t('admin.catalog.kTopicsHint')}
          />
          <Kpi
            i={2}
            tone="sun"
            icon={<ShellIconSvg name="tag" />}
            label={t('admin.catalog.kLevels')}
            value={<CountUp value={levels.length} />}
            hint={t('admin.catalog.kLevelsHint', {
              free: freeLevels,
              premium: levels.length - freeLevels,
            })}
          />
          <Kpi
            i={3}
            tone="leaf"
            icon={<ShellIconSvg name="play" />}
            label={t('admin.catalog.kReady')}
            value={<CountUp value={levels.length - noQuestions} />}
            hint={t('admin.catalog.kReadyHint', { n: noQuestions })}
          />
        </div>
      )}

      <AccessCard onSaved={catalogs.reload} />

      <Loadable loading={catalogs.loading} error={catalogs.error} hasData={!!books}>
        {() =>
          books!.length === 0 ? (
            <Empty>{t('admin.catalog.empty')}</Empty>
          ) : (
            <>
              <Legend />
              <ul className="syl-books">
                {books!.map((b) => (
                  <BookCard
                    key={b.slug}
                    book={b}
                    open={open.has(b.slug)}
                    paywall={paywall}
                    onToggle={() => toggle(b.slug)}
                    onAddTopic={() => setAddingTopicTo(b)}
                    onBooks={(next) => changed(next)}
                    onNotice={setNotice}
                    onWrite={setWriting}
                  />
                ))}
              </ul>
            </>
          )
        }
      </Loadable>

      {addingBook && books && (
        <AddBookDialog
          books={books}
          onClose={() => setAddingBook(false)}
          onDone={(next, title) => {
            setAddingBook(false);
            // Buku baru langsung terbuka supaya topik pertamanya terlihat.
            const fresh = next.find((b) => !books.some((x) => x.slug === b.slug));
            if (fresh) setOpened(new Set([...open, fresh.slug]));
            changed(next, t('admin.catalog.addBook.done', { title }));
          }}
        />
      )}
      {addingTopicTo && (
        <AddTopicDialog
          book={addingTopicTo}
          onClose={() => setAddingTopicTo(undefined)}
          onDone={(next, title) => {
            const book = addingTopicTo;
            setAddingTopicTo(undefined);
            setOpened(new Set([...open, book.slug]));
            changed(next, t('admin.catalog.addTopic.done', { title, book: book.title }));
          }}
        />
      )}
      {writing && (
        <QuestionBankDialog
          level={writing}
          onClose={() => setWriting(undefined)}
          onChanged={(next, count) => {
            const level = writing;
            setWriting(undefined);
            changed(
              next,
              count > 0
                ? t('admin.bank.saved', { n: level.number, count })
                : t('admin.bank.cleared', { n: level.number }),
            );
          }}
        />
      )}
    </>
  );
}
