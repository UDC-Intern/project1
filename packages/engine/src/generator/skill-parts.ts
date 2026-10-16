import type { Rng } from '../rng.js';
import type { GeneratedQuestion } from './types.js';

/** Sampel ditolak: pembuat soal mencoba lagi dengan nilai acak berikutnya. */
export class Reject extends Error {}
export const reject = (why: string): never => {
  throw new Reject(why);
};

/** Kata yang dihindari untuk anak diganti: "salah satu" menjadi "satu di antara", "salah" menjadi "keliru". */
export const soften = (text: string) =>
  text
    .replace(
      /\bSalah satu(nya)?/g,
      (_m, n: string | undefined) => `Satu di antara${n ? 'nya' : ''}`,
    )
    .replace(
      /\bsalah satu(nya)?/g,
      (_m, n: string | undefined) => `satu di antara${n ? 'nya' : ''}`,
    )
    .replace(/\bSalah\b/g, 'Keliru')
    .replace(/\bsalah\b/g, 'keliru')
    .replace(/\bGagal\b/g, 'Belum berhasil')
    .replace(/\bgagal\b/g, 'belum berhasil');

export type PartLike = { family: string; params: Record<string, unknown> };

export type ManualItem = {
  prompt: string;
  stimulus?: unknown[];
  choices?: { visual?: { kind?: string; text?: string }; say?: string }[];
  answer?: number | number[];
  input?: unknown;
  reteach?: string;
};

export type FactsParams = {
  table: { name: string; attrs: Record<string, string | string[]> }[];
  attr: string;
  ask?: 'value' | 'name' | 'odd' | 'true-false';
  only?: string[];
  prompt: string;
  explain: string;
  choices?: number;
};

const isTextVisual = (v: unknown) =>
  typeof v === 'object' &&
  v !== null &&
  ['text', 'word'].includes((v as { kind?: string }).kind ?? '');

/** Bank soal pilihan ganda bertulisan: bisa dibuat dan ditampilkan sebagai teks? */
export function manualSupported(params: Record<string, unknown>): boolean {
  const items = (params.items as ManualItem[] | undefined) ?? [];
  return (
    items.length >= 4 &&
    items.every(
      (it) =>
        !it.input &&
        typeof it.answer === 'number' &&
        (it.stimulus ?? []).length === 0 &&
        (it.choices ?? []).length >= 2 &&
        (it.choices ?? []).every((c) => isTextVisual(c.visual)),
    )
  );
}

export function factsSupported(params: Record<string, unknown>): boolean {
  const f = params as unknown as FactsParams;
  return (
    (f.table ?? []).length >= 4 && ['value', 'name', 'odd', 'true-false'].includes(f.ask ?? 'name')
  );
}

/** Satu soal dari bank soal buatan: pilih acak, urutan pilihan diacak. */
export function manualQuestion(p: { items: ManualItem[] }, rng: Rng): GeneratedQuestion {
  const it = rng.pick(p.items);
  const texts = (it.choices ?? []).map((c) => c.visual?.text ?? '');
  const answer = texts[it.answer as number]!;
  if (new Set(texts).size !== texts.length) reject('pilihan kembar');
  return {
    type: 'choice',
    prompt: soften(it.prompt),
    visual: null,
    options: rng.shuffle(texts).map(soften),
    answer: soften(answer),
    explanation: soften(it.reteach ?? 'Yuk kita lihat lagi bersama.'),
  };
}

/**
 * Soal dari tabel fakta: tanya nilai (benda lalu fungsi), tanya nama (fungsi lalu benda), cari yang bukan
 * anggota kelompok, atau benar dan belum tepat. Pengecoh diambil dari baris yang tidak punya nilai itu.
 */
export function factsQuestion(p: FactsParams, rng: Rng): GeneratedQuestion {
  type Row = FactsParams['table'][number];
  const valuesOf = (r: Row): string[] => {
    const v = r.attrs[p.attr];
    return v === undefined ? [] : Array.isArray(v) ? v : [v];
  };
  const all = p.table.filter((r) => valuesOf(r).length > 0);
  const rows = p.only ? all.filter((r) => valuesOf(r).some((v) => p.only!.includes(v))) : all;
  if (rows.length === 0) reject('tabel kosong');
  const want = p.choices ?? 4;
  const fill = (t: string, name: string, v: string) =>
    t
      .replace(/\{name\}/g, name)
      .replace(/\{value\}/g, v)
      .replace(/\b(?:adalah|merupakan) (bukan|tidak)\b/gi, '$1');
  const out = (
    prompt: string,
    options: string[],
    answer: string,
    explain: string,
  ): GeneratedQuestion => {
    if (new Set(options).size !== options.length) reject('pilihan kembar');
    return {
      type: 'choice',
      prompt: soften(prompt),
      visual: null,
      options: options.map(soften),
      answer: soften(answer),
      explanation: soften(explain),
    };
  };
  const ask = p.ask ?? 'name';

  if (ask === 'value') {
    const target = rng.pick(rows);
    const own = valuesOf(target);
    const answer = rng.pick(own);
    const others = [...new Set(all.flatMap(valuesOf))].filter((v) => !own.includes(v));
    if (others.length < want - 1) reject('nilai pengecoh kurang');
    return out(
      fill(p.prompt, target.name, answer),
      rng.shuffle([answer, ...rng.shuffle(others).slice(0, want - 1)]),
      answer,
      fill(p.explain, target.name, answer),
    );
  }

  if (ask === 'name' || ask === 'true-false') {
    const target = rng.pick(rows);
    const v = rng.pick(valuesOf(target));
    const wrong = all.filter((r) => !valuesOf(r).includes(v));
    if (ask === 'true-false') {
      const truth = rng.chance(0.5) || wrong.length === 0;
      const subject = truth ? target : rng.pick(wrong);
      return out(
        fill(p.prompt, subject.name, v),
        ['Benar', 'Belum tepat'],
        truth ? 'Benar' : 'Belum tepat',
        fill(p.explain, subject.name, truth ? v : valuesOf(subject)[0]!),
      );
    }
    if (wrong.length < want - 1) reject('pengecoh kurang');
    return out(
      fill(p.prompt, target.name, v),
      rng.shuffle([
        target.name,
        ...rng
          .shuffle(wrong)
          .slice(0, want - 1)
          .map((r) => r.name),
      ]),
      target.name,
      fill(p.explain, target.name, v),
    );
  }

  const groups = [...new Set(rows.flatMap(valuesOf))].filter(
    (v) => rows.filter((r) => valuesOf(r).includes(v)).length >= want - 1,
  );
  if (groups.length === 0) reject('kelompok kurang anggota');
  const v = rng.pick(groups);
  const members = rng.shuffle(rows.filter((r) => valuesOf(r).includes(v))).slice(0, want - 1);
  const outsiders = all.filter((r) => !valuesOf(r).includes(v));
  if (outsiders.length === 0) reject('tidak ada yang bukan anggota');
  const odd = rng.pick(outsiders);
  return out(
    fill(p.prompt, odd.name, v),
    rng.shuffle([odd.name, ...members.map((r) => r.name)]),
    odd.name,
    fill(p.explain, odd.name, v),
  );
}
