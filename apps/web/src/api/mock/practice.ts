import {
  generateRound,
  hasGenerator,
  initialMastery,
  scoreRound,
  seedFrom,
  updateMastery,
  type AnswerBody,
  type AnswerResult,
  type ChildQuestion,
  type RoundResult,
  type StartRoundResult,
} from '@udakids/engine';
import { ApiError } from '../client';
import { childIdFromToken } from './auth';
import { autoIssue } from './certificate';
import { levelId, readDb, writeDb, type MockRound } from './db';
import { findLevel, statusFor, topicIdOf } from './levels';

const fail = (status: number, code: ApiError['body']['code'], message: string) =>
  new ApiError(status, { code, message });

let counter = 0;

function ownRound(token: string | null, roundId: string): { childId: string; round: MockRound } {
  const childId = childIdFromToken(token);
  const round = readDb().rounds[roundId];
  if (!round || round.childId !== childId) throw fail(404, 'NOT_FOUND', 'Ronde tidak ketemu.');
  return { childId, round };
}

/** Soal dibuat ulang dari level + seed, sama seperti yang akan dilakukan server. */
function questionsOf(round: MockRound) {
  const found = findLevel(round.levelId)!;
  return generateRound(
    {
      generator: found.level.generator!,
      generatorParams: found.level.generatorParams as Record<string, unknown> | undefined,
    },
    round.seed,
  );
}

export async function startRound(token: string | null, level: string): Promise<StartRoundResult> {
  const childId = childIdFromToken(token);
  const found = findLevel(level);
  if (!found) throw fail(404, 'NOT_FOUND', 'Level tidak ketemu.');

  const status = statusFor(childId, found);
  if (status === 'soon' || !hasGenerator(found.level.generator))
    throw fail(409, 'NOT_ENOUGH_QUESTIONS', 'Level ini segera hadir.');
  if (status === 'locked') throw fail(403, 'LEVEL_LOCKED', 'Selesaikan level sebelumnya dulu.');
  if (status === 'premium')
    throw fail(403, 'PREMIUM_REQUIRED', 'Level ini perlu dibuka oleh orang tua.');

  const db = readDb();
  counter += 1;
  const roundId = `r-${Date.now().toString(36)}-${counter}`;
  const round: MockRound = {
    id: roundId,
    childId,
    levelId: level,
    seed: seedFrom(roundId),
    startedAt: Date.now(),
    stageBefore: db.mastery[childId]?.[topicIdOf(found)]?.visibleStage ?? 0,
    answers: {},
    finishedAt: null,
    result: null,
  };
  db.rounds[roundId] = round;
  db.lastLevel[childId] = level;
  writeDb(db);

  // Kunci (answer, explanation) sengaja tidak ikut dikirim.
  const questions: ChildQuestion[] = questionsOf(round).map((q, index) => ({
    index,
    type: q.type,
    prompt: q.prompt,
    ...(q.say && { say: q.say }),
    visual: q.visual,
    options: q.options,
    audioUrl: null,
  }));
  return { roundId, questions };
}

export async function answer(
  token: string | null,
  roundId: string,
  body: AnswerBody,
): Promise<AnswerResult> {
  const { childId, round } = ownRound(token, roundId);
  if (round.finishedAt) throw fail(409, 'CONFLICT', 'Ronde ini sudah selesai.');
  const q = questionsOf(round)[body.questionIndex];
  if (!q) throw fail(404, 'NOT_FOUND', 'Soal tidak ketemu.');
  if (round.answers[body.questionIndex]) throw fail(409, 'CONFLICT', 'Soal ini sudah dijawab.');

  const isCorrect = body.answer.trim() === q.answer;
  const db = readDb();
  db.rounds[roundId]!.answers[body.questionIndex] = { chosen: body.answer, isCorrect };

  const topic = topicIdOf(findLevel(round.levelId)!);
  const mastery = (db.mastery[childId] ??= {});
  mastery[topic] = updateMastery(mastery[topic] ?? initialMastery(), isCorrect);
  writeDb(db);

  return {
    isCorrect,
    hint: isCorrect ? null : q.explanation,
    correctAnswer: isCorrect ? null : q.answer,
  };
}

function resultOf(round: MockRound): RoundResult {
  const found = findLevel(round.levelId)!;
  const db = readDb();
  const r = round.result!;
  const next = found.topic.levels.find((l) => l.number === found.level.number + 1);
  const cert = round.certificateId ? db.certificates[round.certificateId] : undefined;
  const nextFound = next ? findLevel(levelId(found.bookSlug, found.topic.code, next.number)) : null;
  return {
    roundId: round.id,
    levelId: round.levelId,
    score: r.score,
    correct: r.correct,
    wrong: r.wrong,
    durationMs: r.durationMs,
    passed: r.passed,
    nextLevel:
      next && nextFound
        ? {
            id: levelId(found.bookSlug, found.topic.code, next.number),
            number: next.number,
            status: statusFor(round.childId, nextFound),
          }
        : null,
    plant: {
      topicId: topicIdOf(found),
      title: found.topic.title,
      stageBefore: round.stageBefore,
      stageAfter: db.mastery[round.childId]?.[topicIdOf(found)]?.visibleStage ?? 0,
    },
    certificate: cert ? { id: cert.id, bookSlug: cert.bookSlug, bookTitle: cert.bookTitle } : null,
  };
}

export async function finish(token: string | null, roundId: string): Promise<RoundResult> {
  const { childId, round } = ownRound(token, roundId);
  if (round.result) return resultOf(round);

  const total = questionsOf(round).length;
  const answered = Object.values(round.answers);
  if (answered.length < total) throw fail(409, 'CONFLICT', 'Masih ada soal yang belum dijawab.');

  const correct = answered.filter((a) => a.isCorrect).length;
  const wrong = total - correct;
  const { score, passed } = scoreRound(correct, wrong, total);
  const durationMs = Date.now() - round.startedAt;

  const db = readDb();
  const stored = db.rounds[roundId]!;
  stored.finishedAt = Date.now();
  stored.result = { score, correct, wrong, durationMs, passed };

  const best = (db.best[childId] ??= {});
  const prev = best[round.levelId];
  best[round.levelId] = {
    score: Math.max(prev?.score ?? 0, score),
    ms: Math.min(prev?.ms ?? Number.POSITIVE_INFINITY, durationMs),
  };
  if (passed) {
    const list = (db.passedLevels[childId] ??= []);
    if (!list.includes(round.levelId)) list.push(round.levelId);
    // Level terakhir sebuah buku: sertifikat terbit otomatis bila Premium aktif.
    stored.certificateId = autoIssue(db, childId, findLevel(round.levelId)!.bookSlug)?.id ?? null;
  }
  writeDb(db);
  return resultOf(stored);
}

export async function result(token: string | null, roundId: string): Promise<RoundResult> {
  const { round } = ownRound(token, roundId);
  if (!round.result) throw fail(404, 'NOT_FOUND', 'Hasil belum ada.');
  return resultOf(round);
}
