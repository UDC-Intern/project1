import { z } from 'zod';
import { MOMO_COLORS } from './domain.js';

/**
 * Ilustrasi AI di panel admin (menu Media & Audio). Admin menulis permintaan; hasilnya masuk antrean tinjau dan baru
 * tampil di Galeri setelah disetujui. Mode tiruan menyusun gambar dari pustaka bentuk sendiri; dengan server,
 * permintaan yang sama dikirim ke model gambar.
 */

export const ILLUSTRATION_KINDS = ['object', 'scene', 'character'] as const;
export type IllustrationKind = (typeof ILLUSTRATION_KINDS)[number];

/** Latar ilustrasi: langit dan rumput, ruang kelas, atau polos (untuk ditempel di soal). */
export const ILLUSTRATION_THEMES = ['outdoor', 'classroom', 'plain'] as const;
export type IllustrationTheme = (typeof ILLUSTRATION_THEMES)[number];

export const ILLUSTRATION_STATUSES = ['review', 'approved', 'rejected'] as const;
export type IllustrationStatus = (typeof ILLUSTRATION_STATUSES)[number];

export const illustrationRequestSchema = z.strictObject({
  kind: z.enum(ILLUSTRATION_KINDS),
  /** Apa yang digambar, mis. "apel merah" atau "anak menanam pohon". */
  subject: z.string().trim().min(2).max(60),
  theme: z.enum(ILLUSTRATION_THEMES),
  /** Banyak benda di gambar (dipakai untuk soal hitung). */
  count: z.number().int().min(1).max(12),
  withMomo: z.boolean(),
  momoColor: z.enum(MOMO_COLORS),
  /** Varian ke berapa; permintaan sama dengan varian lain menghasilkan susunan lain. */
  variant: z.number().int().min(1).max(12),
});
export type IllustrationRequest = z.infer<typeof illustrationRequestSchema>;

export const illustrationSchema = illustrationRequestSchema.extend({
  id: z.string(),
  status: z.enum(ILLUSTRATION_STATUSES),
  /** Mesin yang membuat gambar, mis. "pustaka bentuk (tiruan)". */
  engine: z.string(),
  createdBy: z.string(),
  createdAt: z.string(),
  reviewedAt: z.string().nullable(),
  /** Alamat gambar server; kosong bila permintaan memakai pustaka bentuk. */
  imageUrl: z.string().nullable().optional(),
});
export type Illustration = z.infer<typeof illustrationSchema>;
