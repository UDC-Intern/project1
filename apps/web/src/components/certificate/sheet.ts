import type { Certificate, CertificateDesign, CertificateSettings } from '@udakids/engine';
import { encode } from 'uqr';
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
  | 'paper'
  | 'ink'
  | 'muted'
  | 'frame'
  | 'deep'
  | 'accent'
  | 'soft'
  | 'ribbon'
  | 'gold'
  | 'goldDeep'
  | 'goldSoft'
  | 'goldText';

const COMMON = {
  paper: '--kertas',
  ink: '--malam',
  muted: '--malam-muted',
  // Stempel digital selalu emas, apa pun desain lembarnya.
  gold: '--kunyit',
  goldDeep: '--kunyit-tekan',
  goldSoft: '--kunyit-soft',
  goldText: '--kunyit-teks',
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
  | { kind: 'image'; href: string; x: number; y: number; w: number; h: number; opacity?: number }
  | TextShape
  | { kind: 'group'; x: number; y: number; scale: number; children: Shape[] };

/** Isi lembar. `number` null berarti contoh (belum terbit). Teks tetap lembar dari Pengaturan admin. */
export type SheetData = {
  childName: string;
  bookTitle: string;
  levels: number;
  topics: number;
  design: CertificateDesign;
  number: string | null;
  issuedAt: string | null;
  averageScore?: number | null;
  settings: CertificateSettings;
  /** Alamat halaman cek keaslian untuk kode QR; null berarti tanpa QR. */
  verifyUrl?: string | null;
};

/** Alamat halaman cek keaslian sertifikat di domain yang sedang dipakai. */
export const verifyUrlOf = (id: string) =>
  `${typeof window !== 'undefined' ? window.location.origin : ''}/sertifikat/cek/${encodeURIComponent(id)}`;

export const sheetDataOf = (c: Certificate, settings: CertificateSettings): SheetData => ({
  childName: c.childName,
  bookTitle: c.bookTitle,
  levels: c.levels,
  topics: c.topics,
  design: c.design,
  number: c.id,
  issuedAt: c.issuedAt,
  averageScore: c.averageScore ?? null,
  settings,
  verifyUrl: settings.showQr ? verifyUrlOf(c.id) : null,
});

/**
 * Kotak modul QR sebagai satu path: modul gelap yang berderet dalam satu baris digabung menjadi satu persegi
 * panjang, supaya tidak ada garis tipis di antara modul saat dicetak atau digambar ulang.
 */
export function qrPath(text: string, x: number, y: number, size: number): string {
  const { data } = encode(text, { ecc: 'M', border: 0 });
  const n = data.length;
  const m = size / n;
  const f = (v: number) => Number(v.toFixed(2));
  let d = '';
  data.forEach((row, r) => {
    for (let c = 0; c < n; c++) {
      if (!row[c]) continue;
      let end = c;
      while (end + 1 < n && row[end + 1]) end++;
      d += `M${f(x + c * m)} ${f(y + r * m)}h${f((end - c + 1) * m)}v${f(m)}h${f(-(end - c + 1) * m)}z`;
      c = end;
    }
  });
  return d;
}

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

/** Segel bergerigi: `teeth` ujung, bergantian antara jari-jari luar dan dalam. */
export function scallopPath(
  cx: number,
  cy: number,
  outer: number,
  inner: number,
  teeth: number,
): string {
  let d = '';
  for (let i = 0; i < teeth * 2; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = (i * Math.PI) / teeth - Math.PI / 2;
    d += `${i === 0 ? 'M' : 'L'}${(cx + r * Math.cos(a)).toFixed(1)} ${(cy + r * Math.sin(a)).toFixed(1)}`;
  }
  return `${d}Z`;
}

/** Jari-jari segel (px) di lembar, dipakai untuk menempatkannya di samping tanda tangan. */
export const SEAL_RADIUS = 56;

/** Stempel digital resmi: segel emas bergerigi dengan bintang, nama penerbit, dan dua pita di bawahnya. */
function seal(cx: number, cy: number, issuer: string, label: string): Shape[] {
  const tail = (side: 1 | -1): Shape => ({
    kind: 'path',
    d: `M${cx + side * 30} ${cy + 40}L${cx + side * 50} ${cy + 100}L${cx + side * 33} ${cy + 93}L${cx + side * 24} ${cy + 108}L${cx + side * 6} ${cy + 48}Z`,
    fill: 'ribbon',
  });
  return [
    tail(-1),
    tail(1),
    {
      kind: 'path',
      d: scallopPath(cx, cy, SEAL_RADIUS, SEAL_RADIUS - 5, 28),
      fill: 'gold',
      stroke: 'goldDeep',
      width: 2,
    },
    { kind: 'circle', cx, cy, r: 46, stroke: 'paper', width: 2.5 },
    { kind: 'circle', cx, cy, r: 41, fill: 'goldSoft', stroke: 'goldDeep', width: 1.5 },
    { kind: 'path', d: starPath(cx, cy - 13, 14, 6), fill: 'goldDeep' },
    {
      kind: 'text',
      x: cx,
      y: cy + 11,
      text: issuer.toUpperCase(),
      size: 11,
      font: 'body',
      weight: 700,
      fill: 'goldText',
      anchor: 'middle',
      spacing: 1,
      maxWidth: 58,
    },
    {
      kind: 'text',
      x: cx,
      y: cy + 26,
      text: label,
      size: 10,
      font: 'body',
      weight: 700,
      fill: 'goldText',
      anchor: 'middle',
      spacing: 2,
      maxWidth: 52,
    },
  ];
}

const CX = SHEET_W / 2;

/** Ukuran tempat gambar tanda tangan (sama dengan perbandingan kanvas tulis 350 × 120). */
export const SIGNATURE_W = 200;
export const SIGNATURE_H = 72;
/** Jarak mendatar dari tengah tanda tangan ke tengah segel. */
const SEAL_GAP = 160;

/** Semua bentuk satu lembar sertifikat, berurutan dari belakang ke depan. */
export function sheetShapes(data: SheetData): Shape[] {
  const s = data.settings;
  // Gambar tanda tangan hanya dipakai bila jenisnya bukan bawaan; kosong berarti goresan bawaan.
  const signature = s.signatureType !== 'default' ? s.signatureImage : '';
  const sample = data.number === null;
  const qr = !sample && !!data.verifyUrl;
  const text = (x: Omit<TextShape, 'kind' | 'anchor'> & { anchor?: TextShape['anchor'] }) =>
    ({ kind: 'text', anchor: 'middle', ...x }) as TextShape;
  const kicker = [s.issuer, s.tagline].filter(Boolean).join(' · ').toUpperCase();
  const detail = [
    s.curriculum,
    s.showScore && data.averageScore != null
      ? t('common.cert.score', { score: data.averageScore })
      : '',
  ]
    .filter(Boolean)
    .join(' · ');
  // Dengan QR di pojok kanan, tanda tangan kanan digeser sedikit ke kiri.
  const right = qr ? CX + 290 : CX + 317;
  const QR_SIZE = 76;
  const qrX = SHEET_W - 80 - QR_SIZE;
  const qrY = 590;

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
      text: kicker,
      size: 16,
      font: 'body',
      weight: 700,
      fill: 'accent',
      spacing: 4,
      maxWidth: 820,
    }),
    text({
      x: CX,
      y: 176,
      text: s.title,
      size: fitSize(s.title, 76, 760),
      font: 'display',
      weight: 700,
      fill: 'ink',
      spacing: 8,
      maxWidth: 820,
    }),
    ...(s.subtitle
      ? [
          text({
            x: CX,
            y: 214,
            text: s.subtitle,
            size: 28,
            font: 'display',
            weight: 700,
            fill: 'accent',
            spacing: 10,
            maxWidth: 820,
          }),
        ]
      : []),
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
    ...(detail
      ? [
          text({
            x: CX,
            y: 516,
            text: detail,
            size: 17,
            font: 'body',
            weight: 700,
            fill: 'muted',
            maxWidth: 560,
          }),
        ]
      : []),

    // Tanda tangan penyelenggara di kanan bawah: gambar (coretan atau unggahan) atau goresan bawaan.
    ...(signature
      ? [
          {
            kind: 'image' as const,
            href: signature,
            x: right - SIGNATURE_W / 2,
            y: 536,
            w: SIGNATURE_W,
            h: SIGNATURE_H,
          },
        ]
      : [
          {
            kind: 'path' as const,
            d: `M${right - 70} 598c14-26 30-30 36-8s-4 22 10 6 22-26 30-6 4 14 18 2 16-12 24-4`,
            stroke: 'deep' as const,
            width: 3,
          },
        ]),
    {
      kind: 'path' as const,
      d: `M${right - 95} 612H${right + 95}`,
      stroke: 'muted' as const,
      width: 1.5,
    },
    text({
      x: right,
      y: 642,
      text: s.signer2Name,
      size: 24,
      font: 'display',
      weight: 700,
      fill: 'ink',
      maxWidth: 230,
    }),
    ...(s.signer2Role
      ? [
          text({
            x: right,
            y: 666,
            text: s.signer2Role,
            size: 16,
            font: 'body',
            weight: 400,
            fill: 'muted',
            maxWidth: 230,
          }),
        ]
      : []),

    // Stempel digital resmi (opsional) di samping kiri tanda tangan.
    ...(s.showStamp ? seal(right - SEAL_GAP, 594, s.issuer, t('common.cert.seal')) : []),

    // Kode QR menuju halaman cek keaslian.
    ...(qr
      ? [
          {
            kind: 'rect',
            x: qrX - 4,
            y: qrY - 4,
            w: QR_SIZE + 8,
            h: QR_SIZE + 8,
            r: 4,
            fill: 'paper',
            stroke: 'soft',
            width: 1.5,
          } satisfies Shape,
          {
            kind: 'path',
            d: qrPath(data.verifyUrl!, qrX, qrY, QR_SIZE),
            fill: 'ink',
          } satisfies Shape,
          text({
            x: qrX + QR_SIZE / 2,
            y: qrY + QR_SIZE + 18,
            text: t('common.cert.qr'),
            size: 12,
            font: 'body',
            weight: 700,
            fill: 'muted',
          }),
        ]
      : []),

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
  const issued =
    data.number && data.issuedAt
      ? `, ${t('common.cert.altNumber', { number: data.number, date: formatDate(data.issuedAt) })}`
      : '';
  const qr = data.number && data.verifyUrl ? `, ${t('common.cert.altQr')}` : '';
  return `${base}${issued}${qr}`;
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

/** Memuat satu gambar (Data URL) sampai siap digambar di kanvas; gagal berarti gambar dilewati. */
export function loadImage(href: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = href;
  });
}

/** Menggambar daftar bentuk di kanvas dengan warna token yang berlaku di halaman. `images`: gambar yang sudah dimuat. */
export function drawShapes(
  ctx: CanvasRenderingContext2D,
  shapes: Shape[],
  palette: Record<Ink, string>,
  images: ReadonlyMap<string, CanvasImageSource> = new Map(),
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
      case 'image': {
        const img = images.get(s.href);
        if (!img) break;
        if (s.opacity !== undefined) ctx.globalAlpha = s.opacity;
        // Muat di dalam kotak tanpa mengubah perbandingan, rata di tengah dan bawah (di atas garis tanda tangan).
        const natural = img as { width: number; height: number };
        const scale = Math.min(s.w / natural.width, s.h / natural.height);
        const w = natural.width * scale;
        const h = natural.height * scale;
        ctx.drawImage(img, s.x + (s.w - w) / 2, s.y + (s.h - h) / 2, w, h);
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

  const shapes = sheetShapes(data);
  // Gambar (mis. tanda tangan) harus selesai dimuat sebelum digambar; kalau tidak, kanvas menggambarnya kosong.
  const images = new Map<string, CanvasImageSource>();
  const hrefs = [...new Set(shapes.flatMap((sh) => (sh.kind === 'image' ? [sh.href] : [])))];
  await Promise.all(
    hrefs.map(async (href) => {
      const img = await loadImage(href);
      if (img) images.set(href, img);
    }),
  );

  ctx.scale(scale, scale);
  drawShapes(ctx, shapes, PALETTES[data.design], images);
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
