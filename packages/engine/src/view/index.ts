import { z } from 'zod';
import { PIN_PICTURES, type PinPicture } from '../pin.js';
import { MOMO_COLORS, type MomoColor } from '../schemas/domain.js';
import type { Role } from '../schemas/domain.js';

// Kontrak data untuk halaman area orang tua dan beranda publik: tipe, label, dan skema formulir.

export type Color = MomoColor;

/** Nama warna untuk dibacakan dan ditampilkan. */
export const SAY_COLOR: Record<Color, string> = {
  blue: 'Biru',
  green: 'Hijau',
  yellow: 'Kuning',
  orange: 'Oranye',
  pink: 'Merah muda',
  teal: 'Hijau tosca',
};

/** Hiasan Momo tambahan. Belum dipakai: bentuknya dibiarkan longgar. */
export type MomoLook = Record<string, unknown>;

export const MAX_CHILDREN_PER_PARENT = 3;

/** Nama gambar sandi, sebagaimana diucapkan. */
export const OBJECTS: Record<PinPicture, { say: string }> = {
  apple: { say: 'apel' },
  star: { say: 'bintang' },
  fish: { say: 'ikan' },
  flower: { say: 'bunga' },
  ball: { say: 'bola' },
  cat: { say: 'kucing' },
  house: { say: 'rumah' },
  cloud: { say: 'awan' },
  leaf: { say: 'daun' },
};

export type SessionUser = { id: string; role: Role; name: string };

// ---- Skema formulir ----

const nickname = z
  .string()
  .trim()
  .min(2, 'nama panggilan minimal 2 huruf')
  .max(20, 'nama panggilan maksimal 20 huruf');
const pin = z.array(z.enum(PIN_PICTURES)).length(3, 'sandi gambar harus 3 gambar');
const classCode = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z0-9]{6}$/, 'kode kelas terdiri dari 6 huruf atau angka');

export const childProfileSchema = z.object({
  nickname,
  momoColor: z.enum(MOMO_COLORS),
  momoLook: z.record(z.string(), z.unknown()).nullable().optional(),
  pin,
  classCode: classCode.optional(),
});
export type ChildProfileInput = z.infer<typeof childProfileSchema>;

export const childUpdateSchema = z.object({
  nickname: nickname.optional(),
  momoColor: z.enum(MOMO_COLORS).optional(),
  momoLook: z.record(z.string(), z.unknown()).nullable().optional(),
  pin: pin.optional(),
  classCode: classCode.nullable().optional(),
});

export const parentProfileSchema = z.object({
  name: z.string().trim().min(1, 'nama wajib diisi').max(60, 'nama maksimal 60 huruf'),
});

export const emailChangeRequestSchema = z.object({
  email: z.string().trim().toLowerCase().max(254).pipe(z.email('email belum benar')),
  currentPassword: z.string().min(1, 'password saat ini wajib diisi'),
});

export const emailChangeConfirmSchema = z.object({
  code: z.string().regex(/^\d{6}$/, 'kode terdiri dari 6 angka'),
});

export const passwordChangeSchema = z.object({
  currentPassword: z.string().min(1, 'password saat ini wajib diisi'),
  password: z.string().min(8, 'password minimal 8 karakter').max(128),
});

// ---- Paket ----

export type Pricing = {
  normal: number;
  final: number;
  discount: number;
  discountActive: boolean;
};

export type PlanStatus = {
  tier: 'free' | 'books' | 'premium';
  /** `null` = selamanya (atau gratis). */
  endsAt: string | null;
  source: 'admin' | 'purchase' | null;
};

export type Access = {
  tier: PlanStatus['tier'];
  endsAt: string | null;
};

// ---- Ringkasan belajar ----

export type DayActivity = { date: string; rounds: number; passed: number; minutes: number };

export type ChildInsights = {
  totals: { points: number; passed: number; played: number; answered: number; timeMs: number };
  /** 7 hari terakhir, yang terbaru di akhir. */
  week: DayActivity[];
  weekRounds: number;
  weekPassed: number;
  weekMinutes: number;
  activeDays: number;
  trend: { now: number; before: number | null } | null;
  next: { level: number; topic: string; book: string; paid: boolean } | null;
  strength: { topic: string; best: number | null } | null;
  focus: {
    topic: string;
    level: number | null;
    best: number | null;
    attempts: number | null;
  } | null;
  books: {
    domain: string;
    grade: string;
    title: string;
    percent: number;
    passed: number;
    levels: number;
  }[];
  recent: {
    skillId: string;
    ts: number;
    score: number;
    passed: boolean;
    level: number;
    title: string;
    book: string;
    durationMs: number | null;
  }[];
};

// ---- Format ----

const pad = (n: number) => String(n).padStart(2, '0');

/** "02:45" */
export function formatClock(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  return `${pad(Math.floor(total / 60))}:${pad(total % 60)}`;
}

/** "1 j 5 mnt", "12 mnt", "40 dtk" */
export function durationShort(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  if (h > 0) return m > 0 ? `${h} j ${m} mnt` : `${h} j`;
  if (m > 0) return `${m} mnt`;
  return `${total} dtk`;
}

/** "1 jam 5 menit", "12 menit", "40 detik" */
export function durationWords(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  if (h > 0) return m > 0 ? `${h} jam ${m} menit` : `${h} jam`;
  if (m > 0) return `${m} menit`;
  return `${total} detik`;
}

/** Rata-rata skor dengan satu desimal, mis. "86,5". */
export const formatAverage = (n: number): string =>
  n.toLocaleString('id-ID', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

export const LEADERBOARD_TOP = 10;

export const GRADES = ['sd1'] as const;
export const GRADE_LABEL: Record<(typeof GRADES)[number], string> = { sd1: 'Kelas 1' };

export const PROOF_MAX_BYTES = 3 * 1024 * 1024;
