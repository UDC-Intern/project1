import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { and, eq, sql } from 'drizzle-orm';
import {
  generateRound,
  seedFrom,
  scoreRound,
  updateMastery,
  type AnswerBody,
  type RoundResult,
  type Stage,
} from '@udakids/engine';
import { DB, type Db } from '../db/db.module.js';
import * as s from '../db/schema.js';
import { LearningService } from '../catalog/learning.service.js';
import { effective } from '../content/curriculum.service.js';
import { fail, missing } from '../common/errors.js';
import { RateLimiter } from '../common/rate-limit.js';
import { VoiceService } from '../voice/voice.service.js';

@Injectable()
export class PracticeService {
  private limit = new RateLimiter(120, 60_000);
  constructor(
    @Inject(DB) private db: Db,
    private learning: LearningService,
    private voice: VoiceService,
  ) {}
  async start(childId: string, levelId: string) {
    this.limit.take(childId);
    const found = await this.learning.curriculum.find(levelId);
    const state = await this.learning.state(childId);
    const status = await this.learning.status(found.level, state);
    if (status === 'soon') fail(409, 'NOT_ENOUGH_QUESTIONS', 'Latihan ini segera hadir.');
    if (status === 'locked') fail(403, 'LEVEL_LOCKED', 'Tuntaskan level sebelumnya dulu.');
    if (status === 'premium') fail(403, 'PREMIUM_REQUIRED', 'Level ini tersedia dengan Premium.');
    const generator = effective(found.level)!;
    const id = randomUUID();
    const seed = seedFrom(id);
    const questions = generateRound(generator, seed);
    await this.db.transaction(async (tx) => {
      await tx.insert(s.rounds).values({
        id,
        childId,
        levelId,
        seed,
        generatorSnapshot: generator,
        stageBefore: state.mastery.get(found.topic.id)?.visibleStage ?? 0,
      });
      await tx
        .update(s.children)
        .set({ lastLevelId: levelId, lastActiveAt: new Date() })
        .where(eq(s.children.id, childId));
    });
    const urls = await this.voice.urls(questions.map((q) => q.prompt));
    return {
      roundId: id,
      questions: questions.map((q, index) => ({
        index,
        type: q.type,
        prompt: q.prompt,
        visual: q.visual,
        options: q.options,
        audioUrl: urls[index] ?? null,
      })),
    };
  }
  async answer(childId: string, roundId: string, body: AnswerBody) {
    return this.db.transaction(async (tx) => {
      await tx
        .select({ id: s.children.id })
        .from(s.children)
        .where(eq(s.children.id, childId))
        .for('update');
      const [round] = await tx
        .select()
        .from(s.rounds)
        .where(and(eq(s.rounds.id, roundId), eq(s.rounds.childId, childId)))
        .for('update');
      if (!round) missing();
      if (round.finishedAt) fail(409, 'CONFLICT', 'Ronde ini sudah selesai.');
      const answers = await tx
        .select()
        .from(s.roundAnswers)
        .where(eq(s.roundAnswers.roundId, roundId));
      if (body.questionIndex !== answers.length || body.questionIndex >= 10)
        fail(409, 'CONFLICT', 'Jawab soal secara berurutan, satu kali saja.');
      const q = generateRound(round.generatorSnapshot, round.seed)[body.questionIndex]!;
      const correct = q.answer.trim() === body.answer.trim();
      const found = await this.learning.curriculum.find(round.levelId, tx);
      const state = await this.learning.state(childId, tx);
      const mastery = updateMastery(this.learning.mastery(state, found.topic.id), correct);
      await tx
        .insert(s.roundAnswers)
        .values({ roundId, idx: body.questionIndex, chosen: body.answer, isCorrect: correct });
      await tx
        .insert(s.topicMastery)
        .values({ childId, topicId: found.topic.id, ...mastery })
        .onConflictDoUpdate({
          target: [s.topicMastery.childId, s.topicMastery.topicId],
          set: { ...mastery, updatedAt: new Date() },
        });
      return {
        isCorrect: correct,
        hint: correct ? null : q.explanation,
        correctAnswer: correct ? null : q.answer,
      };
    });
  }
  async finish(childId: string, roundId: string): Promise<RoundResult> {
    return this.db.transaction(async (tx) => {
      await tx
        .select({ id: s.children.id })
        .from(s.children)
        .where(eq(s.children.id, childId))
        .for('update');
      const [round] = await tx
        .select()
        .from(s.rounds)
        .where(and(eq(s.rounds.id, roundId), eq(s.rounds.childId, childId)))
        .for('update');
      if (!round) missing();
      if (round.finishedAt) {
        const [existing] = await tx
          .select()
          .from(s.quizResults)
          .where(eq(s.quizResults.roundId, roundId));
        return existing!.result;
      }
      const answers = await tx
        .select()
        .from(s.roundAnswers)
        .where(eq(s.roundAnswers.roundId, roundId));
      if (answers.length !== 10) fail(409, 'CONFLICT', 'Lengkapi sepuluh soal dulu.');
      const correct = answers.filter((a) => a.isCorrect).length;
      const wrong = 10 - correct;
      const result = scoreRound(correct, wrong, 10);
      const now = new Date();
      const durationMs = Math.max(0, now.getTime() - round.startedAt.getTime());
      const found = await this.learning.curriculum.find(round.levelId, tx);
      await tx
        .insert(s.levelProgress)
        .values({
          childId,
          levelId: round.levelId,
          bestScore: result.score,
          bestMs: durationMs,
          passed: result.passed,
          attempts: 1,
          firstPassedAt: result.passed ? now : null,
        })
        .onConflictDoUpdate({
          target: [s.levelProgress.childId, s.levelProgress.levelId],
          set: {
            bestScore: sql`greatest(${s.levelProgress.bestScore}, ${result.score})`,
            bestMs: sql`least(${s.levelProgress.bestMs}, ${durationMs})`,
            passed: sql`${s.levelProgress.passed} or ${result.passed}`,
            attempts: sql`${s.levelProgress.attempts} + 1`,
            firstPassedAt: sql`coalesce(${s.levelProgress.firstPassedAt}, ${result.passed ? now.toISOString() : null}::timestamptz)`,
            updatedAt: now,
          },
        });
      const state = await this.learning.state(childId, tx);
      const progress = (await this.learning.certificateBooks(childId, tx)).books.find(
        (b) => b.bookSlug === found.book.slug,
      )!;
      const cert =
        progress.status === 'ready'
          ? await this.learning.issue(childId, found.book.slug, 'auto', tx)
          : null;
      const dto: RoundResult = {
        roundId,
        levelId: round.levelId,
        ...result,
        correct,
        wrong,
        durationMs,
        nextLevel: await this.learning.nextLevel(found.book, found.level, childId, tx),
        plant: {
          topicId: found.topic.id,
          title: found.topic.title,
          stageBefore: round.stageBefore as Stage,
          stageAfter: (state.mastery.get(found.topic.id)?.visibleStage as Stage) ?? 0,
        },
        certificate: cert
          ? { id: cert.id, bookSlug: cert.bookSlug, bookTitle: cert.bookTitle }
          : null,
      };
      await tx.insert(s.quizResults).values({
        roundId,
        childId,
        levelId: round.levelId,
        bookSlug: found.book.slug,
        ...result,
        correct,
        wrong,
        durationMs,
        finishedAt: now,
        result: dto,
      });
      await tx.update(s.rounds).set({ finishedAt: now }).where(eq(s.rounds.id, roundId));
      return dto;
    });
  }
}
