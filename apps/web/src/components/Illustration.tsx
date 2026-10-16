import { mulberry32, seedFrom, type IllustrationRequest } from '@udakids/engine';
import { OBJECT_LABELS, ObjectShape, type ObjectItem } from './CountObjects';

/**
 * Ilustrasi dari permintaan admin (menu Ilustrasi AI). Di mode tiruan gambar disusun dari pustaka bentuk sendiri:
 * benda hitung, Momo, dan latar. Susunannya ditentukan subjek + varian, jadi permintaan yang sama selalu menghasilkan
 * gambar yang sama (pratinjau sebelum dibuat sama persis dengan hasilnya).
 */

const W = 320;
const H = 240;

/** Kata dalam subjek yang dikenali sebagai benda di pustaka. */
const WORDS: Record<string, ObjectItem> = {
  apel: 'apple',
  apple: 'apple',
  bola: 'ball',
  ball: 'ball',
  bintang: 'star',
  star: 'star',
  ikan: 'fish',
  fish: 'fish',
  daun: 'leaf',
  leaf: 'leaf',
  pohon: 'leaf',
  tanaman: 'leaf',
  buku: 'book',
  book: 'book',
};
const ITEMS = Object.keys(OBJECT_LABELS) as ObjectItem[];

/** Benda yang digambar untuk subjek ini: kata yang dikenali, atau pilihan tetap dari subjek. */
export function illustrationItem(subject: string): ObjectItem {
  for (const word of subject.toLowerCase().split(/[^a-z]+/)) if (WORDS[word]) return WORDS[word]!;
  return ITEMS[seedFrom(subject.toLowerCase()) % ITEMS.length]!;
}

/** Benda dikenali dari subjek? Bila tidak, admin diberi tahu bendanya diganti. */
export const recognizesSubject = (subject: string) =>
  subject
    .toLowerCase()
    .split(/[^a-z]+/)
    .some((w) => !!WORDS[w]);

/** Momo sebagai bentuk SVG (sama dengan Momo di lembar sertifikat), satuan 100, warna badan dari token. */
function MomoShape({ color, size }: { color: string; size: number }) {
  const body = `var(--uk-momo-${color})`;
  return (
    <g transform={`scale(${size / 100})`}>
      <path d="M50 8V20" stroke={body} strokeWidth={4} />
      <circle cx={50} cy={8} r={5} fill={body} />
      <rect x={16} y={20} width={68} height={62} rx={18} fill={body} />
      <rect x={24} y={28} width={52} height={46} rx={14} fill="var(--kertas)" />
      <circle cx={38} cy={44} r={4.5} fill="var(--malam)" />
      <circle cx={62} cy={44} r={4.5} fill="var(--malam)" />
      <path d="M40 56Q50 67 60 56" stroke="var(--malam)" strokeWidth={3.5} fill="none" />
      <rect x={8} y={46} width={8} height={16} rx={4} fill={body} />
      <rect x={84} y={46} width={8} height={16} rx={4} fill={body} />
    </g>
  );
}

function Background({ theme }: { theme: IllustrationRequest['theme'] }) {
  if (theme === 'outdoor')
    return (
      <>
        <rect width={W} height={H} fill="var(--langit-soft)" />
        <circle cx={268} cy={44} r={22} fill="var(--kunyit)" />
        <g fill="var(--kertas)">
          <ellipse cx={70} cy={48} rx={30} ry={12} />
          <ellipse cx={92} cy={42} rx={22} ry={12} />
          <ellipse cx={190} cy={64} rx={24} ry={9} />
        </g>
        <path d={`M0 170 Q80 150 160 168 T${W} 162 V${H} H0Z`} fill="var(--sawah-soft)" />
        <path d={`M0 190 Q90 176 170 192 T${W} 186 V${H} H0Z`} fill="var(--sawah)" opacity={0.25} />
      </>
    );
  if (theme === 'classroom')
    return (
      <>
        <rect width={W} height={H} fill="var(--kertas)" />
        <rect x={40} y={24} width={240} height={96} rx={8} fill="var(--sawah-tekan)" />
        <path d="M60 52 H150 M60 72 H200 M60 92 H120" stroke="var(--kertas)" strokeWidth={3} />
        <rect y={176} width={W} height={H - 176} fill="var(--kunyit-soft)" />
        <path d={`M0 176 H${W}`} stroke="var(--garis-tegas)" strokeWidth={2} />
      </>
    );
  return <rect width={W} height={H} fill="var(--kertas)" />;
}

/** Posisi benda: berjajar rapi untuk "benda", tersebar acak (tetap per varian) untuk "adegan". */
function placements(req: IllustrationRequest) {
  const rand = mulberry32(seedFrom(`${req.subject.toLowerCase()}|${req.variant}|${req.kind}`));
  const n = req.kind === 'character' ? Math.min(req.count, 6) : req.count;
  const size = req.kind === 'object' ? (n === 1 ? 120 : n <= 4 ? 64 : 44) : 40;
  const left = req.withMomo || req.kind === 'character' ? 130 : 24;
  const top = req.theme === 'classroom' ? 124 : 96;
  const out: { x: number; y: number; size: number; tilt: number }[] = [];
  if (req.kind === 'object') {
    const cols = Math.min(n, n <= 4 ? n : 4);
    const rows = Math.ceil(n / cols);
    const gap = 8;
    const width = cols * size + (cols - 1) * gap;
    const height = rows * size + (rows - 1) * gap;
    const x0 = left + (W - left - 24 - width) / 2;
    const y0 = (H - height) / 2 + (n === 1 ? 0 : 10);
    for (let i = 0; i < n; i++)
      out.push({
        x: x0 + (i % cols) * (size + gap),
        y: y0 + Math.floor(i / cols) * (size + gap),
        size,
        tilt: 0,
      });
    return out;
  }
  for (let i = 0; i < n; i++)
    out.push({
      x: left + rand() * (W - left - 24 - size),
      y: top + rand() * (H - top - size - 12),
      size,
      tilt: Math.round((rand() - 0.5) * 30),
    });
  return out;
}

export function Illustration({
  request,
  size = 320,
  title,
}: {
  request: IllustrationRequest;
  size?: number;
  /** Teks alternatif; bawaan: subjek dan jumlah benda. */
  title?: string;
}) {
  const item = illustrationItem(request.subject);
  const label = title ?? `${request.subject}, ${request.count} ${OBJECT_LABELS[item]}`;
  const momoSize = request.kind === 'character' ? 150 : 100;
  return (
    <svg
      className="ill-svg"
      viewBox={`0 0 ${W} ${H}`}
      width={size}
      height={(size * H) / W}
      role="img"
      aria-label={label}
      xmlns="http://www.w3.org/2000/svg"
    >
      <Background theme={request.theme} />
      {placements(request).map((p, i) => (
        <g
          key={i}
          transform={`translate(${p.x.toFixed(1)} ${p.y.toFixed(1)}) rotate(${p.tilt} ${p.size / 2} ${p.size / 2}) scale(${(p.size / 32).toFixed(3)})`}
        >
          <ObjectShape item={item} />
        </g>
      ))}
      {(request.withMomo || request.kind === 'character') && (
        <g transform={`translate(${request.kind === 'character' ? 10 : 18} ${H - momoSize - 8})`}>
          <MomoShape color={request.momoColor} size={momoSize} />
        </g>
      )}
    </svg>
  );
}
