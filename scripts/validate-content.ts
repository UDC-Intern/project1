import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { validateQuestion, type QuestionDraft } from '@udakids/engine';

// Memeriksa semua soal di content/<buku>/questions/*.json dengan aturan teks anak dari engine.
// Folder content/ diisi di M2; sebelum itu skrip ini lolos tanpa memeriksa apa pun.
const root = join(process.cwd(), 'content');
let checked = 0;
const problems: string[] = [];

type QuestionFile = { version: number; questions: (QuestionDraft & { key: string })[] };

if (existsSync(root)) {
  for (const book of readdirSync(root, { withFileTypes: true })) {
    const dir = join(root, book.name, 'questions');
    if (!book.isDirectory() || !existsSync(dir)) continue;
    for (const file of readdirSync(dir).filter((f) => f.endsWith('.json'))) {
      const data = JSON.parse(readFileSync(join(dir, file), 'utf8')) as QuestionFile;
      for (const q of data.questions) {
        checked++;
        const res = validateQuestion(q);
        if (!res.ok) problems.push(`${book.name}/${file} ${q.key}: ${res.issues.join(' ')}`);
      }
    }
  }
}

if (problems.length > 0) {
  console.error(problems.join('\n'));
  console.error(`\n${problems.length} soal belum lolos dari ${checked} soal.`);
  process.exit(1);
}
console.log(`Konten lolos: ${checked} soal diperiksa.`);
