import { t } from '../i18n';

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
        <label className="pager-size">
          {t('common.pager.perPage')}
          <select value={pageSize} onChange={(e) => onPageSize(Number(e.target.value))}>
            {sizes.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
      )}
    </nav>
  );
}
