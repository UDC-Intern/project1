import { z } from 'zod';
import {
  emailSchema,
  levelStatusSchema,
  masteryStatusSchema,
  momoColorSchema,
  nicknameSchema,
  passwordSchema,
  pinSchema,
  questionTypeSchema,
  roleSchema,
  stageSchema,
  visualSchema,
} from './domain.js';

// Kontrak API: satu-satunya tempat bentuk permintaan dan respons ditulis.
// Mock di web dan API NestJS memakai skema yang sama.

export const API_ERROR_CODES = [
  'VALIDATION',
  'UNAUTHENTICATED',
  'INVALID_CREDENTIALS',
  'WRONG_PIN',
  'FORBIDDEN',
  'LEVEL_LOCKED',
  'PREMIUM_REQUIRED',
  'NOT_FOUND',
  'CONFLICT',
  'NOT_ENOUGH_QUESTIONS',
  'TEMPORARILY_LOCKED',
  'RATE_LIMITED',
] as const;

export const apiErrorSchema = z.object({
  error: z.object({
    code: z.enum(API_ERROR_CODES),
    message: z.string(),
    attemptsLeft: z.number().int().optional(),
    lockedUntil: z.string().optional(),
  }),
});
export type ApiErrorBody = z.infer<typeof apiErrorSchema>;

// ---- Akun ----

export const authUserSchema = z.object({
  id: z.string(),
  role: roleSchema,
  name: z.string(),
  familyCode: z.string().nullable(),
});
export const authResultSchema = z.object({ token: z.string(), user: authUserSchema });
export type AuthResult = z.infer<typeof authResultSchema>;

export const registerParentBodySchema = z.object({
  name: z.string().trim().min(1).max(60),
  email: emailSchema,
  password: passwordSchema,
  consent: z.literal(true),
  referralCode: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{6}$/)
    .optional(),
});
export type RegisterParentBody = z.infer<typeof registerParentBodySchema>;

export const loginBodySchema = z.object({ email: emailSchema, password: z.string().min(1) });
export type LoginBody = z.infer<typeof loginBodySchema>;

export const familyProfilesSchema = z.object({
  profiles: z.array(
    z.object({
      id: z.string(),
      nickname: z.string(),
      momoColor: momoColorSchema,
      hasPin: z.boolean(),
    }),
  ),
});
export type FamilyProfiles = z.infer<typeof familyProfilesSchema>;

export const childLoginBodySchema = z.object({ childId: z.string(), pin: pinSchema });
export type ChildLoginBody = z.infer<typeof childLoginBodySchema>;

export const childLoginResultSchema = z.object({
  token: z.string(),
  child: z.object({ id: z.string(), nickname: z.string(), momoColor: momoColorSchema }),
});
export type ChildLoginResult = z.infer<typeof childLoginResultSchema>;

// ---- Katalog dan ronde (anak) ----

export const childQuestionSchema = z.object({
  index: z.number().int().min(0).max(49),
  type: questionTypeSchema,
  prompt: z.string(),
  visual: visualSchema,
  options: z.array(z.string()).nullable(),
  audioUrl: z.string().nullable(),
});
export type ChildQuestion = z.infer<typeof childQuestionSchema>;

export const startRoundBodySchema = z.object({ levelId: z.string() });
export const startRoundResultSchema = z.object({
  roundId: z.string(),
  questions: z.array(childQuestionSchema),
});
export type StartRoundResult = z.infer<typeof startRoundResultSchema>;

export const answerBodySchema = z.object({
  questionIndex: z.number().int().min(0).max(49),
  answer: z.string().trim().min(1).max(60),
});
export type AnswerBody = z.infer<typeof answerBodySchema>;
export const answerResultSchema = z.object({
  isCorrect: z.boolean(),
  hint: z.string().nullable(),
  correctAnswer: z.string().nullable(),
});
export type AnswerResult = z.infer<typeof answerResultSchema>;

export const roundResultSchema = z.object({
  roundId: z.string(),
  levelId: z.string(),
  score: z.number().int(),
  correct: z.number().int(),
  wrong: z.number().int(),
  durationMs: z.number().int(),
  passed: z.boolean(),
  nextLevel: z
    .object({ id: z.string(), number: z.number().int(), status: levelStatusSchema })
    .nullable(),
  plant: z.object({
    topicId: z.string(),
    title: z.string(),
    stageBefore: stageSchema,
    stageAfter: stageSchema,
  }),
});
export type RoundResult = z.infer<typeof roundResultSchema>;

export const catalogHomeSchema = z.object({
  books: z.array(
    z.object({
      slug: z.string(),
      title: z.string(),
      subject: z.enum(['math', 'science']),
      topicsTotal: z.number().int(),
      topicsStarted: z.number().int(),
    }),
  ),
  continue: z.object({ levelId: z.string(), topicId: z.string(), title: z.string() }).nullable(),
});
export type CatalogHome = z.infer<typeof catalogHomeSchema>;

export const bookDetailSchema = z.object({
  book: z.object({ slug: z.string(), title: z.string(), subject: z.enum(['math', 'science']) }),
  topics: z.array(
    z.object({
      id: z.string(),
      code: z.string(),
      title: z.string(),
      stage: stageSchema,
      levelsPassed: z.number().int(),
      levelsTotal: z.number().int(),
    }),
  ),
});
export type BookDetail = z.infer<typeof bookDetailSchema>;

/** Contoh soal di halaman topik: boleh dicoba tanpa dinilai, jadi kunci ikut dikirim. */
export const topicExampleSchema = z.object({
  type: questionTypeSchema,
  prompt: z.string(),
  visual: visualSchema,
  options: z.array(z.string()).nullable(),
  answer: z.string(),
  explanation: z.string(),
});
export type TopicExample = z.infer<typeof topicExampleSchema>;

export const topicDetailSchema = z.object({
  example: topicExampleSchema.nullable(),
  topic: z.object({
    id: z.string(),
    code: z.string(),
    title: z.string(),
    lesson: z.string(),
    lessonAudioUrl: z.string().nullable(),
    bookSlug: z.string(),
  }),
  levels: z.array(
    z.object({
      id: z.string(),
      number: z.number().int(),
      title: z.string(),
      status: levelStatusSchema,
      bestScore: z.number().int().nullable(),
    }),
  ),
});
export type TopicDetail = z.infer<typeof topicDetailSchema>;

export const childOwnProfileSchema = z.object({
  nickname: z.string(),
  momoColor: momoColorSchema,
  totalScore: z.number().int(),
  levelsPassed: z.number().int(),
  rounds: z.number().int(),
  plants: z.array(
    z.object({ topicId: z.string(), title: z.string(), bookSlug: z.string(), stage: stageSchema }),
  ),
  history: z.array(
    z.object({
      roundId: z.string(),
      levelTitle: z.string(),
      score: z.number().int(),
      passed: z.boolean(),
      finishedAt: z.string(),
    }),
  ),
});
export type ChildProfile = z.infer<typeof childOwnProfileSchema>;

export const setMomoBodySchema = z.object({ momoColor: momoColorSchema });

// ---- Papan peringkat ----

export const LEADERBOARD_MODES = ['average', 'total', 'mock'] as const;
export const leaderboardModeSchema = z.enum(LEADERBOARD_MODES);
export type LeaderboardMode = z.infer<typeof leaderboardModeSchema>;

export const leaderboardEntrySchema = z.object({
  rank: z.number().int(),
  nickname: z.string(),
  momoColor: momoColorSchema,
  /** Nilai yang diurutkan: rata-rata tertimbang (mode average) atau total skor (mode total). */
  score: z.number(),
  /** Total skor terbaik semua level. */
  points: z.number().int(),
  average: z.number(),
  rounds: z.number().int(),
  questions: z.number().int(),
  timeMs: z.number().int(),
  isMe: z.boolean().optional(),
});
export type LeaderboardEntry = z.infer<typeof leaderboardEntrySchema>;
export const leaderboardSchema = z.object({
  mode: leaderboardModeSchema,
  total: z.number().int(),
  entries: z.array(leaderboardEntrySchema),
  me: leaderboardEntrySchema.nullable(),
});
export type Leaderboard = z.infer<typeof leaderboardSchema>;
export const leaderboardTopSchema = z.object({ entries: z.array(leaderboardEntrySchema) });
export type LeaderboardTop = z.infer<typeof leaderboardTopSchema>;

// ---- Orang tua ----

export const childSummarySchema = z.object({
  id: z.string(),
  nickname: z.string(),
  momoColor: momoColorSchema,
  hasPin: z.boolean(),
  totalScore: z.number().int(),
  levelsPassed: z.number().int(),
  rounds: z.number().int(),
  minutes: z.number().int(),
  premiumUntil: z.string().nullable(),
});
export const parentOverviewSchema = z.object({
  familyCode: z.string(),
  week: z.object({
    rounds: z.number().int(),
    levelsPassed: z.number().int(),
    minutes: z.number().int(),
    activeChildren: z.number().int(),
  }),
  children: z.array(childSummarySchema),
});
export type ParentOverview = z.infer<typeof parentOverviewSchema>;

export const createChildBodySchema = z.object({
  nickname: nicknameSchema,
  momoColor: momoColorSchema,
});
export type CreateChildBody = z.infer<typeof createChildBodySchema>;
export const patchChildBodySchema = createChildBodySchema.partial();
export const setPinBodySchema = z.object({ pin: pinSchema });

export const childReportSchema = z.object({
  child: z.object({ id: z.string(), nickname: z.string(), momoColor: momoColorSchema }),
  topics: z.array(
    z.object({
      topicId: z.string(),
      title: z.string(),
      bookTitle: z.string(),
      mastery: z.number().int(),
      status: masteryStatusSchema,
      stage: stageSchema,
    }),
  ),
  weekAccuracy: z.number().nullable(),
  recentRounds: z.array(
    z.object({
      roundId: z.string(),
      levelTitle: z.string(),
      score: z.number().int(),
      passed: z.boolean(),
      finishedAt: z.string(),
      durationMs: z.number().int(),
    }),
  ),
  suggestions: z.array(z.object({ topicId: z.string(), title: z.string() })).max(3),
});
export type ChildReport = z.infer<typeof childReportSchema>;

export const parentPlanSchema = z.object({
  adminWhatsapp: z.string(),
  children: z.array(
    z.object({
      id: z.string(),
      nickname: z.string(),
      plan: z.enum(['free', 'premium']),
      until: z.string().nullable(),
    }),
  ),
});
export type ParentPlan = z.infer<typeof parentPlanSchema>;

// ---- Admin ----

/** Pratinjau generator: soal lengkap dengan kunci, dibuat ulang dari level + seed. Tidak disimpan. */
export const previewQuestionSchema = childQuestionSchema.extend({
  answer: z.string(),
  explanation: z.string(),
});
export type PreviewQuestion = z.infer<typeof previewQuestionSchema>;

export const previewResultSchema = z.object({
  levelId: z.string(),
  seed: z.number().int(),
  questions: z.array(previewQuestionSchema),
});
export type PreviewResult = z.infer<typeof previewResultSchema>;

export const aiAssistBodySchema = z.object({
  topicId: z.string(),
  purpose: z.enum(['lesson', 'curriculum']),
  note: z.string().trim().max(300).optional(),
});
export type AiAssistBody = z.infer<typeof aiAssistBodySchema>;
export const aiAssistResultSchema = z.object({ jobId: z.string(), draft: z.string() });

export const certificateSchema = z.object({
  childName: z.string(),
  bookTitle: z.string(),
  issuedAt: z.string(),
});
export type Certificate = z.infer<typeof certificateSchema>;

export const premiumBodySchema = z.object({ until: z.iso.datetime() });
export type PremiumBody = z.infer<typeof premiumBodySchema>;

// ---- Admin: ringkasan, konten, pengguna, laporan ----

export const adminOverviewSchema = z.object({
  parents: z.number().int(),
  children: z.number().int(),
  roundsToday: z.number().int(),
  activeChildren7d: z.number().int(),
  hardestTopics: z.array(
    z.object({ topicId: z.string(), title: z.string(), passRate: z.number().int() }),
  ),
});
export type AdminOverview = z.infer<typeof adminOverviewSchema>;

export const adminCatalogSchema = z.object({
  books: z.array(
    z.object({
      id: z.string(),
      slug: z.string(),
      title: z.string(),
      topics: z.array(
        z.object({
          id: z.string(),
          code: z.string(),
          title: z.string(),
          lesson: z.string(),
          levels: z.array(
            z.object({
              id: z.string(),
              number: z.number().int(),
              title: z.string(),
              isFree: z.boolean(),
              generator: z.string().nullable(),
            }),
          ),
        }),
      ),
    }),
  ),
});
export type AdminCatalog = z.infer<typeof adminCatalogSchema>;

export const updateTopicBodySchema = z.object({
  title: z.string().trim().min(1).max(60).optional(),
  lesson: z.string().trim().min(1).max(600).optional(),
});
export type UpdateTopicBody = z.infer<typeof updateTopicBodySchema>;

export const updateLevelBodySchema = z.object({
  title: z.string().trim().min(1).max(60).optional(),
  isFree: z.boolean().optional(),
});
export type UpdateLevelBody = z.infer<typeof updateLevelBodySchema>;

export const adminUsersSchema = z.object({
  parents: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      email: z.string(),
      familyCode: z.string(),
      children: z.array(
        z.object({
          id: z.string(),
          nickname: z.string(),
          plan: z.enum(['free', 'premium']),
          until: z.string().nullable(),
        }),
      ),
    }),
  ),
  total: z.number().int(),
});
export type AdminUsers = z.infer<typeof adminUsersSchema>;

export const levelStatsSchema = z.object({
  levels: z.array(
    z.object({
      levelId: z.string(),
      levelTitle: z.string(),
      topicTitle: z.string(),
      rounds: z.number().int(),
      passRate: z.number().int(),
      avgScore: z.number().int(),
    }),
  ),
});
export type LevelStats = z.infer<typeof levelStatsSchema>;

// ---- Admin: wawasan dasbor ----

export const INSIGHT_RANGES = ['7d', '30d', 'month'] as const;
export const insightRangeSchema = z.enum(INSIGHT_RANGES);
export type InsightRange = z.infer<typeof insightRangeSchema>;

export const adminInsightsSchema = z.object({
  range: insightRangeSchema,
  /** Benar bila angka memakai data contoh karena aktivitas nyata masih sedikit. */
  sample: z.boolean(),
  days: z.array(z.string()),
  kpis: z.object({
    activeChildren: z.number().int(),
    answered: z.number().int(),
    accuracy: z.number().nullable(),
    revenue: z.number().int(),
  }),
  activity: z.array(
    z.object({ date: z.string(), rounds: z.number().int(), answers: z.number().int() }),
  ),
  revenueSeries: z.array(z.object({ date: z.string(), amount: z.number().int() })),
  funnel: z.array(z.object({ label: z.string(), value: z.number().int() })),
  subjects: z.array(z.object({ label: z.string(), value: z.number().int() })),
  /** 7 hari (Senin sampai Minggu) x 16 jam (06 sampai 21) */
  heatmap: z.array(z.array(z.number().int())),
  hardestSkills: z.array(
    z.object({ title: z.string(), accuracy: z.number().int(), answers: z.number().int() }),
  ),
  popularDistractors: z.array(
    z.object({ prompt: z.string(), chosen: z.string(), count: z.number().int() }),
  ),
  live: z.array(z.object({ nickname: z.string(), momoColor: momoColorSchema, level: z.string() })),
});
export type AdminInsights = z.infer<typeof adminInsightsSchema>;
