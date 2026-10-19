import type { QuestionType, Visual } from '../schemas/domain.js';
import type { Rng } from '../rng.js';

/** Satu soal keluaran generator, lengkap dengan kunci. Kunci tidak boleh dikirim ke anak sebelum menjawab. */
export type GeneratedQuestion = {
  type: QuestionType;
  prompt: string;
  /** Teks yang diucapkan bila berbeda dari teks yang terlihat, misalnya soal dikte angka. */
  say?: string;
  visual: Visual;
  options: string[] | null;
  answer: string;
  explanation: string;
};

/** Tingkat kesulitan dalam satu ronde: 0 mudah, 1 sedang, 2 sulit. */
export type Band = 0 | 1 | 2;

export type Family = (rng: Rng, band: Band, params: Record<string, unknown>) => GeneratedQuestion;

export const TRUE_FALSE_OPTIONS = ['Benar', 'Belum tepat'];

/** Empat pilihan unik yang memuat jawaban, urutannya diacak. Mengembalikan null bila pengecoh kurang. */
export function fourOptions(rng: Rng, answer: string, wrong: readonly string[]): string[] {
  const pool = [...new Set(wrong.filter((w) => w !== answer))];
  const picked = rng.shuffle(pool).slice(0, 3);
  return rng.shuffle([answer, ...picked]);
}

/** Pengecoh angka di sekitar jawaban: lebih satu, kurang satu, dan selisih kecil lain. Selalu positif dan unik. */
export function numberDistractors(rng: Rng, answer: number, max: number): string[] {
  const set = new Set<number>();
  for (const d of rng.shuffle([1, -1, 2, -2, 3, -3, 10, -10])) {
    const v = answer + d;
    if (v >= 0 && v <= max && v !== answer) set.add(v);
    if (set.size === 3) break;
  }
  return [...set].map(String);
}
