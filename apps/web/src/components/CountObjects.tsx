import type { Visual } from '@udakids/engine';

type Item = NonNullable<Visual>['item'];

const COLORS: Record<Item, string> = {
  apple: '#c0392b',
  ball: '#f08a24',
  star: '#f2b705',
  fish: '#3b82c4',
  leaf: '#3fa66b',
  book: '#8a6a3c',
};

const LABELS: Record<Item, string> = {
  apple: 'apel',
  ball: 'bola',
  star: 'bintang',
  fish: 'ikan',
  leaf: 'daun',
  book: 'buku',
};

function Shape({ item }: { item: Item }) {
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

/** Gambar objek untuk soal hitung. Satu kelompok (count) atau beberapa kelompok (groups). */
export function CountObjects({ visual }: { visual: Visual }) {
  if (!visual) return null;
  const groups = visual.groups ?? [visual.count ?? 0];
  const total = groups.reduce((a, b) => a + b, 0);
  return (
    <div className="uk-count" role="img" aria-label={`${total} ${LABELS[visual.item]}`}>
      {groups.map((n, g) => (
        <div key={g} className="uk-count-group">
          {Array.from({ length: n }, (_, i) => (
            <svg key={i} width="36" height="36" viewBox="0 0 32 32" aria-hidden="true">
              <Shape item={visual.item} />
            </svg>
          ))}
        </div>
      ))}
    </div>
  );
}
