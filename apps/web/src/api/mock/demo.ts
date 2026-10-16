import { autoIssue } from './certificate';
import { BOOKS, levelId, readDb, writeDb } from './db';

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Bantuan demo (hanya dipakai halaman /gaya saat pengembangan): menandai semua level satu buku lulus untuk seorang
 * anak, supaya alur sertifikat bisa ditunjukkan tanpa memainkan puluhan ronde. Dengan `premium`, Premium anak
 * diaktifkan 30 hari dan sertifikat terbit otomatis; tanpa itu, anak masuk daftar Menunggu di panel admin.
 */
export function demoFinishBook(childId: string, bookSlug: string, premium: boolean) {
  const db = readDb();
  const book = BOOKS.find((b) => b.slug === bookSlug);
  if (!book || !db.children.some((c) => c.id === childId)) return null;

  const passed = new Set(db.passedLevels[childId] ?? []);
  const best = (db.best[childId] ??= {});
  for (const topic of book.topics) {
    for (const level of topic.levels) {
      const id = levelId(book.slug, topic.code, level.number);
      passed.add(id);
      best[id] = { score: Math.max(best[id]?.score ?? 0, 90), ms: best[id]?.ms ?? 95_000 };
    }
  }
  db.passedLevels[childId] = [...passed];
  if (premium) db.premiumUntil[childId] = new Date(Date.now() + 30 * DAY_MS).toISOString();
  else delete db.premiumUntil[childId];
  const cert = premium ? autoIssue(db, childId, bookSlug) : null;
  writeDb(db);
  return cert;
}
