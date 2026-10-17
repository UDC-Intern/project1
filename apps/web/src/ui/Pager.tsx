import { useId, useState } from 'react';
import { t } from '../i18n';
import { Select } from './Select';
import './pager.css';

const SIZES = [10, 20, 50];

/**
 * Paging di sisi klien untuk daftar yang dimuat utuh: baris untuk halaman yang sedang dibuka. Kembali ke halaman 1
 * bila jumlah baris berubah (mis. saringan diganti).
 */
export function usePaged<T>(rows: readonly T[], initialSize = SIZES[0]!) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialSize);
  const [seen, setSeen] = useState(rows.length);
  if (seen !== rows.length) {
    setSeen(rows.length);
    setPage(1);
  }
  const pages = Math.max(1, Math.ceil(rows.length / pageSize));
  const current = Math.min(page, pages);
  // Ukuran tak terbatas (tanpa paging): selalu dari baris pertama.
  const start = current === 1 ? 0 : (current - 1) * pageSize;
  return {
    items: rows.slice(start, start + pageSize),
    page: current,
    pageSize,
    total: rows.length,
    setPage,
    setPageSize: (n: number) => {
      setPageSize(n);
      setPage(1);
    },
  };
}
export type Paged = Omit<ReturnType<typeof usePaged>, 'items'>;

/** Pager untuk `usePaged`. Tidak tampil bila semua baris muat di satu halaman ukuran terkecil. */
export function ListPager({ paged, sizes = SIZES }: { paged: Paged; sizes?: number[] }) {
  if (paged.total <= sizes[0]!) return null;
  return (
    <Pager
      page={paged.page}
      pageSize={paged.pageSize}
      total={paged.total}
      onPage={paged.setPage}
      onPageSize={paged.setPageSize}
      sizes={sizes}
    />
  );
}

/** Nomor halaman dengan elipsis: 1 … 4 5 6 … 12. */
export function pageList(page: number, pages: number): (number | '…')[] {
  if (pages <= 7) return Array.from({ length: pages }, (_, i) => i + 1);
  const out: (number | '…')[] = [1];
  const from = Math.max(2, page - 1);
  const to = Math.min(pages - 1, page + 1);
  if (from > 2) out.push('…');
  for (let i = from; i <= to; i++) out.push(i);
  if (to < pages - 1) out.push('…');
  out.push(pages);
  return out;
}

/** Paging tabel: info rentang, tombol halaman, dan pilihan jumlah per halaman. */
export function Pager({
  page,
  pageSize,
  total,
  onPage,
  onPageSize,
  sizes = [10, 20, 50],
}: {
  page: number;
  pageSize: number;
  total: number;
  onPage: (p: number) => void;
  onPageSize?: (n: number) => void;
  sizes?: number[];
}) {
  const sizeLabel = useId();
  // Ukuran yang sedang dipakai selalu ada di pilihan (mis. 12 kartu per halaman).
  const options = sizes.includes(pageSize) ? sizes : [...sizes, pageSize].sort((a, b) => a - b);
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  return (
    <nav className="pager" aria-label={t('common.pager.label')}>
      <span className="pager-info" aria-live="polite">
        {t('common.pager.range', { from, to, total })}
      </span>
      <div className="pager-pages">
        <button
          type="button"
          onClick={() => onPage(page - 1)}
          disabled={page <= 1}
          aria-label={t('common.pager.prev')}
        >
          ‹
        </button>
        {pageList(page, pages).map((p, i) =>
          p === '…' ? (
            <span key={`e${i}`} className="pager-gap" aria-hidden>
              …
            </span>
          ) : (
            <button
              key={p}
              type="button"
              className={p === page ? 'is-on' : undefined}
              aria-current={p === page ? 'page' : undefined}
              aria-label={t('common.pager.page', { n: p })}
              onClick={() => onPage(p)}
            >
              {p}
            </button>
          ),
        )}
        <button
          type="button"
          onClick={() => onPage(page + 1)}
          disabled={page >= pages}
          aria-label={t('common.pager.next')}
        >
          ›
        </button>
      </div>
      {onPageSize && (
        <div className="pager-size">
          <span id={sizeLabel}>{t('common.pager.perPage')}</span>
          <Select
            size="sm"
            aria-labelledby={sizeLabel}
            value={String(pageSize)}
            options={options.map((n) => ({ value: String(n), label: String(n) }))}
            onChange={(v) => onPageSize(Number(v))}
          />
        </div>
      )}
    </nav>
  );
}
