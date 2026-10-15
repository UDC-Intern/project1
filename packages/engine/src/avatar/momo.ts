import { z } from 'zod';

/**
 * Tampilan Momo (D-051, diperluas D-102): warna utama (`momoColor`, 6 warna lama) atau warna sendiri (`body`,
 * kode hex), gradasi ke warna kedua, model karakter, pola badan, aksesori kepala, dan pernak-pernik.
 * Ini tampilan robot Momo — bukan data pribadi anak. Semua pilihan tersedia untuk semua anak, tanpa label
 * laki-laki/perempuan (tidak ada data gender atau agama yang disimpan, PRD A17).
 */

/** Palet warna gradasi dan aksesori: hex kontras cukup dengan garis gelap #2b2540. */
export const MOMO_TONES = {
  merah: '#ef6f6c',
  oranye: '#f79a4a',
  kuning: '#f7c948',
  hijau: '#46b97a',
  toska: '#2bb5a8',
  biru: '#4f8ff7',
  ungu: '#8a6cf0',
  merahmuda: '#f58fc0',
  cokelat: '#a8714a',
  abu: '#9aa3b5',
  hitam: '#3b3550',
  putih: '#fdfaf3',
} as const;
export type MomoTone = keyof typeof MOMO_TONES;
export const MOMO_TONE_IDS = Object.keys(MOMO_TONES) as [MomoTone, ...MomoTone[]];

/** Aksesori kepala. Tanpa label laki-laki/perempuan: semua untuk semua anak (D-051, D-104). */
export const MOMO_ACCESSORIES = [
  'none',
  'rambut-cepak',
  'rambut-jabrik',
  'rambut-belah',
  'rambut-mohawk',
  'rambut-gelombang',
  'rambut-poni',
  'rambut-keriting',
  'rambut-kuncir',
  'topi',
  'topi-terbalik',
  'bandana',
  'peci',
  'jilbab',
  'pita',
  'mahkota',
  'bunga',
] as const;
export type MomoAccessory = (typeof MOMO_ACCESSORIES)[number];

/**
 * Model karakter (D-102, D-113): bentuk kepala, telinga, dan antena. `udakids` = Momo UdaKids (antena gonjong, layar
 * wajah gelap, badan bergaris pucuk rebung) dan menjadi tampilan bawaan; `kotak` = Momo lama.
 */
export const MOMO_MODELS = [
  'udakids',
  'kotak',
  'bulat',
  'kucing',
  'kelinci',
  'beruang',
  'alien',
  'tv',
  'dino',
] as const;
export type MomoModel = (typeof MOMO_MODELS)[number];
/** Model bila anak belum memilih (D-113). */
export const DEFAULT_MOMO_MODEL: MomoModel = 'udakids';

/** Pola di badan (D-102). */
export const MOMO_PATTERNS = ['none', 'titik', 'garis', 'bintang', 'hati'] as const;
export type MomoPattern = (typeof MOMO_PATTERNS)[number];

/** Pernak-pernik di wajah/badan, bisa dipadukan dengan aksesori kepala (D-102). */
export const MOMO_EXTRAS = [
  'none',
  'kacamata',
  'kacamata-hitam',
  'dasi-kupu',
  'syal',
  'headphone',
  'pipi-bintang',
  'dasi',
  'medali',
] as const;
export type MomoExtra = (typeof MOMO_EXTRAS)[number];

/** Kode warna sendiri: "#" + 6 digit hex (huruf kecil). Ketat agar aman dipakai langsung di SVG. */
export const MOMO_HEX = /^#[0-9a-f]{6}$/;
const hexSchema = z.string().trim().toLowerCase().regex(MOMO_HEX);
/** Warna dari palet (nama) atau warna sendiri (hex). */
const toneOrHex = z.union([z.enum(MOMO_TONE_IDS), hexSchema]);

export const momoLookSchema = z.strictObject({
  /** Model karakter; kosong = Momo UdaKids (bawaan sejak D-113). */
  model: z.enum(MOMO_MODELS).optional(),
  /** Warna badan sendiri (hex); kosong = warna utama `momoColor`. */
  body: hexSchema.nullable().optional(),
  /** Warna kedua gradasi badan; kosong = warna polos. */
  gradient: toneOrHex.nullable().optional(),
  /** Pola di badan; kosong = polos. */
  pattern: z.enum(MOMO_PATTERNS).optional(),
  accessory: z.enum(MOMO_ACCESSORIES).default('none'),
  /** Warna aksesori; kosong = warna bawaan aksesori. */
  accessoryColor: toneOrHex.nullable().optional(),
  /** Pernak-pernik; kosong = tidak ada. */
  extra: z.enum(MOMO_EXTRAS).optional(),
  /** Warna pernak-pernik; kosong = warna bawaan. */
  extraColor: toneOrHex.nullable().optional(),
});
export type MomoLook = z.infer<typeof momoLookSchema>;

/** Nama palet atau kode hex → hex; selain itu `undefined`. */
export function momoHex(v: string | null | undefined): string | undefined {
  if (!v) return undefined;
  if (v in MOMO_TONES) return MOMO_TONES[v as MomoTone];
  return MOMO_HEX.test(v) ? v : undefined;
}

/** Warna bawaan tiap aksesori. */
export const ACCESSORY_DEFAULT_TONE: Record<MomoAccessory, MomoTone> = {
  none: 'hitam',
  'rambut-poni': 'hitam',
  'rambut-kuncir': 'cokelat',
  'rambut-keriting': 'hitam',
  topi: 'biru',
  peci: 'hitam',
  jilbab: 'merahmuda',
  pita: 'merah',
  mahkota: 'kuning',
  bunga: 'merahmuda',
  'rambut-cepak': 'hitam',
  'rambut-jabrik': 'hitam',
  'rambut-belah': 'cokelat',
  'rambut-mohawk': 'hitam',
  'rambut-gelombang': 'cokelat',
  'topi-terbalik': 'merah',
  bandana: 'merah',
};

/** Warna bawaan tiap pernak-pernik. */
export const EXTRA_DEFAULT_TONE: Record<MomoExtra, MomoTone> = {
  none: 'hitam',
  kacamata: 'hitam',
  'kacamata-hitam': 'hitam',
  'dasi-kupu': 'merah',
  syal: 'oranye',
  headphone: 'abu',
  'pipi-bintang': 'kuning',
  dasi: 'biru',
  medali: 'kuning',
};

/** Data lama/rusak → tampilan polos (tidak pernah melempar error saat membaca dari DB). */
export function parseMomoLook(v: unknown): MomoLook | null {
  if (v == null) return null;
  const r = momoLookSchema.safeParse(v);
  return r.success ? r.data : null;
}
