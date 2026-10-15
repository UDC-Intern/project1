import { COUNT_ITEMS } from '../schemas/domain.js';
import {
  fourOptions,
  numberDistractors,
  TRUE_FALSE_OPTIONS,
  type Band,
  type Family,
  type GeneratedQuestion,
} from './types.js';

const ITEM_NAME: Record<(typeof COUNT_ITEMS)[number], string> = {
  apple: 'apel',
  ball: 'bola',
  star: 'bintang',
  fish: 'ikan',
  leaf: 'daun',
  book: 'buku',
};

const num = (params: Record<string, unknown>, key: string, fallback: number) =>
  typeof params[key] === 'number' ? (params[key] as number) : fallback;

/** Membilang benda bergambar: mudah (sampai 10) pilihan ganda, sedang isian, sulit benar/belum tepat. */
export const count: Family = (rng, band, params) => {
  const max = Math.min(num(params, 'max', 20), 20);
  const item = rng.pick(COUNT_ITEMS);
  const name = ITEM_NAME[item];
  const hi = band === 0 ? Math.min(10, max) : max;
  const lo = band === 0 ? 1 : Math.min(8, hi);
  const n = rng.int(lo, hi);
  const explanation = `Hitung satu per satu dari satu sampai ${n}.`;

  if (band === 0) {
    return {
      type: 'choice',
      prompt: `Ada berapa ${name} di gambar?`,
      visual: { item, count: n },
      options: fourOptions(rng, String(n), numberDistractors(rng, n, 20).concat(['1', '2', '3'])),
      answer: String(n),
      explanation,
    };
  }
  if (band === 1) {
    return {
      type: 'number',
      prompt: `Hitung ${name} di gambar. Ada berapa?`,
      visual: { item, count: n },
      options: null,
      answer: String(n),
      explanation,
    };
  }
  const claimed = rng.chance(0.5) ? n : Math.max(1, Math.min(max, n + rng.pick([-2, -1, 1, 2])));
  return {
    type: 'true_false',
    prompt: `Di gambar ada ${claimed} ${name}.`,
    visual: { item, count: n },
    options: TRUE_FALSE_OPTIONS,
    answer: claimed === n ? 'Benar' : 'Belum tepat',
    explanation,
  };
};

/** Loncat 2, 5, atau 10: lanjutkan deret, atau periksa pernyataan. */
export const skipCount: Family = (rng, band, params) => {
  const steps = Array.isArray(params.steps)
    ? (params.steps as number[]).filter((s) => typeof s === 'number')
    : [2, 5, 10];
  const step = band === 0 ? steps[0]! : rng.pick(steps);
  const startIdx = rng.int(0, 3);
  const start = band === 2 ? step * startIdx : step * rng.int(0, 2);
  const shown = [start, start + step, start + 2 * step, start + 3 * step];
  const next = start + 4 * step;
  const explanation = `Tambah ${step} setiap kali.`;

  if (band === 0) {
    return {
      type: 'choice',
      prompt: `Lanjutkan hitungan: ${shown.join(', ')}, ...`,
      visual: null,
      options: fourOptions(rng, String(next), numberDistractors(rng, next, 100)),
      answer: String(next),
      explanation,
    };
  }
  if (band === 1) {
    return {
      type: 'number',
      prompt: `Lanjutkan hitungan: ${shown.join(', ')}, ...`,
      visual: null,
      options: null,
      answer: String(next),
      explanation,
    };
  }
  const claimed = rng.chance(0.5) ? next : next + rng.pick([-1, 1, step]);
  return {
    type: 'true_false',
    prompt: `Hitungan loncat ${step}: setelah ${shown[3]} ada ${claimed}.`,
    visual: null,
    options: TRUE_FALSE_OPTIONS,
    answer: claimed === next ? 'Benar' : 'Belum tepat',
    explanation,
  };
};

/** Angka sebelum, sesudah, dan di antara. Rentang makin lebar mengikuti tingkat kesulitan. */
export const neighbors: Family = (rng, band, params) => {
  const max = num(params, 'max', 100);
  const hi = band === 0 ? Math.min(20, max) : band === 1 ? Math.min(50, max) : max;
  const n = rng.int(3, hi - 2);

  const kind =
    band === 0
      ? rng.pick(['before', 'after'] as const)
      : rng.pick(['before', 'after', 'between'] as const);
  let prompt: string;
  let answer: number;
  let explanation: string;
  if (kind === 'before') {
    prompt = `Angka sebelum ${n} adalah ...`;
    answer = n - 1;
    explanation = `Kurangi satu dari ${n}.`;
  } else if (kind === 'after') {
    prompt = `Angka sesudah ${n} adalah ...`;
    answer = n + 1;
    explanation = `Tambah satu pada ${n}.`;
  } else {
    prompt = `Angka di antara ${n - 1} dan ${n + 1} adalah ...`;
    answer = n;
    explanation = `Angkanya ada di tengah ${n - 1} dan ${n + 1}.`;
  }

  if (band === 2 && rng.chance(0.4)) {
    const claimed = rng.chance(0.5) ? answer : answer + rng.pick([-1, 1]);
    return {
      type: 'true_false',
      prompt: prompt.replace('adalah ...', `adalah ${claimed}.`),
      visual: null,
      options: TRUE_FALSE_OPTIONS,
      answer: claimed === answer ? 'Benar' : 'Belum tepat',
      explanation,
    } satisfies GeneratedQuestion;
  }
  if (band === 1 && rng.chance(0.5)) {
    return {
      type: 'number',
      prompt,
      visual: null,
      options: null,
      answer: String(answer),
      explanation,
    };
  }
  return {
    type: 'choice',
    prompt,
    visual: null,
    options: fourOptions(rng, String(answer), numberDistractors(rng, answer, max)),
    answer: String(answer),
    explanation,
  };
};

export const mathFamilies: Record<string, Family> = {
  count,
  'skip-count': skipCount,
  neighbors,
};

export type { Band };
