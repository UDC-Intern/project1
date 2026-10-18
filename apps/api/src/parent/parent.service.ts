import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, gte, sql } from 'drizzle-orm';
import {
  createChildBodySchema,
  childUpdateSchema,
  pinSchema,
  pinSecret,
  MAX_CHILDREN_PER_PARENT,
  masteryStatus,
  subjectDomainOf,
  FOREVER_ISO,
  type ChildInsights,
  type PlanStatus,
} from '@udakids/engine';
import { DB, type Db, type Executor } from '../db/db.module.js';
import * as s from '../db/schema.js';
import { LearningService } from '../catalog/learning.service.js';
import { hashSecret } from '../common/crypto.js';
import { fail, missing } from '../common/errors.js';
import { DAY, iso, jakartaDate } from '../common/dates.js';
import { AuthGuard } from '../auth/auth.guard.js';

@Injectable()
export class ParentService {
  constructor(
    @Inject(DB) private db: Db,
    readonly learning: LearningService,
    private guard: AuthGuard,
  ) {}
  async owned(parentId: string, id: string, tx: Executor = this.db) {
    const [child] = await tx
      .select()
      .from(s.children)
      .where(and(eq(s.children.id, id), eq(s.children.parentId, parentId)));
    if (!child) missing();
    return child;
  }
  async children(parentId: string) {
    return this.db
      .select()
      .from(s.children)
      .where(eq(s.children.parentId, parentId))
      .orderBy(s.children.createdAt)
      .limit(MAX_CHILDREN_PER_PARENT);
  }
  async create(parentId: string, input: unknown) {
    const data = createChildBodySchema.extend({ pin: pinSchema.optional() }).parse(input);
    const picturePinHash = data.pin ? await hashSecret(pinSecret(pinSchema.parse(data.pin))) : null;
    return this.db.transaction(async (tx) => {
      await tx
        .select({ id: s.parents.id })
        .from(s.parents)
        .where(eq(s.parents.id, parentId))
        .for('update');
      const [count] = await tx
        .select({ n: sql<number>`count(*)::int` })
        .from(s.children)
        .where(eq(s.children.parentId, parentId));
      if (count!.n >= MAX_CHILDREN_PER_PARENT)
        fail(409, 'CONFLICT', 'Satu keluarga paling banyak tiga anak.');
      const [child] = await tx
        .insert(s.children)
        .values({ parentId, nickname: data.nickname, momoColor: data.momoColor, picturePinHash })
        .returning();
      return this.learning.profileView(child!);
    });
  }
  async update(parentId: string, id: string, input: unknown) {
    const data = childUpdateSchema.parse(input);
    if (data.classCode) fail(400, 'VALIDATION', 'Fitur kelas belum tersedia.');
    const picturePinHash = data.pin
      ? await hashSecret(pinSecret(pinSchema.parse(data.pin)))
      : undefined;
    return this.db.transaction(async (tx) => {
      const current = await this.owned(parentId, id, tx);
      if (data.certificateName && !current.certificateConsentAt && !data.certificateConsent)
        fail(400, 'VALIDATION', 'Persetujuan orang tua diperlukan untuk nama sertifikat.');
      const [child] = await tx
        .update(s.children)
        .set({
          nickname: data.nickname,
          momoColor: data.momoColor,
          ...(picturePinHash && {
            picturePinHash,
            pinChangedAt: new Date(),
            failedPinAttempts: 0,
            pinLockCount: 0,
            pinLockedUntil: null,
          }),
          ...(data.certificateName !== undefined && {
            certificateName: data.certificateName || null,
            certificateConsentAt: data.certificateName
              ? (current.certificateConsentAt ?? new Date())
              : null,
          }),
        })
        .where(and(eq(s.children.id, id), eq(s.children.parentId, parentId)))
        .returning();
      const settings = await this.learning.settings.get(tx);
      await tx
        .update(s.certificates)
        .set({
          childName:
            settings.certificate.useFullName && child!.certificateName
              ? child!.certificateName
              : child!.nickname,
        })
        .where(eq(s.certificates.childId, id));
      this.guard.forget(id);
      return this.learning.profileView(child!);
    });
  }
  async remove(parentId: string, id: string) {
    const rows = await this.db
      .delete(s.children)
      .where(and(eq(s.children.id, id), eq(s.children.parentId, parentId)))
      .returning({ id: s.children.id });
    if (!rows.length) missing();
    this.guard.forget(id);
  }
  async plan(childId: string): Promise<PlanStatus> {
    const state = await this.learning.state(childId);
    return {
      tier: state.premium ? 'premium' : 'free',
      endsAt: state.until === FOREVER_ISO ? null : state.until,
      source: state.premium
        ? iso(state.parent?.premiumUntil) === state.until
          ? 'purchase'
          : 'admin'
        : null,
    };
  }
  async insights(childId: string): Promise<ChildInsights> {
    const state = await this.learning.state(childId);
    const [books, recent, days, totals, certs] = await Promise.all([
      this.learning.curriculum.books(),
      this.db
        .select()
        .from(s.quizResults)
        .where(eq(s.quizResults.childId, childId))
        .orderBy(desc(s.quizResults.finishedAt))
        .limit(5),
      this.db
        .select({
          date: sql<string>`to_char(${s.quizResults.finishedAt} at time zone 'Asia/Jakarta', 'YYYY-MM-DD')`,
          rounds: sql<number>`count(*)::int`,
          passed: sql<number>`count(*) filter (where ${s.quizResults.passed})::int`,
          minutes: sql<number>`round(sum(${s.quizResults.durationMs}) / 60000.0)::int`,
          average: sql<number>`round(avg(${s.quizResults.score}))::int`,
        })
        .from(s.quizResults)
        .where(
          and(
            eq(s.quizResults.childId, childId),
            gte(s.quizResults.finishedAt, new Date(Date.now() - 14 * DAY)),
          ),
        )
        .groupBy(sql`1`),
      this.db
        .select({
          played: sql<number>`count(*)::int`,
          answered: sql<number>`coalesce(sum(${s.quizResults.correct} + ${s.quizResults.wrong}),0)::int`,
          timeMs: sql<number>`coalesce(sum(${s.quizResults.durationMs}),0)::float8`,
        })
        .from(s.quizResults)
        .where(eq(s.quizResults.childId, childId)),
      this.db.select().from(s.certificates).where(eq(s.certificates.childId, childId)),
    ]);
    const progress = [...state.progress.values()];
    const week = Array.from({ length: 7 }, (_, i) => {
      const date = jakartaDate(new Date(Date.now() - (6 - i) * DAY));
      const d = days.find((d) => d.date === date);
      return { date, rounds: d?.rounds ?? 0, passed: d?.passed ?? 0, minutes: d?.minutes ?? 0 };
    });
    let next: ChildInsights['next'] = null;
    const strengths: { topic: string; best: number | null }[] = [];
    let focus: ChildInsights['focus'] = null;
    for (const book of books)
      for (const topic of book.topics) {
        const played = topic.levels.flatMap((l) =>
          state.progress.get(l.id) ? [state.progress.get(l.id)!] : [],
        );
        if (played.length)
          strengths.push({
            topic: topic.title,
            best: Math.round(played.reduce((n, p) => n + p.bestScore, 0) / played.length),
          });
        for (const level of topic.levels) {
          const p = state.progress.get(level.id);
          if (!next && !p?.passed && level.generator)
            next = {
              level: level.number,
              topic: topic.title,
              book: book.title,
              paid: (await this.learning.status(level, state)) === 'premium',
            };
          if (p && !p.passed && p.attempts >= 2 && (!focus || p.bestScore < (focus.best ?? 100)))
            focus = {
              topic: topic.title,
              level: level.number,
              best: p.bestScore,
              attempts: p.attempts,
            };
        }
      }
    const mean = (list: typeof days) =>
      list.length
        ? Math.round(
            list.reduce((n, d) => n + d.average * d.rounds, 0) /
              list.reduce((n, d) => n + d.rounds, 0),
          )
        : null;
    const current = days.filter((d) => week.some((w) => w.date === d.date));
    const previous = days.filter((d) => !week.some((w) => w.date === d.date));
    const average = mean(current);
    return {
      totals: {
        points: progress.reduce((n, p) => n + p.bestScore, 0),
        passed: progress.filter((p) => p.passed).length,
        played: totals[0]!.played,
        answered: totals[0]!.answered,
        timeMs: totals[0]!.timeMs,
      },
      week,
      weekRounds: week.reduce((n, d) => n + d.rounds, 0),
      weekPassed: week.reduce((n, d) => n + d.passed, 0),
      weekMinutes: week.reduce((n, d) => n + d.minutes, 0),
      activeDays: week.filter((d) => d.rounds > 0).length,
      trend: average === null ? null : { now: average, before: mean(previous) },
      next,
      strength: strengths.sort((a, b) => (b.best ?? 0) - (a.best ?? 0))[0] ?? null,
      focus,
      books: books.map((b) => {
        const ids = b.topics.flatMap((t) => t.levels.map((l) => l.id));
        const passed = ids.filter((id) => state.progress.get(id)?.passed).length;
        return {
          slug: b.slug,
          title: b.title,
          domain: subjectDomainOf(b.subject),
          grade: `sd${b.grade}`,
          passed,
          levels: ids.length,
          percent: ids.length ? Math.round((passed / ids.length) * 100) : 0,
          certificateId: certs.find((c) => c.bookSlug === b.slug)?.id ?? null,
        };
      }),
      recent: await Promise.all(
        recent.map(async (r) => {
          const f = await this.learning.curriculum.find(r.levelId);
          return {
            skillId: r.levelId,
            ts: r.finishedAt.getTime(),
            score: r.score,
            passed: r.passed,
            level: f.level.number,
            title: f.topic.title,
            book: f.book.title,
            durationMs: r.durationMs,
          };
        }),
      ),
    };
  }
  async overview(parentId: string) {
    const [parent] = await this.db.select().from(s.parents).where(eq(s.parents.id, parentId));
    if (!parent) missing();
    const children = await Promise.all(
      (await this.children(parentId)).map(async (c) => {
        const [insights, plan, state] = await Promise.all([
          this.insights(c.id),
          this.plan(c.id),
          this.learning.state(c.id),
        ]);
        return {
          ...this.learning.profileView(c),
          plan,
          insights,
          totalScore: insights.totals.points,
          levelsPassed: insights.totals.passed,
          rounds: insights.totals.played,
          minutes: Math.round(insights.totals.timeMs / 60_000),
          premiumUntil: state.until,
        };
      }),
    );
    return {
      familyCode: parent.familyCode,
      children,
      week: {
        rounds: children.reduce((n, c) => n + c.insights.weekRounds, 0),
        levelsPassed: children.reduce((n, c) => n + c.insights.weekPassed, 0),
        minutes: children.reduce((n, c) => n + c.insights.weekMinutes, 0),
        activeChildren: children.filter((c) => c.insights.weekRounds > 0).length,
      },
    };
  }
  async report(childId: string) {
    const state = await this.learning.state(childId);
    const books = await this.learning.curriculum.books();
    const rows = await this.db
      .select()
      .from(s.quizResults)
      .where(eq(s.quizResults.childId, childId))
      .orderBy(desc(s.quizResults.finishedAt))
      .limit(5);
    const [week] = await this.db
      .select({
        accuracy: sql<
          number | null
        >`round(100.0 * sum(${s.quizResults.correct}) / nullif(sum(${s.quizResults.correct} + ${s.quizResults.wrong}),0))::int`,
      })
      .from(s.quizResults)
      .where(
        and(
          eq(s.quizResults.childId, childId),
          gte(s.quizResults.finishedAt, new Date(Date.now() - 7 * DAY)),
        ),
      );
    const topics = books.flatMap((b) =>
      b.topics
        .filter((t) => state.mastery.has(t.id))
        .map((t) => {
          const m = state.mastery.get(t.id)!;
          return {
            topicId: t.id,
            title: t.title,
            bookTitle: b.title,
            mastery: m.score,
            status: masteryStatus(m.score),
            stage: m.visibleStage,
          };
        }),
    );
    return {
      child: { id: childId, nickname: state.child.nickname, momoColor: state.child.momoColor },
      topics,
      weekAccuracy: week?.accuracy ?? null,
      recentRounds: await Promise.all(
        rows.map(async (r) => ({
          roundId: r.roundId,
          levelTitle: (await this.learning.curriculum.find(r.levelId)).level.title,
          score: r.score,
          passed: r.passed,
          finishedAt: r.finishedAt.toISOString(),
          durationMs: r.durationMs,
        })),
      ),
      suggestions: topics
        .filter((t) => t.status !== 'mastered')
        .sort((a, b) => a.mastery - b.mastery)
        .slice(0, 3)
        .map((t) => ({ topicId: t.topicId, title: t.title })),
    };
  }
}
