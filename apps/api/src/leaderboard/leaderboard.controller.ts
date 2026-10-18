import { Controller, Get, Inject, Query } from '@nestjs/common';
import { and, eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { leaderboardModeSchema, type LeaderboardEntry } from '@udakids/engine';
import { DB, type Db } from '../db/db.module.js';
import * as s from '../db/schema.js';
import { CurrentUser, Public, Roles, type User } from '../auth/decorators.js';
@Controller('leaderboard')
export class LeaderboardController {
  constructor(@Inject(DB) private db: Db) {}
  private async ranking(mode: string, book: string, childId?: string) {
    if (mode === 'mock') return { mode, total: 0, entries: [], me: null };
    const stats = this.db
      .select({
        id: s.quizResults.childId,
        rounds: sql<number>`count(*)::int`.as('rounds'),
        sum: sql<number>`sum(${s.quizResults.score})::int`.as('score_sum'),
        timeMs: sql<number>`sum(${s.quizResults.durationMs})::float8`.as('time_ms'),
        questions: sql<number>`sum(${s.quizResults.correct}+${s.quizResults.wrong})::int`.as(
          'questions',
        ),
      })
      .from(s.quizResults)
      .where(book ? eq(s.quizResults.bookSlug, book) : undefined)
      .groupBy(s.quizResults.childId)
      .as('stats');
    const points = sql<number>`coalesce((select sum(lp.best_score) from level_progress lp join levels l on l.id=lp.level_id join topics t on t.id=l.topic_id where lp.child_id=${s.children.id} and (${book}='' or t.book_slug=${book})),0)::int`;
    const average = sql<number>`round(${stats.sum}::numeric/${stats.rounds},2)::float8`;
    const rating = sql<number>`round((${stats.sum}+350)::numeric/(${stats.rounds}+5),2)::float8`;
    const base = this.db
      .select({
        id: s.children.id,
        nickname: s.children.nickname,
        momoColor: s.children.momoColor,
        rounds: stats.rounds,
        questions: stats.questions,
        timeMs: stats.timeMs,
        points: points.as('points'),
        average: average.as('average'),
        score: (mode === 'total' ? points : rating).as('score'),
      })
      .from(s.children)
      .innerJoin(stats, eq(stats.id, s.children.id))
      .innerJoin(s.parents, eq(s.parents.id, s.children.parentId))
      .where(and(eq(s.children.active, true), eq(s.parents.active, true)))
      .as('base');
    const rank = sql<number>`row_number() over(order by ${base.score} desc, ${mode === 'total' ? sql`0` : base.average} desc, ${base.timeMs} asc, ${base.rounds} desc, ${base.nickname} asc, ${base.id} asc)::int`;
    const ranked = this.db
      .select({
        id: base.id,
        nickname: base.nickname,
        momoColor: base.momoColor,
        rounds: base.rounds,
        questions: base.questions,
        timeMs: base.timeMs,
        points: base.points,
        average: base.average,
        score: base.score,
        rank: rank.as('rank'),
      })
      .from(base)
      .as('ranked');
    const [top, own, total] = await Promise.all([
      this.db.select().from(ranked).orderBy(ranked.rank).limit(25),
      childId ? this.db.select().from(ranked).where(eq(ranked.id, childId)) : Promise.resolve([]),
      this.db.select({ n: sql<number>`count(*)::int` }).from(base),
    ]);
    const view = (r: (typeof top)[number]): LeaderboardEntry => ({
      nickname: r.nickname,
      momoColor: r.momoColor as LeaderboardEntry['momoColor'],
      rounds: r.rounds,
      questions: r.questions,
      timeMs: r.timeMs,
      points: r.points,
      average: r.average,
      score: r.score,
      rank: r.rank,
      isMe: r.id === childId,
    });
    return { mode, total: total[0]!.n, entries: top.map(view), me: own[0] ? view(own[0]) : null };
  }
  @Public() @Get('top') async top(@Query('mode') raw?: string) {
    const result = await this.ranking(leaderboardModeSchema.default('average').parse(raw), '');
    return { entries: result.entries.slice(0, 10) };
  }
  @Roles('child') @Get() list(
    @CurrentUser() u: User,
    @Query('book') book?: string,
    @Query('mode') raw?: string,
  ) {
    return this.ranking(
      leaderboardModeSchema.default('average').parse(raw),
      z.string().max(100).default('').parse(book),
      u.id,
    );
  }
}
