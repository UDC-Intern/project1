import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { CatalogBook } from '../../api/adminTypes';
import { useSettings } from '../../api/settings';
import { useApiCall, useFetch } from '../../auth/useApi';
import { t } from '../../i18n';
import { Badge, Button, Empty, PageHeader, TextArea, TextField } from '../../ui/ui';
import { ActionNotice, Icon, Loadable, useAction } from '../common';

type Topic = CatalogBook['topics'][number];

/** Satu topik: judul, materi singkat, hal penting ("Tahukah kamu?"), dan judul level beserta status gratis. */
function TopicEditor({
  topic,
  onSaved,
}: {
  topic: Topic;
  onSaved: (books: CatalogBook[]) => void;
}) {
  const call = useApiCall('staff');
  const action = useAction();
  const [title, setTitle] = useState(topic.title);
  const [lesson, setLesson] = useState(topic.lesson);
  const [tips, setTips] = useState(topic.tips.join('\n'));
  const [levels, setLevels] = useState(topic.levels);
  const cleanTips = tips
    .split('\n')
    .map((x) => x.trim())
    .filter(Boolean)
    .slice(0, 6);

  async function save() {
    const out = await action.run(
      async () => {
        let books = await call<CatalogBook[]>(`/admin/topics/${encodeURIComponent(topic.id)}`, {
          method: 'PATCH',
          body: { title, lesson, tips: cleanTips },
        });
        for (const level of levels) {
          const before = topic.levels.find((l) => l.id === level.id)!;
          if (before.title !== level.title || before.free !== level.free)
            books = await call<CatalogBook[]>(`/admin/levels/${encodeURIComponent(level.id)}`, {
              method: 'PATCH',
              body: { title: level.title, free: level.free },
            });
        }
        return books;
      },
      t('admin.catalog.saved', { topic: title }),
    );
    if (!out) return;
    // Tanda "Pengecualian" mengikuti hasil simpan (level yang kembali sama dengan aturan tidak lagi dikecualikan).
    const fresh = out.flatMap((b) => b.topics).find((x) => x.id === topic.id);
    if (fresh) setLevels(fresh.levels);
    onSaved(out);
  }

  return (
    <div className="adm-cat-row">
      <div className="adm-inline-form" style={{ marginBottom: 8 }}>
        <div style={{ width: 70 }}>
          <TextField label={t('admin.catalog.code')} value={topic.code} readOnly />
        </div>
        <div style={{ flex: 1, minWidth: 220 }}>
          <TextField
            label={t('admin.catalog.catTitle')}
            maxLength={60}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>
      </div>
      <details className="adm-cat-intro">
        <summary>{t('admin.catalog.introEdit')}</summary>
        <TextArea
          label={t('admin.catalog.intro')}
          hint={t('admin.catalog.introHint')}
          rows={3}
          maxLength={600}
          value={lesson}
          onChange={(e) => setLesson(e.target.value)}
        />
        <TextArea
          label={t('admin.catalog.tips')}
          hint={t('admin.catalog.tipsHint')}
          rows={3}
          value={tips}
          onChange={(e) => setTips(e.target.value)}
        />
        <ul className="adm-level-list">
          {levels.map((l, i) => (
            <li key={l.id}>
              <span className="adm-level-num">{l.number}</span>
              <TextField
                label={t('admin.catalog.levelTitle', { n: l.number })}
                maxLength={60}
                value={l.title}
                onChange={(e) =>
                  setLevels((xs) =>
                    xs.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)),
                  )
                }
              />
              <label className="ui-check">
                <input
                  type="checkbox"
                  checked={l.free}
                  disabled={l.number === 1}
                  aria-label={t('admin.catalog.freeLabel', { n: l.number })}
                  onChange={(e) =>
                    setLevels((xs) =>
                      xs.map((x, j) => (j === i ? { ...x, free: e.target.checked } : x)),
                    )
                  }
                />
                <span>{l.free ? t('admin.catalog.free') : t('admin.catalog.premium')}</span>
              </label>
              {l.override && <Badge tone="info">{t('admin.catalog.override')}</Badge>}
              {!l.generator && <Badge tone="muted">{t('admin.catalog.noGenerator')}</Badge>}
            </li>
          ))}
        </ul>
      </details>
      <ActionNotice error={action.error} done={action.done} />
      <Button variant="secondary" onClick={() => void save()} disabled={action.busy}>
        <Icon name="check" />
        {t('admin.catalog.save')}
      </Button>
    </div>
  );
}

/** Konten: buku, topik, materi singkat, hal penting, dan level. Struktur buku tetap dari berkas konten. */
export function CatalogPage() {
  const catalogs = useFetch<CatalogBook[]>('staff', '/admin/catalogs');
  const billing = useSettings().billing;
  return (
    <>
      <PageHeader
        title={t('admin.catalog.title')}
        subtitle={t('admin.catalog.subtitle')}
        actions={
          <Link className="ui-btn ui-btn-ghost" to="/admin/pengaturan">
            {billing.paywall
              ? t('admin.catalog.freeRule', { n: billing.freeLevels })
              : t('admin.catalog.allFree')}
          </Link>
        }
      />
      <Loadable loading={catalogs.loading} error={catalogs.error} hasData={!!catalogs.data}>
        {() =>
          catalogs.data!.length === 0 ? (
            <Empty>{t('admin.catalog.empty')}</Empty>
          ) : (
            catalogs.data!.map((b, i) => (
              <details key={b.slug} className="ui-card adm-book" open={i === 0}>
                <summary>
                  <h2>{b.title}</h2>
                  <span className="ui-muted">
                    {t('admin.catalog.topics', { n: b.topics.length })}
                  </span>
                </summary>
                {b.topics.map((topic) => (
                  <TopicEditor
                    key={topic.id}
                    topic={topic}
                    onSaved={(books) => catalogs.setData(books)}
                  />
                ))}
              </details>
            ))
          )
        }
      </Loadable>
    </>
  );
}
