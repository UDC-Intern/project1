import { Inject, Injectable } from '@nestjs/common';
import { bankToLevel, questionBankSchema, hasGenerator } from '@udakids/engine';
import { DB, type Db, type Executor } from '../db/db.module.js';
import { books, topics, levels } from '../db/schema.js';
import { missing } from '../common/errors.js';

export type Level = typeof levels.$inferSelect;
export type Topic = typeof topics.$inferSelect & { levels: Level[] };
export type Book = typeof books.$inferSelect & { topics: Topic[] };
export function effective(level: Level) {
  if (level.bank) return bankToLevel(questionBankSchema.parse(level.bank));
  if (!hasGenerator(level.generator)) return null;
  return { generator: level.generator!, generatorParams: level.generatorParams ?? undefined };
}
@Injectable()
export class CurriculumService {
  private cache?: { at: number; books: Book[] };
  constructor(@Inject(DB) private db: Db) {}
  invalidate() {
    this.cache = undefined;
  }
  async books(tx: Executor = this.db): Promise<Book[]> {
    if (tx === this.db && this.cache && Date.now() - this.cache.at < 30_000)
      return this.cache.books;
    const [bs, ts, ls] = await Promise.all([
      tx.select().from(books).orderBy(books.sort, books.slug),
      tx.select().from(topics).orderBy(topics.sort, topics.code),
      tx.select().from(levels).orderBy(levels.number),
    ]);
    const result = bs.map((b) => ({
      ...b,
      topics: ts
        .filter((t) => t.bookSlug === b.slug)
        .map((t) => ({ ...t, levels: ls.filter((l) => l.topicId === t.id) })),
    }));
    if (tx === this.db) this.cache = { at: Date.now(), books: result };
    return result;
  }
  async find(id: string, tx: Executor = this.db) {
    for (const book of await this.books(tx))
      for (const topic of book.topics) {
        const level = topic.levels.find((l) => l.id === id);
        if (level) return { book, topic, level };
      }
    return missing();
  }
}
