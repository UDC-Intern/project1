import { describe, expect, it } from 'vitest';
import { createRng, generateRound, stimuliSupported } from '../src/index.js';
import { partSupported } from '../src/generator/skill.js';
import { factsQuestion, manualQuestion, soften } from '../src/generator/skill-parts.js';

const table = [
  { name: 'Sirip ikan', attrs: { u: 'berenang' } },
  { name: 'Sayap burung', attrs: { u: 'terbang' } },
  { name: 'Duri landak', attrs: { u: 'melindungi tubuh' } },
  { name: 'Kaki bebek', attrs: { u: 'berenang' } },
  { name: 'Sayap kupu-kupu', attrs: { u: 'terbang' } },
  { name: 'Cangkang kura-kura', attrs: { u: 'melindungi tubuh' } },
];

const facts = (ask: 'value' | 'name' | 'odd' | 'true-false') => ({
  table,
  attr: 'u',
  ask,
  prompt: '{name}: apa gunanya?',
  explain: '{name} dipakai untuk {value}.',
  choices: 3,
});

describe('soal dari tabel fakta', () => {
  for (const ask of ['value', 'name', 'odd', 'true-false'] as const) {
    it(`mode ${ask} menghasilkan satu jawaban di antara pilihan`, () => {
      for (let seed = 1; seed < 40; seed++) {
        const q = factsQuestion(facts(ask), createRng(seed));
        expect(q.type).toBe('choice');
        expect(q.options).toContain(q.answer);
        expect(new Set(q.options).size).toBe(q.options!.length);
        expect(q.prompt).not.toMatch(/\{(name|value)\}/);
      }
    });
  }
});

describe('bank soal buatan', () => {
  const items = Array.from({ length: 5 }, (_, i) => ({
    prompt: `Soal ${i}?`,
    choices: [
      { visual: { kind: 'text', text: `benar ${i}` } },
      { visual: { kind: 'text', text: `lain ${i}` } },
      { visual: { kind: 'text', text: `lagi ${i}` } },
    ],
    answer: 0,
    reteach: 'Itu salah satu cara.',
  }));

  it('memilih satu soal dan mengacak pilihan', () => {
    const q = manualQuestion({ items }, createRng(3));
    expect(q.options).toContain(q.answer);
    expect(q.answer).toMatch(/^benar/);
    expect(q.explanation).toBe('Itu satu di antara cara.');
  });

  it('hanya menerima bank bertulisan dengan jawaban tunggal', () => {
    expect(partSupported({ family: 'manual', params: { items } })).toBe(true);
    expect(partSupported({ family: 'manual', params: { items: items.slice(0, 2) } })).toBe(false);
    const withImage = items.map((it) => ({
      ...it,
      choices: [{ visual: { kind: 'shape' } }, ...it.choices.slice(1)],
    }));
    expect(partSupported({ family: 'manual', params: { items: withImage } })).toBe(false);
    expect(partSupported({ family: 'facts', params: facts('name') })).toBe(true);
    expect(partSupported({ family: 'count', params: {} })).toBe(false);
  });

  it('kata yang dihindari diganti', () => {
    expect(soften('Salah satunya benar. Jangan salah. Gagal lagi.')).toBe(
      'Satu di antaranya benar. Jangan keliru. Belum berhasil lagi.',
    );
  });
});

describe('spesifikasi ekspresi', () => {
  const spec = (params: Record<string, unknown>) => ({
    generator: 'skill',
    generatorParams: { family: 'expr', params },
  });

  it('jawaban kategori memakai label', () => {
    const qs = generateRound(
      spec({
        vars: { a: [1, 9], b: [1, 9] },
        prompt: '{a} dan {b}. Mana yang lebih besar?',
        answer: '(a > b) * 1 + (a == b) * 2 + (a < b) * 3',
        labels: { '1': 'pertama', '2': 'sama', '3': 'kedua' },
        explain: 'Bandingkan {a} dan {b}.',
      }),
      11,
    );
    for (const q of qs) expect(['pertama', 'sama', 'kedua']).toContain(q.answer);
  });

  it('isian angka dan pecahan', () => {
    const input = generateRound(
      spec({
        vars: { a: [1, 9], b: [1, 9] },
        prompt: '{a} + {b} = ...',
        answer: 'a + b',
        mode: 'input',
        explain: '{a} + {b} = {answer}.',
      }),
      5,
    );
    expect(input[0]!.type).toBe('number');
    expect(Number(input[0]!.answer)).toBeGreaterThan(1);

    const frac = generateRound(
      spec({
        vars: { n: [1, 3], d: [4, 8] },
        format: 'fraction',
        prompt: 'Berapa {n}/{d}?',
        fraction: { num: 'n', den: 'd', simplify: false },
        distractors: [
          { num: 'n + 1', den: 'd' },
          { num: 'n', den: 'd + 1' },
          { num: 'n + 2', den: 'd' },
        ],
        explain: 'Jawabannya {answer}.',
      }),
      9,
    );
    expect(frac[0]!.type).toBe('choice');
    expect(frac[0]!.answer).toMatch(/\d+\/\d+/);
  });

  it('gambar pendukung yang tidak bisa ditampilkan membuat spesifikasi ditolak', () => {
    expect(
      stimuliSupported({
        family: 'expr',
        params: { prompt: 'x', explain: 'y', answer: '1', stimulus: [{ kind: 'clock' }] },
      }),
    ).toBe(false);
    expect(
      stimuliSupported({
        family: 'expr',
        params: {
          prompt: 'x',
          explain: 'y',
          answer: '1',
          stimulus: [{ kind: 'equation', left: 3, op: '+', right: 4 }],
        },
      }),
    ).toBe(true);
  });
});

describe('fitur lain spesifikasi ekspresi', () => {
  const run = (params: Record<string, unknown>, seed = 3) =>
    generateRound({ generator: 'skill', generatorParams: { family: 'expr', params } }, seed);

  it('variabel berdaftar nilai dan berlangkah, kata, satuan, dan templat ekspresi', () => {
    const qs = run({
      vars: { a: { values: [2, 4, 6] }, p: { range: [10, 50], step: 10 } },
      words: { benda: ['pensil', 'buku'] },
      derived: { c: 'a * p' },
      prompt: 'Ada {a} {benda}, tiap {p} cm. Tulis {w:a}. Dua kali {=a*2}.',
      stimulus: [
        { kind: 'text', text: 'Panjang {c} cm' },
        { kind: 'equation', left: '=a', op: '-', right: 1, result: '=a-1' },
      ],
      answer: 'c',
      unit: 'cm',
      explain: 'Hasilnya {answer} cm.',
    });
    for (const q of qs) {
      expect(q.prompt).toMatch(/Panjang \d+ cm/);
      expect(q.prompt).toContain('−');
      expect(q.answer).toMatch(/cm$/);
      expect(q.explanation).not.toMatch(/cm cm/);
    }
  });

  it('desimal, batasan, dan jawaban negatif yang diizinkan', () => {
    const dec = run({
      vars: { a: [1, 9] },
      format: 'decimal',
      prompt: '{a} dibagi 4',
      answer: 'a / 4',
      distractors: ['a / 2', { expr: 'a / 8', tag: 'x' }, 'a * 2'],
      constraint: 'a != 5',
      explain: '{answer}',
    });
    expect(dec[0]!.answer).toMatch(/,|\d/);
    const neg = run({
      vars: { a: [1, 5], b: [6, 9] },
      prompt: '{a} - {b}',
      answer: 'a - b',
      allowNegative: true,
      explain: '{answer}',
    });
    expect(neg[0]!.answer).toMatch(/^-/);
  });

  it('spesifikasi mustahil dan variabel turunan melingkar gagal dengan pesan jelas', () => {
    expect(() =>
      run({ vars: { a: [1, 3] }, prompt: 'x', answer: 'a', constraint: 'a > 100', explain: 'y' }),
    ).toThrow(/tidak bisa dibuat/);
    expect(() =>
      run({
        vars: { a: [1, 3] },
        derived: { p: 'q + 1', q: 'p + 1' },
        prompt: 'x',
        answer: 'a',
        explain: 'y',
      }),
    ).toThrow(/tidak bisa dibuat/);
  });

  it('campuran bobot dan bagian yang tidak didukung', () => {
    const part = (prompt: string) => ({
      family: 'expr',
      params: { vars: { a: [1, 9] }, prompt, answer: 'a', explain: 'e' },
      weight: 2,
    });
    const qs = generateRound(
      {
        generator: 'skill',
        generatorParams: { family: 'mix', params: { parts: [part('satu'), part('dua')] } },
      },
      21,
    );
    const seen = new Set(qs.map((q) => q.prompt.split('\n')[0]!.slice(0, 3)));
    expect(seen.size).toBeGreaterThan(0);
    expect(() =>
      generateRound(
        {
          generator: 'skill',
          generatorParams: { family: 'mix', params: { parts: [{ family: 'count', params: {} }] } },
        },
        1,
      ),
    ).toThrow();
  });
});

describe('sampel yang ditolak pada tabel fakta dan bank soal', () => {
  const same = [
    { name: 'A', attrs: { u: 'x' } },
    { name: 'B', attrs: { u: 'x' } },
    { name: 'C', attrs: { u: 'x' } },
    { name: 'D', attrs: { u: 'x' } },
  ];
  const base = { attr: 'u', prompt: '{name}', explain: '{value}', choices: 3 };

  it('menolak bila pengecoh atau kelompok kurang', () => {
    for (const ask of ['value', 'name', 'odd'] as const)
      expect(() => factsQuestion({ ...base, table: same, ask }, createRng(1))).toThrow();
    expect(() =>
      factsQuestion({ ...base, table, ask: 'name', only: ['tidak-ada'] }, createRng(1)),
    ).toThrow();
  });

  it('benar atau belum tepat selalu benar bila semua baris sama', () => {
    const q = factsQuestion({ ...base, table: same, ask: 'true-false' }, createRng(2));
    expect(q.answer).toBe('Benar');
  });

  it('hanya baris yang cocok dengan filter yang dipakai', () => {
    const q = factsQuestion({ ...facts('name'), only: ['terbang'] }, createRng(4));
    expect(['Sayap burung', 'Sayap kupu-kupu']).toContain(q.answer);
  });

  it('menolak bank dengan pilihan kembar', () => {
    const dup = [
      {
        prompt: 'p',
        choices: [
          { visual: { kind: 'text', text: 'sama' } },
          { visual: { kind: 'text', text: 'sama' } },
        ],
        answer: 0,
      },
    ];
    expect(() => manualQuestion({ items: dup }, createRng(1))).toThrow();
  });
});

describe('satuan, label bacaan, dan pecahan sederhana', () => {
  const run = (params: Record<string, unknown>, seed = 8) =>
    generateRound({ generator: 'skill', generatorParams: { family: 'expr', params } }, seed);

  it('satuan derajat dan persen menempel pada angka', () => {
    const deg = run({
      vars: { a: [10, 80] },
      prompt: 'Sudut {a}°. Berapa sisanya?',
      answer: '90 - a',
      unit: '°',
      explain: '{answer}',
    });
    expect(deg[0]!.answer).toMatch(/\d°$/);
    const pct = run({
      vars: { a: [1, 9] },
      prompt: '{a} persen',
      answer: 'a * 10',
      unit: '%',
      explain: '{answer}',
      choices: 3,
    });
    expect(pct[0]!.options).toHaveLength(3);
    expect(pct[0]!.answer).toMatch(/\d%$/);
  });

  it('pecahan yang disederhanakan menjadi bilangan bulat dan label bacaan', () => {
    const f = run({
      vars: { n: [2, 3] },
      format: 'fraction',
      prompt: 'Berapa {n}/{n}?',
      fraction: { num: 'n * 2', den: 'n', simplify: true },
      distractors: [
        { num: 'n', den: 'n', tag: 'a' },
        { num: 'n + 1', den: 'n', tag: 'b' },
        { num: 'n + 2', den: 'n', tag: 'c' },
        { num: '0', den: 'n', tag: 'd' },
      ],
      explain: '{answer}',
    });
    expect(f[0]!.answer).toBe('2');
    const l = run({
      vars: { a: [1, 2] },
      prompt: 'Pilih',
      answer: 'a',
      labels: { '1': '>', '2': '<' },
      labelSay: { '1': 'lebih dari', '2': 'kurang dari' },
      explain: 'Jawabannya {answer_say}.',
    });
    expect(l[0]!.explanation).toMatch(/lebih dari|kurang dari/);
  });
});
