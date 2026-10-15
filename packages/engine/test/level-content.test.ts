import { describe, expect, it } from 'vitest';
import { checkChildText } from '../src/content/validate-question.js';
import { levelStatus, type LevelStatusInput } from '../src/rules/level.js';
import { bookContentSchema } from '../src/schemas/content.js';

const base: LevelStatusInput = {
  number: 1,
  passed: false,
  previousPassed: false,
  isFree: true,
  hasPremium: false,
  hasGenerator: true,
};

describe('levelStatus', () => {
  it('level tanpa generator tampil segera hadir', () => {
    expect(levelStatus({ ...base, hasGenerator: false })).toBe('soon');
  });

  it('level 1 gratis terbuka, dan lulus bila pernah lulus', () => {
    expect(levelStatus(base)).toBe('open');
    expect(levelStatus({ ...base, passed: true })).toBe('passed');
  });

  it('level lanjutan terkunci sampai level sebelumnya lulus', () => {
    expect(levelStatus({ ...base, number: 2, isFree: false })).toBe('locked');
    expect(levelStatus({ ...base, number: 3, isFree: false, previousPassed: false })).toBe(
      'locked',
    );
  });

  it('level Premium tanpa langganan tampil premium, dengan langganan terbuka', () => {
    const lvl2 = { ...base, number: 2, isFree: false, previousPassed: true };
    expect(levelStatus(lvl2)).toBe('premium');
    expect(levelStatus({ ...lvl2, hasPremium: true })).toBe('open');
    expect(levelStatus({ ...lvl2, hasPremium: true, passed: true })).toBe('passed');
  });

  it('level yang pernah lulus kembali premium bila langganan berakhir', () => {
    expect(
      levelStatus({ ...base, number: 2, isFree: false, previousPassed: true, passed: true }),
    ).toBe('premium');
  });
});

describe('aturan teks anak dan skema konten', () => {
  it('menandai kalimat panjang dan kata terlarang', () => {
    expect(checkChildText('Hitung apelnya satu per satu.')).toEqual([]);
    expect(checkChildText('Jawabanmu salah.')).toHaveLength(1);
    const long =
      'Ayu membeli banyak sekali apel merah di pasar pagi tadi bersama ibunya yang baik hati sekali.';
    expect(checkChildText(long)).toHaveLength(1);
  });

  const level = (n: number) => ({
    number: n,
    title: `Level ${n}`,
    isFree: n === 1,
    generator: null,
  });
  const topic = (code: string) => ({
    code,
    title: 'Topik',
    sort: 1,
    lesson: 'Hitung benda satu per satu.',
    levels: [level(1), level(2), level(3)],
  });
  const book = {
    slug: 'matematika-kelas-1',
    grade: 'kelas-1',
    subject: 'math',
    title: 'Matematika Kelas 1',
    sort: 1,
    topics: ['A', 'B', 'C', 'D'].map(topic),
  };

  it('menerima buku dengan 4 topik dan 3 level per topik', () => {
    expect(bookContentSchema.safeParse(book).success).toBe(true);
  });

  it('menolak materi berkata terlarang dan buku tanpa topik', () => {
    const bad = {
      ...book,
      topics: [{ ...topic('A'), lesson: 'Itu salah.' }, ...book.topics.slice(1)],
    };
    expect(bookContentSchema.safeParse(bad).success).toBe(false);
    expect(bookContentSchema.safeParse({ ...book, topics: [] }).success).toBe(false);
  });
});
