import type { Rng } from '../rng.js';
import { evalBool, evalNumber, ExprError, type Vars } from './expr-eval.js';
import {
  factsQuestion,
  factsSupported,
  manualQuestion,
  manualSupported,
  Reject,
  reject,
  soften,
  type FactsParams,
  type ManualItem,
  type PartLike,
} from './skill-parts.js';
import type { Family, GeneratedQuestion } from './types.js';

/**
 * Soal ber-template untuk materi kelas 1 sampai 4. Setiap level menyimpan spesifikasi deklaratif:
 * variabel acak, variabel turunan, batasan, kalimat soal, ekspresi jawaban dan pengecoh, serta pembahasan.
 * Seed yang sama memberi soal yang sama, jadi penilaian dapat membuat ulang soal tanpa menyimpan kunci.
 */

export type SkillSpec = {
  family: 'expr' | 'manual' | 'facts' | 'mix';
  params: Record<string, unknown>;
};

type VarSpec = [number, number] | { values: number[] } | { range: [number, number]; step: number };
type Distractor = string | { expr: string; tag?: string } | { num: string; den: string };

type ExprParams = {
  vars?: Record<string, VarSpec>;
  derived?: Record<string, string>;
  words?: Record<string, string[]>;
  constraint?: string;
  prompt: string;
  say?: string;
  stimulus?: unknown[];
  format?: 'number' | 'decimal' | 'fraction';
  answer?: string;
  fraction?: { num: string; den: string; simplify?: boolean };
  unit?: string;
  distractors?: Distractor[];
  mode?: 'choice' | 'input';
  choices?: number;
  allowNegative?: boolean;
  explain: string;
  labels?: Record<string, string>;
  labelSay?: Record<string, string>;
};

const ROUND = 1e6;
const clean = (x: number) => Math.round(x * ROUND) / ROUND;
const shownExactly = (v: number) => Math.abs(clean(v) * 1000 - Math.round(clean(v) * 1000)) < 1e-6;

/** Angka gaya Indonesia: 12.500 dan 0,25. */
export const formatId = (n: number, maxDecimals = 3) =>
  clean(n).toLocaleString('id-ID', { maximumFractionDigits: maxDecimals });

const gcd = (a: number, b: number): number => (b === 0 ? Math.abs(a) : gcd(b, a % b));
const simplify = (n: number, d: number): [number, number] => {
  const g = gcd(n, d) || 1;
  return [n / g, d / g];
};

const UNITS = [
  'nol',
  'satu',
  'dua',
  'tiga',
  'empat',
  'lima',
  'enam',
  'tujuh',
  'delapan',
  'sembilan',
];
export function numberWord(n: number): string {
  if (!Number.isInteger(n) || n < 0 || n > 999_999_999) return String(n);
  if (n < 10) return UNITS[n]!;
  if (n === 10) return 'sepuluh';
  if (n === 11) return 'sebelas';
  if (n < 20) return `${UNITS[n - 10]} belas`;
  if (n < 100) {
    const u = n % 10;
    return `${UNITS[Math.floor(n / 10)]} puluh${u ? ` ${UNITS[u]}` : ''}`;
  }
  if (n < 1000) {
    const h = Math.floor(n / 100);
    const rest = n % 100;
    return `${h === 1 ? 'seratus' : `${UNITS[h]} ratus`}${rest ? ` ${numberWord(rest)}` : ''}`;
  }
  if (n < 1_000_000) {
    const th = Math.floor(n / 1000);
    const rest = n % 1000;
    return `${th === 1 ? 'seribu' : `${numberWord(th)} ribu`}${rest ? ` ${numberWord(rest)}` : ''}`;
  }
  const m = Math.floor(n / 1_000_000);
  const rest = n % 1_000_000;
  return `${numberWord(m)} juta${rest ? ` ${numberWord(rest)}` : ''}`;
}

const TEMPLATE_RE = /\{(=[^}]+|w:[a-zA-Z_][a-zA-Z0-9_]*|[a-zA-Z_][a-zA-Z0-9_]*)\}/g;

/** Jenis gambar pendukung yang bisa ditampilkan sebagai teks. */
const TEXT_STIMULI = new Set(['text', 'equation']);

/** Apakah bagian soal ini bisa dibuat dan ditampilkan sebagai teks? Dipakai saat mengimpor konten. */
export function partSupported(p: PartLike): boolean {
  if (p.family === 'expr') {
    const e = p.params as unknown as ExprParams;
    return (
      (e.stimulus ?? []).every(
        (x) =>
          typeof x === 'object' &&
          x !== null &&
          TEXT_STIMULI.has((x as { kind?: string }).kind ?? ''),
      ) &&
      // Isian pecahan atau desimal belum bisa diketik dengan papan angka.
      !(e.mode === 'input' && (e.format ?? 'number') !== 'number')
    );
  }
  if (p.family === 'manual') return manualSupported(p.params);
  if (p.family === 'facts') return factsSupported(p.params);
  return false;
}

/** Apakah seluruh spesifikasi ini bisa ditampilkan? */
export function stimuliSupported(spec: SkillSpec): boolean {
  const parts =
    spec.family === 'mix'
      ? ((spec.params.parts as PartLike[] | undefined) ?? [])
      : [{ family: spec.family, params: spec.params }];
  return parts.length > 0 && parts.every(partSupported);
}

function orderDerived(derived: Record<string, string>, vars: Record<string, number>): void {
  const pending = Object.keys(derived);
  let guard = pending.length + 1;
  while (pending.length > 0 && guard-- > 0) {
    for (const name of [...pending]) {
      try {
        vars[name] = clean(evalNumber(derived[name]!, vars));
        pending.splice(pending.indexOf(name), 1);
      } catch (err) {
        if (!(err instanceof ExprError) || !/variabel tidak dikenal/.test(err.message)) throw err;
      }
    }
  }
  if (pending.length > 0) reject('variabel turunan melingkar');
}

function exprQuestion(p: ExprParams, rng: Rng): GeneratedQuestion {
  const vars: Record<string, number> = {};
  for (const [name, spec] of Object.entries(p.vars ?? {})) {
    if (Array.isArray(spec)) vars[name] = rng.int(spec[0], spec[1]);
    else if ('values' in spec) vars[name] = rng.pick(spec.values);
    else {
      const steps = Math.floor(clean((spec.range[1] - spec.range[0]) / spec.step));
      vars[name] = clean(spec.range[0] + rng.int(0, steps) * spec.step);
    }
  }
  orderDerived(p.derived ?? {}, vars);
  const words = Object.fromEntries(
    Object.entries(p.words ?? {}).map(([k, list]) => [k, rng.pick(list)]),
  );
  if (p.constraint && !evalBool(p.constraint, vars as Vars)) reject('batasan');

  const format = p.format ?? 'number';
  const mode = p.mode ?? 'choice';
  const want = p.choices ?? 4;
  const unit = p.unit ? (/^[°%]/.test(p.unit) ? p.unit : ` ${p.unit}`) : '';
  let answerText: string;
  let answerSay: string | undefined;
  let answerValue = 0;
  let options: string[] = [];

  if (format === 'fraction') {
    const rawN = evalNumber(p.fraction!.num, vars);
    const rawD = evalNumber(p.fraction!.den, vars);
    const [n, d] = p.fraction!.simplify === false ? [rawN, rawD] : simplify(rawN, rawD);
    if (!Number.isInteger(n) || !Number.isInteger(d) || d <= 0 || n < 0)
      reject('pecahan tidak valid');
    const show = (a: number, b: number) => (b === 1 ? formatId(a) : `${a}/${b}`);
    answerText = show(n, d);
    answerValue = n / d;
    const seen = new Set([clean(n / d)]);
    const pool: string[] = [];
    for (const dist of p.distractors ?? []) {
      if (typeof dist === 'string' || !('num' in dist)) continue;
      const dn = evalNumber(dist.num, vars);
      const dd = evalNumber(dist.den, vars);
      if (!Number.isInteger(dn) || !Number.isInteger(dd) || dd <= 0 || dn < 0) continue;
      if (dn === 0 && n !== 0) continue;
      if (seen.has(clean(dn / dd))) continue;
      seen.add(clean(dn / dd));
      pool.push(show(dn, dd));
    }
    if (pool.length < want - 1) reject('pengecoh pecahan kurang');
    options = rng.shuffle([answerText, ...rng.shuffle(pool).slice(0, want - 1)]);
  } else if (p.labels) {
    const raw = clean(evalNumber(p.answer!, vars));
    const text = p.labels[String(raw)];
    if (text === undefined) reject(`jawaban ${raw} tidak punya label`);
    answerValue = raw;
    answerText = text!;
    answerSay = p.labelSay?.[String(raw)];
    options = rng.shuffle(Object.values(p.labels));
  } else {
    const raw = clean(evalNumber(p.answer!, vars));
    if (!Number.isFinite(raw)) reject('jawaban tidak hingga');
    if (format === 'number' && !Number.isInteger(raw)) reject('jawaban bukan bilangan bulat');
    if (!p.allowNegative && raw < 0) reject('jawaban negatif');
    if (!shownExactly(raw)) reject('jawaban lebih dari 3 angka desimal');
    answerValue = raw;
    answerText = `${formatId(raw)}${unit}`;
    const pool = new Set<number>();
    const ok = (v: number) =>
      Number.isFinite(v) &&
      v !== raw &&
      (p.allowNegative || v >= 0) &&
      (format !== 'number' || Number.isInteger(v)) &&
      shownExactly(v);
    for (const d of p.distractors ?? []) {
      if (typeof d !== 'string' && !('expr' in d)) continue;
      let v: number;
      try {
        v = clean(evalNumber(typeof d === 'string' ? d : d.expr, vars));
      } catch {
        continue;
      }
      if (ok(v)) pool.add(v);
    }
    const step =
      format === 'decimal' ? 0.1 : 10 ** Math.floor(Math.log10(Math.max(1, Math.abs(raw) / 10)));
    for (const k of [1, -1, 2, -2, 3, -3, 5, -5, 10]) {
      if (pool.size >= want - 1) break;
      const v = clean(raw + k * step);
      if (ok(v)) pool.add(v);
    }
    if (mode === 'choice' && pool.size < want - 1) reject('pengecoh kurang');
    options = rng.shuffle([
      answerText,
      ...[...pool].slice(0, want - 1).map((v) => `${formatId(v)}${unit}`),
    ]);
  }

  const unitWord = p.unit?.trim();
  const dupUnit = unitWord
    ? new RegExp(
        `(${unitWord.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})(\\s+\\1)+(?![\\p{L}\\d])`,
        'gu',
      )
    : undefined;
  const fill = (text: string) => {
    const out = text.replace(TEMPLATE_RE, (_, name: string) => {
      if (name === 'answer') return answerText;
      if (name === 'answer_say') return answerSay ?? answerText;
      if (name.startsWith('=')) return formatId(evalNumber(name.slice(1), vars));
      if (name.startsWith('w:')) return numberWord(vars[name.slice(2)]!);
      if (name in words) return words[name]!;
      if (!(name in vars)) return `{${name}}`;
      return formatId(vars[name]!);
    });
    return dupUnit ? out.replace(dupUnit, '$1') : out;
  };

  const stimulusLines: string[] = [];
  for (const s of p.stimulus ?? []) {
    const v = s as {
      kind?: string;
      text?: string;
      left?: unknown;
      op?: string;
      right?: unknown;
      result?: unknown;
    };
    if (v.kind === 'text' && typeof v.text === 'string') stimulusLines.push(fill(v.text));
    else if (v.kind === 'equation') {
      const num = (x: unknown) =>
        typeof x === 'string' && x.startsWith('=')
          ? formatId(evalNumber(x.slice(1), vars))
          : String(x);
      stimulusLines.push(
        `${num(v.left)} ${v.op === '-' ? '−' : '+'} ${num(v.right)} = ${v.result === undefined ? '?' : num(v.result)}`,
      );
    } else reject('gambar pendukung belum didukung');
  }

  const prompt = soften([fill(p.prompt), ...stimulusLines].join('\n'));
  const explanation = soften(fill(p.explain));
  if (mode === 'input') {
    return {
      type: 'number',
      prompt,
      visual: null,
      options: null,
      answer: String(answerValue),
      explanation,
    };
  }
  if (new Set(options).size !== options.length) reject('pilihan kembar');
  const shown = options.map(soften);
  return {
    type: 'choice',
    prompt,
    visual: null,
    options: shown,
    answer: soften(answerText),
    explanation,
  };
}

function makePart(part: PartLike, rng: Rng): GeneratedQuestion {
  if (part.family === 'expr') return exprQuestion(part.params as unknown as ExprParams, rng);
  if (part.family === 'manual')
    return manualQuestion(part.params as unknown as { items: ManualItem[] }, rng);
  if (part.family === 'facts') return factsQuestion(part.params as unknown as FactsParams, rng);
  return reject('bagian belum didukung');
}

export const skill: Family = (rng, _band, params) => {
  const spec = params as unknown as SkillSpec;
  for (let attempt = 0; attempt < 100; attempt++) {
    try {
      if (spec.family === 'mix') {
        const parts = spec.params.parts as {
          family: string;
          params: ExprParams;
          weight?: number;
        }[];
        const total = parts.reduce((a, x) => a + (x.weight ?? 1), 0);
        let pickAt = (rng.int(0, 999_999) / 1_000_000) * total;
        const part = parts.find((x) => (pickAt -= x.weight ?? 1) < 0) ?? parts[parts.length - 1]!;
        return makePart(part, rng);
      }
      return makePart(spec, rng);
    } catch (err) {
      if (!(err instanceof Reject) && !(err instanceof ExprError)) throw err;
    }
  }
  throw new Error('Soal tidak bisa dibuat dari spesifikasi ini.');
};
