import {
  generateRound,
  hasGenerator,
  levelStatus,
  type BookDetail,
  type CatalogHome,
  type ChildProfile,
  type MomoColor,
  type MomoLook,
  type TopicDetail,
} from '@udakids/engine';
import { ApiError } from '../client';
import { childIdFromToken } from './auth';
import { BOOKS, levelId, premiumUntilOf, readDb, topicId, writeDb } from './db';
import { findLevel } from './levels';

const notFound = () => new ApiError(404, { code: 'NOT_FOUND', message: 'Tidak ketemu.' });

function hasPremium(childId: string): boolean {
  return premiumUntilOf(readDb(), childId) !== null;
}

/** Kelas dari slug buku, mis. matematika-kelas-3. */
const gradeOf = (slug: string) => Number(/kelas-(\d+)$/.exec(slug)?.[1] ?? 1);

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
      grade: gradeOf(b.slug),
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
  const premium = hasPremium(childId);
  return {
    book: { slug: found.slug, title: found.title, subject: found.subject },
    topics: found.topics.map((t) => ({
      id: topicId(found.slug, t.code),
      code: t.code,
      title: t.title,
      stage: db.mastery[childId]?.[topicId(found.slug, t.code)]?.visibleStage ?? 0,
      levelsPassed: t.levels.filter((l) => passed.includes(levelId(found.slug, t.code, l.number)))
        .length,
      levelsTotal: t.levels.length,
      lesson: t.lesson,
      tips: t.tips ?? [],
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
      })),
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
  const first = t.levels[0];
  const example =
    first && hasGenerator(first.generator)
      ? generateRound(
          {
            generator: first.generator!,
            generatorParams: first.generatorParams as Record<string, unknown> | undefined,
          },
          7,
        )[0]!
      : null;
  return {
    example,
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
      bestScore: readDb().best[childId]?.[levelId(found.slug, t.code, l.number)]?.score ?? null,
    })),
  };
}

export async function profile(token: string | null): Promise<ChildProfile> {
  const childId = childIdFromToken(token);
  const db = readDb();
  const child = db.children.find((c) => c.id === childId)!;
  return {
    nickname: child.nickname,
    momoColor: child.momoColor,
    momoLook: child.momoLook ?? null,
    totalScore: Object.values(db.best[childId] ?? {}).reduce((a, b) => a + b.score, 0),
    levelsPassed: (db.passedLevels[childId] ?? []).length,
    rounds: Object.values(db.rounds).filter((r) => r.childId === childId && r.result).length,
    // Tanaman hanya untuk topik yang sudah pernah dimainkan.
    plants: BOOKS.flatMap((b) =>
      b.topics
        .filter((t) => db.mastery[childId]?.[topicId(b.slug, t.code)] !== undefined)
        .map((t) => ({
          topicId: topicId(b.slug, t.code),
          title: t.title,
          bookSlug: b.slug,
          stage: db.mastery[childId]?.[topicId(b.slug, t.code)]?.visibleStage ?? 0,
        })),
    ),
    history: Object.values(db.rounds)
      .filter((r) => r.childId === childId && r.result)
      .sort((a, b) => (b.finishedAt ?? 0) - (a.finishedAt ?? 0))
      .slice(0, 10)
      .map((r) => ({
        roundId: r.id,
        levelTitle: findLevel(r.levelId)?.level.title ?? r.levelId,
        score: r.result!.score,
        passed: r.result!.passed,
        finishedAt: new Date(r.finishedAt!).toISOString(),
      })),
  };
}

export async function setMomo(
  token: string | null,
  momoColor: MomoColor,
  momoLook?: MomoLook | null,
) {
  const childId = childIdFromToken(token);
  const db = readDb();
  const child = db.children.find((c) => c.id === childId)!;
  child.momoColor = momoColor;
  if (momoLook !== undefined) child.momoLook = momoLook;
  writeDb(db);
  return { momoColor, momoLook: child.momoLook ?? null };
}
