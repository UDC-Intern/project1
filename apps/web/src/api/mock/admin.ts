import {
  checkChildText,
  generateRound,
  hasGenerator,
  updateLevelBodySchema,
  updateTopicBodySchema,
  type AdminCatalog,
  type AdminOverview,
  type PreviewResult,
  type UpdateLevelBody,
  type UpdateTopicBody,
} from '@udakids/engine';
import { ApiError } from '../client';
import { adminFromToken } from './staff';
import { applyEdits, BOOKS, levelId, newId, readDb, topicId, writeDb, type MockDb } from './db';
import { findLevel } from './levels';
import { isLevelFree } from './settings';

const notFound = (what: string) => new ApiError(404, { code: 'NOT_FOUND', message: what });
const DAY_MS = 24 * 60 * 60 * 1000;

function allRounds(db: MockDb) {
  return Object.values(db.rounds).filter((r) => r.result);
}

export async function overview(token: string | null): Promise<AdminOverview> {
  adminFromToken(token);
  const db = readDb();
  const rounds = allRounds(db);
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const perTopic = new Map<string, { title: string; rounds: number; passed: number }>();
  for (const r of rounds) {
    const found = findLevel(r.levelId);
    if (!found) continue;
    const id = topicId(found.bookSlug, found.topic.code);
    const row = perTopic.get(id) ?? { title: found.topic.title, rounds: 0, passed: 0 };
    row.rounds += 1;
    if (r.result!.passed) row.passed += 1;
    perTopic.set(id, row);
  }

  return {
    parents: db.parents.length,
    children: db.children.length,
    roundsToday: rounds.filter((r) => (r.finishedAt ?? 0) >= startOfToday.getTime()).length,
    activeChildren7d: new Set(
      rounds.filter((r) => (r.finishedAt ?? 0) >= Date.now() - 7 * DAY_MS).map((r) => r.childId),
    ).size,
    hardestTopics: [...perTopic.entries()]
      .map(([id, v]) => ({
        topicId: id,
        title: v.title,
        passRate: Math.round((v.passed / v.rounds) * 100),
      }))
      .sort((a, b) => a.passRate - b.passRate)
      .slice(0, 5),
  };
}

export async function catalog(token: string | null): Promise<AdminCatalog> {
  adminFromToken(token);
  const db = readDb();
  return {
    books: BOOKS.map((b) => ({
      id: b.slug,
      slug: b.slug,
      title: b.title,
      topics: b.topics.map((t) => ({
        id: topicId(b.slug, t.code),
        code: t.code,
        title: t.title,
        lesson: t.lesson,
        levels: t.levels.map((l) => ({
          id: levelId(b.slug, t.code, l.number),
          number: l.number,
          title: l.title,
          isFree: isLevelFree(db, levelId(b.slug, t.code, l.number), l.number),
          generator: l.generator,
        })),
      })),
    })),
  };
}

export async function updateTopic(token: string | null, id: string, body: UpdateTopicBody) {
  adminFromToken(token);
  const [slug, code] = id.split(':');
  if (!BOOKS.find((b) => b.slug === slug)?.topics.some((t) => t.code === code))
    throw notFound('Topik tidak ketemu.');
  const parsed = updateTopicBodySchema.safeParse(body);
  if (!parsed.success)
    throw new ApiError(400, { code: 'VALIDATION', message: 'Judul atau materi belum sesuai.' });
  for (const text of [parsed.data.lesson, ...(parsed.data.tips ?? [])]) {
    if (!text) continue;
    const issues = checkChildText(text);
    if (issues.length > 0)
      throw new ApiError(400, { code: 'VALIDATION', message: issues.join(' ') });
  }
  const db = readDb();
  db.contentEdits.topics[id] = { ...db.contentEdits.topics[id], ...parsed.data };
  applyEdits(db.contentEdits);
  writeDb(db);
}

export async function updateLevel(token: string | null, id: string, body: UpdateLevelBody) {
  adminFromToken(token);
  if (!findLevel(id)) throw notFound('Level tidak ketemu.');
  const parsed = updateLevelBodySchema.safeParse(body);
  if (!parsed.success)
    throw new ApiError(400, { code: 'VALIDATION', message: 'Judul level belum sesuai.' });
  const [, , n] = id.split(':');
  if (n === '1' && parsed.data.isFree === false)
    throw new ApiError(400, { code: 'VALIDATION', message: 'Level 1 harus tetap gratis.' });
  const db = readDb();
  db.contentEdits.levels[id] = { ...db.contentEdits.levels[id], ...parsed.data };
  applyEdits(db.contentEdits);
  writeDb(db);
}

/** Pratinjau soal generator: tidak menyimpan apa pun. */
export async function preview(
  token: string | null,
  level: string,
  seed: number,
): Promise<PreviewResult> {
  adminFromToken(token);
  const found = findLevel(level);
  if (!found) throw notFound('Level tidak ketemu.');
  if (!hasGenerator(found.level.generator))
    throw new ApiError(409, {
      code: 'NOT_ENOUGH_QUESTIONS',
      message: 'Level ini belum punya generator soal.',
    });
  const questions = generateRound(
    {
      generator: found.level.generator!,
      generatorParams: found.level.generatorParams as Record<string, unknown> | undefined,
    },
    seed,
  );
  return {
    levelId: level,
    seed,
    questions: questions.map((q, index) => ({ ...q, index, audioUrl: null })),
  };
}

const MODEL = 'gemini (data tiruan)';

export async function aiAssist(
  token: string | null,
  topicIdArg: string,
  purpose: 'lesson' | 'curriculum',
): Promise<{ jobId: string; draft: string }> {
  const admin = adminFromToken(token);
  const [slug, code] = topicIdArg.split(':');
  const topic = BOOKS.find((b) => b.slug === slug)?.topics.find((t) => t.code === code);
  if (!topic) throw notFound('Topik tidak ketemu.');

  const draft =
    purpose === 'lesson'
      ? `${topic.lesson} Coba ceritakan ulang dengan contoh dari rumah. Ajak anak menunjuk benda satu per satu.`
      : `Tujuan topik ${topic.title}: anak mengenal konsep dasarnya lewat gambar. Level 1 memperkenalkan, level 2 melatih, level 3 menerapkan.`;

  const db = readDb();
  const job = {
    id: newId('j'),
    adminName: admin.name,
    topicTitle: topic.title,
    purpose,
    model: MODEL,
    createdAt: new Date().toISOString(),
  };
  db.aiJobs.unshift(job);
  writeDb(db);
  return { jobId: job.id, draft };
}

export async function aiJobs(token: string | null) {
  adminFromToken(token);
  return { jobs: readDb().aiJobs };
}
