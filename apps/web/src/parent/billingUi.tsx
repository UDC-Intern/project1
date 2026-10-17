import { useMemo, useState } from 'react';
import { GRADE_LABEL, formatRupiah, type OrderStatus } from '@udakids/engine';
import type { CatalogResponse } from '../api/types';
import { useFetch } from '../auth/useApi';
import { t, type MessageKey } from '../i18n';
import { Badge, Button } from '../ui/ui';
import type { BookRef } from './billingTypes';

/** Bagian bersama halaman paket & transaksi orang tua. */

export const formatDay = (v: string) =>
  new Date(v).toLocaleDateString('id-ID', { dateStyle: 'long' });

const STATUS_TONE: Record<OrderStatus, 'neutral' | 'success' | 'warning' | 'info' | 'muted'> = {
  awaiting_payment: 'warning',
  awaiting_review: 'info',
  paid: 'success',
  rejected: 'warning',
  expired: 'muted',
  cancelled: 'muted',
};

export function StatusBadge({ status }: { status: OrderStatus }) {
  return (
    <Badge tone={STATUS_TONE[status]}>{t(`parent.orderStatus.${status}` as MessageKey)}</Badge>
  );
}

/** Nominal rupiah dengan 3 digit terakhir (kode unik) ditandai. */
export function Amount({ value, className }: { value: number; className?: string }) {
  const s = formatRupiah(value);
  return (
    <span className={`pa-amount ${className ?? ''}`}>
      {s.slice(0, -3)}
      <mark className="pa-amount-code">{s.slice(-3)}</mark>
    </span>
  );
}

/** Tombol salin; disembunyikan bila peramban tidak menyediakan clipboard. */
export function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  if (typeof navigator === 'undefined' || !navigator.clipboard) return null;
  return (
    <Button
      variant="ghost"
      aria-live="polite"
      onClick={() => {
        navigator.clipboard.writeText(text).then(
          () => setCopied(true),
          () => setCopied(false),
        );
      }}
    >
      {copied ? t('parent.billing.copied') : label}
    </Button>
  );
}

/** Nama buku dari katalog (`domain/grade` → judul); diambil hanya bila diperlukan. */
export function useBookTitles(needed: boolean) {
  const res = useFetch<CatalogResponse>('parent', needed ? '/catalog' : null);
  return useMemo(() => {
    const titles = new Map<string, string>();
    for (const c of res.data?.catalogs ?? []) titles.set(`${c.domain}/${c.grade}`, c.title);
    return (b: BookRef) =>
      titles.get(`${b.domain}/${b.grade}`) ??
      `${b.domain} · ${GRADE_LABEL[b.grade as keyof typeof GRADE_LABEL] ?? b.grade}`;
  }, [res.data]);
}

export function scopeText(
  scope: 'all' | 'books',
  books: readonly BookRef[],
  title: (b: BookRef) => string,
) {
  return scope === 'all' ? t('parent.billing.scopeAll') : books.map(title).join(', ');
}

export const durationText = (days: number | null) =>
  days === null ? t('parent.billing.forever') : t('parent.billing.days', { n: days });
