import {
  levelStatus,
  type LevelContent,
  type LevelStatus,
  type TopicContent,
} from '@udakids/engine';
import { BOOKS, levelId, premiumUntilOf, readDb, topicId } from './db';
import { isLevelFree } from './settings';

export type FoundLevel = {
  bookSlug: string;
  bookTitle: string;
  topic: TopicContent;
  level: LevelContent;
};

/** Id level berbentuk "buku:topik:nomor". */
export function findLevel(id: string): FoundLevel | null {
  const [slug, code, n] = id.split(':');
  const book = BOOKS.find((b) => b.slug === slug);
  const topic = book?.topics.find((t) => t.code === code);
  const level = topic?.levels.find((l) => String(l.number) === n);
  if (!book || !topic || !level) return null;
  return { bookSlug: book.slug, bookTitle: book.title, topic, level };
}

export function hasPremium(childId: string): boolean {
  return premiumUntilOf(readDb(), childId) !== null;
}

export function statusFor(childId: string, found: FoundLevel): LevelStatus {
  const db = readDb();
  const passed = db.passedLevels[childId] ?? [];
  const { bookSlug, topic, level } = found;
  return levelStatus({
    number: level.number,
    passed: passed.includes(levelId(bookSlug, topic.code, level.number)),
    previousPassed: passed.includes(levelId(bookSlug, topic.code, level.number - 1)),
    isFree: isLevelFree(db, levelId(bookSlug, topic.code, level.number), level.number),
    hasPremium: hasPremium(childId),
    hasGenerator: level.generator !== null,
  });
}

export const topicIdOf = (found: FoundLevel) => topicId(found.bookSlug, found.topic.code);
