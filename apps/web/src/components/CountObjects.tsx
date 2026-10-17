import { objectsTotal, type CountItem, type Visual } from '@udakids/engine';

export type ObjectItem = CountItem;
type Item = ObjectItem;

const COLORS: Record<Item, string> = {
  apple: '#c0392b',
  ball: '#f08a24',
  star: '#f2b705',
  fish: '#3b82c4',
  leaf: '#3fa66b',
  book: '#8a6a3c',
};

export const OBJECT_LABELS: Record<Item, string> = {
  apple: 'apel',
  ball: 'bola',
  star: 'bintang',
  fish: 'ikan',
  leaf: 'daun',
  book: 'buku',
};

/** Bentuk satu benda dalam kotak 32 × 32 (dipakai soal hitung, Galeri Aset, dan Ilustrasi AI). */
export function ObjectShape({ item }: { item: Item }) {
  const fill = COLORS[item];
  switch (item) {
    case 'star':
      return (
        <path d="M16 3 L20 12 L29 13 L22 19 L24 28 L16 23 L8 28 L10 19 L3 13 L12 12Z" fill={fill} />
      );
    case 'fish':
      return (
        <>
          <ellipse cx="14" cy="16" rx="10" ry="6" fill={fill} />
          <path d="M23 16 L30 10 V22Z" fill={fill} />
        </>
      );
    case 'leaf':
      return <path d="M5 27 Q3 6 27 5 Q29 25 5 27Z" fill={fill} />;
    case 'book':
      return <rect x="6" y="5" width="20" height="22" rx="3" fill={fill} />;
    default:
      return <circle cx="16" cy="16" r="11" fill={fill} />;
  }
}

/**
 * Gambar yang menyertai soal. Benda hitung: satu kelompok (count) atau beberapa kelompok (groups) dari benda vektor
 * yang digandakan. Gambar utuh (galeri aset, ilustrasi AI, atau unggahan admin): satu <img> yang muat di layar.
 */
export function CountObjects({
  visual,
  maxHeight = 180,
}: {
  visual: Visual;
  /** Tinggi paling besar gambar utuh (px); benda hitung tidak terpengaruh. */
  maxHeight?: number;
}) {
  if (!visual) return null;
  if (visual.kind === 'image')
    return (
      <img
        src={visual.url}
        alt={visual.label || 'Gambar soal'}
        decoding="async"
        style={{
          maxHeight,
          maxWidth: '100%',
          objectFit: 'contain',
          borderRadius: 8,
          margin: '8px auto',
          display: 'block',
        }}
      />
    );
  const groups = visual.groups ?? [visual.count ?? 0];
  const total = objectsTotal(visual);
  return (
    <div className="uk-count" role="img" aria-label={`${total} ${OBJECT_LABELS[visual.item]}`}>
      {groups.map((n, g) => (
        <div key={g} className="uk-count-group">
          {Array.from({ length: n }, (_, i) => (
            <svg key={i} width="36" height="36" viewBox="0 0 32 32" aria-hidden="true">
              <ObjectShape item={visual.item} />
            </svg>
          ))}
        </div>
      ))}
    </div>
  );
}
