import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { bookContentSchema } from '@udakids/engine';

// Memeriksa content/<buku>/book.json: bentuk buku, 4 topik, 3 level per topik, dan aturan teks anak
// (kalimat materi maksimal 15 kata, tanpa kata "salah" atau "gagal").
const root = join(process.cwd(), 'content');
const problems: string[] = [];
let books = 0;
let levels = 0;

if (existsSync(root)) {
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const file = join(root, entry.name, 'book.json');
    if (!entry.isDirectory() || !existsSync(file)) continue;
    books++;
    const parsed = bookContentSchema.safeParse(JSON.parse(readFileSync(file, 'utf8')));
    if (!parsed.success) {
      for (const issue of parsed.error.issues)
        problems.push(`${entry.name}/book.json ${issue.path.join('.')}: ${issue.message}`);
      continue;
    }
    if (parsed.data.slug !== entry.name)
      problems.push(`${entry.name}: slug harus sama dengan nama folder`);
    for (const topic of parsed.data.topics) {
      levels += topic.levels.length;
      topic.levels.forEach((level, i) => {
        if (level.number !== i + 1)
          problems.push(`${entry.name} topik ${topic.code}: level harus berurutan 1, 2, 3`);
      });
      if (!topic.levels[0]?.isFree)
        problems.push(`${entry.name} topik ${topic.code}: level 1 harus gratis`);
    }
  }
}

if (problems.length > 0) {
  console.error(problems.join('\n'));
  console.error(`\n${problems.length} masalah pada konten.`);
  process.exit(1);
}
console.log(`Konten lolos: ${books} buku, ${levels} level.`);
