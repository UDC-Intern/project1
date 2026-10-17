import { describe, expect, it } from 'vitest';
import {
  BANK_MAX_QUESTIONS,
  BANK_MIN_QUESTIONS,
  bankFromLevel,
  bankIssues,
  bankQuestionSchema,
  bankToLevel,
  bookInputSchema,
  bookSlugOf,
  bookTitleOf,
  generateRound,
  levelSource,
  nextTopicCode,
  questionBankSchema,
  topicInputSchema,
  type BankQuestion,
} from '../src/index.js';

const question = (n: number, patch: Partial<BankQuestion> = {}): BankQuestion => ({
  prompt: `Berapa hasil ${n} tambah 1?`,
  choices: [String(n + 1), String(n + 2), String(n)],
  answer: 0,
  hint: `${n} tambah 1 sama dengan ${n + 1}.`,
  ...patch,
});
const bank = (size: number) => Array.from({ length: size }, (_, i) => question(i + 1));

describe('nama buku dan kode topik', () => {
  it('alamat dan judul buku dari mapel dan kelas', () => {
    expect(bookSlugOf('math', 5)).toBe('matematika-kelas-5');
    expect(bookSlugOf('science', 2)).toBe('sains-kelas-2');
    expect(bookTitleOf('math', 5)).toBe('Matematika Kelas 5');
    expect(bookTitleOf('science', 2)).toBe('Sains Kelas 2');
  });

  it('kode topik berikutnya melewati yang sudah dipakai', () => {
    expect(nextTopicCode([])).toBe('T1');
    expect(nextTopicCode(['A', 'KB'])).toBe('T1');
    expect(nextTopicCode(['T1', 't2'])).toBe('T3');
  });
});

describe('topik dan buku masukan admin', () => {
  const topic = {
    title: 'Mengenal bentuk',
    lesson: 'Ada bentuk bulat dan kotak. Kita mencarinya di sekitar.',
    tips: ['Bola berbentuk bulat.'],
    levels: [{ title: 'Bentuk dasar' }],
  };

  it('menerima topik yang lengkap dan kode boleh kosong', () => {
    expect(topicInputSchema.safeParse(topic).success).toBe(true);
    expect(topicInputSchema.safeParse({ ...topic, code: 'b2' }).success).toBe(true);
  });

  it('menolak kode, judul, dan level yang keliru', () => {
    for (const bad of [
      { ...topic, code: 'ABCDE' },
      { ...topic, code: 'A-1' },
      { ...topic, title: 'A' },
      { ...topic, levels: [] },
      { ...topic, levels: Array.from({ length: 13 }, () => ({ title: 'x' })) },
      { ...topic, levels: [{ title: '   ' }] },
      { ...topic, tips: Array.from({ length: 7 }, () => 'hal penting') },
    ])
      expect(topicInputSchema.safeParse(bad).success).toBe(false);
  });

  it('menjaga bahasa untuk anak: kata terlarang dan kalimat terlalu panjang', () => {
    const forbidden = topicInputSchema.safeParse({
      ...topic,
      lesson: 'Jawaban yang salah diulang.',
    });
    expect(forbidden.success).toBe(false);
    const long = topicInputSchema.safeParse({
      ...topic,
      tips: [
        'Ini kalimat yang sangat panjang sekali sehingga anak kecil akan sangat kesulitan membacanya sampai habis tanpa jeda.',
      ],
    });
    expect(long.success).toBe(false);
    if (!long.success) expect(long.error.issues[0]?.path).toEqual(['tips', 0]);
  });

  it('buku wajib membawa topik pertama dan kelas 1 sampai 6', () => {
    const book = { subject: 'math', grade: 5, title: 'Matematika Kelas 5', topic };
    expect(bookInputSchema.safeParse(book).success).toBe(true);
    expect(bookInputSchema.safeParse({ ...book, grade: 7 }).success).toBe(false);
    expect(bookInputSchema.safeParse({ ...book, subject: 'seni' }).success).toBe(false);
    expect(bookInputSchema.safeParse({ ...book, topic: undefined }).success).toBe(false);
    expect(bookInputSchema.safeParse({ ...book, extra: 1 }).success).toBe(false);
  });
});

describe('bank soal tulisan sendiri', () => {
  it('soal yang benar lolos dengan petunjuk boleh kosong', () => {
    expect(bankQuestionSchema.safeParse(question(1)).success).toBe(true);
    expect(bankQuestionSchema.safeParse(question(1, { hint: '' })).success).toBe(true);
  });

  it('menolak soal yang keliru dengan pesan per isian', () => {
    const cases: [Partial<BankQuestion>, string, (string | number)[]][] = [
      [{ prompt: '  ' }, 'Tulis pertanyaannya.', ['prompt']],
      [{ choices: ['1'] }, 'Beri minimal 2 pilihan jawaban.', ['choices']],
      [{ choices: ['1', '2', '3', '4', '5'] }, 'Pilihan jawaban paling banyak 4.', ['choices']],
      [{ choices: ['1', ''] }, 'Pilihan jawaban tidak boleh kosong.', ['choices', 1]],
      [{ choices: ['Apel', 'apel'] }, 'Pilihan ini kembar.', ['choices', 1]],
      [{ answer: 3 }, 'Pilih jawaban yang benar.', ['answer']],
      [
        { prompt: 'Mana yang salah?' },
        'Memakai kata "salah" atau "gagal". Pakai "belum tepat".',
        ['prompt'],
      ],
      [
        { hint: 'Jangan gagal ya.' },
        'Memakai kata "salah" atau "gagal". Pakai "belum tepat".',
        ['hint'],
      ],
    ];
    for (const [patch, message, path] of cases) {
      const result = bankQuestionSchema.safeParse(question(2, patch));
      expect(result.success, JSON.stringify(patch)).toBe(false);
      if (!result.success)
        expect(
          result.error.issues.some((i) => i.message === message && i.path.join() === path.join()),
        ).toBe(true);
    }
  });

  it('bank butuh jumlah soal yang cukup dan tanpa pertanyaan kembar', () => {
    expect(questionBankSchema.safeParse(bank(BANK_MIN_QUESTIONS)).success).toBe(true);
    expect(questionBankSchema.safeParse(bank(BANK_MIN_QUESTIONS - 1)).success).toBe(false);
    expect(questionBankSchema.safeParse(bank(BANK_MAX_QUESTIONS + 1)).success).toBe(false);
    const dup = [...bank(5), question(1)];
    const issues = bankIssues(dup);
    expect(issues.ok).toBe(false);
    expect(issues.byQuestion.get(5)).toEqual(['Pertanyaan ini sama dengan soal ke-1.']);
  });

  it('bankIssues mengelompokkan isu umum dan per soal', () => {
    const few = bankIssues(bank(2));
    expect(few.general).toEqual([`Tulis minimal ${BANK_MIN_QUESTIONS} soal.`]);
    const mixed = bankIssues([...bank(4), question(9, { answer: 7 })]);
    expect(mixed.ok).toBe(false);
    expect([...mixed.byQuestion.keys()]).toEqual([4]);
    expect(bankIssues(bank(10))).toMatchObject({ ok: true, general: [] });
  });
});

describe('bank soal menjadi level yang bisa dimainkan', () => {
  const items = bank(12);

  it('bolak-balik tanpa kehilangan isi', () => {
    const level = bankToLevel(items);
    expect(level.generator).toBe('skill');
    expect(bankFromLevel(level)).toEqual(items);
    // Petunjuk kosong memakai kalimat bawaan, dan kembali kosong saat disunting.
    const blank = bankToLevel([question(1, { hint: '' }), ...bank(3)]);
    expect(bankFromLevel(blank)?.[0]?.hint).toBe('');
  });

  it('level dari generator bawaan atau tanpa soal bukan bank soal', () => {
    expect(bankFromLevel({ generator: null })).toBeNull();
    expect(bankFromLevel({ generator: 'count', generatorParams: { max: 10 } })).toBeNull();
    expect(
      bankFromLevel({ generator: 'skill', generatorParams: { family: 'expr', params: {} } }),
    ).toBeNull();
    expect(
      bankFromLevel({
        generator: 'skill',
        generatorParams: { family: 'manual', params: { items: [{ prompt: 1 }] } },
      }),
    ).toBeNull();
  });

  it('asal soal: tidak ada, bank, atau otomatis', () => {
    expect(levelSource({ generator: null })).toBe('none');
    expect(levelSource(bankToLevel(items))).toBe('bank');
    expect(levelSource({ generator: 'count', generatorParams: { max: 10 } })).toBe('auto');
    expect(
      levelSource({ generator: 'skill', generatorParams: { family: 'mix', params: {} } }),
    ).toBe('auto');
  });

  it('menghasilkan ronde 10 soal: jawaban benar ada di pilihan dan hasilnya tetap untuk seed yang sama', () => {
    const level = bankToLevel(items);
    const round = generateRound(
      { generator: level.generator!, generatorParams: level.generatorParams },
      42,
    );
    expect(round).toHaveLength(10);
    for (const q of round) {
      expect(q.type).toBe('choice');
      expect(q.options).toContain(q.answer);
      expect(q.options).toHaveLength(3);
    }
    expect(new Set(round.map((q) => q.prompt)).size).toBeGreaterThanOrEqual(8);
    expect(
      generateRound({ generator: level.generator!, generatorParams: level.generatorParams }, 42),
    ).toEqual(round);
  });
});
