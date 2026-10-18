import {
  CERTIFICATE_DESIGNS,
  MOMO_COLORS,
  PIN_PICTURES,
  type Illustration as IllustrationRow,
  type Stage,
} from '@udakids/engine';
import { useMemo, type ReactNode } from 'react';
import { useSettings } from '../../api/settings';
import { useFetch } from '../../auth/useApi';
import { CertificateSheet } from '../../components/certificate/CertificateSheet';
import { OBJECT_LABELS, ObjectShape, type ObjectItem } from '../../components/CountObjects';
import { Illustration } from '../../components/Illustration';
import { Momo } from '../../components/Momo';
import { PinPictureIcon } from '../../components/PicturePin';
import { Plant } from '../../components/Plant';
import { t, type MessageKey } from '../../i18n';

export type GalleryCategory = 'objects' | 'pins' | 'momo' | 'plants' | 'certificates' | 'ai';
export const GALLERY_CATEGORIES: GalleryCategory[] = [
  'objects',
  'pins',
  'momo',
  'plants',
  'certificates',
  'ai',
];

export type GalleryAsset = {
  imageUrl?: string | null;
  key: string;
  category: GalleryCategory;
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

/**
 * Semua gambar yang dipakai aplikasi, dari benda soal hitung sampai ilustrasi AI yang disetujui. Dipakai halaman Galeri
 * Aset dan pemilih gambar di dialog soal, jadi keduanya selalu menampilkan isi yang sama.
 */
export function useGalleryAssets(): { assets: GalleryAsset[]; loading: boolean } {
  const usage = useFetch<{ objects: Record<string, number> }>('staff', '/admin/media/usage');
  const approved = useFetch<IllustrationRow[]>('staff', '/admin/illustrations?status=approved');
  const settings = useSettings().certificate;

  const assets = useMemo<GalleryAsset[]>(() => {
    const list: GalleryAsset[] = [];
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
        imageUrl: img.imageUrl,
        render: (size) => <Illustration request={img} size={size * 1.4} />,
      });
    return list;
  }, [usage.data, approved.data, settings]);

  return { assets, loading: usage.loading || approved.loading };
}
