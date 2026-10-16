import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { bookContentSchema, generateRound, hasGenerator, ROUND_SIZE } from '../src/index.js';

const BOOKS = [
  'matematika-kelas-1',
  'matematika-kelas-2',
  'matematika-kelas-3',
  'matematika-kelas-4',
].map((slug) =>
  bookContentSchema.parse(
    JSON.parse(readFileSync(join(__dirname, '../../../content', slug, 'book.json'), 'utf8')),
  ),
);

describe('generator skill (materi kelas 1 sampai 4)', () => {
  it('terdaftar sebagai generator', () => {
    expect(hasGenerator('skill')).toBe(true);
  });

  it('setiap level membuat 10 soal valid dan deterministik', () => {
    let levels = 0;
    for (const book of BOOKS) {
      for (const topic of book.topics) {
        for (const level of topic.levels) {
          if (level.generator !== 'skill') continue;
          levels++;
          const spec = { generator: 'skill', generatorParams: level.generatorParams };
          const first = generateRound(spec, 1234);
          expect(first).toHaveLength(ROUND_SIZE);
          expect(generateRound(spec, 1234)).toEqual(first);
          for (const q of first) {
            expect(q.prompt.length).toBeGreaterThan(0);
            expect(q.answer).not.toBe('');
            expect(q.explanation).not.toMatch(/\b(salah|gagal)\b/i);
            if (q.type === 'choice') {
              expect(new Set(q.options).size).toBe(q.options!.length);
              expect(q.options).toContain(q.answer);
            } else {
              expect(q.options).toBeNull();
            }
          }
        }
      }
    }
    expect(levels).toBeGreaterThan(250);
  }, 180_000);
});
