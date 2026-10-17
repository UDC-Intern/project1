import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import type { PinPicture } from '@udakids/engine';
import type {
  ChildRow,
  DirectorySummary,
  FamilyChild,
  FamilyRow,
  Grant,
  Page,
} from '../../api/adminTypes';
import { useApiCall, useFetch } from '../../auth/useApi';
import { t, type MessageKey } from '../../i18n';
import { formatDate as formatDay } from '../../lib/format';
import { ShellIconSvg } from '../../ui/AppShell';
import { Kpi } from '../../ui/charts';
import { Pager } from '../../ui/Pager';
import { PlanBadge } from '../../ui/PlanBadge';
import { Button, Empty, formatDate, Notice, PageHeader, SelectField, TextArea } from '../../ui/ui';
import {
  ActionNotice,
  ActiveBadge,
  childReportPath,
  ColorDot,
  lastSeen,
  Loadable,
  useAction,
  useDebounced,
} from '../common';
import { PasswordSetter } from './PasswordSetter';
import { PinPicker } from './PinPicker';

type Tab = 'families' | 'children';
type Target = { id: string; name: string; plan: FamilyRow['plan']; grants: Grant[] };

const DURATIONS = [
  { value: '30', label: 'admin.dir.days30' },
  { value: '90', label: 'admin.dir.days90' },
  { value: '180', label: 'admin.dir.days180' },
  { value: '365', label: 'admin.dir.days365' },
  { value: '', label: 'admin.dir.forever' },
] as const satisfies readonly { value: string; label: MessageKey }[];

/** Dialog beri atau cabut Premium per anak. Tidak membuat transaksi. */
function PremiumDialog({
  target,
  onClose,
  onChanged,
}: {
  target: Target;
  onClose: () => void;
  onChanged: (message: string) => void;
}) {
  const call = useApiCall('staff');
  const action = useAction();
  const [duration, setDuration] = useState('30');
  const [note, setNote] = useState('');
  const box = useRef<HTMLDivElement>(null);
  const liveAdmin = target.grants.filter((g) => g.source === 'admin' && g.live);
  const forever = liveAdmin.some((g) => g.endsAt === null);

  useEffect(() => {
    box.current?.querySelector<HTMLElement>('select, button')?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function grant(e: FormEvent) {
    e.preventDefault();
    const body = {
      childId: target.id,
      durationDays: duration ? Number(duration) : null,
      note: note.trim(),
    };
    const ok = await action.run(() =>
      call('/admin/premium', { method: 'POST', body }).then(() => true),
    );
    if (ok) onChanged(t('admin.dir.granted', { name: target.name }));
  }
  async function revoke(g: Grant) {
    const ok = await action.run(() =>
      call(`/admin/premium/${g.id}`, { method: 'DELETE' }).then(() => true),
    );
    if (ok) onChanged(t('admin.dir.revoked', { name: target.name }));
  }

  return (
    <div className="dir-overlay" onClick={onClose}>
      <div
        ref={box}
        className="dir-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="dir-dialog-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="dir-dialog-head">
          <h2 id="dir-dialog-title">{t('admin.dir.premiumChild', { name: target.name })}</h2>
          <button
            type="button"
            className="shell-iconbtn"
            aria-label={t('admin.cancel')}
            onClick={onClose}
          >
            <ShellIconSvg name="close" />
          </button>
        </div>
        <p className="ui-muted">{t('admin.dir.premiumChildHint', { name: target.name })}</p>
        <div className="dir-now">
          <span>{t('admin.dir.current')}</span>
          <PlanBadge plan={target.plan} detail />
        </div>
        <Notice tone="info">{t('admin.dir.noCash')}</Notice>
        <ActionNotice error={action.error} />

        {liveAdmin.length > 0 && (
          <ul className="dir-grants">
            {liveAdmin.map((g) => (
              <li key={g.id}>
                <div>
                  <strong>
                    {g.endsAt
                      ? t('admin.dir.grantUntil', { date: formatDate(g.endsAt) })
                      : t('admin.dir.forever')}
                  </strong>
                  <small>
                    {t('admin.dir.grantBy', {
                      name: g.grantedByName ?? '—',
                      date: formatDate(g.createdAt),
                    })}
                    {g.note ? ` · ${g.note}` : ''}
                  </small>
                </div>
                <Button variant="danger" disabled={action.busy} onClick={() => void revoke(g)}>
                  {t('admin.dir.revoke')}
                </Button>
              </li>
            ))}
          </ul>
        )}

        {forever ? (
          <p className="ui-muted">{t('admin.dir.alreadyForever')}</p>
        ) : (
          <form onSubmit={grant} className="dir-form">
            <SelectField
              label={liveAdmin.length ? t('admin.dir.extend') : t('admin.dir.duration')}
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              options={DURATIONS.map((d) => ({ value: d.value, label: t(d.label) }))}
            />
            <TextArea
              label={t('admin.dir.note')}
              hint={t('admin.dir.noteHint')}
              maxLength={200}
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
            <div className="ui-row">
              <Button type="submit" disabled={action.busy}>
                <ShellIconSvg name="plus" size={18} />
                {t('admin.dir.grant')}
              </Button>
              <Button variant="ghost" onClick={onClose}>
                {t('admin.cancel')}
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

function Initials({ name }: { name: string }) {
  const parts = name.trim().split(/\s+/);
  const ini = (
    (parts[0]?.[0] ?? '') + (parts.length > 1 ? (parts.at(-1)?.[0] ?? '') : '')
  ).toUpperCase();
  return (
    <span className="dir-avatar" aria-hidden>
      {ini || '?'}
    </span>
  );
}

/**
 * Orang tua & anak: ringkasan, tab Keluarga / Anak, cari, saring, urutkan, paging, status Free / Premium,
 * pemberian Premium oleh admin, atur ulang sandi gambar, dan nonaktifkan akun.
 */
export function FamiliesPage() {
  const [params, setParams] = useSearchParams();
  const tab: Tab = params.get('tab') === 'anak' ? 'children' : 'families';
  const get = (k: string, d: string) => params.get(k) ?? d;
  const status = get('status', 'all');
  const active = get('active', 'all');
  const sort = get('sort', 'newest');
  const page = Math.max(1, Number(get('page', '1')) || 1);
  const pageSize = [10, 20, 50].includes(Number(get('size', '20')))
    ? Number(get('size', '20'))
    : 20;
  const [search, setSearch] = useState(get('q', ''));
  const q = useDebounced(search, 350);

  const set = (patch: Record<string, string | number | null>, resetPage = true) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(patch)) {
      if (
        v === null ||
        v === '' ||
        v === 'all' ||
        (k === 'page' && v === 1) ||
        (k === 'size' && v === 20)
      )
        next.delete(k);
      else next.set(k, String(v));
    }
    if (resetPage && !('page' in patch)) next.delete('page');
    setParams(next, { replace: true });
  };
  useEffect(() => {
    if (q !== get('q', '')) set({ q });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const qs = new URLSearchParams({
    search: q,
    status,
    active,
    sort,
    page: String(page),
    pageSize: String(pageSize),
  }).toString();
  const summary = useFetch<DirectorySummary>('staff', '/admin/directory/summary');
  const families = useFetch<Page<FamilyRow>>(
    'staff',
    tab === 'families' ? `/admin/directory/families?${qs}` : null,
  );
  const kids = useFetch<Page<ChildRow>>(
    'staff',
    tab === 'children' ? `/admin/directory/children?${qs}` : null,
  );
  const call = useApiCall('staff');
  const action = useAction();
  const [pinFor, setPinFor] = useState<string>();
  const [premiumFor, setPremiumFor] = useState<Target>();

  const reload = () => {
    summary.reload();
    families.reload();
    kids.reload();
  };

  async function toggleParent(p: FamilyRow) {
    const ok = await action.run(
      () =>
        call(`/admin/parents/${p.id}`, { method: 'PATCH', body: { active: !p.active } }).then(
          () => true,
        ),
      p.active
        ? t('admin.family.parentOff', { name: p.name })
        : t('admin.family.parentOn', { name: p.name }),
    );
    if (ok) reload();
  }
  async function setPassword(p: FamilyRow, password: string) {
    const ok = await action.run(
      () =>
        call(`/admin/parents/${p.id}/password`, { method: 'POST', body: { password } }).then(
          () => true,
        ),
      t('admin.user.passwordSet', { name: p.name }),
    );
    return ok === true;
  }
  async function toggleChild(c: FamilyChild) {
    const ok = await action.run(
      () =>
        call(`/admin/children/${c.id}`, { method: 'PATCH', body: { active: !c.active } }).then(
          () => true,
        ),
      c.active
        ? t('admin.family.childOff', { name: c.nickname })
        : t('admin.family.childOn', { name: c.nickname }),
    );
    if (ok) reload();
  }
  async function setPin(c: FamilyChild, pin: PinPicture[]) {
    const ok = await action.run(
      () => call(`/admin/children/${c.id}/pin`, { method: 'POST', body: { pin } }).then(() => true),
      t('admin.pin.saved', { name: c.nickname }),
    );
    if (ok) setPinFor(undefined);
  }

  const childActions = (c: FamilyChild): ReactNode => (
    <div className="dir-actions">
      <Button
        variant="secondary"
        onClick={() =>
          setPremiumFor({ id: c.id, name: c.nickname, plan: c.plan, grants: c.grants })
        }
      >
        {t('admin.dir.setPremium')}
      </Button>
      <Link className="ui-btn ui-btn-ghost" to={childReportPath(c.id)}>
        {t('admin.family.report')}
      </Link>
      <Button
        variant="ghost"
        aria-expanded={pinFor === c.id}
        title={t('admin.pin.reset')}
        onClick={() => setPinFor(pinFor === c.id ? undefined : c.id)}
      >
        {t('admin.dir.pinShort')}
      </Button>
      <Button
        variant={c.active ? 'danger' : 'secondary'}
        disabled={action.busy}
        onClick={() => void toggleChild(c)}
      >
        {c.active ? t('admin.user.deactivate') : t('admin.user.activate')}
      </Button>
    </div>
  );
  const pinRow = (c: FamilyChild) =>
    pinFor === c.id && (
      <div className="dir-pin">
        <PinPicker
          busy={action.busy}
          onCancel={() => setPinFor(undefined)}
          onSubmit={(pin) => void setPin(c, pin)}
        />
      </div>
    );

  const s = summary.data;
  const list = tab === 'families' ? families : kids;
  const data = list.data;

  return (
    <>
      <PageHeader title={t('admin.family.title')} subtitle={t('admin.dir.subtitle')} />

      {s && (
        <div className="ins-kpis dir-kpis">
          <Kpi
            i={0}
            tone="grape"
            icon={<ShellIconSvg name="users" />}
            label={t('admin.dir.kFamilies')}
            value={s.families}
            hint={t('admin.dir.kInactive', { n: s.familiesInactive })}
          />
          <Kpi
            i={1}
            tone="leaf"
            icon={<ShellIconSvg name="badge" />}
            label={t('admin.dir.kChildren')}
            value={s.children}
            hint={t('admin.dir.kInactive', { n: s.childrenInactive })}
          />
          <Kpi
            i={2}
            tone="sun"
            icon={<ShellIconSvg name="tag" />}
            label={t('admin.dir.kPremium')}
            value={s.premiumChildren}
            hint={t('admin.dir.kPremiumHint', { n: s.premiumFamilies })}
          />
          <Kpi
            i={3}
            tone="sky"
            icon={<ShellIconSvg name="gear" />}
            label={t('admin.dir.kGrants')}
            value={s.adminGrants}
            hint={t('admin.dir.kGrantsHint')}
          />
        </div>
      )}

      <section className="ins-panel dir-panel">
        <div className="dir-tabs" role="tablist" aria-label={t('admin.dir.tabs')}>
          {(['families', 'children'] as const).map((k) => (
            <button
              key={k}
              type="button"
              role="tab"
              aria-selected={tab === k}
              className={`ins-chip${tab === k ? ' is-on' : ''}`}
              onClick={() => {
                setPinFor(undefined);
                set({ tab: k === 'children' ? 'anak' : null, sort: null });
              }}
            >
              {t(k === 'families' ? 'admin.dir.tabFamilies' : 'admin.dir.tabChildren')}
              {s && <span className="dir-count">{k === 'families' ? s.families : s.children}</span>}
            </button>
          ))}
        </div>

        <div className="dir-filters">
          <label className="dir-search">
            <span className="adm-sr">{t('admin.family.search')}</span>
            <ShellIconSvg name="search" size={18} />
            <input
              type="search"
              value={search}
              placeholder={t(
                tab === 'families' ? 'admin.dir.searchFamilies' : 'admin.dir.searchChildren',
              )}
              onChange={(e) => setSearch(e.target.value)}
              maxLength={80}
            />
          </label>
          <SelectField
            label={t('admin.dir.fStatus')}
            value={status}
            onChange={(e) => set({ status: e.target.value })}
            options={[
              { value: 'all', label: t('admin.dir.all') },
              { value: 'premium', label: t('common.plan.premium') },
              { value: 'free', label: t('common.plan.free') },
            ]}
          />
          <SelectField
            label={t('admin.dir.fActive')}
            value={active}
            onChange={(e) => set({ active: e.target.value })}
            options={[
              { value: 'all', label: t('admin.dir.all') },
              { value: 'active', label: t('admin.dir.active') },
              { value: 'inactive', label: t('admin.dir.inactive') },
            ]}
          />
          <SelectField
            label={t('admin.dir.fSort')}
            value={sort}
            onChange={(e) => set({ sort: e.target.value })}
            options={[
              { value: 'newest', label: t('admin.dir.sNewest') },
              { value: 'oldest', label: t('admin.dir.sOldest') },
              { value: 'name', label: t('admin.dir.sName') },
              { value: 'recent', label: t('admin.dir.sRecent') },
            ]}
          />
        </div>
        <ActionNotice error={action.error} done={action.done} />

        <Loadable loading={list.loading} error={list.error} hasData={!!data}>
          {() =>
            data!.items.length === 0 ? (
              <Empty>{t('admin.dir.empty')}</Empty>
            ) : tab === 'families' ? (
              <ul className="dir-families">
                {(data as Page<FamilyRow>).items.map((p) => (
                  <li key={p.id} className={`dir-family${p.active ? '' : ' is-off'}`}>
                    <div className="dir-family-head">
                      <Initials name={p.name} />
                      <div className="dir-who">
                        <strong>{p.name}</strong>
                        <small>
                          {p.email} · {t('admin.family.code')}:{' '}
                          <span className="adm-code-small">{p.familyCode}</span>
                        </small>
                        <small>
                          {t('admin.dir.joined', { date: formatDate(p.createdAt) })} ·{' '}
                          {lastSeen(p.lastActiveAt)}
                        </small>
                      </div>
                      <div className="dir-badges">
                        {p.plan.tier !== 'free' && <PlanBadge plan={p.plan} detail />}
                        <span className={`dir-premium-count${p.premiumChildren ? ' is-on' : ''}`}>
                          {t('admin.dir.premiumCount', {
                            n: p.premiumChildren,
                            total: p.children.length,
                          })}
                        </span>
                        {!p.active && <ActiveBadge active={false} />}
                      </div>
                    </div>

                    {p.children.length === 0 ? (
                      <span className="ui-muted">{t('admin.family.noChildren')}</span>
                    ) : (
                      <ul className="dir-kid-list">
                        {p.children.map((c) => (
                          <li key={c.id} className={c.active ? undefined : 'is-off'}>
                            <div className="dir-kid-row">
                              <span className="dir-kid-name">
                                <ColorDot color={c.momoColor} />
                                <strong>{c.nickname}</strong>
                                <PlanBadge plan={c.plan} detail />
                                {!c.active && <ActiveBadge active={false} />}
                              </span>
                              <small className="ui-muted">{lastSeen(c.lastActiveAt)}</small>
                              {childActions(c)}
                            </div>
                            {pinRow(c)}
                          </li>
                        ))}
                      </ul>
                    )}

                    <div className="dir-actions dir-family-actions">
                      <Button
                        variant={p.active ? 'danger' : 'secondary'}
                        disabled={action.busy}
                        onClick={() => void toggleParent(p)}
                      >
                        {p.active
                          ? t('admin.user.deactivateFamily')
                          : t('admin.user.activateFamily')}
                      </Button>
                      <PasswordSetter
                        busy={action.busy}
                        note={t('admin.user.passwordForceNote')}
                        onSubmit={(pw) => setPassword(p, pw)}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="dir-table" role="table" aria-label={t('admin.dir.tabChildren')}>
                <div className="dir-tr dir-th" role="row">
                  {(['cChild', 'cParent', 'cPlan', 'cPassed', 'cLast', 'cActions'] as const).map(
                    (k) => (
                      <span key={k} role="columnheader">
                        {t(`admin.dir.${k}`)}
                      </span>
                    ),
                  )}
                </div>
                {(data as Page<ChildRow>).items.map((c) => (
                  <div key={c.id} className={`dir-tr-wrap${c.active ? '' : ' is-off'}`}>
                    <div className="dir-tr" role="row">
                      <span role="cell" data-label={t('admin.dir.cChild')} className="dir-kid-name">
                        <ColorDot color={c.momoColor} />
                        <strong>{c.nickname}</strong>
                        {!c.active && <ActiveBadge active={false} />}
                      </span>
                      <span role="cell" data-label={t('admin.dir.cParent')}>
                        {c.parent.name}
                        <small className="ui-muted dir-sub">{c.parent.email}</small>
                      </span>
                      <span role="cell" data-label={t('admin.dir.cPlan')}>
                        <PlanBadge plan={c.plan} detail />
                      </span>
                      <span role="cell" data-label={t('admin.dir.cPassed')}>
                        {c.passed}
                        <small className="ui-muted dir-sub">
                          {t('admin.dir.answered', { n: c.answered.toLocaleString('id-ID') })}
                        </small>
                      </span>
                      <span role="cell" data-label={t('admin.dir.cLast')}>
                        {c.lastActiveAt ? formatDay(c.lastActiveAt) : '—'}
                      </span>
                      <span role="cell" data-label={t('admin.dir.cActions')}>
                        {childActions(c)}
                      </span>
                    </div>
                    {pinRow(c)}
                  </div>
                ))}
              </div>
            )
          }
        </Loadable>

        {data && data.total > 0 && (
          <Pager
            page={page}
            pageSize={pageSize}
            total={data.total}
            onPage={(n) => set({ page: n }, false)}
            onPageSize={(n) => set({ size: n })}
          />
        )}
      </section>

      {premiumFor && (
        <PremiumDialog
          target={premiumFor}
          onClose={() => setPremiumFor(undefined)}
          onChanged={(msg) => {
            setPremiumFor(undefined);
            void action.run(async () => undefined, msg);
            reload();
          }}
        />
      )}
    </>
  );
}
