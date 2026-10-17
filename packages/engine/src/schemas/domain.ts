import { z } from 'zod';
import { PIN_PICTURES } from '../pin.js';

export const MOMO_COLORS = ['blue', 'green', 'yellow', 'orange', 'pink', 'teal'] as const;
export const momoColorSchema = z.enum(MOMO_COLORS);
export type MomoColor = z.infer<typeof momoColorSchema>;

export const pinPictureSchema = z.enum(PIN_PICTURES);
export const pinSchema = z.tuple([pinPictureSchema, pinPictureSchema, pinPictureSchema]);

export const roleSchema = z.enum(['admin', 'parent', 'child']);
export type Role = z.infer<typeof roleSchema>;

export const questionTypeSchema = z.enum(['choice', 'number', 'true_false']);
export type QuestionType = z.infer<typeof questionTypeSchema>;

export const questionStatusSchema = z.enum(['draft', 'active', 'archived']);
export type QuestionStatus = z.infer<typeof questionStatusSchema>;

export const questionSourceSchema = z.enum(['manual', 'ai', 'seed']);
export type QuestionSource = z.infer<typeof questionSourceSchema>;

export const levelStatusSchema = z.enum(['passed', 'open', 'locked', 'premium', 'soon']);
export type LevelStatus = z.infer<typeof levelStatusSchema>;

export const masteryStatusSchema = z.enum(['learning', 'proficient', 'mastered']);
export type MasteryStatus = z.infer<typeof masteryStatusSchema>;

export const stageSchema = z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]);
export type Stage = z.infer<typeof stageSchema>;

export const COUNT_ITEMS = ['apple', 'ball', 'star', 'fish', 'leaf', 'book'] as const;
export type CountItem = (typeof COUNT_ITEMS)[number];

/** Paling banyak benda dalam satu kelompok, dan paling banyak seluruh benda dalam satu gambar soal. */
export const VISUAL_COUNT_MAX = 30;
export const VISUAL_GROUPS_MAX = 3;
/** Panjang paling banyak Data URL gambar soal (unggahan admin atau gambar dari galeri). */
export const VISUAL_IMAGE_MAX = 300_000;

/**
 * Alamat gambar soal yang dikenal: Data URL PNG, JPG, WebP, atau SVG (SVG hanya tampil lewat <img>, jadi tidak
 * menjalankan skrip), alamat http(s), atau alamat dari akar situs ("/aset/apel.png").
 */
export const isQuestionImageUrl = (v: string): boolean =>
  /^data:image\/(png|jpeg|webp|svg\+xml);base64,[A-Za-z0-9+/]+={0,2}$/.test(v) ||
  /^https?:\/\/\S+$/i.test(v) ||
  /^\/(?!\/)\S*$/.test(v);

const groupSize = z.number().int().min(1).max(VISUAL_COUNT_MAX);

/** Gambar benda hitung: satu benda yang digandakan sebanyak `count`, atau beberapa kelompok (`groups`). */
export const objectsVisualSchema = z
  .object({
    kind: z.literal('objects').optional(),
    item: z.enum(COUNT_ITEMS),
    count: groupSize.optional(),
    groups: z.array(groupSize).min(1).max(VISUAL_GROUPS_MAX).optional(),
  })
  .refine(
    (v) => (v.groups ?? [v.count ?? 0]).reduce((a, b) => a + b, 0) <= VISUAL_COUNT_MAX,
    `Seluruh benda paling banyak ${VISUAL_COUNT_MAX}.`,
  );

/** Gambar utuh dari galeri aset, ilustrasi AI, atau unggahan admin. `label` menjadi teks alternatif gambar. */
export const imageVisualSchema = z.object({
  kind: z.literal('image'),
  url: z
    .string()
    .min(1, 'Alamat gambar kosong.')
    .max(VISUAL_IMAGE_MAX, 'Gambar terlalu besar.')
    .refine(isQuestionImageUrl, 'Gambar harus berupa PNG, JPG, WebP, atau SVG.'),
  label: z.string().trim().max(80, 'Keterangan gambar maksimal 80 huruf.').optional(),
});

export const visualSchema = z.union([objectsVisualSchema, imageVisualSchema]).nullable();
export type ObjectsVisual = z.infer<typeof objectsVisualSchema>;
export type ImageVisual = z.infer<typeof imageVisualSchema>;
export type Visual = z.infer<typeof visualSchema>;

/** Banyak benda pada gambar benda hitung (jumlah semua kelompok). */
export const objectsTotal = (v: Pick<ObjectsVisual, 'count' | 'groups'>): number =>
  (v.groups ?? [v.count ?? 0]).reduce((a, b) => a + b, 0);

export const nicknameSchema = z.string().trim().min(2).max(20);
export const emailSchema = z.string().trim().toLowerCase().max(254).pipe(z.email());
export const passwordSchema = z.string().min(8).max(128);
