import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useT } from '../i18n';

export const BOOKS_PER_PAGE = 9;

/**
 * Rak buku bergeser: maksimal 9 buku per halaman (3 x 3). Lebih dari itu menjadi halaman berikutnya,
 * dengan tombol sebelumnya dan berikutnya, titik halaman, atau geser dengan jari (scroll-snap).
 */
export function BookSlider<T>({
  items,
  render,
  perPage = BOOKS_PER_PAGE,
}: {
  items: T[];
  render: (item: T, index: number) => ReactNode;
  perPage?: number;
}) {
  const t = useT('site');
  const track = useRef<HTMLDivElement>(null);
  const [page, setPage] = useState(0);
  const pages: T[][] = [];
  for (let i = 0; i < items.length; i += perPage) pages.push(items.slice(i, i + perPage));
  const count = pages.length;

  useEffect(() => {
    const el = track.current;
    if (!el) return;
    const onScroll = () => {
      const w = el.clientWidth || 1;
      setPage(Math.min(count - 1, Math.max(0, Math.round(el.scrollLeft / w))));
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, [count]);

  const go = (p: number) => {
    const next = Math.min(count - 1, Math.max(0, p));
    setPage(next);
    const el = track.current;
    el?.scrollTo?.({ left: next * el.clientWidth, behavior: 'smooth' });
  };

  if (count <= 1) {
    return <div className="book-grid">{items.map(render)}</div>;
  }

  return (
    <div
      className="book-slider"
      role="region"
      aria-roledescription="carousel"
      aria-label={t('books.title')}
    >
      <div className="book-slider-bar">
        <span className="book-slider-count" aria-live="polite">
          {t('books.page', {
            from: page * perPage + 1,
            to: Math.min(items.length, (page + 1) * perPage),
            total: items.length,
          })}
        </span>
        <div className="book-slider-nav">
          <button
            type="button"
            className="slider-btn"
            onClick={() => go(page - 1)}
            disabled={page === 0}
            aria-label={t('books.prev')}
          >
            <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden>
              <path
                d="M15 5l-7 7 7 7"
                stroke="currentColor"
                strokeWidth="3"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
          <button
            type="button"
            className="slider-btn"
            onClick={() => go(page + 1)}
            disabled={page === count - 1}
            aria-label={t('books.next')}
          >
            <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden>
              <path
                d="M9 5l7 7-7 7"
                stroke="currentColor"
                strokeWidth="3"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>
      </div>
      <div className="book-pages" ref={track}>
        {pages.map((list, p) => (
          <div
            key={p}
            className="book-page"
            role="group"
            aria-roledescription="slide"
            aria-label={t('books.pageLabel', { n: p + 1, total: count })}
            aria-hidden={p !== page}
          >
            <div className="book-grid">{list.map((it, i) => render(it, p * perPage + i))}</div>
          </div>
        ))}
      </div>
      <div className="book-dots" role="tablist" aria-label={t('books.pages')}>
        {pages.map((_, p) => (
          <button
            key={p}
            type="button"
            role="tab"
            aria-selected={p === page}
            aria-label={t('books.pageLabel', { n: p + 1, total: count })}
            className={`book-dot${p === page ? ' is-on' : ''}`}
            onClick={() => go(p)}
          />
        ))}
      </div>
    </div>
  );
}
