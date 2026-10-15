import {
  levelStatus,
  type LevelContent,
  type LevelStatus,
  type TopicContent,
} from '@udakids/engine';
import { BOOKS, levelId, readDb, topicId } from './db';

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
  const until = readDb().premiumUntil[childId];
  return until !== undefined && Date.parse(until) > Date.now();
}

export function statusFor(childId: string, found: FoundLevel): LevelStatus {
  const passed = readDb().passedLevels[childId] ?? [];
  const { bookSlug, topic, level } = found;
  return levelStatus({
    number: level.number,
    passed: passed.includes(levelId(bookSlug, topic.code, level.number)),
    previousPassed: passed.includes(levelId(bookSlug, topic.code, level.number - 1)),
    isFree: level.isFree,
    hasPremium: hasPremium(childId),
    hasGenerator: level.generator !== null,
  });
}

export const topicIdOf = (found: FoundLevel) => topicId(found.bookSlug, found.topic.code);
