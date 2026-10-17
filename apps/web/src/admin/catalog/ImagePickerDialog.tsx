import { useState, type MouseEvent } from 'react';
import { t, type MessageKey } from '../../i18n';
import { ShellIconSvg } from '../../ui/AppShell';
import { Dialog } from '../../ui/Dialog';
import { Button, Empty, Notice, Spinner } from '../../ui/ui';
import { FilterChips } from '../common';
import {
  GALLERY_CATEGORIES,
  useGalleryAssets,
  type GalleryAsset,
  type GalleryCategory,
} from '../media/galleryAssets';
import { svgToQuestionImage } from '../media/svgImage';

/** Lembar sertifikat bukan gambar untuk soal, jadi tidak ikut ditawarkan. */
const CATEGORIES = GALLERY_CATEGORIES.filter((c) => c !== 'certificates');

export type PickedImage = { url: string; label: string };

/**
 * Pemilih gambar dari Galeri Aset (benda soal, sandi gambar, Momo, tanaman) dan Ilustrasi AI yang sudah disetujui.
 * Satu ketukan pada gambar langsung memasangnya di soal; gambar disimpan sebagai SVG di data soal, jadi tetap tajam
 * dan tidak bergantung pada galeri setelahnya.
 */
export function ImagePickerDialog({
  n,
  onPick,
  onClose,
}: {
  /** Nomor soal yang sedang diberi gambar (mulai 1). */
  n: number;
  onPick: (picked: PickedImage) => void;
  onClose: () => void;
}) {
  const { assets, loading } = useGalleryAssets();
  const [category, setCategory] = useState<GalleryCategory | 'all'>('all');
  const [query, setQuery] = useState('');
  const [tooBig, setTooBig] = useState(false);

  const pickable = assets.filter((a) => a.category !== 'certificates');
  const q = query.trim().toLowerCase();
  const shown = pickable.filter(
    (a) =>
      (category === 'all' || a.category === category) &&
      (!q || a.name.toLowerCase().includes(q) || a.code.toLowerCase().includes(q)),
  );
  const count = (c: GalleryCategory) => pickable.filter((a) => a.category === c).length;

  function choose(e: MouseEvent<HTMLButtonElement>, asset: GalleryAsset) {
    const svg = e.currentTarget.querySelector('svg');
    const url = svg ? svgToQuestionImage(svg) : null;
    if (!url) {
      setTooBig(true);
      return;
    }
    onPick({ url, label: asset.name });
  }

  return (
    <Dialog wide title={t('admin.bank.pickTitle', { n })} onClose={onClose}>
      <p className="ui-muted bank-pick-hint">{t('admin.bank.pickHint')}</p>
      <FilterChips
        label={t('admin.gallery.categories')}
        value={category}
        onChange={setCategory}
        items={(['all', ...CATEGORIES] as const).map((c) => ({
          key: c,
          label: t(`admin.gallery.cat.${c}` as MessageKey),
          count: c === 'all' ? pickable.length : count(c),
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
      {tooBig && <Notice tone="warning">{t('admin.bank.pickTooBig')}</Notice>}
      {loading && shown.length === 0 ? (
        <Spinner />
      ) : shown.length === 0 ? (
        <Empty>{category === 'ai' ? t('admin.gallery.aiEmpty') : t('admin.gallery.empty')}</Empty>
      ) : (
        <ul className="gal-grid bank-pick-grid">
          {shown.map((a) => (
            <li key={a.key}>
              <button
                type="button"
                className="gal-tile"
                aria-label={t('admin.bank.pickTile', { name: a.name })}
                onClick={(e) => choose(e, a)}
              >
                <span className="gal-preview">{a.render(72)}</span>
                <strong>{a.name}</strong>
                <small className="ui-muted">
                  {t(`admin.gallery.cat.${a.category}` as MessageKey)}
                </small>
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="ui-row bank-pick-actions">
        <Button variant="ghost" onClick={onClose}>
          {t('admin.cancel')}
        </Button>
      </div>
    </Dialog>
  );
}
