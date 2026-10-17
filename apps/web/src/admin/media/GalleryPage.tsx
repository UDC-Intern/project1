import { useRef, useState } from 'react';
import { t, type MessageKey } from '../../i18n';
import { ShellIconSvg } from '../../ui/AppShell';
import { Dialog } from '../../ui/Dialog';
import { Button, Empty, PageHeader } from '../../ui/ui';
import { FilterChips } from '../common';
import {
  GALLERY_CATEGORIES,
  useGalleryAssets,
  type GalleryAsset,
  type GalleryCategory,
} from './galleryAssets';
import { svgMarkup } from './svgImage';

/** Galeri Aset: semua gambar yang dipakai aplikasi, dari benda soal hitung sampai ilustrasi AI yang disetujui. */
export function GalleryPage() {
  const { assets } = useGalleryAssets();
  const [category, setCategory] = useState<GalleryCategory | 'all'>('all');
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState<GalleryAsset>();
  const big = useRef<HTMLDivElement>(null);

  const q = query.trim().toLowerCase();
  const shown = assets.filter(
    (a) =>
      (category === 'all' || a.category === category) &&
      (!q || a.name.toLowerCase().includes(q) || a.code.toLowerCase().includes(q)),
  );
  const count = (c: GalleryCategory) => assets.filter((a) => a.category === c).length;

  function downloadSvg(a: GalleryAsset) {
    const svg = big.current?.querySelector('svg');
    if (!svg) return;
    const text = svgMarkup(svg);
    const url = URL.createObjectURL(new Blob([text], { type: 'image/svg+xml' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `udakids-${a.category}-${a.code}.svg`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  return (
    <>
      <PageHeader title={t('admin.gallery.title')} subtitle={t('admin.gallery.subtitle')} />
      <section className="ins-panel">
        <FilterChips
          label={t('admin.gallery.categories')}
          value={category}
          onChange={setCategory}
          items={(['all', ...GALLERY_CATEGORIES] as const).map((c) => ({
            key: c,
            label: t(`admin.gallery.cat.${c}` as MessageKey),
            count: c === 'all' ? assets.length : count(c),
          }))}
        />
        <label className="dir-search">
          <span className="adm-sr">{t('admin.gallery.search')}</span>
          <ShellIconSvg name="search" size={18} />
          <input
            type="search"
            value={query}
            placeholder={t('admin.gallery.search')}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        {shown.length === 0 ? (
          <Empty>{category === 'ai' ? t('admin.gallery.aiEmpty') : t('admin.gallery.empty')}</Empty>
        ) : (
          <ul className="gal-grid">
            {shown.map((a) => (
              <li key={a.key}>
                <button type="button" className="gal-tile" onClick={() => setOpen(a)}>
                  <span className="gal-preview">{a.render(72)}</span>
                  <strong>{a.name}</strong>
                  <code className="adm-code-small">{a.code}</code>
                  <small className="ui-muted">{a.meta}</small>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {open && (
        <Dialog title={open.name} onClose={() => setOpen(undefined)}>
          <div className="uk-stack">
            <div className="gal-big" ref={big}>
              {open.render(200)}
            </div>
            <dl className="certs-facts">
              <dt>{t('admin.gallery.category')}</dt>
              <dd>{t(`admin.gallery.cat.${open.category}` as MessageKey)}</dd>
              <dt>{t('admin.gallery.code')}</dt>
              <dd>
                <code className="adm-code-small">{open.code}</code>
              </dd>
              <dt>{t('admin.gallery.usage')}</dt>
              <dd>{open.meta}</dd>
            </dl>
            <div className="ui-row">
              <Button onClick={() => downloadSvg(open)}>{t('admin.gallery.download')}</Button>
              <Button variant="ghost" onClick={() => setOpen(undefined)}>
                {t('admin.cancel')}
              </Button>
            </div>
          </div>
        </Dialog>
      )}
    </>
  );
}
