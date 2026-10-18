import { z } from 'zod';
import { generateRound, hasGenerator } from '../generator/index.js';
import { numberDistractors, type GeneratedQuestion } from '../generator/types.js';
import { createRng } from '../rng.js';
import type { LevelContent } from '../schemas/content.js';
import { visualSchema, type Visual } from '../schemas/domain.js';
import { checkChildText, checkForbiddenWords } from './validate-question.js';

/**
 * Silabus buatan admin: buku, topik, level, dan bank soal tulisan sendiri. Aturan di sini dipakai sama oleh
 * formulir admin (pemeriksaan langsung) dan oleh server atau data tiruan (pemeriksaan akhir).
 */

export const SYLLABUS_GRADES = [1, 2, 3, 4, 5, 6] as const;
export const MAX_LEVELS_PER_TOPIC = 12;
export const MAX_TOPICS_PER_BOOK = 60;
export const MAX_TIPS = 6;

// ---- Mata pelajaran ----
//
// Mapel tidak dibatasi daftar tetap. Matematika dan Sains tersimpan sebagai kode lama ('math', 'science') supaya
// konten yang sudah ada tetap sah; mapel lain tersimpan sebagai namanya ("Bahasa Inggris", "Seni Budaya", "IPS").
// Alamat buku diturunkan dari nama itu, jadi satu mapel selalu mendapat alamat yang sama.

/** Mapel yang selalu ditawarkan di formulir tambah buku, walau belum punya buku. Nilainya seperti yang disimpan. */
export const SUBJECT_PRESETS = ['math', 'science', 'Bahasa Inggris'] as const;

/** Nama bahasa Inggris atau kode lama → alamat bahasa Indonesia. */
const SLUG_ALIASES: Record<string, string> = {
  math: 'matematika',
  maths: 'matematika',
  mathematics: 'matematika',
  science: 'sains',
  english: 'bahasa-inggris',
  indonesian: 'bahasa-indonesia',
};

/** Alamat yang namanya sudah pasti rapi (dipakai bila nama diketik huruf kecil semua). */
const KNOWN_NAMES: Record<string, string> = {
  matematika: 'Matematika',
  sains: 'Sains',
  'bahasa-inggris': 'Bahasa Inggris',
  'bahasa-indonesia': 'Bahasa Indonesia',
};

/** Huruf kecil, tanpa aksen, selain huruf dan angka menjadi satu tanda hubung ("Seni & Budaya" → "seni-dan-budaya"). */
const slugify = (text: string) =>
  text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' dan ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

/**
 * Alamat rapi sebuah mapel dari nama atau kodenya, dalam bahasa Indonesia atau Inggris: "Math" dan "Matematika" →
 * "matematika", "Science" → "sains", "Bahasa Inggris" dan "English" → "bahasa-inggris". Kosong bila tidak ada huruf
 * atau angka sama sekali.
 */
export function subjectSlugOf(nameOrSlug: string): string {
  const slug = slugify(nameOrSlug);
  return SLUG_ALIASES[slug] ?? slug;
}

/**
 * Nama tampilan sebuah mapel dari nilai yang tersimpan. Nama yang diketik admin dipakai apa adanya ("IPS", "Seni
 * Budaya"); kode atau alamat huruf kecil dirapikan ("math" → "Matematika", "seni-budaya" → "Seni Budaya").
 */
export function subjectNameOf(subject: string): string {
  const text = subject.trim().replace(/\s+/g, ' ');
  const known = KNOWN_NAMES[subjectSlugOf(text)];
  if (known) return known;
  if (/[A-Z]/.test(text)) return text;
  return text
    .split(/[-\s]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

/** Nilai `subject` yang disimpan: 'math' atau 'science' untuk dua mapel lama, selain itu nama yang rapi. */
export function subjectCodeOf(nameOrSlug: string): string {
  const slug = subjectSlugOf(nameOrSlug);
  if (slug === 'matematika') return 'math';
  if (slug === 'sains') return 'science';
  return subjectNameOf(nameOrSlug);
}

/** Kunci mapel di data keanggotaan dan laporan: 'math', 'sains', atau alamat mapel lain. */
export function subjectDomainOf(subject: string): string {
  const slug = subjectSlugOf(subject);
  return slug === 'matematika' ? 'math' : slug;
}

/** Nama buku bawaan untuk mapel dan kelas, mis. "Matematika Kelas 5". */
export const bookTitleOf = (subject: string, grade: number) =>
  `${subjectNameOf(subject)} Kelas ${grade}`;

/** Alamat buku: satu buku untuk satu pasangan mapel dan kelas, mis. "matematika-kelas-5". */
export const bookSlugOf = (subject: string, grade: number) =>
  `${subjectSlugOf(subject)}-kelas-${grade}`;

/** Kode topik berikutnya yang belum dipakai: T1, T2, dan seterusnya. */
export function nextTopicCode(used: readonly string[]): string {
  const taken = new Set(used.map((c) => c.toUpperCase()));
  for (let n = 1; ; n++) if (!taken.has(`T${n}`)) return `T${n}`;
}

/** Aturan teks untuk anak (kata terlarang, panjang kalimat) sebagai isu zod dengan jalur isiannya. */
function childText(text: string, ctx: z.RefinementCtx, path: (string | number)[]) {
  for (const message of checkChildText(text)) ctx.addIssue({ code: 'custom', path, message });
}

export const levelInputSchema = z.strictObject({
  title: z
    .string()
    .trim()
    .min(1, 'Judul level wajib diisi.')
    .max(60, 'Judul level maksimal 60 huruf.'),
});

export const topicInputSchema = z
  .strictObject({
    /** Kosong berarti kode dibuat otomatis (T1, T2, ...). */
    code: z
      .string()
      .trim()
      .regex(/^[A-Za-z0-9]{1,4}$/, 'Kode 1 sampai 4 huruf atau angka.')
      .optional(),
    title: z
      .string()
      .trim()
      .min(2, 'Judul topik minimal 2 huruf.')
      .max(60, 'Judul topik maksimal 60 huruf.'),
    lesson: z
      .string()
      .trim()
      .min(1, 'Materi singkat wajib diisi.')
      .max(600, 'Materi maksimal 600 huruf.'),
    tips: z
      .array(z.string().trim().min(1).max(200, 'Satu hal penting maksimal 200 huruf.'))
      .max(MAX_TIPS, `Hal penting paling banyak ${MAX_TIPS} baris.`),
    levels: z
      .array(levelInputSchema)
      .min(1, 'Tambahkan minimal satu level.')
      .max(MAX_LEVELS_PER_TOPIC, `Satu topik paling banyak ${MAX_LEVELS_PER_TOPIC} level.`),
  })
  .superRefine((topic, ctx) => {
    childText(topic.lesson, ctx, ['lesson']);
    topic.tips.forEach((tip, i) => childText(tip, ctx, ['tips', i]));
  });
export type TopicInput = z.infer<typeof topicInputSchema>;

export const bookInputSchema = z.strictObject({
  /** Nama atau kode mapel; alamat bukunya diturunkan dari sini (lihat `subjectSlugOf`). */
  subject: z
    .string()
    .trim()
    .min(1, 'Pilih atau tulis nama mata pelajaran.')
    .max(40, 'Nama mata pelajaran maksimal 40 huruf.')
    .refine((v) => subjectSlugOf(v) !== '', 'Nama mata pelajaran harus memuat huruf atau angka.'),
  grade: z.number().int().min(1).max(6),
  title: z
    .string()
    .trim()
    .min(2, 'Judul buku minimal 2 huruf.')
    .max(60, 'Judul buku maksimal 60 huruf.'),
  /** Buku selalu lahir dengan satu topik pertama. */
  topic: topicInputSchema,
});
export type BookInput = z.infer<typeof bookInputSchema>;

// ---- Bank soal tulisan sendiri (family `manual`) ----

export const BANK_MIN_QUESTIONS = 4;
/** Satu ronde 10 soal: dengan 10 soal atau lebih, soal hampir tidak berulang dalam satu ronde. */
export const BANK_GOOD_QUESTIONS = 10;
export const BANK_MAX_QUESTIONS = 60;
export const BANK_MIN_CHOICES = 2;
export const BANK_MAX_CHOICES = 4;
const DEFAULT_HINT = 'Yuk kita lihat lagi bersama.';

export const bankQuestionSchema = z
  .strictObject({
    prompt: z
      .string()
      .trim()
      .min(1, 'Tulis pertanyaannya.')
      .max(200, 'Pertanyaan maksimal 200 huruf.'),
    choices: z
      .array(
        z
          .string()
          .trim()
          .min(1, 'Pilihan jawaban tidak boleh kosong.')
          .max(60, 'Pilihan maksimal 60 huruf.'),
      )
      .min(BANK_MIN_CHOICES, `Beri minimal ${BANK_MIN_CHOICES} pilihan jawaban.`)
      .max(BANK_MAX_CHOICES, `Pilihan jawaban paling banyak ${BANK_MAX_CHOICES}.`),
    /** Nomor pilihan yang benar, mulai dari 0. */
    answer: z.number().int().min(0),
    /** Petunjuk saat anak belum tepat; kosong memakai kalimat bawaan. */
    hint: z.string().trim().max(240, 'Petunjuk maksimal 240 huruf.'),
    /** Gambar yang menyertai soal: benda hitung (jenis dan jumlah) atau gambar utuh dari galeri atau unggahan. */
    visual: visualSchema.optional(),
  })
  .superRefine((q, ctx) => {
    if (q.answer >= q.choices.length)
      ctx.addIssue({ code: 'custom', path: ['answer'], message: 'Pilih jawaban yang benar.' });
    const seen = new Set<string>();
    q.choices.forEach((choice, i) => {
      const key = choice.toLowerCase();
      if (seen.has(key))
        ctx.addIssue({ code: 'custom', path: ['choices', i], message: 'Pilihan ini kembar.' });
      seen.add(key);
      childText(choice, ctx, ['choices', i]);
    });
    childText(q.prompt, ctx, ['prompt']);
    // Petunjuk berisi langkah hitung ("7 × 3 = 21, lalu tambah satu kelompok 7") yang bisa panjang; yang dijaga
    // hanya kata yang dihindari untuk anak, sama seperti penjelasan soal dari generator.
    for (const message of checkForbiddenWords(q.hint))
      ctx.addIssue({ code: 'custom', path: ['hint'], message });
  });
export type BankQuestion = z.infer<typeof bankQuestionSchema>;

/**
 * Kunci pembanding soal. `exact`: kalimat, gambar, pilihan, dan jawaban sama (soal kembar). Tanpa `exact`: hanya
 * kalimat, gambar, dan jawaban, untuk memilih soal yang beragam dari generator.
 */
function bankKey(q: BankQuestion, exact: boolean): string {
  return [
    q.prompt.trim().toLowerCase(),
    JSON.stringify(q.visual ?? null),
    q.choices[q.answer]?.toLowerCase(),
    ...(exact
      ? [
          [...q.choices]
            .map((c) => c.toLowerCase())
            .sort()
            .join('|'),
        ]
      : []),
  ].join('\u241f');
}

export const questionBankSchema = z
  .array(bankQuestionSchema)
  .min(BANK_MIN_QUESTIONS, `Tulis minimal ${BANK_MIN_QUESTIONS} soal.`)
  .max(BANK_MAX_QUESTIONS, `Satu level paling banyak ${BANK_MAX_QUESTIONS} soal.`)
  .superRefine((items, ctx) => {
    const imageChars = items.reduce(
      (n, q) => n + (q.visual?.kind === 'image' ? q.visual.url.length : 0),
      0,
    );
    if (imageChars > 3_000_000)
      ctx.addIssue({ code: 'custom', message: 'Terlalu banyak gambar di satu level.' });
    const first = new Map<string, number>();
    items.forEach((q, i) => {
      // Kalimat yang sama dengan pilihan atau gambar lain ("Mana yang bisa terbang?", "Ada berapa apel?") adalah
      // soal yang berbeda; yang ditolak hanya soal kembar.
      const key = bankKey(q, true);
      const earlier = first.get(key);
      if (earlier !== undefined)
        ctx.addIssue({
          code: 'custom',
          path: [i, 'prompt'],
          message: `Soal ini sama persis dengan soal ke-${earlier + 1}.`,
        });
      else first.set(key, i);
    });
  });

/** Isu bank soal dikelompokkan: umum (jumlah soal) dan per soal (nomor mulai 0). */
export type BankIssues = { general: string[]; byQuestion: Map<number, string[]> };

/** Periksa bank soal tanpa melempar galat; `ok` bila siap disimpan. */
export function bankIssues(items: readonly BankQuestion[]): BankIssues & { ok: boolean } {
  const result = questionBankSchema.safeParse(items);
  const general: string[] = [];
  const byQuestion = new Map<number, string[]>();
  if (!result.success) {
    for (const issue of result.error.issues) {
      const [index] = issue.path;
      if (typeof index === 'number')
        byQuestion.set(index, [...(byQuestion.get(index) ?? []), issue.message]);
      else general.push(issue.message);
    }
  }
  return { ok: result.success, general, byQuestion };
}

type ManualChoice = { visual: { kind: 'text'; text: string }; say: string; tag?: string };
type ManualItemShape = {
  prompt: string;
  visual?: NonNullable<Visual>;
  choices: ManualChoice[];
  answer: number;
  reteach: string;
};

/** Bank soal menjadi level yang bisa dimainkan: family `manual` di dalam generator `skill`. */
export function bankToLevel(items: readonly BankQuestion[]): {
  generator: 'skill';
  generatorParams: Record<string, unknown>;
} {
  const manual: ManualItemShape[] = items.map((q) => ({
    prompt: q.prompt,
    ...(q.visual && { visual: q.visual }),
    choices: q.choices.map((text, i) => ({
      visual: { kind: 'text' as const, text },
      say: text,
      ...(i !== q.answer && { tag: 'pengecoh' }),
    })),
    answer: q.answer,
    reteach: q.hint || DEFAULT_HINT,
  }));
  return { generator: 'skill', generatorParams: { family: 'manual', params: { items: manual } } };
}

/** Isi level menjadi bank soal untuk disunting; null bila level bukan bank soal tulisan (mis. generator bawaan). */
export function bankFromLevel(
  level: Pick<LevelContent, 'generator' | 'generatorParams'>,
): BankQuestion[] | null {
  if (level.generator !== 'skill') return null;
  const spec = level.generatorParams as
    { family?: string; params?: { items?: unknown } } | undefined;
  if (spec?.family !== 'manual' || !Array.isArray(spec.params?.items)) return null;
  const out: BankQuestion[] = [];
  for (const raw of spec.params.items as Partial<ManualItemShape>[]) {
    const choices = (raw.choices ?? []).map((c) => c.visual?.text);
    if (
      typeof raw.prompt !== 'string' ||
      typeof raw.answer !== 'number' ||
      choices.some((c) => typeof c !== 'string')
    )
      return null;
    const visual = visualSchema.safeParse(raw.visual ?? null);
    out.push({
      prompt: raw.prompt,
      choices: choices as string[],
      answer: raw.answer,
      hint: raw.reteach === DEFAULT_HINT ? '' : (raw.reteach ?? ''),
      ...(visual.success && visual.data && { visual: visual.data }),
    });
  }
  return out;
}

/** Jumlah soal yang diambil dari generator saat admin mulai menyesuaikan soal sebuah level otomatis. */
export const BANK_DRAFT_SIZE = 20;
/** Paling banyak ronde generator yang dicoba untuk mengumpulkan soal yang berbeda. */
const DRAFT_ROUNDS = 40;

/** Petunjuk dipotong di batas kalimat bila lebih dari 240 huruf; kalimat pertama yang kepanjangan dipotong dengan "…". */
function fitHint(text: string): string {
  const MAX = 240;
  if (text.length <= MAX) return text;
  const sentences = text.match(/[^.!?]+[.!?]+(\s+|$)/g) ?? [];
  let out = '';
  for (const sentence of sentences) {
    if ((out + sentence).trim().length > MAX) break;
    out += sentence;
  }
  return out.trim() || `${text.slice(0, MAX - 1).trimEnd()}…`;
}

/** Satu soal generator menjadi soal bank: soal isian angka menjadi pilihan ganda (jawaban dan pengecoh angka). */
function toBankQuestion(q: GeneratedQuestion, seed: number): BankQuestion | null {
  let choices: string[];
  if (q.options && q.options.length >= BANK_MIN_CHOICES) choices = [...q.options];
  else if (q.type === 'number') {
    const n = Number(q.answer);
    if (!Number.isInteger(n) || n < 0) return null;
    const rng = createRng(seed >>> 0);
    choices = rng.shuffle([q.answer, ...numberDistractors(rng, n, Math.max(20, n + 10))]);
  } else return null;
  const answer = choices.indexOf(q.answer);
  if (answer < 0 || choices.length > BANK_MAX_CHOICES) return null;
  const parsed = bankQuestionSchema.safeParse({
    // Satu baris di kolom pertanyaan: pemisah baris pada soal bertumpuk menjadi spasi.
    prompt: q.prompt.replace(/\s*\n\s*/g, ' ').trim(),
    choices,
    answer,
    hint: fitHint((q.explanation ?? '').replace(/\s*\n\s*/g, ' ').trim()),
    ...(q.visual && { visual: q.visual }),
  });
  return parsed.success ? parsed.data : null;
}

/**
 * Soal dari generator bawaan sebuah level, disalin menjadi bank soal yang bisa disunting admin. Mengumpulkan
 * `size` soal yang berbeda (kalimat, gambar, dan jawaban) dari beberapa ronde generator; deterministik untuk
 * `seed` yang sama. Level yang ruang soalnya kecil bisa menghasilkan lebih sedikit dari `size`. Kosong bila level
 * tidak punya generator.
 */
export function bankFromGenerator(
  level: Pick<LevelContent, 'generator' | 'generatorParams'>,
  opts: { size?: number; seed?: number } = {},
): BankQuestion[] {
  const size = Math.min(BANK_MAX_QUESTIONS, opts.size ?? BANK_DRAFT_SIZE);
  if (!level.generator || !hasGenerator(level.generator)) return [];
  const spec = {
    generator: level.generator,
    generatorParams: level.generatorParams as Record<string, unknown> | undefined,
  };
  const base = opts.seed ?? 1;
  // Soal yang beragam (kalimat, gambar, jawaban berbeda) didahulukan; soal yang hanya beda pengecoh jadi cadangan
  // untuk level yang ruang soalnya kecil, supaya tetap terkumpul `size` soal.
  const diverse = new Map<string, BankQuestion>();
  const spare = new Map<string, BankQuestion>();
  const exactSeen = new Set<string>();
  for (let round = 0; round < DRAFT_ROUNDS && diverse.size < size; round++) {
    const seed = base + round * 10_007;
    let questions: GeneratedQuestion[];
    try {
      questions = generateRound(spec, seed);
    } catch {
      break;
    }
    questions.forEach((q, i) => {
      const item = toBankQuestion(q, seed + i);
      if (!item || diverse.size >= size) return;
      const exact = bankKey(item, true);
      if (exactSeen.has(exact)) return;
      exactSeen.add(exact);
      if (!diverse.has(bankKey(item, false))) diverse.set(bankKey(item, false), item);
      else spare.set(exact, item);
    });
  }
  const out = [...diverse.values()];
  for (const item of spare.values()) {
    if (out.length >= size) break;
    out.push(item);
  }
  return out;
}

/**
 * Asal soal sebuah level: `none` (belum ada soal, "Segera hadir"), `bank` (bank soal tulisan), atau `auto`
 * (dibuat generator di engine).
 */
export function levelSource(
  level: Pick<LevelContent, 'generator' | 'generatorParams'>,
): 'none' | 'bank' | 'auto' {
  if (level.generator === null) return 'none';
  const spec = level.generatorParams as { family?: string } | undefined;
  return level.generator === 'skill' && spec?.family === 'manual' ? 'bank' : 'auto';
}
