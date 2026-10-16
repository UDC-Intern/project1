import {
  CERTIFICATE_DESIGNS,
  MOMO_COLORS,
  PIN_PICTURES,
  type Illustration as IllustrationRow,
  type Stage,
} from '@udakids/engine';
import { useMemo, useRef, useState, type ReactNode } from 'react';
import { useSettings } from '../../api/settings';
import { useFetch } from '../../auth/useApi';
import { CertificateSheet } from '../../components/certificate/CertificateSheet';
import { OBJECT_LABELS, ObjectShape, type ObjectItem } from '../../components/CountObjects';
import { Illustration } from '../../components/Illustration';
import { Momo } from '../../components/Momo';
import { PinPictureIcon } from '../../components/PicturePin';
import { Plant } from '../../components/Plant';
import { t, type MessageKey } from '../../i18n';
import { ShellIconSvg } from '../../ui/AppShell';
import { Dialog } from '../../ui/Dialog';
import { Button, Empty, PageHeader } from '../../ui/ui';

type Category = 'objects' | 'pins' | 'momo' | 'plants' | 'certificates' | 'ai';
const CATEGORIES: Category[] = ['objects', 'pins', 'momo', 'plants', 'certificates', 'ai'];

type Asset = {
  key: string;
  category: Category;
  name: string;
  code: string;
  meta: string;
  render: (size: number) => ReactNode;
};

const PIN_LABELS: Record<string, string> = {
  apple: 'Apel',
  star: 'Bintang',
  fish: 'Ikan',
  flower: 'Bunga',
  ball: 'Bola',
  cat: 'Kucing',
  house: 'Rumah',
  cloud: 'Awan',
  leaf: 'Daun',
};
const MOMO_LABELS: Record<string, string> = {
  blue: 'Biru',
  green: 'Hijau',
  yellow: 'Kuning',
  orange: 'Oranye',
  pink: 'Merah muda',
  teal: 'Hijau tosca',
};
const PLANT_LABELS = ['Benih', 'Tunas', 'Pohon', 'Pohon berbuah'];

function objectSvg(item: ObjectItem, size: number) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" role="img" aria-label={OBJECT_LABELS[item]}>
      <ObjectShape item={item} />
    </svg>
  );
}

/** Galeri Aset: semua gambar yang dipakai aplikasi, dari benda soal hitung sampai ilustrasi AI yang disetujui. */
export function GalleryPage() {
  const usage = useFetch<{ objects: Record<string, number> }>('staff', '/admin/media/usage');
  const approved = useFetch<IllustrationRow[]>('staff', '/admin/illustrations?status=approved');
  const settings = useSettings().certificate;
  const [category, setCategory] = useState<Category | 'all'>('all');
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState<Asset>();
  const big = useRef<HTMLDivElement>(null);

  const assets = useMemo<Asset[]>(() => {
    const list: Asset[] = [];
    for (const item of Object.keys(OBJECT_LABELS) as ObjectItem[])
      list.push({
        key: `objects:${item}`,
        category: 'objects',
        name: OBJECT_LABELS[item],
        code: item,
        meta: usage.data
          ? t('admin.gallery.usedIn', { n: usage.data.objects[item] ?? 0 })
          : t('admin.gallery.counting'),
        render: (size) => objectSvg(item, size),
      });
    for (const pin of PIN_PICTURES)
      list.push({
        key: `pins:${pin}`,
        category: 'pins',
        name: PIN_LABELS[pin] ?? pin,
        code: pin,
        meta: t('admin.gallery.pinMeta'),
        render: (size) => <PinPictureIcon name={pin} size={size} />,
      });
    for (const color of MOMO_COLORS)
      list.push({
        key: `momo:${color}`,
        category: 'momo',
        name: `Momo ${MOMO_LABELS[color] ?? color}`,
        code: color,
        meta: t('admin.gallery.momoMeta'),
        render: (size) => <Momo color={color} mood="happy" size={size} />,
      });
    ([0, 1, 2, 3] as Stage[]).forEach((stage) =>
      list.push({
        key: `plants:${stage}`,
        category: 'plants',
        name: PLANT_LABELS[stage]!,
        code: `stage-${stage}`,
        meta: t('admin.gallery.plantMeta'),
        render: (size) => <Plant stage={stage} size={size} />,
      }),
    );
    for (const design of CERTIFICATE_DESIGNS)
      list.push({
        key: `certificates:${design}`,
        category: 'certificates',
        name: t(`admin.certs.design.${design}` as MessageKey),
        code: design,
        meta: t('admin.gallery.certMeta'),
        render: (size) => (
          <div style={{ width: size * 1.4 }}>
            <CertificateSheet
              data={{
                childName: t('admin.certSettings.sampleName'),
                bookTitle: t('admin.certSettings.sampleBook'),
                levels: 40,
                topics: 10,
                design,
                number: null,
                issuedAt: null,
                settings,
              }}
            />
          </div>
        ),
      });
    for (const img of approved.data ?? [])
      list.push({
        key: `ai:${img.id}`,
        category: 'ai',
        name: img.subject,
        code: img.id,
        meta: t('admin.gallery.aiMeta', { by: img.createdBy }),
        render: (size) => <Illustration request={img} size={size * 1.4} />,
      });
    return list;
  }, [usage.data, approved.data, settings]);

  const q = query.trim().toLowerCase();
  const shown = assets.filter(
    (a) =>
      (category === 'all' || a.category === category) &&
      (!q || a.name.toLowerCase().includes(q) || a.code.toLowerCase().includes(q)),
  );
  const count = (c: Category) => assets.filter((a) => a.category === c).length;

  function downloadSvg(a: Asset) {
    const svg = big.current?.querySelector('svg');
    if (!svg) return;
    const clone = svg.cloneNode(true) as SVGSVGElement;
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    const css = getComputedStyle(document.documentElement);
    // Token warna (var(--…)) diganti nilainya supaya berkas tetap berwarna di luar aplikasi.
    const text = clone.outerHTML.replace(/var\((--[\w-]+)\)/g, (m, name: string) => {
      const v = css.getPropertyValue(name).trim();
      return v || m;
    });
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
        <div className="dir-tabs" role="tablist" aria-label={t('admin.gallery.categories')}>
          {(['all', ...CATEGORIES] as const).map((c) => (
            <button
              key={c}
              type="button"
              role="tab"
              aria-selected={category === c}
              className={`ins-chip${category === c ? ' is-on' : ''}`}
              onClick={() => setCategory(c)}
            >
              {t(`admin.gallery.cat.${c}` as MessageKey)}
              <span className="dir-count">{c === 'all' ? assets.length : count(c)}</span>
            </button>
          ))}
        </div>
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
