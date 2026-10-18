import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, gte, sql } from 'drizzle-orm';
import {
  insightRangeSchema,
  masteryStatus,
  type AdminChildReport,
  type AdminInsights,
  type Stage,
} from '@udakids/engine';
import { DB, type Db } from '../db/db.module.js';
import * as s from '../db/schema.js';
import { LearningService } from '../catalog/learning.service.js';
import { DirectoryService } from '../admin/directory.service.js';
import { DAY, iso, jakartaDate } from '../common/dates.js';
import { orderDto, orderColumns } from '../billing/billing.service.js';

@Injectable()
export class ReportsService {
  private cache = new Map<string, { at: number; value: AdminInsights }>();
  constructor(
    @Inject(DB) private db: Db,
    private learning: LearningService,
    private directory: DirectoryService,
  ) {}
  async levelStats(from?: Date) {
    const [books, stats, passed, wrong] = await Promise.all([
      this.learning.curriculum.books(),
      this.db
        .select({
          id: s.quizResults.levelId,
          answered: sql<number>`sum(${s.quizResults.correct}+${s.quizResults.wrong})::int`,
          correct: sql<number>`sum(${s.quizResults.correct})::int`,
          learners: sql<number>`count(distinct ${s.quizResults.childId})::int`,
          rounds: sql<number>`count(*)::int`,
          avg: sql<number>`round(avg(${s.quizResults.score}))::int`,
          pass: sql<number>`round(100.0*count(*) filter(where ${s.quizResults.passed})/nullif(count(*),0))::int`,
        })
        .from(s.quizResults)
        .where(from ? gte(s.quizResults.finishedAt, from) : undefined)
        .groupBy(s.quizResults.levelId),
      this.db
        .select({
          id: s.levelProgress.levelId,
          count: sql<number>`count(*) filter(where ${s.levelProgress.passed})::int`,
        })
        .from(s.levelProgress)
        .groupBy(s.levelProgress.levelId),
      this.db
        .select({
          id: s.rounds.levelId,
          answer: s.roundAnswers.chosen,
          count: sql<number>`count(*)::int`,
        })
        .from(s.roundAnswers)
        .innerJoin(s.rounds, eq(s.rounds.id, s.roundAnswers.roundId))
        .where(
          and(
            eq(s.roundAnswers.isCorrect, false),
            from ? gte(s.roundAnswers.answeredAt, from) : undefined,
          ),
        )
        .groupBy(s.rounds.levelId, s.roundAnswers.chosen),
    ]);
    return books.flatMap((b) =>
      b.topics.flatMap((t) =>
        t.levels.map((l) => {
          const v = stats.find((r) => r.id === l.id);
          return {
            id: l.id,
            levelId: l.id,
            bookSlug: b.slug,
            bookTitle: b.title,
            topicCode: t.code,
            topicTitle: t.title,
            number: l.number,
            title: l.title,
            levelTitle: l.title,
            answered: v?.answered ?? 0,
            accuracy: v?.answered ? Math.round((v.correct / v.answered) * 100) : null,
            learners: v?.learners ?? 0,
            passed: passed.find((r) => r.id === l.id)?.count ?? 0,
            rounds: v?.rounds ?? 0,
            avgScore: v?.avg ?? 0,
            passRate: v?.pass ?? 0,
            topWrong: wrong
              .filter((r) => r.id === l.id)
              .sort((a, b) => b.count - a.count)
              .slice(0, 3)
              .map((r) => ({ answer: r.answer, count: r.count })),
          };
        }),
      ),
    );
  }
  async children() {
    const rows = await this.db
      .select({
        id: s.children.id,
        nickname: s.children.nickname,
        momoColor: s.children.momoColor,
        parentName: s.parents.name,
        lastActiveAt: s.children.lastActiveAt,
        active: sql<boolean>`${s.children.active} and ${s.parents.active}`,
        answered: sql<number>`coalesce((select sum(q.correct+q.wrong) from quiz_results q where q.child_id=${s.children.id}),0)::int`,
        correct: sql<number>`coalesce((select sum(q.correct) from quiz_results q where q.child_id=${s.children.id}),0)::int`,
        passed: sql<number>`(select count(*) from level_progress p where p.child_id=${s.children.id} and p.passed)::int`,
      })
      .from(s.children)
      .innerJoin(s.parents, eq(s.parents.id, s.children.parentId))
      .orderBy(desc(s.children.lastActiveAt))
      .limit(1000);
    return rows.map((r) => ({ ...r, lastActiveAt: iso(r.lastActiveAt) }));
  }
  async childReport(id: string): Promise<AdminChildReport> {
    const state = await this.learning.state(id);
    const [catalog, stats, week] = await Promise.all([
      this.learning.curriculum.books(),
      this.db
        .select({
          id: s.quizResults.levelId,
          answered: sql<number>`sum(${s.quizResults.correct}+${s.quizResults.wrong})::int`,
          correct: sql<number>`sum(${s.quizResults.correct})::int`,
        })
        .from(s.quizResults)
        .where(eq(s.quizResults.childId, id))
        .groupBy(s.quizResults.levelId),
      this.db
        .select({
          answered: sql<number>`coalesce(sum(${s.quizResults.correct}+${s.quizResults.wrong}),0)::int`,
          correct: sql<number>`coalesce(sum(${s.quizResults.correct}),0)::int`,
        })
        .from(s.quizResults)
        .where(
          and(
            eq(s.quizResults.childId, id),
            gte(s.quizResults.finishedAt, new Date(Date.now() - 7 * DAY)),
          ),
        ),
    ]);
    const books: AdminChildReport['books'] = catalog.map((b) => {
      const topics = b.topics.map((t) => {
        const m = state.mastery.get(t.id);
        return {
          id: t.id,
          code: t.code,
          title: t.title,
          mastery: m?.score ?? 0,
          status: m ? masteryStatus(m.score) : ('not_started' as const),
          stage: (m?.visibleStage ?? 0) as Stage,
          levels: t.levels.map((l) => ({
            id: l.id,
            number: l.number,
            title: l.title,
            best: state.progress.get(l.id)?.bestScore ?? null,
            answered: stats.find((r) => r.id === l.id)?.answered ?? 0,
            correct: stats.find((r) => r.id === l.id)?.correct ?? 0,
            passed: state.progress.get(l.id)?.passed ?? false,
          })),
        };
      });
      const started = topics.filter((t) => t.status !== 'not_started');
      return {
        slug: b.slug,
        title: b.title,
        mastery: started.length
          ? Math.round(started.reduce((n, t) => n + t.mastery, 0) / started.length)
          : 0,
        passed: topics.reduce((n, t) => n + t.levels.filter((l) => l.passed).length, 0),
        levels: topics.reduce((n, t) => n + t.levels.length, 0),
        mastered: topics.filter((t) => t.status === 'mastered').length,
        topics,
      };
    });
    const topics = books.flatMap((b) => b.topics.map((t) => ({ ...t, bookTitle: b.title })));
    return {
      child: {
        id,
        nickname: state.child.nickname,
        momoColor: state.child.momoColor,
        parentName: state.parent?.name ?? '',
        lastActiveAt: iso(state.child.lastActiveAt),
        createdAt: iso(state.child.createdAt),
      },
      totals: {
        answered: stats.reduce((n, r) => n + r.answered, 0),
        correct: stats.reduce((n, r) => n + r.correct, 0),
        passed: books.reduce((n, b) => n + b.passed, 0),
        levels: books.reduce((n, b) => n + b.levels, 0),
        mastered: topics.filter((t) => t.status === 'mastered').length,
        topics: topics.length,
      },
      week: week[0]!,
      recommendations: topics
        .filter((t) => t.status === 'learning' || t.status === 'proficient')
        .sort((a, b) => a.mastery - b.mastery)
        .slice(0, 3)
        .map((t) => ({ topicId: t.id, title: t.title, bookTitle: t.bookTitle, status: t.status })),
      books,
    };
  }
  async insights(raw: unknown): Promise<AdminInsights> {
    const range = insightRangeSchema.default('7d').parse(raw);
    const hit = this.cache.get(range);
    if (hit && Date.now() - hit.at < 30_000) return hit.value;
    const today = jakartaDate();
    const count = range === '7d' ? 7 : range === '30d' ? 30 : Number(today.slice(-2));
    const days = Array.from({ length: count }, (_, i) =>
      jakartaDate(new Date(Date.now() - (count - 1 - i) * DAY)),
    );
    const from = new Date(`${days[0]}T00:00:00+07:00`);
    const [activity, revenue, totals, heat, hard, live, summary] = await Promise.all([
      this.db
        .select({
          date: sql<string>`to_char(${s.quizResults.finishedAt} at time zone 'Asia/Jakarta','YYYY-MM-DD')`,
          rounds: sql<number>`count(*)::int`,
          answers: sql<number>`sum(${s.quizResults.correct}+${s.quizResults.wrong})::int`,
        })
        .from(s.quizResults)
        .where(gte(s.quizResults.finishedAt, from))
        .groupBy(sql`1`),
      this.db
        .select({
          date: sql<string>`to_char(${s.orders.paidAt} at time zone 'Asia/Jakarta','YYYY-MM-DD')`,
          amount: sql<number>`sum(${s.orders.total})::int`,
        })
        .from(s.orders)
        .where(and(eq(s.orders.status, 'paid'), gte(s.orders.paidAt, from)))
        .groupBy(sql`1`),
      this.db
        .select({
          activeChildren: sql<number>`count(distinct ${s.quizResults.childId})::int`,
          answered: sql<number>`coalesce(sum(${s.quizResults.correct}+${s.quizResults.wrong}),0)::int`,
          accuracy: sql<
            number | null
          >`round(100.0*sum(${s.quizResults.correct})/nullif(sum(${s.quizResults.correct}+${s.quizResults.wrong}),0))::int`,
        })
        .from(s.quizResults)
        .where(gte(s.quizResults.finishedAt, from)),
      this.db
        .select({
          day: sql<number>`extract(isodow from ${s.quizResults.finishedAt} at time zone 'Asia/Jakarta')::int-1`,
          hour: sql<number>`extract(hour from ${s.quizResults.finishedAt} at time zone 'Asia/Jakarta')::int`,
          rounds: sql<number>`count(*)::int`,
          children: sql<number>`count(distinct ${s.quizResults.childId})::int`,
        })
        .from(s.quizResults)
        .where(gte(s.quizResults.finishedAt, from))
        .groupBy(sql`1,2`),
      this.levelStats(from),
      this.db
        .select({
          nickname: s.children.nickname,
          momoColor: s.children.momoColor,
          level: s.levels.title,
        })
        .from(s.rounds)
        .innerJoin(s.children, eq(s.children.id, s.rounds.childId))
        .innerJoin(s.levels, eq(s.levels.id, s.rounds.levelId))
        .where(gte(s.rounds.startedAt, new Date(Date.now() - 300_000)))
        .orderBy(desc(s.rounds.startedAt))
        .limit(8),
      this.directory.summary(),
    ]);
    const value: AdminInsights = {
      range,
      sample: false,
      days,
      kpis: { ...totals[0]!, revenue: revenue.reduce((n, r) => n + r.amount, 0) },
      activity: days.map((date) => ({
        date,
        rounds: activity.find((r) => r.date === date)?.rounds ?? 0,
        answers: activity.find((r) => r.date === date)?.answers ?? 0,
      })),
      revenueSeries: days.map((date) => ({
        date,
        amount: revenue.find((r) => r.date === date)?.amount ?? 0,
      })),
      funnel: [
        { label: 'Keluarga', value: summary.families ?? 0 },
        { label: 'Anak', value: summary.children ?? 0 },
        { label: 'Aktif belajar', value: totals[0]!.activeChildren },
        { label: 'Premium', value: summary.premiumChildren ?? 0 },
      ],
      subjects: [],
      heatmap: Array.from({ length: 7 }, (_, d) =>
        Array.from(
          { length: 24 },
          (_, h) => heat.find((r) => r.day === d && r.hour === h)?.rounds ?? 0,
        ),
      ),
      heatmapChildren: Array.from({ length: 7 }, (_, d) =>
        Array.from(
          { length: 24 },
          (_, h) => heat.find((r) => r.day === d && r.hour === h)?.children ?? 0,
        ),
      ),
      hardestSkills: hard
        .filter((l) => l.answered)
        .sort((a, b) => (a.accuracy ?? 100) - (b.accuracy ?? 100))
        .slice(0, 5)
        .map((l) => ({
          title: `${l.topicTitle}: ${l.title}`,
          accuracy: l.accuracy ?? 0,
          answers: l.answered,
        })),
      popularDistractors: hard
        .flatMap((l) =>
          l.topWrong.map((w) => ({
            prompt: `${l.topicTitle}: ${l.title}`,
            chosen: w.answer,
            count: w.count,
          })),
        )
        .sort((a, b) => b.count - a.count)
        .slice(0, 5),
      live: live.map((r) => ({
        ...r,
        momoColor: r.momoColor as AdminInsights['live'][number]['momoColor'],
      })),
    };
    const subjectRows = await this.db
      .select({ label: s.books.subject, value: sql<number>`count(*)::int` })
      .from(s.quizResults)
      .innerJoin(s.books, eq(s.books.slug, s.quizResults.bookSlug))
      .where(gte(s.quizResults.finishedAt, from))
      .groupBy(s.books.subject);
    value.subjects = subjectRows;
    this.cache.set(range, { at: Date.now(), value });
    return value;
  }
  async dashboard(range?: string) {
    const insight = await this.insights(range);
    const from = new Date(`${insight.days[0]}T00:00:00+07:00`);
    const [summary, books, counts, byBook, latest] = await Promise.all([
      this.directory.summary(),
      this.learning.curriculum.books(),
      this.db
        .select({
          pendingOrders: sql<number>`count(*) filter(where ${s.orders.status}='awaiting_review')::int`,
          awaitingPayment: sql<number>`count(*) filter(where ${s.orders.status}='awaiting_payment' and ${s.orders.expiresAt}>now())::int`,
        })
        .from(s.orders),
      this.db
        .select({
          slug: s.quizResults.bookSlug,
          rounds: sql<number>`count(*)::int`,
          learners: sql<number>`count(distinct ${s.quizResults.childId})::int`,
          passRate: sql<number>`round(100.0*count(*) filter(where ${s.quizResults.passed})/nullif(count(*),0))::int`,
        })
        .from(s.quizResults)
        .where(gte(s.quizResults.finishedAt, from))
        .groupBy(s.quizResults.bookSlug),
      this.db
        .select({ order: orderColumns, parentName: s.parents.name })
        .from(s.orders)
        .innerJoin(s.parents, eq(s.parents.id, s.orders.parentId))
        .orderBy(desc(s.orders.createdAt))
        .limit(6),
    ]);
    const [certs] = await this.db.select({ n: sql<number>`count(*)::int` }).from(s.certificates);
    const [review] = await this.db
      .select({ n: sql<number>`count(*)::int` })
      .from(s.illustrations)
      .where(eq(s.illustrations.status, 'review'));
    const [waiting] = await this.db
      .select({ n: sql<number>`count(*)::int` })
      .from(s.children)
      .where(
        sql`exists(select 1 from books b where exists(select 1 from topics t join levels l on l.topic_id=t.id where t.book_slug=b.slug) and not exists(select 1 from topics t join levels l on l.topic_id=t.id where t.book_slug=b.slug and not exists(select 1 from level_progress p where p.child_id=${s.children.id} and p.level_id=l.id and p.passed)) and not exists(select 1 from certificates c where c.child_id=${s.children.id} and c.book_slug=b.slug))`,
      );
    const completed = this.db
      .select({ slug: s.topics.bookSlug, childId: s.levelProgress.childId })
      .from(s.levelProgress)
      .innerJoin(s.levels, eq(s.levels.id, s.levelProgress.levelId))
      .innerJoin(s.topics, eq(s.topics.id, s.levels.topicId))
      .where(eq(s.levelProgress.passed, true))
      .groupBy(s.topics.bookSlug, s.levelProgress.childId)
      .having(
        sql`count(*)=(select count(*) from levels l join topics t on t.id=l.topic_id where t.book_slug=${s.topics.bookSlug})`,
      )
      .as('completed');
    const finishedBooks = await this.db
      .select({ slug: completed.slug, n: sql<number>`count(*)::int` })
      .from(completed)
      .groupBy(completed.slug);
    const total = insight.activity.reduce((n, r) => n + r.rounds, 0);
    const [passes] = await this.db
      .select({ n: sql<number>`count(*) filter(where ${s.quizResults.passed})::int` })
      .from(s.quizResults)
      .where(gte(s.quizResults.finishedAt, from));
    return {
      range: insight.range,
      rounds: total,
      passRate: total ? Math.round((passes!.n / total) * 100) : null,
      counts: {
        families: summary.families,
        children: summary.children,
        premiumChildren: summary.premiumChildren,
        certificates: certs!.n,
        waitingCertificates: waiting!.n,
        illustrationsToReview: review!.n,
        ...counts[0],
      },
      books: books.map((b) => ({
        ...byBook.find((r) => r.slug === b.slug),
        slug: b.slug,
        title: b.title,
        rounds: byBook.find((r) => r.slug === b.slug)?.rounds ?? 0,
        learners: byBook.find((r) => r.slug === b.slug)?.learners ?? 0,
        passRate: byBook.find((r) => r.slug === b.slug)?.passRate ?? null,
        finished: finishedBooks.find((r) => r.slug === b.slug)?.n ?? 0,
      })),
      recentOrders: latest.map((r) => ({ ...orderDto(r.order), parentName: r.parentName })),
    };
  }
  async overview() {
    const [summary, insight, levels] = await Promise.all([
      this.directory.summary(),
      this.insights('7d'),
      this.levelStats(),
    ]);
    return {
      parents: summary.families,
      children: summary.children,
      roundsToday: insight.activity.at(-1)?.rounds ?? 0,
      activeChildren7d: insight.kpis.activeChildren,
      hardestTopics: levels
        .filter((l) => l.rounds > 0)
        .sort((a, b) => a.passRate - b.passRate)
        .slice(0, 5)
        .map((l) => ({
          topicId: `${l.bookSlug}:${l.topicCode}`,
          title: l.topicTitle,
          passRate: l.passRate,
        })),
    };
  }
}
