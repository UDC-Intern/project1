import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { bookContentSchema, stimuliSupported, type SkillSpec } from '@udakids/engine';

/**
 * Menyusun content/<buku>/book.json dari folder skill berformat deklaratif.
 *
 *   tsx --conditions=source scripts/import-skills.ts <folder-skill> <kelas> [--subject=sains]
 *       [--prefix=K] [--max=10] [--only=H,I,N]
 *
 * `<folder-skill>` berisi _catalog.json (topik, pengantar, tips) dan satu berkas JSON per level.
 * - Topik buatan tangan di book.json yang sudah ada (generator bukan "skill") dipertahankan di depan.
 * - Tiap topik hasil impor memakai 4 level pertama yang soalnya bisa ditampilkan: level 1 dan 2 gratis,
 *   level 3 dan 4 Premium. Topik dengan kurang dari 4 level yang bisa ditampilkan dilewati.
 * - Jumlah topik dibatasi `--max` (bawaan 10), termasuk topik buatan tangan.
 * - Dijalankan ulang: topik hasil impor diganti, topik buatan tangan tetap.
 */

const [dir, gradeArg, ...flags] = process.argv.slice(2);
if (!dir || !gradeArg) {
  console.error(
    'Pakai: import-skills <folder-skill> <kelas 1-4> [--subject=sains] [--prefix=K] [--max=10] [--only=H,I]',
  );
  process.exit(1);
}
const flag = (name: string) =>
  flags.find((f) => f.startsWith(`--${name}=`))?.slice(name.length + 3);
const grade = Number(gradeArg);
const sains = flag('subject') === 'sains';
const prefix = flag('prefix') ?? '';
const max = Number(flag('max') ?? 10);
const only = flag('only')?.split(',');
const slug = `${sains ? 'sains' : 'matematika'}-kelas-${grade}`;
const target = join(process.cwd(), 'content', slug, 'book.json');

const LEVELS_PER_TOPIC = 4;
const FREE_LEVELS = 2;

type Skill = {
  title: string;
  category: string;
  order: number;
  family: string;
  params: Record<string, unknown>;
};
type Category = { code: string; title: string; intro?: string; tips?: string[] };
type Existing = {
  topics: { code: string; sort: number; levels: { number: number; generator: string | null }[] }[];
  [key: string]: unknown;
};

const catalog = JSON.parse(readFileSync(join(dir, '_catalog.json'), 'utf8')) as {
  categories: Category[];
};

// Kata yang tidak dipakai di teks anak.
const soften = (text: string) =>
  text
    .replace(
      /\bsalah satu(nya)?/gi,
      (m) => (m[0] === 'S' ? 'Satu di antara' : 'satu di antara') + (/nya$/i.test(m) ? 'nya' : ''),
    )
    .replace(/\bsalah\b/gi, (m) => (m[0] === 'S' ? 'Keliru' : 'keliru'))
    .replace(/\bgagal\b/gi, (m) => (m[0] === 'G' ? 'Belum berhasil' : 'belum berhasil'));
const clip = (text: string, limit: number) =>
  text.length <= limit ? text : `${text.slice(0, limit - 1).trimEnd()}…`;

/** "Nilai tempat — Level 1 — Tabel nilai tempat" menjadi "Tabel nilai tempat". */
const levelLabel = (title: string) => title.replace(/^.*?—\s*Level\s+\d+\s*—\s*/, '');

type Part = { family: string; params: Record<string, unknown>; weight?: number };

/** Bagian yang tidak didukung dibuang; sisanya menjadi satu spesifikasi. */
function usable(skill: Skill): SkillSpec | null {
  if (skill.family !== 'mix') {
    const spec = { family: skill.family, params: skill.params } as SkillSpec;
    return stimuliSupported(spec) ? spec : null;
  }
  const parts = (skill.params.parts as Part[]).filter((p) =>
    stimuliSupported({ family: p.family, params: p.params } as SkillSpec),
  );
  if (parts.length === 0) return null;
  if (parts.length === 1) {
    return { family: parts[0]!.family, params: parts[0]!.params } as SkillSpec;
  }
  return {
    family: 'mix',
    params: {
      parts: parts.map((p) => ({
        family: p.family,
        params: p.params,
        ...(p.weight ? { weight: p.weight } : {}),
      })),
    },
  };
}

const byCategory = new Map<string, Skill[]>();
for (const file of readdirSync(dir)) {
  if (!file.endsWith('.json') || file.startsWith('_')) continue;
  const skill = JSON.parse(readFileSync(join(dir, file), 'utf8')) as Skill;
  const list = byCategory.get(skill.category) ?? [];
  list.push(skill);
  byCategory.set(skill.category, list);
}

const existing: Existing | null = existsSync(target)
  ? (JSON.parse(readFileSync(target, 'utf8')) as Existing)
  : null;
const handmade = (existing?.topics ?? []).filter((t) =>
  t.levels.every((l) => l.generator !== null && l.generator !== 'skill'),
);

const candidates = catalog.categories
  .filter((cat) => !only || only.includes(cat.code))
  .flatMap((cat) => {
    const levels = (byCategory.get(cat.code) ?? [])
      .sort((a, b) => a.order - b.order)
      .flatMap((s) => {
        const spec = usable(s);
        return spec ? [{ title: clip(levelLabel(s.title), 60), spec }] : [];
      })
      .slice(0, LEVELS_PER_TOPIC);
    if (levels.length < LEVELS_PER_TOPIC) return [];
    return [
      {
        code: `${prefix}${cat.code}`,
        title: clip(cat.title, 60),
        lesson: clip(soften(cat.intro ?? cat.title), 600),
        ...(cat.tips?.length
          ? { tips: cat.tips.slice(0, 6).map((t) => clip(soften(t), 200)) }
          : {}),
        levels: levels.map((l, i) => ({
          number: i + 1,
          title: l.title,
          isFree: i < FREE_LEVELS,
          generator: 'skill' as const,
          generatorParams: l.spec as unknown as Record<string, unknown>,
        })),
      },
    ];
  })
  .slice(0, Math.max(0, max - handmade.length));

// Topik buatan tangan: level 1 dan 2 gratis, sisanya Premium.
const kept = handmade.map((t) => ({
  ...t,
  levels: t.levels.map((l) => ({ ...l, isFree: l.number <= FREE_LEVELS })),
}));

const book = {
  slug,
  grade: (existing?.grade as string | undefined) ?? (grade === 1 ? 'kelas-1' : `sd${grade}`),
  subject: sains ? 'science' : 'math',
  title:
    (existing?.title as string | undefined) ?? `${sains ? 'Sains' : 'Matematika'} Kelas ${grade}`,
  sort: (existing?.sort as number | undefined) ?? (sains ? 2 : grade === 1 ? 1 : 10 + grade),
  topics: [...kept, ...candidates].map((t, i) => ({ ...t, sort: i + 1 })),
};
const parsed = bookContentSchema.parse(book);
writeFileSync(target, `${JSON.stringify(parsed)}\n`);
const levels = parsed.topics.reduce((n, t) => n + t.levels.length, 0);
console.log(`${slug}: ${parsed.topics.length} topik, ${levels} level`);
