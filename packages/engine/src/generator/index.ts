import { createRng } from '../rng.js';
import { mathFamilies } from './math.js';
import { scienceFamilies } from './science.js';
import { skill, stimuliSupported, type SkillSpec } from './skill.js';
import type { Band, Family, GeneratedQuestion } from './types.js';

export type { GeneratedQuestion, Band } from './types.js';

export const ROUND_SIZE = 10;
const FAMILIES: Record<string, Family> = { ...mathFamilies, ...scienceFamilies, skill };

export { stimuliSupported, type SkillSpec };

export type LevelGenerator = {
  generator: string;
  generatorParams?: Record<string, unknown> | undefined;
};

export const hasGenerator = (name: string | null | undefined): boolean =>
  name !== null && name !== undefined && name in FAMILIES;

/** Soal 1 sampai 3 mudah, 4 sampai 7 sedang, 8 sampai 10 sulit. */
export const bandOf = (index: number): Band => (index < 3 ? 0 : index < 7 ? 1 : 2);

const ATTEMPTS = 40;
const keyOf = (q: GeneratedQuestion) => `${q.prompt}|${q.answer}`;

/**
 * Membuat satu ronde (10 soal) dari level dan seed. Deterministik: seed sama memberi soal sama,
 * jadi server dapat membuat ulang soal untuk menilai tanpa menyimpan kunci.
 */
export function generateRound(
  level: LevelGenerator,
  seed: number,
  size: number = ROUND_SIZE,
): GeneratedQuestion[] {
  const family = FAMILIES[level.generator];
  if (!family) throw new Error(`Generator tidak dikenal: ${level.generator}`);
  const params = level.generatorParams ?? {};
  const used = new Set<string>();
  const out: GeneratedQuestion[] = [];

  for (let i = 0; i < size; i++) {
    let chosen: GeneratedQuestion | null = null;
    for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
      const rng = createRng((seed + i * 7919 + attempt * 104729) >>> 0);
      const q = family(rng, bandOf(i), params);
      chosen = q;
      if (!used.has(keyOf(q))) break;
    }
    used.add(keyOf(chosen!));
    out.push(chosen!);
  }
  return out;
}
