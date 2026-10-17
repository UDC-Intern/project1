import { describe, expect, it } from 'vitest';
import { generateRound, hasGenerator, ROUND_SIZE, bandOf } from '../src/generator/index.js';
import { validateQuestion } from '../src/content/validate-question.js';
import { objectsTotal } from '../src/schemas/domain.js';
import { createRng } from '../src/rng.js';

const LEVELS = [
  { generator: 'count', generatorParams: { max: 20 } },
  { generator: 'skip-count', generatorParams: { steps: [2, 5, 10] } },
  { generator: 'neighbors', generatorParams: { max: 100 } },
  { generator: 'body-parts' },
  { generator: 'senses' },
  { generator: 'body-care' },
];

describe('generator soal', () => {
  it.each(LEVELS)('menghasilkan 10 soal sah untuk 1000 seed: $generator', (level) => {
    for (let seed = 1; seed <= 1000; seed++) {
      const round = generateRound(level, seed);
      expect(round).toHaveLength(ROUND_SIZE);
      for (const q of round) {
        const res = validateQuestion(q);
        if (!res.ok)
          throw new Error(
            `${level.generator} seed ${seed}: ${res.issues.join(' ')} :: ${q.prompt}`,
          );
        if (q.type === 'number') expect(q.options).toBeNull();
        else expect(q.options).toContain(q.answer);
        if (q.visual && q.visual.kind !== 'image') {
          const total = objectsTotal(q.visual);
          expect(total).toBeGreaterThanOrEqual(1);
          expect(total).toBeLessThanOrEqual(20);
        }
      }
    }
  });

  it('deterministik: seed sama memberi soal sama, seed lain berbeda', () => {
    const level = LEVELS[0]!;
    expect(generateRound(level, 42)).toEqual(generateRound(level, 42));
    expect(generateRound(level, 42)).not.toEqual(generateRound(level, 43));
  });

  it('tidak ada soal kembar dalam satu ronde untuk generator berangka', () => {
    for (const level of LEVELS.slice(0, 3)) {
      for (let seed = 1; seed <= 200; seed++) {
        const prompts = generateRound(level, seed).map((q) => `${q.prompt}|${q.answer}`);
        expect(new Set(prompts).size).toBe(ROUND_SIZE);
      }
    }
  });

  it('kesulitan naik: soal 1 sampai 3 mudah, 8 sampai 10 sulit', () => {
    expect([0, 2, 3, 6, 7, 9].map(bandOf)).toEqual([0, 0, 1, 1, 2, 2]);
  });

  it('mengenali nama generator dan menolak yang tidak dikenal', () => {
    expect(hasGenerator('count')).toBe(true);
    expect(hasGenerator('tidak-ada')).toBe(false);
    expect(hasGenerator(null)).toBe(false);
    expect(() => generateRound({ generator: 'tidak-ada' }, 1)).toThrow();
  });

  it('createRng deterministik dan memberi pilihan dalam rentang', () => {
    const a = createRng(7);
    const b = createRng(7);
    expect([a.int(1, 9), a.int(1, 9)]).toEqual([b.int(1, 9), b.int(1, 9)]);
    expect(a.pick(['x', 'y'])).toMatch(/x|y/);
    expect(typeof a.chance(0.5)).toBe('boolean');
    expect(a.shuffle([1, 2, 3]).sort()).toEqual([1, 2, 3]);
  });
});
