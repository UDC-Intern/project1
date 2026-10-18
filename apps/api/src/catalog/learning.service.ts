import { Inject, Injectable } from '@nestjs/common';
import { randomInt } from 'node:crypto';
import { and, desc, eq, sql } from 'drizzle-orm';
import {
  FOREVER_ISO,
  isFreeLevel,
  levelStatus,
  initialMastery,
  generateRound,
  certificateStatus,
  certificateNumber,
  certificateDesignSchema,
  meanScore,
  maskName,
  type Stage,
  type RoundResult,
} from '@udakids/engine';
import { DB, type Db, type Executor } from '../db/db.module.js';
import * as s from '../db/schema.js';
import {
  CurriculumService,
  effective,
  type Book,
  type Level,
} from '../content/curriculum.service.js';
import { SettingsService } from '../settings/settings.service.js';
import { fail, missing } from '../common/errors.js';
import { iso } from '../common/dates.js';
import { VoiceService } from '../voice/voice.service.js';

@Injectable()
export class LearningService {
  constructor(
    @Inject(DB) private db: Db,
    readonly curriculum: CurriculumService,
    readonly settings: SettingsService,
    private voice: VoiceService,
  ) {}
  async state(childId: string, tx: Executor = this.db) {
    const [child] = await tx.select().from(s.children).where(eq(s.children.id, childId));
    if (!child) missing();
    const [parent] = child.parentId
      ? await tx.select().from(s.parents).where(eq(s.parents.id, child.parentId))
      : [];
    const [progress, mastery, grants] = await Promise.all([
      tx.select().from(s.levelProgress).where(eq(s.levelProgress.childId, childId)),
      tx.select().from(s.topicMastery).where(eq(s.topicMastery.childId, childId)),
      tx.select().from(s.premiumGrants).where(eq(s.premiumGrants.childId, childId)),
    ]);
    const dates = [
      parent?.premiumUntil,
      ...grants.map((g) => g.endsAt ?? new Date(FOREVER_ISO)),
    ].filter((d): d is Date => !!d && d.getTime() > Date.now());
    const until = dates.length
      ? new Date(Math.max(...dates.map((d) => d.getTime()))).toISOString()
      : null;
    return {
      child,
      parent,
      until,
      premium: !!until,
      progress: new Map(progress.map((p) => [p.levelId, p])),
      mastery: new Map(mastery.map((m) => [m.topicId, m])),
      grants,
    };
  }
  async status(
    level: Level,
    state: Awaited<ReturnType<LearningService['state']>>,
    tx: Executor = this.db,
  ) {
    const settings = await this.settings.get(tx);
    return levelStatus({
      number: level.number,
      passed: state.progress.get(level.id)?.passed ?? false,
      previousPassed:
        level.number === 1 ||
        (state.progress.get(`${level.topicId}:${level.number - 1}`)?.passed ?? false),
      isFree:
        !settings.billing.paywall ||
        (level.freeOverride ?? isFreeLevel(level.number, settings.billing)),
      hasPremium: state.premium,
      hasGenerator: !!effective(level),
    });
  }
  async home(id: string) {
    const [state, books] = await Promise.all([this.state(id), this.curriculum.books()]);
    let next = null;
    if (state.child.lastLevelId) {
      try {
        const f = await this.curriculum.find(state.child.lastLevelId);
        next = { levelId: f.level.id, topicId: f.topic.id, title: f.topic.title };
      } catch {
        /* Level yang dihapus tidak menjadi tujuan lanjut. */
      }
    }
    return {
      books: books.map((b) => ({
        slug: b.slug,
        title: b.title,
        subject: b.subject,
        grade: b.grade,
        topicsTotal: b.topics.length,
        topicsStarted: b.topics.filter((t) =>
          t.levels.some((l) => state.progress.get(l.id)?.passed),
        ).length,
      })),
      continue: next,
    };
  }
  async book(id: string, slug: string) {
    const [state, books] = await Promise.all([this.state(id), this.curriculum.books()]);
    const book = books.find((b) => b.slug === slug);
    if (!book) missing();
    return {
      book: { slug: book.slug, title: book.title, subject: book.subject },
      topics: await Promise.all(
        book.topics.map(async (t) => ({
          id: t.id,
          code: t.code,
          title: t.title,
          lesson: t.lesson,
          tips: t.tips,
          stage: state.mastery.get(t.id)?.visibleStage ?? 0,
          levelsPassed: t.levels.filter((l) => state.progress.get(l.id)?.passed).length,
          levelsTotal: t.levels.length,
          levels: await Promise.all(
            t.levels.map(async (l) => ({
              id: l.id,
              number: l.number,
              title: l.title,
              status: await this.status(l, state),
            })),
          ),
        })),
      ),
    };
  }
  async topic(id: string, topicId: string) {
    const state = await this.state(id);
    for (const b of await this.curriculum.books()) {
      const t = b.topics.find((t) => t.id === topicId);
      if (!t) continue;
      const generator = t.levels[0] && effective(t.levels[0]);
      const example = generator ? generateRound(generator, 7)[0] : null;
      const [lessonAudioUrl] = await this.voice.urls([[t.lesson, ...t.tips].join('. ')]);
      return {
        example,
        topic: {
          id: t.id,
          code: t.code,
          title: t.title,
          lesson: t.lesson,
          lessonAudioUrl: lessonAudioUrl ?? null,
          bookSlug: b.slug,
        },
        levels: await Promise.all(
          t.levels.map(async (l) => ({
            id: l.id,
            number: l.number,
            title: l.title,
            status: await this.status(l, state),
            bestScore: state.progress.get(l.id)?.bestScore ?? null,
          })),
        ),
      };
    }
    return missing();
  }
  async profile(id: string) {
    const state = await this.state(id);
    const books = await this.curriculum.books();
    const history = await this.db
      .select()
      .from(s.quizResults)
      .where(eq(s.quizResults.childId, id))
      .orderBy(desc(s.quizResults.finishedAt))
      .limit(10);
    const [count] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(s.quizResults)
      .where(eq(s.quizResults.childId, id));
    return {
      nickname: state.child.nickname,
      momoColor: state.child.momoColor,
      totalScore: [...state.progress.values()].reduce((n, p) => n + p.bestScore, 0),
      levelsPassed: [...state.progress.values()].filter((p) => p.passed).length,
      rounds: count?.count ?? 0,
      plants: books.flatMap((b) =>
        b.topics
          .filter((t) => state.mastery.has(t.id))
          .map((t) => ({
            topicId: t.id,
            title: t.title,
            bookSlug: b.slug,
            stage: state.mastery.get(t.id)!.visibleStage,
          })),
      ),
      history: await Promise.all(
        history.map(async (r) => ({
          roundId: r.roundId,
          levelTitle: (await this.curriculum.find(r.levelId)).level.title,
          score: r.score,
          passed: r.passed,
          finishedAt: r.finishedAt.toISOString(),
        })),
      ),
    };
  }
  async certificateBooks(id: string, tx: Executor = this.db) {
    const [state, books, certs] = await Promise.all([
      this.state(id, tx),
      this.curriculum.books(tx),
      tx.select().from(s.certificates).where(eq(s.certificates.childId, id)),
    ]);
    const design = certificateDesignSchema
      .catch('klasik')
      .parse(await this.settings.value('certificateDesign', tx));
    return {
      hasPremium: state.premium,
      books: books.map((b) => {
        const ids = b.topics.flatMap((t) => t.levels.map((l) => l.id));
        const cert = certs.find((c) => c.bookSlug === b.slug);
        return {
          bookSlug: b.slug,
          bookTitle: b.title,
          subject: b.subject,
          grade: b.grade,
          topicsTotal: b.topics.length,
          levelsPassed: ids.filter((id) => state.progress.get(id)?.passed).length,
          levelsTotal: ids.length,
          design,
          status: cert
            ? ('issued' as const)
            : certificateStatus({
                bookLevelIds: ids,
                passedLevelIds: [...state.progress.values()]
                  .filter((p) => p.passed)
                  .map((p) => p.levelId),
                hasPremium: state.premium,
              }),
          certificate: cert ? { ...cert, issuedAt: cert.issuedAt.toISOString() } : null,
        };
      }),
    };
  }
  async issue(
    id: string,
    slug: string,
    source: 'auto' | 'claim' | 'admin',
    tx: Executor = this.db,
  ) {
    const status = (await this.certificateBooks(id, tx)).books.find((b) => b.bookSlug === slug);
    if (!status) missing();
    if (status.certificate) {
      if (source === 'admin') fail(409, 'CONFLICT', 'Sertifikat buku ini sudah terbit.');
      return status.certificate;
    }
    if (status.status === 'not_finished')
      fail(409, 'CONFLICT', 'Tuntaskan semua level buku ini dulu.');
    if (status.status === 'premium_required' && source !== 'admin')
      fail(403, 'PREMIUM_REQUIRED', 'Sertifikat tersedia untuk anak Premium.');
    const state = await this.state(id, tx);
    const book = (await this.curriculum.books(tx)).find((b) => b.slug === slug)!;
    const settings = await this.settings.get(tx);
    const [cert] = await tx
      .insert(s.certificates)
      .values({
        id: certificateNumber(() => randomInt(1_000_000) / 1_000_000),
        childId: id,
        bookSlug: slug,
        bookTitle: book.title,
        childName:
          settings.certificate.useFullName && state.child.certificateName
            ? state.child.certificateName
            : state.child.nickname,
        topics: status.topicsTotal,
        levels: status.levelsTotal,
        source,
        design: status.design,
        averageScore: meanScore(
          book.topics.flatMap((t) => t.levels.map((l) => state.progress.get(l.id)?.bestScore ?? 0)),
        ),
      })
      .onConflictDoNothing()
      .returning();
    const result =
      cert ??
      (
        await tx
          .select()
          .from(s.certificates)
          .where(and(eq(s.certificates.childId, id), eq(s.certificates.bookSlug, slug)))
      )[0];
    if (!result) fail(409, 'CONFLICT', 'Nomor sertifikat sedang dipakai. Coba lagi.');
    return { ...result, issuedAt: result.issuedAt.toISOString() };
  }
  async verify(id: string) {
    const [cert] = await this.db.select().from(s.certificates).where(eq(s.certificates.id, id));
    if (!cert) missing();
    return {
      id: cert.id,
      name: maskName(cert.childName),
      bookTitle: cert.bookTitle,
      topics: cert.topics,
      levels: cert.levels,
      issuedAt: cert.issuedAt.toISOString(),
      issuer: (await this.settings.get()).certificate.issuer,
    };
  }
  async roundResult(id: string, childId: string) {
    const [row] = await this.db
      .select({ result: s.quizResults.result })
      .from(s.quizResults)
      .where(and(eq(s.quizResults.roundId, id), eq(s.quizResults.childId, childId)));
    if (!row) missing();
    return row.result;
  }
  mastery(state: Awaited<ReturnType<LearningService['state']>>, topicId: string) {
    const m = state.mastery.get(topicId);
    return m
      ? {
          score: m.score,
          visibleStage: m.visibleStage as Stage,
          challengeCorrect: m.challengeCorrect,
        }
      : initialMastery();
  }
  async nextLevel(
    book: Book,
    level: Level,
    childId: string,
    tx: Executor,
  ): Promise<RoundResult['nextLevel']> {
    const next = book.topics
      .flatMap((t) => t.levels)
      .find((l) => l.topicId === level.topicId && l.number === level.number + 1);
    return next
      ? {
          id: next.id,
          number: next.number,
          status: await this.status(next, await this.state(childId, tx), tx),
        }
      : null;
  }
  profileView(child: typeof s.children.$inferSelect) {
    return {
      id: child.id,
      nickname: child.nickname,
      momoColor: child.momoColor,
      hasPin: !!child.picturePinHash,
      classId: null,
      className: null,
      classCode: null,
      lastActiveAt: iso(child.lastActiveAt),
      createdAt: child.createdAt.toISOString(),
      certificateName: child.certificateName,
    };
  }
}
