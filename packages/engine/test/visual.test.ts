import { describe, expect, it } from 'vitest';
import {
  VISUAL_COUNT_MAX,
  VISUAL_IMAGE_MAX,
  bankFromLevel,
  bankIssues,
  bankQuestionSchema,
  bankToLevel,
  generateRound,
  isQuestionImageUrl,
  objectsTotal,
  validateQuestion,
  visualSchema,
  type BankQuestion,
} from '../src/index.js';

const PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const SVG = `data:image/svg+xml;base64,${Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><circle cx="16" cy="16" r="11" fill="#c0392b"/></svg>').toString('base64')}`;

describe('visualSchema: benda hitung dan gambar', () => {
  it('benda hitung lama tetap sah dan tidak berubah bentuknya (tanpa kind tambahan)', () => {
    expect(visualSchema.parse({ item: 'fish', count: 4 })).toEqual({ item: 'fish', count: 4 });
    expect(visualSchema.parse({ item: 'apple', groups: [3, 2] })).toEqual({
      item: 'apple',
      groups: [3, 2],
    });
    expect(visualSchema.parse({ kind: 'objects', item: 'star', count: 1 })).toMatchObject({
      kind: 'objects',
      item: 'star',
    });
    expect(visualSchema.parse(null)).toBeNull();
  });

  it('batas jumlah: 1 sampai 30 per kelompok, paling banyak 3 kelompok, 30 benda seluruhnya', () => {
    expect(visualSchema.safeParse({ item: 'ball', count: VISUAL_COUNT_MAX }).success).toBe(true);
    expect(visualSchema.safeParse({ item: 'ball', count: 0 }).success).toBe(false);
    expect(visualSchema.safeParse({ item: 'ball', count: VISUAL_COUNT_MAX + 1 }).success).toBe(
      false,
    );
    expect(visualSchema.safeParse({ item: 'ball', groups: [10, 10, 10] }).success).toBe(true);
    expect(visualSchema.safeParse({ item: 'ball', groups: [1, 1, 1, 1] }).success).toBe(false);
    expect(visualSchema.safeParse({ item: 'ball', groups: [] }).success).toBe(false);
    const over = visualSchema.safeParse({ item: 'ball', groups: [15, 15, 1] });
    expect(over.success).toBe(false);
    expect(over.error?.issues[0]?.message).toBe('Seluruh benda paling banyak 30.');
    expect(visualSchema.safeParse({ item: 'robot', count: 3 }).success).toBe(false);
  });

  it('gambar utuh: Data URL PNG, JPG, WebP, SVG, alamat http(s), atau alamat dari akar situs', () => {
    for (const url of [
      PNG,
      SVG,
      'data:image/jpeg;base64,/9j/4AAQSkZJRg==',
      'data:image/webp;base64,UklGRhoAAABXRUJQ',
      'https://contoh.id/apel.png',
      'http://localhost:6006/aset/apel.webp',
      '/aset/apel.png',
    ])
      expect(visualSchema.safeParse({ kind: 'image', url }).success, url).toBe(true);
    const labelled = visualSchema.parse({ kind: 'image', url: PNG, label: 'Tiga apel merah' });
    expect(labelled).toMatchObject({ kind: 'image', label: 'Tiga apel merah' });
  });

  it('gambar utuh yang tidak aman atau keliru ditolak', () => {
    for (const url of [
      '',
      'javascript:alert(1)',
      'data:text/html;base64,PHNjcmlwdD4=',
      'data:image/gif;base64,R0lGODlh',
      'data:image/png;base64,bukan base64!',
      'data:image/png,mentah',
      '//jahat.example/x.png',
      'ftp://x/y.png',
      'apel.png',
    ])
      expect(visualSchema.safeParse({ kind: 'image', url }).success, url).toBe(false);
    expect(visualSchema.safeParse({ kind: 'image' }).success).toBe(false);
    const big = `data:image/png;base64,${'A'.repeat(VISUAL_IMAGE_MAX)}`;
    expect(visualSchema.safeParse({ kind: 'image', url: big }).success).toBe(false);
    expect(visualSchema.safeParse({ kind: 'image', url: PNG, label: 'x'.repeat(81) }).success).toBe(
      false,
    );
  });

  it('isQuestionImageUrl dan objectsTotal', () => {
    expect(isQuestionImageUrl(PNG)).toBe(true);
    expect(isQuestionImageUrl('https://x.id/a.png')).toBe(true);
    expect(isQuestionImageUrl('javascript:1')).toBe(false);
    expect(objectsTotal({ count: 7 })).toBe(7);
    expect(objectsTotal({ groups: [3, 2] })).toBe(5);
    expect(objectsTotal({})).toBe(0);
  });
});

const question = (visual?: BankQuestion['visual']): BankQuestion => ({
  prompt: 'Ada berapa benda di gambar?',
  choices: ['2', '3', '4'],
  answer: 1,
  hint: '',
  ...(visual && { visual }),
});

describe('bank soal dengan gambar', () => {
  it('menerima benda hitung dan gambar utuh, menolak gambar keliru', () => {
    expect(bankQuestionSchema.safeParse(question({ item: 'apple', count: 3 })).success).toBe(true);
    expect(bankQuestionSchema.safeParse(question({ kind: 'image', url: SVG })).success).toBe(true);
    const bad = bankQuestionSchema.safeParse(question({ kind: 'image', url: 'javascript:1' }));
    expect(bad.success).toBe(false);
    expect(bad.error?.issues[0]?.path).toEqual(['visual', 'url']);
  });

  it('soal dengan kalimat sama tetapi gambar beda adalah soal berbeda', () => {
    const items = [
      question({ item: 'apple', count: 3 }),
      question({ item: 'fish', count: 3 }),
      question({ kind: 'image', url: PNG }),
      question(),
    ];
    const four = [...items, question({ item: 'star', count: 3 })];
    expect(bankIssues(four).byQuestion.size).toBe(0);
    const twin = bankIssues([...four, question({ item: 'apple', count: 3 })]);
    expect(twin.byQuestion.get(5)).toEqual(['Soal ini sama persis dengan soal ke-1.']);
  });

  it('bank menjadi level dan kembali: gambar utuh dan benda hitung ikut utuh', () => {
    const items = [
      question({ kind: 'image', url: PNG, label: 'Apel merah' }),
      question({ item: 'leaf', groups: [2, 3] }),
      question(),
      question({ item: 'book', count: 9 }),
    ];
    const level = bankToLevel(items);
    const back = bankFromLevel(level)!;
    expect(back).toHaveLength(4);
    expect(back[0]!.visual).toEqual({ kind: 'image', url: PNG, label: 'Apel merah' });
    expect(back[1]!.visual).toEqual({ item: 'leaf', groups: [2, 3] });
    expect(back[2]!.visual).toBeUndefined();
    expect(back[3]!.visual).toEqual({ item: 'book', count: 9 });
  });

  it('anak menerima gambar yang disunting admin pada soalnya, tanpa jawaban', () => {
    const image = { kind: 'image' as const, url: SVG, label: 'Bola' };
    const items = Array.from({ length: 12 }, (_, i) => ({
      ...question(i % 2 === 0 ? image : { item: 'ball', count: 5 }),
      prompt: `Soal nomor ${i + 1}, ada berapa?`,
    }));
    const round = generateRound(bankToLevel(items), 7);
    expect(round).toHaveLength(10);
    for (const q of round) {
      expect(q.visual).not.toBeNull();
      const idx = Number(/nomor (\d+)/.exec(q.prompt)![1]) - 1;
      expect(q.visual).toEqual(idx % 2 === 0 ? image : { item: 'ball', count: 5 });
      expect(validateQuestion(q).issues.join(' ')).not.toMatch(/Gambar objek/);
    }
  });

  it('validateQuestion tidak menghitung benda untuk gambar utuh', () => {
    const res = validateQuestion({
      type: 'choice',
      prompt: 'Apa nama gambar ini?',
      visual: { kind: 'image', url: PNG },
      options: ['apel', 'bola', 'ikan', 'daun'],
      answer: 'apel',
      explanation: 'Yuk kita lihat lagi bersama.',
    });
    expect(res.issues.join(' ')).not.toMatch(/Gambar objek|Objek bergambar/);
  });
});
