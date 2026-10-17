import {
  ILLUSTRATION_KINDS,
  ILLUSTRATION_STATUSES,
  ILLUSTRATION_THEMES,
  MOMO_COLORS,
  illustrationRequestSchema,
  type Illustration as IllustrationRow,
  type IllustrationRequest,
  type IllustrationStatus,
} from '@udakids/engine';
import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useApiCall, useFetch } from '../../auth/useApi';
import { Illustration, illustrationItem, recognizesSubject } from '../../components/Illustration';
import { OBJECT_LABELS } from '../../components/CountObjects';
import { t, type MessageKey } from '../../i18n';
import { ShellIconSvg } from '../../ui/AppShell';
import { CountUp, Kpi } from '../../ui/charts';
import { ListPager, usePaged } from '../../ui/Pager';
import {
  Badge,
  Button,
  Card,
  Checkbox,
  Empty,
  Notice,
  PageHeader,
  SelectField,
  TextField,
} from '../../ui/ui';
import { ActionNotice, Loadable, confirmAction, useAction } from '../common';

const START: IllustrationRequest = {
  kind: 'scene',
  subject: 'apel merah di kebun',
  theme: 'outdoor',
  count: 5,
  withMomo: true,
  momoColor: 'blue',
  variant: 1,
};

/** Kartu per halaman: kelipatan 4 dan 3 supaya kisi penuh di layar lebar maupun sedang. */
const PAGE_SIZES = [12, 24, 48];

const STATUS_TONE: Record<IllustrationStatus, 'warning' | 'success' | 'muted'> = {
  review: 'warning',
  approved: 'success',
  rejected: 'muted',
};

/**
 * Ilustrasi AI: admin menulis permintaan gambar (benda, adegan, atau karakter), melihat pratinjau, lalu hasilnya masuk
 * antrean tinjau. Hanya yang disetujui tampil di Galeri Aset.
 */
export function IllustrationsPage() {
  const call = useApiCall('staff');
  const action = useAction();
  const review = useAction();
  const [form, setForm] = useState<IllustrationRequest>(START);
  const [filter, setFilter] = useState<IllustrationStatus | 'all'>('review');
  const all = useFetch<IllustrationRow[]>('staff', '/admin/illustrations?status=all');
  const parsed = illustrationRequestSchema.safeParse(form);
  const set = <K extends keyof IllustrationRequest>(k: K, v: IllustrationRequest[K]) =>
    setForm((f) => ({ ...f, [k]: v }));
  const rows = all.data ?? [];
  const shown = rows.filter((r) => filter === 'all' || r.status === filter);
  const paged = usePaged(shown, PAGE_SIZES[0]);
  const countOf = (s: IllustrationStatus) => rows.filter((r) => r.status === s).length;
  const show = (s: IllustrationStatus | 'all') => {
    setFilter(s);
    paged.setPage(1);
  };

  async function submit(e: FormEvent) {
    e.preventDefault();
    const out = await action.run(
      () => call<IllustrationRow>('/admin/illustrations', { method: 'POST', body: form }),
      t('admin.ill.made', { subject: form.subject.trim() }),
    );
    if (out) {
      show('review');
      set('variant', Math.min(12, form.variant + 1));
      all.reload();
    }
  }
  async function setStatus(row: IllustrationRow, status: IllustrationStatus) {
    const ok = await review.run(
      () =>
        call(`/admin/illustrations/${row.id}`, { method: 'PATCH', body: { status } }).then(
          () => true,
        ),
      t(`admin.ill.statusDone.${status}` as MessageKey, { subject: row.subject }),
    );
    if (ok) all.reload();
  }
  async function remove(row: IllustrationRow) {
    if (!confirmAction(t('admin.ill.deleteConfirm', { subject: row.subject }))) return;
    const ok = await review.run(
      () => call(`/admin/illustrations/${row.id}`, { method: 'DELETE' }).then(() => true),
      t('admin.ill.deleted', { subject: row.subject }),
    );
    if (ok) all.reload();
  }

  return (
    <>
      <PageHeader
        title={t('admin.ill.title')}
        subtitle={t('admin.ill.subtitle')}
        actions={
          <Link className="ui-btn ui-btn-secondary" to="/admin/galeri">
            <ShellIconSvg name="image" size={18} />
            {t('admin.ill.toGallery')}
          </Link>
        }
      />
      <Notice tone="info">{t('admin.ill.mockNote')}</Notice>

      <div className="ins-kpis">
        <Kpi
          i={0}
          tone="sun"
          icon={<ShellIconSvg name="flag" />}
          label={t('admin.ill.kReview')}
          value={<CountUp value={countOf('review')} />}
          hint={t('admin.ill.kReviewHint')}
        />
        <Kpi
          i={1}
          tone="leaf"
          icon={<ShellIconSvg name="image" />}
          label={t('admin.ill.kApproved')}
          value={<CountUp value={countOf('approved')} />}
          hint={t('admin.ill.kApprovedHint')}
        />
        <Kpi
          i={2}
          tone="coral"
          icon={<ShellIconSvg name="close" />}
          label={t('admin.ill.kRejected')}
          value={<CountUp value={countOf('rejected')} />}
          hint={t('admin.ill.kRejectedHint')}
        />
        <Kpi
          i={3}
          tone="grape"
          icon={<ShellIconSvg name="chart" />}
          label={t('admin.ill.kTotal')}
          value={<CountUp value={rows.length} />}
          hint={t('admin.ill.kTotalHint')}
        />
      </div>

      <Card title={t('admin.ill.formTitle')}>
        <ActionNotice error={action.error} done={action.done} />
        <div className="ill-layout">
          <form onSubmit={submit}>
            <div className="adm-fields">
              <SelectField
                label={t('admin.ill.kind')}
                value={form.kind}
                onChange={(e) => set('kind', e.target.value as IllustrationRequest['kind'])}
                options={ILLUSTRATION_KINDS.map((k) => ({
                  value: k,
                  label: t(`admin.ill.kind.${k}` as MessageKey),
                }))}
              />
              <SelectField
                label={t('admin.ill.theme')}
                value={form.theme}
                onChange={(e) => set('theme', e.target.value as IllustrationRequest['theme'])}
                options={ILLUSTRATION_THEMES.map((k) => ({
                  value: k,
                  label: t(`admin.ill.theme.${k}` as MessageKey),
                }))}
              />
            </div>
            <TextField
              label={t('admin.ill.subject')}
              hint={t('admin.ill.subjectHint')}
              required
              maxLength={60}
              value={form.subject}
              onChange={(e) => set('subject', e.target.value)}
            />
            {form.subject.trim().length >= 2 && !recognizesSubject(form.subject) && (
              <p className="ui-hint">
                {t('admin.ill.unknownSubject', {
                  item: OBJECT_LABELS[illustrationItem(form.subject)],
                })}
              </p>
            )}
            <div className="adm-fields">
              <TextField
                label={t('admin.ill.count')}
                type="number"
                min={1}
                max={12}
                value={String(form.count)}
                onChange={(e) =>
                  set('count', Math.max(1, Math.min(12, Number(e.target.value) || 1)))
                }
              />
              <TextField
                label={t('admin.ill.variant')}
                hint={t('admin.ill.variantHint')}
                type="number"
                min={1}
                max={12}
                value={String(form.variant)}
                onChange={(e) =>
                  set('variant', Math.max(1, Math.min(12, Number(e.target.value) || 1)))
                }
              />
              <SelectField
                label={t('admin.ill.momoColor')}
                value={form.momoColor}
                disabled={!form.withMomo && form.kind !== 'character'}
                onChange={(e) =>
                  set('momoColor', e.target.value as IllustrationRequest['momoColor'])
                }
                options={MOMO_COLORS.map((c) => ({
                  value: c,
                  label: t(`admin.ill.color.${c}` as MessageKey),
                }))}
              />
            </div>
            {form.kind !== 'character' && (
              <Checkbox
                label={t('admin.ill.withMomo')}
                checked={form.withMomo}
                onChange={(e) => set('withMomo', e.target.checked)}
              />
            )}
            <Button type="submit" disabled={action.busy || !parsed.success}>
              <ShellIconSvg name="plus" size={18} />
              {action.busy ? t('admin.ill.making') : t('admin.ill.make')}
            </Button>
          </form>
          <figure className="ill-preview">
            <figcaption className="ui-muted">{t('admin.ill.preview')}</figcaption>
            {parsed.success ? (
              <Illustration request={parsed.data} size={360} />
            ) : (
              <p className="ui-muted">{t('admin.ill.previewInvalid')}</p>
            )}
          </figure>
        </div>
      </Card>

      <Card title={t('admin.ill.listTitle')}>
        <div className="dir-tabs" role="tablist" aria-label={t('admin.ill.filter')}>
          {(['review', 'approved', 'rejected', 'all'] as const).map((s) => (
            <button
              key={s}
              type="button"
              role="tab"
              aria-selected={filter === s}
              className={`ins-chip${filter === s ? ' is-on' : ''}`}
              onClick={() => show(s)}
            >
              {t(`admin.ill.status.${s}` as MessageKey)}
              <span className="dir-count">{s === 'all' ? rows.length : countOf(s)}</span>
            </button>
          ))}
        </div>
        <ActionNotice error={review.error} done={review.done} />
        <Loadable loading={all.loading} error={all.error} hasData={!!all.data}>
          {() =>
            shown.length === 0 ? (
              <Empty>{t('admin.ill.empty')}</Empty>
            ) : (
              <ul className="ill-grid">
                {paged.items.map((row) => (
                  <li key={row.id} className="ill-card">
                    <Illustration request={row} size={260} />
                    <div className="ill-card-body">
                      <strong>{row.subject}</strong>
                      <small className="ui-muted">
                        {t('admin.ill.meta', {
                          kind: t(`admin.ill.kind.${row.kind}` as MessageKey),
                          theme: t(`admin.ill.theme.${row.theme}` as MessageKey),
                          variant: row.variant,
                        })}
                      </small>
                      <small className="ui-muted">
                        {t('admin.ill.by', { name: row.createdBy, engine: row.engine })}
                      </small>
                      <Badge tone={STATUS_TONE[row.status]}>
                        {t(`admin.ill.status.${row.status}` as MessageKey)}
                      </Badge>
                    </div>
                    <div className="dir-actions">
                      {ILLUSTRATION_STATUSES.filter((s) => s !== 'review' && s !== row.status).map(
                        (s) => (
                          <Button
                            key={s}
                            variant={s === 'approved' ? 'primary' : 'secondary'}
                            disabled={review.busy}
                            onClick={() => void setStatus(row, s)}
                          >
                            {t(`admin.ill.action.${s}` as MessageKey)}
                          </Button>
                        ),
                      )}
                      <Button
                        variant="ghost"
                        disabled={review.busy}
                        onClick={() => void remove(row)}
                      >
                        {t('admin.ill.delete')}
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )
          }
        </Loadable>
        <ListPager paged={paged} sizes={PAGE_SIZES} />
      </Card>
    </>
  );
}
