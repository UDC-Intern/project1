import { z } from 'zod';
import { checkChildText } from '../content/validate-question.js';

const childText = (max: number) =>
  z
    .string()
    .trim()
    .min(1)
    .max(max)
    .superRefine((text, ctx) => {
      for (const message of checkChildText(text)) ctx.addIssue({ code: 'custom', message });
    });

export const levelContentSchema = z.object({
  number: z.number().int().min(1).max(10),
  title: z.string().trim().min(1).max(60),
  isFree: z.boolean(),
  /** Nama family generator di engine; null berarti soal belum ada ("Segera hadir"). */
  generator: z.string().min(1).nullable(),
  generatorParams: z.record(z.string(), z.unknown()).optional(),
});

export const topicContentSchema = z.object({
  code: z.string().regex(/^[A-D]$/),
  title: z.string().trim().min(1).max(60),
  sort: z.number().int(),
  lesson: childText(600),
  levels: z.array(levelContentSchema).length(3),
});

export const bookContentSchema = z.object({
  slug: z.string().regex(/^[a-z0-9-]+$/),
  grade: z.string(),
  subject: z.enum(['math', 'science']),
  title: z.string().trim().min(1).max(60),
  sort: z.number().int(),
  topics: z.array(topicContentSchema).length(4),
});
export type BookContent = z.infer<typeof bookContentSchema>;
export type TopicContent = z.infer<typeof topicContentSchema>;
export type LevelContent = z.infer<typeof levelContentSchema>;
