import type { PlanStatus } from '@udakids/engine';
import { t } from '../i18n';
import { formatDate } from './ui';
import './plan.css';

/** Badge status langganan (D-041): Premium / Paket buku / Free, dengan asal & masa berlaku. */
export function PlanBadge({ plan, detail = false }: { plan: PlanStatus; detail?: boolean }) {
  const label =
    plan.tier === 'premium'
      ? t('common.plan.premium')
      : plan.tier === 'books'
        ? t('common.plan.books')
        : t('common.plan.free');
  const until =
    plan.tier === 'free'
      ? ''
      : plan.endsAt
        ? t('common.plan.until', { date: formatDate(plan.endsAt) })
        : t('common.plan.forever');
  const source =
    plan.source === 'admin'
      ? t('common.plan.byAdmin')
      : plan.source === 'purchase'
        ? t('common.plan.byPurchase')
        : '';
  const full = [label, source, until].filter(Boolean).join(' · ');
  return (
    <span className={`plan-badge is-${plan.tier}`} title={full} aria-label={full}>
      {plan.tier === 'premium' && (
        <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden>
          <path d="M3 8l4.5 3.5L12 5l4.5 6.5L21 8l-2 11H5z" fill="currentColor" />
        </svg>
      )}
      <span aria-hidden>{label}</span>
      {detail && (source || until) && (
        <small aria-hidden>{[source, until].filter(Boolean).join(' · ')}</small>
      )}
    </span>
  );
}
