import { levelStatus, type BookDetail, type CatalogHome, type TopicDetail } from '@udakids/engine';
import { ApiError } from '../client';
import { childIdFromToken } from './auth';
import { BOOKS, levelId, readDb, topicId } from './db';

const notFound = () => new ApiError(404, { code: 'NOT_FOUND', message: 'Tidak ketemu.' });

function hasPremium(childId: string): boolean {
  const until = readDb().premiumUntil[childId];
  return until !== undefined && Date.parse(until) > Date.now();
}

export async function home(token: string | null): Promise<CatalogHome> {
  const childId = childIdFromToken(token);
  const db = readDb();
  const passed = db.passedLevels[childId] ?? [];
  const last = db.lastLevel[childId];
  let resume: CatalogHome['continue'] = null;
  if (last) {
    const [slug, code] = last.split(':');
    const topic = BOOKS.find((b) => b.slug === slug)?.topics.find((t) => t.code === code);
    if (topic) resume = { levelId: last, topicId: `${slug}:${code}`, title: topic.title };
  }
  return {
    books: BOOKS.map((b) => ({
      slug: b.slug,
      title: b.title,
      subject: b.subject,
      topicsTotal: b.topics.length,
      topicsStarted: b.topics.filter((t) =>
        t.levels.some((l) => passed.includes(levelId(b.slug, t.code, l.number))),
      ).length,
    })),
    continue: resume,
  };
}

export async function book(token: string | null, slug: string): Promise<BookDetail> {
  const childId = childIdFromToken(token);
  const db = readDb();
  const found = BOOKS.find((b) => b.slug === slug);
  if (!found) throw notFound();
  const passed = db.passedLevels[childId] ?? [];
  return {
    book: { slug: found.slug, title: found.title, subject: found.subject },
    topics: found.topics.map((t) => ({
      id: topicId(found.slug, t.code),
      code: t.code,
      title: t.title,
      stage: db.stages[childId]?.[topicId(found.slug, t.code)] ?? 0,
      levelsPassed: t.levels.filter((l) => passed.includes(levelId(found.slug, t.code, l.number)))
        .length,
      levelsTotal: t.levels.length,
    })),
  };
}

export async function topic(token: string | null, id: string): Promise<TopicDetail> {
  const childId = childIdFromToken(token);
  const [slug, code] = id.split(':');
  const found = BOOKS.find((b) => b.slug === slug);
  const t = found?.topics.find((x) => x.code === code);
  if (!found || !t) throw notFound();

  const passed = readDb().passedLevels[childId] ?? [];
  const premium = hasPremium(childId);
  return {
    topic: {
      id,
      code: t.code,
      title: t.title,
      lesson: t.lesson,
      lessonAudioUrl: null,
      bookSlug: found.slug,
    },
    levels: t.levels.map((l) => ({
      id: levelId(found.slug, t.code, l.number),
      number: l.number,
      title: l.title,
      status: levelStatus({
        number: l.number,
        passed: passed.includes(levelId(found.slug, t.code, l.number)),
        previousPassed: passed.includes(levelId(found.slug, t.code, l.number - 1)),
        isFree: l.isFree,
        hasPremium: premium,
        hasGenerator: l.generator !== null,
      }),
      bestScore: null,
    })),
  };
}
