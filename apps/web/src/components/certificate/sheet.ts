import type { Certificate, CertificateDesign } from '@udakids/engine';
import { t } from '../../i18n';
import { formatDate } from '../../lib/format';

/**
 * Lembar Sertifikat Juara Digital ditulis sekali sebagai daftar bentuk (persegi, lingkaran, garis, teks). Daftar yang
 * sama digambar sebagai SVG di layar dan saat dicetak, dan digambar di kanvas saat diunduh sebagai gambar PNG.
 */

/** A4 mendatar pada 96 dpi (297 × 210 mm). */
export const SHEET_W = 1123;
export const SHEET_H = 794;

/** Nama warna di lembar. Nilainya token CSS, jadi lembar mengikuti token desain. */
export type Ink =
  'paper' | 'ink' | 'muted' | 'frame' | 'deep' | 'accent' | 'soft' | 'ribbon' | 'momo';

const COMMON = {
  paper: '--kertas',
  ink: '--malam',
  muted: '--malam-muted',
  momo: '--uk-momo-blue',
} as const;

export const PALETTES: Record<CertificateDesign, Record<Ink, string>> = {
  klasik: {
    ...COMMON,
    frame: '--kunyit',
    deep: '--kunyit-tekan',
    accent: '--kunyit-teks',
    soft: '--kunyit-soft',
    ribbon: '--gonjong',
  },
  gonjong: {
    ...COMMON,
    frame: '--gonjong',
    deep: '--gonjong-tekan',
    accent: '--gonjong-teks',
    soft: '--gonjong-soft',
    ribbon: '--kunyit',
  },
  sawah: {
    ...COMMON,
    frame: '--sawah',
    deep: '--sawah-tekan',
    accent: '--sawah-teks',
    soft: '--sawah-soft',
    ribbon: '--kunyit',
  },
};

type Paint = { fill?: Ink; stroke?: Ink; width?: number; dash?: number; opacity?: number };

export type TextShape = {
  kind: 'text';
  x: number;
  y: number;
  text: string;
  size: number;
  font: 'display' | 'body';
  weight: 400 | 700;
  fill: Ink;
  anchor?: 'start' | 'middle' | 'end';
  spacing?: number;
  /** Lebar paling besar; teks yang lebih panjang dirapatkan. */
  maxWidth?: number;
  rotate?: number;
  opacity?: number;
};

export type Shape =
  | (Paint & { kind: 'rect'; x: number; y: number; w: number; h: number; r?: number })
  | (Paint & { kind: 'circle'; cx: number; cy: number; r: number })
  | (Paint & { kind: 'path'; d: string })
  | TextShape
  | { kind: 'group'; x: number; y: number; scale: number; children: Shape[] };

/** Isi lembar. `number` null berarti contoh (belum terbit). */
export type SheetData = {
  childName: string;
  bookTitle: string;
  levels: number;
  topics: number;
  design: CertificateDesign;
  number: string | null;
  issuedAt: string | null;
};

export const sheetDataOf = (c: Certificate): SheetData => ({
  childName: c.childName,
  bookTitle: c.bookTitle,
  levels: c.levels,
  topics: c.topics,
  design: c.design,
  number: c.id,
  issuedAt: c.issuedAt,
});

/** Perkiraan lebar teks (px) untuk memilih ukuran huruf tanpa mengukur di DOM. */
export const textWidth = (s: Pick<TextShape, 'text' | 'size' | 'font' | 'spacing'>) =>
  s.text.length * (s.size * (s.font === 'display' ? 0.56 : 0.5) + (s.spacing ?? 0));

/** Ukuran huruf terbesar (paling banyak `size`) agar teks muat di `max` px. */
const fitSize = (text: string, size: number, max: number) =>
  Math.max(24, Math.min(size, Math.floor(max / Math.max(1, text.length * 0.56))));

/** Pita rebung (segitiga berderet) di tepi atas atau bawah bingkai. */
function rebung(y: number, down: boolean): string {
  const x0 = 64;
  const x1 = SHEET_W - 64;
  const w = 26;
  const h = 16;
  const n = Math.floor((x1 - x0) / w);
  const start = x0 + (x1 - x0 - n * w) / 2;
  let d = '';
  for (let i = 0; i < n; i++) {
    const x = start + i * w;
    d += `M${x} ${y}L${x + w / 2} ${down ? y + h : y - h}L${x + w} ${y}Z`;
  }
  return d;
}

/** Bintang lima sudut berpusat di (cx, cy). */
export function starPath(cx: number, cy: number, outer: number, inner: number): string {
  let d = '';
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    d += `${i === 0 ? 'M' : 'L'}${(cx + r * Math.cos(a)).toFixed(1)} ${(cy + r * Math.sin(a)).toFixed(1)}`;
  }
  return `${d}Z`;
}

/** Momo (robot biru) dalam satuan 100, digeser ke (x, y) dan diperkecil ke `size` px. */
function momo(x: number, y: number, size: number): Shape {
  return {
    kind: 'group',
    x,
    y,
    scale: size / 100,
    children: [
      { kind: 'path', d: 'M50 8V20', stroke: 'momo', width: 4 },
      { kind: 'circle', cx: 50, cy: 8, r: 5, fill: 'momo' },
      { kind: 'rect', x: 16, y: 20, w: 68, h: 62, r: 18, fill: 'momo' },
      { kind: 'rect', x: 24, y: 28, w: 52, h: 46, r: 14, fill: 'paper' },
      { kind: 'circle', cx: 38, cy: 44, r: 4.5, fill: 'ink' },
      { kind: 'circle', cx: 62, cy: 44, r: 4.5, fill: 'ink' },
      { kind: 'path', d: 'M40 56Q50 67 60 56', stroke: 'ink', width: 3.5 },
      { kind: 'rect', x: 8, y: 46, w: 8, h: 16, r: 4, fill: 'momo' },
      { kind: 'rect', x: 84, y: 46, w: 8, h: 16, r: 4, fill: 'momo' },
    ],
  };
}

const CX = SHEET_W / 2;

/** Semua bentuk satu lembar sertifikat, berurutan dari belakang ke depan. */
export function sheetShapes(data: SheetData): Shape[] {
  const sample = data.number === null;
  const text = (s: Omit<TextShape, 'kind' | 'anchor'> & { anchor?: TextShape['anchor'] }) =>
    ({ kind: 'text', anchor: 'middle', ...s }) as TextShape;

  return [
    { kind: 'rect', x: 0, y: 0, w: SHEET_W, h: SHEET_H, fill: 'paper' },
    {
      kind: 'rect',
      x: 24,
      y: 24,
      w: SHEET_W - 48,
      h: SHEET_H - 48,
      r: 20,
      stroke: 'frame',
      width: 10,
    },
    {
      kind: 'rect',
      x: 44,
      y: 44,
      w: SHEET_W - 88,
      h: SHEET_H - 88,
      r: 12,
      stroke: 'deep',
      width: 2.5,
    },
    { kind: 'path', d: rebung(52, true), fill: 'soft', stroke: 'frame', width: 1.5 },
    { kind: 'path', d: rebung(SHEET_H - 52, false), fill: 'soft', stroke: 'frame', width: 1.5 },
    { kind: 'path', d: 'M44 383L58 397L44 411L30 397Z', fill: 'frame' },
    {
      kind: 'path',
      d: `M${SHEET_W - 44} 383L${SHEET_W - 30} 397L${SHEET_W - 44} 411L${SHEET_W - 58} 397Z`,
      fill: 'frame',
    },

    ...(sample
      ? [
          text({
            x: CX,
            y: 470,
            text: t('common.cert.sample'),
            size: 150,
            font: 'display',
            weight: 700,
            fill: 'frame',
            spacing: 12,
            rotate: -14,
            opacity: 0.16,
          }),
        ]
      : []),

    text({
      x: CX,
      y: 104,
      text: t('common.cert.kicker').toUpperCase(),
      size: 16,
      font: 'body',
      weight: 700,
      fill: 'accent',
      spacing: 4,
    }),
    text({
      x: CX,
      y: 176,
      text: t('common.cert.title'),
      size: 76,
      font: 'display',
      weight: 700,
      fill: 'ink',
      spacing: 8,
    }),
    text({
      x: CX,
      y: 214,
      text: t('common.cert.subtitle'),
      size: 28,
      font: 'display',
      weight: 700,
      fill: 'accent',
      spacing: 10,
    }),
    text({
      x: CX,
      y: 262,
      text: t('common.cert.given'),
      size: 22,
      font: 'body',
      weight: 400,
      fill: 'muted',
    }),
    text({
      x: CX,
      y: 336,
      text: data.childName,
      size: fitSize(data.childName, 72, 700),
      font: 'display',
      weight: 700,
      fill: 'ink',
      maxWidth: 720,
    }),
    { kind: 'path', d: `M${CX - 230} 356H${CX + 230}`, stroke: 'frame', width: 3 },
    text({
      x: CX,
      y: 400,
      text: t('common.cert.for', { levels: data.levels }),
      size: 21,
      font: 'body',
      weight: 400,
      fill: 'muted',
      maxWidth: 900,
    }),
    text({
      x: CX,
      y: 428,
      text: t('common.cert.in', { topics: data.topics }),
      size: 21,
      font: 'body',
      weight: 400,
      fill: 'muted',
    }),
    text({
      x: CX,
      y: 482,
      text: data.bookTitle,
      size: fitSize(data.bookTitle, 46, 760),
      font: 'display',
      weight: 700,
      fill: 'accent',
      maxWidth: 800,
    }),

    // Tanda tangan kiri: Momo, teman belajar.
    momo(CX - 316 - 32, 538, 64),
    { kind: 'path', d: `M${CX - 401} 612H${CX - 231}`, stroke: 'muted', width: 1.5 },
    text({
      x: CX - 316,
      y: 642,
      text: t('common.cert.signMomo'),
      size: 24,
      font: 'display',
      weight: 700,
      fill: 'ink',
    }),
    text({
      x: CX - 316,
      y: 666,
      text: t('common.cert.signMomoRole'),
      size: 16,
      font: 'body',
      weight: 400,
      fill: 'muted',
    }),

    // Stempel di tengah.
    {
      kind: 'path',
      d: `M${CX - 33} 636L${CX - 55} 704L${CX - 37} 696L${CX - 27} 712L${CX - 9} 650Z`,
      fill: 'ribbon',
    },
    {
      kind: 'path',
      d: `M${CX + 33} 636L${CX + 55} 704L${CX + 37} 696L${CX + 27} 712L${CX + 9} 650Z`,
      fill: 'ribbon',
    },
    { kind: 'circle', cx: CX, cy: 600, r: 58, fill: 'frame' },
    { kind: 'circle', cx: CX, cy: 600, r: 49, stroke: 'paper', width: 2, dash: 4 },
    { kind: 'path', d: starPath(CX, 590, 24, 10), fill: 'paper' },
    text({
      x: CX,
      y: 630,
      text: t('common.cert.seal'),
      size: 15,
      font: 'body',
      weight: 700,
      fill: 'paper',
      spacing: 3,
    }),

    // Tanda tangan kanan: tim pengelola.
    {
      kind: 'path',
      d: `M${CX + 247} 598c14-26 30-30 36-8s-4 22 10 6 22-26 30-6 4 14 18 2 16-12 24-4`,
      stroke: 'deep',
      width: 3,
    },
    { kind: 'path', d: `M${CX + 232} 612H${CX + 402}`, stroke: 'muted', width: 1.5 },
    text({
      x: CX + 317,
      y: 642,
      text: t('common.cert.signTeam'),
      size: 24,
      font: 'display',
      weight: 700,
      fill: 'ink',
    }),
    text({
      x: CX + 317,
      y: 666,
      text: t('common.cert.signTeamRole'),
      size: 16,
      font: 'body',
      weight: 400,
      fill: 'muted',
    }),

    text({
      x: 80,
      y: 712,
      anchor: 'start',
      text: data.issuedAt
        ? t('common.cert.date', { date: formatDate(data.issuedAt) })
        : t('common.cert.sampleDate'),
      size: 15,
      font: 'body',
      weight: 400,
      fill: 'muted',
    }),
    text({
      x: SHEET_W - 80,
      y: 712,
      anchor: 'end',
      text: data.number
        ? t('common.cert.number', { number: data.number })
        : t('common.cert.sampleNumber'),
      size: 15,
      font: 'body',
      weight: 700,
      fill: 'ink',
      spacing: 1,
    }),
  ];
}

/** Keterangan lembar untuk pembaca layar. */
export function sheetLabel(data: SheetData): string {
  const base = t('common.cert.alt', { name: data.childName, book: data.bookTitle });
  return data.number && data.issuedAt
    ? `${base}, ${t('common.cert.altNumber', { number: data.number, date: formatDate(data.issuedAt) })}`
    : base;
}

/** Nama berkas unduhan/cetak, mis. "Sertifikat-Ayu-Matematika-Kelas-1". */
export const certificateFileName = (data: SheetData) =>
  t('common.cert.file', { name: data.childName, book: data.bookTitle })
    .replace(/[^A-Za-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

// ---- Kanvas (unduh PNG) ----

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Menggambar daftar bentuk di kanvas dengan warna token yang berlaku di halaman. */
export function drawShapes(
  ctx: CanvasRenderingContext2D,
  shapes: Shape[],
  palette: Record<Ink, string>,
) {
  const css = getComputedStyle(document.documentElement);
  const color = (ink: Ink) => css.getPropertyValue(palette[ink]).trim() || 'black';
  const family = (f: TextShape['font']) =>
    css.getPropertyValue(f === 'display' ? '--font-display' : '--font-body').trim() || 'sans-serif';

  const paint = (s: Paint, path?: Path2D) => {
    if (s.opacity !== undefined) ctx.globalAlpha = s.opacity;
    if (s.fill) {
      ctx.fillStyle = color(s.fill);
      if (path) ctx.fill(path);
      else ctx.fill();
    }
    if (s.stroke) {
      ctx.strokeStyle = color(s.stroke);
      ctx.lineWidth = s.width ?? 1;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      if (s.dash) ctx.setLineDash([s.dash, s.dash + 1]);
      if (path) ctx.stroke(path);
      else ctx.stroke();
    }
  };

  const draw = (s: Shape) => {
    ctx.save();
    switch (s.kind) {
      case 'rect':
        roundRect(ctx, s.x, s.y, s.w, s.h, s.r ?? 0);
        paint(s);
        break;
      case 'circle':
        ctx.beginPath();
        ctx.arc(s.cx, s.cy, s.r, 0, Math.PI * 2);
        paint(s);
        break;
      case 'path':
        paint(s, new Path2D(s.d));
        break;
      case 'text': {
        ctx.font = `${s.weight} ${s.size}px ${family(s.font)}`;
        ctx.textAlign = s.anchor === 'start' ? 'left' : s.anchor === 'end' ? 'right' : 'center';
        if (s.spacing && 'letterSpacing' in ctx) ctx.letterSpacing = `${s.spacing}px`;
        ctx.fillStyle = color(s.fill);
        if (s.opacity !== undefined) ctx.globalAlpha = s.opacity;
        ctx.translate(s.x, s.y);
        if (s.rotate) ctx.rotate((s.rotate * Math.PI) / 180);
        if (s.maxWidth) ctx.fillText(s.text, 0, 0, s.maxWidth);
        else ctx.fillText(s.text, 0, 0);
        break;
      }
      case 'group':
        ctx.translate(s.x, s.y);
        ctx.scale(s.scale, s.scale);
        s.children.forEach(draw);
        break;
    }
    ctx.restore();
  };
  shapes.forEach(draw);
}

/** Mengunduh lembar sebagai PNG (2 kali ukuran A4 96 dpi, cukup tajam untuk dicetak atau dibagikan). */
export async function downloadCertificateImage(data: SheetData): Promise<void> {
  const scale = 2;
  const canvas = document.createElement('canvas');
  canvas.width = SHEET_W * scale;
  canvas.height = SHEET_H * scale;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Kanvas tidak tersedia.');

  // Huruf halaman (Baloo 2 dan Andika) dimuat dulu agar kanvas tidak memakai huruf cadangan.
  const css = getComputedStyle(document.documentElement);
  const display = css.getPropertyValue('--font-display').trim() || 'sans-serif';
  const body = css.getPropertyValue('--font-body').trim() || 'sans-serif';
  await Promise.all(
    [`700 72px ${display}`, `400 22px ${body}`, `700 16px ${body}`].map((f) =>
      document.fonts?.load(f).catch(() => []),
    ),
  );

  ctx.scale(scale, scale);
  drawShapes(ctx, sheetShapes(data), PALETTES[data.design]);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
  if (!blob) throw new Error('Gambar belum bisa dibuat.');

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${certificateFileName(data)}.png`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/**
 * Membuka dialog cetak hanya untuk lembar sertifikat (pilih "Simpan sebagai PDF" untuk berkas PDF). Lembar cetak
 * dipasang `CertificatePrint`; judul dokumen sementara diganti agar nama berkas PDF rapi.
 */
export function printCertificate(data: SheetData): void {
  const before = document.title;
  document.title = certificateFileName(data);
  document.body.classList.add('cert-printing');
  const done = () => {
    document.body.classList.remove('cert-printing');
    document.title = before;
    window.removeEventListener('afterprint', done);
  };
  window.addEventListener('afterprint', done);
  try {
    window.print();
  } catch {
    done();
  }
}
