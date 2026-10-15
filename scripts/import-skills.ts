import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { bookContentSchema, stimuliSupported, type SkillSpec } from '@udakids/engine';

/**
 * Menyusun content/<slug>/book.json dari folder skill berformat deklaratif.
 *
 *   tsx --conditions=source scripts/import-skills.ts <folder-skill> <kelas> [--prefix=K] [--append]
 *
 * `<folder-skill>` berisi _catalog.json (topik, pengantar, tips) dan satu berkas JSON per level.
 * Level yang soalnya belum bisa ditampilkan dilewati, dan nomor level disusun ulang berurutan.
 * Dengan --append, topik ditambahkan setelah topik buku yang sudah ada (kode diberi awalan --prefix).
 */

const [dir, gradeArg, ...flags] = process.argv.slice(2);
if (!dir || !gradeArg) {
  console.error('Pakai: import-skills <folder-skill> <kelas 1-4> [--prefix=K] [--append]');
  process.exit(1);
}
const grade = Number(gradeArg);
const prefix = flags.find((f) => f.startsWith('--prefix='))?.slice(9) ?? '';
const append = flags.includes('--append');
const slug = `matematika-kelas-${grade}`;
const target = join(process.cwd(), 'content', slug, 'book.json');

type Skill = {
  title: string;
  category: string;
  order: number;
  family: string;
  params: Record<string, unknown>;
};
type Category = { code: string; title: string; intro?: string; tips?: string[] };

const catalog = JSON.parse(readFileSync(join(dir, '_catalog.json'), 'utf8')) as {
  categories: Category[];
};

// Kata yang tidak dipakai di teks anak.
const soften = (text: string) =>
  text
    .replace(/\bsalah\b/gi, (m) => (m[0] === 'S' ? 'Keliru' : 'keliru'))
    .replace(/\bgagal\b/gi, (m) => (m[0] === 'G' ? 'Belum berhasil' : 'belum berhasil'));
const clip = (text: string, max: number) =>
  text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`;

/** "Nilai tempat — Level 1 — Tabel nilai tempat" menjadi "Tabel nilai tempat". */
const levelLabel = (title: string) => title.replace(/^.*?—\s*Level\s+\d+\s*—\s*/, '');

/** Bagian yang tidak didukung dibuang; sisanya menjadi satu spesifikasi. */
function usable(skill: Skill): SkillSpec | null {
  if (skill.family === 'expr') {
    const spec: SkillSpec = { family: 'expr', params: skill.params };
    return stimuliSupported(spec) ? spec : null;
  }
  if (skill.family !== 'mix') return null;
  const parts = (
    skill.params.parts as { family: string; params: Record<string, unknown>; weight?: number }[]
  )
    .filter((p) => p.family === 'expr' && stimuliSupported({ family: 'expr', params: p.params }))
    .map((p) => ({ family: 'expr', params: p.params, ...(p.weight ? { weight: p.weight } : {}) }));
  if (parts.length === 0) return null;
  return parts.length === 1
    ? { family: 'expr', params: parts[0]!.params }
    : { family: 'mix', params: { parts } };
}

const byCategory = new Map<string, Skill[]>();
for (const file of readdirSync(dir)) {
  if (!file.endsWith('.json') || file.startsWith('_')) continue;
  const skill = JSON.parse(readFileSync(join(dir, file), 'utf8')) as Skill;
  const list = byCategory.get(skill.category) ?? [];
  list.push(skill);
  byCategory.set(skill.category, list);
}

const imported = catalog.categories.flatMap((cat, index) => {
  const levels = (byCategory.get(cat.code) ?? [])
    .sort((a, b) => a.order - b.order)
    .flatMap((s) => {
      const spec = usable(s);
      return spec ? [{ title: clip(levelLabel(s.title), 60), spec }] : [];
    })
    .slice(0, 12)
    .map((l, i) => ({
      number: i + 1,
      title: l.title,
      isFree: i === 0,
      generator: 'skill' as const,
      generatorParams: l.spec as unknown as Record<string, unknown>,
    }));
  if (levels.length === 0) return [];
  return [
    {
      code: `${prefix}${cat.code}`,
      title: clip(cat.title, 60),
      sort: index + 1,
      lesson: clip(soften(cat.intro ?? cat.title), 600),
      ...(cat.tips?.length ? { tips: cat.tips.slice(0, 6).map((t) => clip(soften(t), 200)) } : {}),
      levels,
    },
  ];
});

const existing =
  append && existsSync(target)
    ? (JSON.parse(readFileSync(target, 'utf8')) as { topics: { code: string; sort: number }[] })
    : null;
// Dijalankan ulang: topik hasil impor sebelumnya diganti, topik buatan tangan tetap.
const base = existing
  ? { ...existing, topics: existing.topics.filter((t) => !prefix || !t.code.startsWith(prefix)) }
  : null;
const offset = base ? base.topics.length : 0;
const book = {
  slug,
  grade: `sd${grade}`,
  subject: 'math',
  title: `Matematika Kelas ${grade}`,
  sort: 10 + grade,
  ...(base ?? {}),
  topics: [...(base?.topics ?? []), ...imported.map((t, i) => ({ ...t, sort: offset + i + 1 }))],
};
const parsed = bookContentSchema.parse(book);
writeFileSync(target, `${JSON.stringify(parsed)}\n`);
const levels = parsed.topics.reduce((n, t) => n + t.levels.length, 0);
console.log(`${slug}: ${parsed.topics.length} topik, ${levels} level`);
