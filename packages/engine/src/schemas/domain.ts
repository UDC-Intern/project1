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
export const visualSchema = z
  .object({
    item: z.enum(COUNT_ITEMS),
    count: z.number().int().min(1).max(20).optional(),
    groups: z.array(z.number().int().min(1).max(20)).min(1).max(3).optional(),
  })
  .nullable();
export type Visual = z.infer<typeof visualSchema>;

export const nicknameSchema = z.string().trim().min(2).max(20);
export const emailSchema = z.string().trim().toLowerCase().max(254).pipe(z.email());
export const passwordSchema = z.string().min(8).max(128);
