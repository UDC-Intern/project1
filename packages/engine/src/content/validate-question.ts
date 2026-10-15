import type { QuestionType, Visual } from '../schemas/domain.js';

export type QuestionDraft = {
  type: QuestionType;
  prompt: string;
  visual?: Visual | undefined;
  options?: string[] | null | undefined;
  answer: string;
  explanation?: string | null | undefined;
};

export type ValidationResult = { ok: boolean; issues: string[] };

export const MAX_PROMPT_CHARS = 200;
export const MAX_WORDS_PER_SENTENCE = 15;
export const MAX_VISUAL_OBJECTS = 20;
export const FORBIDDEN_WORDS = ['salah', 'gagal'] as const;

const countWords = (sentence: string) => sentence.split(/\s+/).filter(Boolean).length;
const sentences = (text: string) =>
  text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
const hasForbidden = (text: string) =>
  FORBIDDEN_WORDS.some((w) => new RegExp(`(^|[^\\p{L}])${w}([^\\p{L}]|$)`, 'iu').test(text));

/** Aturan teks anak untuk konten anak. Murni: tanpa jaringan atau database. */
export function validateQuestion(q: QuestionDraft): ValidationResult {
  const issues: string[] = [];
  const prompt = q.prompt.trim();

  if (prompt.length === 0) issues.push('Kalimat soal kosong.');
  if (prompt.length > MAX_PROMPT_CHARS)
    issues.push(`Kalimat soal lebih dari ${MAX_PROMPT_CHARS} karakter.`);
  for (const s of sentences(prompt)) {
    if (countWords(s) > MAX_WORDS_PER_SENTENCE)
      issues.push(`Ada kalimat lebih dari ${MAX_WORDS_PER_SENTENCE} kata: "${s}"`);
  }

  const texts = [prompt, ...(q.options ?? []), q.explanation ?? ''];
  if (texts.some(hasForbidden))
    issues.push('Memakai kata "salah" atau "gagal". Pakai "belum tepat".');

  const answer = q.answer.trim();
  if (answer.length === 0) issues.push('Jawaban kosong.');

  if (q.type === 'choice') {
    const options = q.options ?? [];
    if (options.length !== 4) issues.push('Pilihan ganda harus tepat 4 opsi.');
    if (new Set(options.map((o) => o.trim().toLowerCase())).size !== options.length)
      issues.push('Ada opsi yang kembar.');
    if (!options.includes(q.answer)) issues.push('Jawaban tidak ada di antara opsi.');
  } else if (q.type === 'true_false') {
    const options = q.options ?? [];
    if (options.length !== 2 || options[0] !== 'Benar' || options[1] !== 'Belum tepat')
      issues.push('Opsi benar/belum tepat harus ["Benar", "Belum tepat"].');
    if (!options.includes(q.answer)) issues.push('Jawaban harus "Benar" atau "Belum tepat".');
  } else {
    if (q.options && q.options.length > 0) issues.push('Soal isian angka tidak memakai opsi.');
    if (!/^\d+$/.test(answer)) issues.push('Jawaban isian angka harus bilangan bulat tanpa tanda.');
  }

  if (!q.explanation || q.explanation.trim().length === 0)
    issues.push('Petunjuk (explanation) kosong.');

  if (q.visual) {
    const total = q.visual.groups
      ? q.visual.groups.reduce((a, b) => a + b, 0)
      : (q.visual.count ?? 0);
    if (total < 1) issues.push('Gambar objek tidak punya jumlah.');
    if (total > MAX_VISUAL_OBJECTS)
      issues.push(`Objek bergambar lebih dari ${MAX_VISUAL_OBJECTS}.`);
  }

  return { ok: issues.length === 0, issues };
}
