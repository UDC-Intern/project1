import { useState } from 'react';
import { MAX_LEVELS_PER_TOPIC, MAX_TIPS } from '@udakids/engine';
import type { CatalogBook, CatalogLevel, CatalogTopic } from '../../api/adminTypes';
import { useApiCall } from '../../auth/useApi';
import { t } from '../../i18n';
import { Segmented } from '../../ui/controls';
import { Badge, Button, Notice, TextArea, TextField } from '../../ui/ui';
import { ActionNotice, ConfirmDialog, Icon, useAction } from '../common';

type LevelDraft = { title?: string; free?: boolean };

/** Asal soal satu level: otomatis (generator), bank soal, atau belum ada. */
function SourceBadge({ level }: { level: CatalogLevel }) {
  if (level.source === 'auto') return <Badge tone="muted">{t('admin.catalog.level.auto')}</Badge>;
  if (level.source === 'bank')
    return <Badge tone="success">{t('admin.catalog.level.bank', { n: level.questions })}</Badge>;
  return <Badge tone="warning">{t('admin.catalog.level.none')}</Badge>;
}

/** Tombol soal satu level: menyesuaikan soal otomatis, mengubah bank soal, atau menulis soal pertama. */
const questionAction = (level: CatalogLevel) =>
  level.source === 'auto'
    ? ({ label: 'admin.catalog.level.adjust', aria: 'admin.catalog.level.adjustLabel' } as const)
    : level.source === 'bank'
      ? ({ label: 'admin.catalog.level.edit', aria: 'admin.catalog.level.editLabel' } as const)
      : ({ label: 'admin.catalog.level.write', aria: 'admin.catalog.level.writeLabel' } as const);

/**
 * Panel sunting satu topik: judul, materi, "Tahukah kamu?", dan level (judul, gratis atau Premium, soal). Topik
 * buatan admin juga bisa ditambah levelnya dan dihapus selama belum dikerjakan anak.
 */
export function TopicPanel({
  topic,
  paywall,
  topicCount,
  onBooks,
  onNotice,
  onWrite,
}: {
  topic: CatalogTopic;
  /** Kunci berbayar aktif; bila mati semua level gratis dan pilihan akses dikunci. */
  paywall: boolean;
  /** Jumlah topik di buku ini (topik terakhir tidak bisa dihapus). */
  topicCount: number;
  onBooks: (books: CatalogBook[]) => void;
  onNotice: (message: string) => void;
  /** Buka editor bank soal untuk sebuah level. */
  onWrite: (level: CatalogLevel) => void;
}) {
  const call = useApiCall('staff');
  const save = useAction();
  const edit = useAction();
  const [title, setTitle] = useState(topic.title);
  const [lesson, setLesson] = useState(topic.lesson);
  const [tips, setTips] = useState(topic.tips.join('\n'));
  const [drafts, setDrafts] = useState<Record<string, LevelDraft>>({});
  const [newLevel, setNewLevel] = useState('');
  const [removeLevel, setRemoveLevel] = useState<CatalogLevel>();
  const [removeTopic, setRemoveTopic] = useState(false);

  const cleanTips = tips
    .split('\n')
    .map((x) => x.trim())
    .filter(Boolean)
    .slice(0, MAX_TIPS);
  const levelOf = (l: CatalogLevel) => ({
    title: drafts[l.id]?.title ?? l.title,
    free: drafts[l.id]?.free ?? l.free,
  });
  const changedLevels = topic.levels.filter((l) => {
    const d = levelOf(l);
    return d.title !== l.title || d.free !== l.free;
  });
  const dirty =
    title !== topic.title ||
    lesson !== topic.lesson ||
    cleanTips.join('\n') !== topic.tips.join('\n') ||
    changedLevels.length > 0;
  const lastNumber = Math.max(...topic.levels.map((l) => l.number));
  const enc = encodeURIComponent;
  const setDraft = (id: string, patch: LevelDraft) =>
    setDrafts((d) => ({ ...d, [id]: { ...d[id], ...patch } }));

  async function saveTopic() {
    const out = await save.run(
      async () => {
        let books = await call<CatalogBook[]>(`/admin/topics/${enc(topic.id)}`, {
          method: 'PATCH',
          body: { title, lesson, tips: cleanTips },
        });
        for (const l of changedLevels) {
          const d = levelOf(l);
          books = await call<CatalogBook[]>(`/admin/levels/${enc(l.id)}`, {
            method: 'PATCH',
            body: { title: d.title, free: d.free },
          });
        }
        return books;
      },
      t('admin.catalog.topic.saved', { topic: title }),
    );
    if (!out) return;
    setDrafts({});
    onBooks(out);
  }

  async function addLevel() {
    const out = await edit.run(() =>
      call<CatalogBook[]>(`/admin/topics/${enc(topic.id)}/levels`, {
        method: 'POST',
        body: { title: newLevel },
      }),
    );
    if (!out) return;
    setNewLevel('');
    onBooks(out);
    onNotice(t('admin.catalog.level.added', { n: lastNumber + 1 }));
  }

  async function deleteLevel(level: CatalogLevel) {
    const out = await edit.run(() =>
      call<CatalogBook[]>(`/admin/levels/${enc(level.id)}`, { method: 'DELETE' }),
    );
    setRemoveLevel(undefined);
    if (!out) return;
    onBooks(out);
    onNotice(t('admin.catalog.level.deleted', { n: level.number }));
  }

  async function deleteTopic() {
    const out = await edit.run(() =>
      call<CatalogBook[]>(`/admin/topics/${enc(topic.id)}`, { method: 'DELETE' }),
    );
    setRemoveTopic(false);
    if (!out) return;
    onBooks(out);
    onNotice(t('admin.catalog.topic.deleted', { title: topic.title }));
  }

  const canDeleteTopic = topic.custom && !topic.used && topicCount > 1;

  return (
    <div className="syl-panel">
      {!paywall && <Notice tone="info">{t('admin.catalog.topic.paywallOff')}</Notice>}
      <div className="syl-panel-grid">
        <div>
          <TextField
            label={t('admin.catalog.topic.title')}
            maxLength={60}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <TextArea
            label={t('admin.catalog.topic.lesson')}
            hint={t('admin.catalog.topic.lessonHint')}
            rows={4}
            maxLength={600}
            value={lesson}
            onChange={(e) => setLesson(e.target.value)}
          />
          <TextArea
            label={t('admin.catalog.topic.tips')}
            hint={t('admin.catalog.topic.tipsHint')}
            rows={3}
            value={tips}
            onChange={(e) => setTips(e.target.value)}
          />
        </div>
        <div>
          <h3 className="syl-section-title">{t('admin.catalog.topic.levels')}</h3>
          <ul className="syl-levels">
            {topic.levels.map((l) => {
              const d = levelOf(l);
              const action = questionAction(l);
              const removable =
                l.custom && !l.used && topic.levels.length > 1 && l.number === lastNumber;
              return (
                <li key={l.id} className="syl-level">
                  <span className="adm-level-num">{l.number}</span>
                  <div className="syl-level-title">
                    <TextField
                      label={t('admin.catalog.level.title', { n: l.number })}
                      maxLength={60}
                      value={d.title}
                      onChange={(e) => setDraft(l.id, { title: e.target.value })}
                    />
                  </div>
                  <div className="syl-level-access">
                    <Segmented
                      label={t('admin.catalog.level.access', { n: l.number })}
                      value={d.free ? 'free' : 'premium'}
                      disabled={!paywall}
                      onChange={(v) => setDraft(l.id, { free: v === 'free' })}
                      options={[
                        { value: 'free', label: t('admin.catalog.legendFree'), tone: 'success' },
                        {
                          value: 'premium',
                          label: t('admin.catalog.legendPremium'),
                          tone: 'warning',
                          disabled: l.number === 1,
                        },
                      ]}
                    />
                  </div>
                  <div className="syl-level-meta">
                    <SourceBadge level={l} />
                    {l.edited && <Badge tone="info">{t('admin.catalog.level.adjusted')}</Badge>}
                    {l.override && <Badge tone="info">{t('admin.catalog.level.override')}</Badge>}
                    <span className="syl-spacer" />
                    <Button
                      variant="secondary"
                      size="sm"
                      aria-label={t(action.aria, { n: l.number })}
                      onClick={() => onWrite(l)}
                    >
                      <Icon name="edit" />
                      {t(action.label)}
                    </Button>
                    {removable && (
                      <Button
                        variant="danger"
                        size="sm"
                        disabled={edit.busy}
                        aria-label={t('admin.catalog.level.delete', { n: l.number })}
                        title={t('admin.catalog.level.delete', { n: l.number })}
                        onClick={() => setRemoveLevel(l)}
                      >
                        <Icon name="trash" />
                      </Button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
          {topic.levels.length < MAX_LEVELS_PER_TOPIC ? (
            <form
              className="syl-add-level"
              onSubmit={(e) => {
                e.preventDefault();
                if (newLevel.trim()) void addLevel();
              }}
            >
              <TextField
                label={t('admin.catalog.level.new')}
                maxLength={60}
                value={newLevel}
                onChange={(e) => setNewLevel(e.target.value)}
              />
              <Button type="submit" variant="secondary" disabled={edit.busy || !newLevel.trim()}>
                <Icon name="plus" />
                {t('admin.catalog.level.add')}
              </Button>
            </form>
          ) : (
            <p className="ui-muted" style={{ marginTop: 10 }}>
              {t('admin.catalog.level.limit', { n: MAX_LEVELS_PER_TOPIC })}
            </p>
          )}
        </div>
      </div>
      <ActionNotice error={save.error ?? edit.error} done={save.done} />
      <div className="syl-panel-foot">
        <Button onClick={() => void saveTopic()} disabled={!dirty || save.busy}>
          <Icon name="check" />
          {t('admin.catalog.topic.save')}
        </Button>
        <span className="syl-spacer" />
        {topic.custom && (
          <Button
            variant="danger"
            disabled={!canDeleteTopic || edit.busy}
            title={
              topic.used
                ? t('admin.catalog.topic.usedHint')
                : topicCount <= 1
                  ? t('admin.catalog.topic.lastTopic')
                  : undefined
            }
            aria-label={t('admin.catalog.topic.deleteLabel', { title: topic.title })}
            onClick={() => setRemoveTopic(true)}
          >
            <Icon name="trash" />
            {t('admin.catalog.topic.delete')}
          </Button>
        )}
      </div>
      <ConfirmDialog
        open={!!removeLevel}
        title={t('admin.catalog.level.deleteTitle', { n: removeLevel?.number ?? 0 })}
        message={t('admin.catalog.level.deleteText')}
        confirmLabel={t('admin.catalog.level.delete', { n: removeLevel?.number ?? 0 })}
        busy={edit.busy}
        onConfirm={() => removeLevel && void deleteLevel(removeLevel)}
        onCancel={() => setRemoveLevel(undefined)}
      />
      <ConfirmDialog
        open={removeTopic}
        title={t('admin.catalog.topic.deleteTitle', { title: topic.title })}
        message={t('admin.catalog.topic.deleteText')}
        confirmLabel={t('admin.catalog.topic.delete')}
        busy={edit.busy}
        onConfirm={() => void deleteTopic()}
        onCancel={() => setRemoveTopic(false)}
      />
    </div>
  );
}
