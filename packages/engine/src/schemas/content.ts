import { z } from 'zod';
import { FORBIDDEN_WORDS } from '../content/validate-question.js';

/** Materi dan tips: boleh berkalimat lebih panjang, tetapi tidak memakai kata yang dihindari untuk anak. */
const lessonText = (max: number) =>
  z
    .string()
    .trim()
    .min(1)
    .max(max)
    .superRefine((text, ctx) => {
      for (const w of FORBIDDEN_WORDS)
        if (new RegExp(String.raw`(^|[^\p{L}])${w}([^\p{L}]|$)`, 'iu').test(text))
          ctx.addIssue({ code: 'custom', message: `Memakai kata "${w}". Pakai "belum tepat".` });
    });

export const levelContentSchema = z.object({
  number: z.number().int().min(1).max(12),
  title: z.string().trim().min(1).max(60),
  isFree: z.boolean(),
  /** Nama family generator di engine; null berarti soal belum ada ("Segera hadir"). */
  generator: z.string().min(1).nullable(),
  generatorParams: z.record(z.string(), z.unknown()).optional(),
});

export const topicContentSchema = z.object({
  code: z.string().regex(/^[A-Za-z0-9]{1,4}$/),
  title: z.string().trim().min(1).max(60),
  sort: z.number().int(),
  lesson: lessonText(600),
  /** Hal penting topik, tampil sebagai "Tahukah kamu?". */
  tips: z.array(lessonText(200)).max(6).optional(),
  levels: z.array(levelContentSchema).min(1).max(12),
});

export const bookContentSchema = z.object({
  slug: z.string().regex(/^[a-z0-9-]+$/),
  grade: z.string(),
  subject: z.string().trim().min(1).max(40),
  title: z.string().trim().min(1).max(60),
  sort: z.number().int(),
  topics: z.array(topicContentSchema).min(1).max(60),
});
export type BookContent = z.infer<typeof bookContentSchema>;
export type TopicContent = z.infer<typeof topicContentSchema>;
export type LevelContent = z.infer<typeof levelContentSchema>;
