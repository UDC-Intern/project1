import { Inject, Injectable } from '@nestjs/common';
import { and, asc, desc, eq, ilike, inArray, or, sql, type SQL } from 'drizzle-orm';
import { z } from 'zod';
import {
  extendPremium,
  FOREVER_ISO,
  type FamilyChild,
  type FamilyRow,
  type Grant,
  type PlanStatus,
} from '@udakids/engine';
import { DB, type Db } from '../db/db.module.js';
import * as s from '../db/schema.js';
import { fail, missing } from '../common/errors.js';
import { iso } from '../common/dates.js';

const querySchema = z.object({
  search: z.string().trim().max(100).default(''),
  status: z.enum(['all', 'premium', 'free']).default('all'),
  active: z.enum(['all', 'active', 'inactive']).default('all'),
  sort: z.enum(['newest', 'oldest', 'name', 'recent']).default('newest'),
  page: z.coerce.number().int().min(1).max(100000).default(1),
  pageSize: z.coerce
    .number()
    .int()
    .refine((n) => [10, 20, 50].includes(n))
    .default(20),
});
export const childPremium = sql<boolean>`(${s.parents.premiumUntil} > now() or exists(select 1 from premium_grants g where g.child_id=${s.children.id} and (g.ends_at is null or g.ends_at>now())))`;
const familyPremium = sql<boolean>`(${s.parents.premiumUntil}>now() or exists(select 1 from children c join premium_grants g on g.child_id=c.id where c.parent_id=${s.parents.id} and (g.ends_at is null or g.ends_at>now())))`;
const planOf = (until: Date | null, source: 'admin' | 'purchase'): PlanStatus =>
  until && until > new Date()
    ? {
        tier: 'premium',
        endsAt: until.toISOString() === FOREVER_ISO ? null : until.toISOString(),
        source,
      }
    : { tier: 'free', endsAt: null, source: null };
@Injectable()
export class DirectoryService {
  constructor(@Inject(DB) private db: Db) {}
  async childViews(
    children: (typeof s.children.$inferSelect)[],
    parents: (typeof s.parents.$inferSelect)[],
  ): Promise<FamilyChild[]> {
    const ids = children.map((c) => c.id);
    if (!ids.length) return [];
    const grants = await this.db
      .select()
      .from(s.premiumGrants)
      .where(inArray(s.premiumGrants.childId, ids));
    return children.map((c) => {
      const p = parents.find((p) => p.id === c.parentId);
      const own = grants.filter((g) => g.childId === c.id);
      const live = own.filter((g) => !g.endsAt || g.endsAt > new Date());
      const adminUntil = live.length
        ? new Date(Math.max(...live.map((g) => g.endsAt?.getTime() ?? Date.parse(FOREVER_ISO))))
        : null;
      const purchase = p?.premiumUntil && p.premiumUntil > new Date() ? p.premiumUntil : null;
      const fromPurchase = !!purchase && (!adminUntil || purchase >= adminUntil);
      const plan = planOf(
        fromPurchase ? purchase : adminUntil,
        fromPurchase ? 'purchase' : 'admin',
      );
      const list: Grant[] = own.map((g) => ({
        id: g.id,
        source: 'admin',
        childId: c.id,
        note: g.note,
        startsAt: iso(g.createdAt),
        endsAt: iso(g.endsAt),
        createdAt: iso(g.createdAt),
        grantedByName: g.grantedBy,
        live: !g.endsAt || g.endsAt > new Date(),
      }));
      if (purchase)
        list.push({
          id: `purchase-${p!.id}`,
          source: 'purchase',
          childId: null,
          note: null,
          startsAt: null,
          endsAt: purchase.toISOString() === FOREVER_ISO ? null : iso(purchase),
          createdAt: null,
          grantedByName: null,
          live: true,
        });
      return {
        id: c.id,
        nickname: c.nickname,
        momoColor: c.momoColor,
        active: c.active && (p?.active ?? false),
        lastActiveAt: iso(c.lastActiveAt),
        plan,
        grants: list,
      };
    });
  }
  async familyRows(parents: (typeof s.parents.$inferSelect)[]): Promise<FamilyRow[]> {
    if (!parents.length) return [];
    const children = await this.db
      .select()
      .from(s.children)
      .where(
        inArray(
          s.children.parentId,
          parents.map((p) => p.id),
        ),
      );
    const views = await this.childViews(children, parents);
    return parents.map((p) => {
      const kids = views.filter((c) => children.find((row) => row.id === c.id)?.parentId === p.id);
      return {
        id: p.id,
        name: p.name,
        email: p.email,
        familyCode: p.familyCode,
        active: p.active,
        createdAt: iso(p.createdAt),
        lastActiveAt:
          kids
            .flatMap((c) => (c.lastActiveAt ? [c.lastActiveAt] : []))
            .sort()
            .at(-1) ?? iso(p.lastLoginAt),
        plan: planOf(p.premiumUntil, 'purchase'),
        premiumChildren: kids.filter((c) => c.plan.tier === 'premium').length,
        children: kids,
      };
    });
  }
  async families(input: unknown) {
    const q = querySchema.parse(input);
    const search = `%${q.search}%`;
    const conditions: (SQL | undefined)[] = [
      q.search
        ? or(
            ilike(s.parents.name, search),
            ilike(s.parents.email, search),
            ilike(s.parents.familyCode, search),
            sql`exists(select 1 from children c where c.parent_id=${s.parents.id} and c.nickname ilike ${search})`,
          )
        : undefined,
      q.active === 'all' ? undefined : eq(s.parents.active, q.active === 'active'),
      q.status === 'all' ? undefined : sql`${familyPremium}=${q.status === 'premium'}`,
    ];
    const where = and(...conditions);
    const [count] = await this.db
      .select({ n: sql<number>`count(*)::int` })
      .from(s.parents)
      .where(where);
    const order =
      q.sort === 'name'
        ? asc(s.parents.name)
        : q.sort === 'oldest'
          ? asc(s.parents.createdAt)
          : q.sort === 'recent'
            ? desc(s.parents.lastLoginAt)
            : desc(s.parents.createdAt);
    const rows = await this.db
      .select()
      .from(s.parents)
      .where(where)
      .orderBy(order, s.parents.id)
      .limit(q.pageSize)
      .offset((q.page - 1) * q.pageSize);
    return {
      page: q.page,
      pageSize: q.pageSize,
      total: count!.n,
      items: await this.familyRows(rows),
    };
  }
  async children(input: unknown) {
    const q = querySchema.parse(input);
    const search = `%${q.search}%`;
    const active = sql<boolean>`(${s.children.active} and ${s.parents.active})`;
    const where = and(
      q.search
        ? or(
            ilike(s.children.nickname, search),
            ilike(s.parents.name, search),
            ilike(s.parents.email, search),
          )
        : undefined,
      q.active === 'all' ? undefined : sql`${active}=${q.active === 'active'}`,
      q.status === 'all' ? undefined : sql`${childPremium}=${q.status === 'premium'}`,
    );
    const [count] = await this.db
      .select({ n: sql<number>`count(*)::int` })
      .from(s.children)
      .innerJoin(s.parents, eq(s.parents.id, s.children.parentId))
      .where(where);
    const order =
      q.sort === 'name'
        ? asc(s.children.nickname)
        : q.sort === 'oldest'
          ? asc(s.children.createdAt)
          : q.sort === 'recent'
            ? desc(s.children.lastActiveAt)
            : desc(s.children.createdAt);
    const rows = await this.db
      .select({ child: s.children, parent: s.parents })
      .from(s.children)
      .innerJoin(s.parents, eq(s.parents.id, s.children.parentId))
      .where(where)
      .orderBy(order, s.children.id)
      .limit(q.pageSize)
      .offset((q.page - 1) * q.pageSize);
    const views = await this.childViews(
      rows.map((r) => r.child),
      rows.map((r) => r.parent),
    );
    const ids = rows.map((r) => r.child.id);
    const results = ids.length
      ? await this.db
          .select({
            id: s.quizResults.childId,
            n: sql<number>`coalesce(sum(${s.quizResults.correct}+${s.quizResults.wrong}),0)::int`,
          })
          .from(s.quizResults)
          .where(inArray(s.quizResults.childId, ids))
          .groupBy(s.quizResults.childId)
      : [];
    const progress = ids.length
      ? await this.db
          .select({
            id: s.levelProgress.childId,
            n: sql<number>`count(*) filter(where ${s.levelProgress.passed})::int`,
          })
          .from(s.levelProgress)
          .where(inArray(s.levelProgress.childId, ids))
          .groupBy(s.levelProgress.childId)
      : [];
    return {
      page: q.page,
      pageSize: q.pageSize,
      total: count!.n,
      items: views.map((c) => {
        const row = rows.find((r) => r.child.id === c.id)!;
        return {
          ...c,
          createdAt: iso(row.child.createdAt),
          parent: { id: row.parent.id, name: row.parent.name, email: row.parent.email },
          passed: progress.find((r) => r.id === c.id)?.n ?? 0,
          answered: results.find((r) => r.id === c.id)?.n ?? 0,
        };
      }),
    };
  }
  async summary() {
    const [families] = await this.db
      .select({
        families: sql<number>`count(*)::int`,
        familiesInactive: sql<number>`count(*) filter(where not ${s.parents.active})::int`,
        premiumFamilies: sql<number>`count(*) filter(where ${s.parents.premiumUntil}>now())::int`,
      })
      .from(s.parents);
    const [children] = await this.db
      .select({
        children: sql<number>`count(*)::int`,
        childrenInactive: sql<number>`count(*) filter(where not (${s.children.active} and ${s.parents.active}))::int`,
        premiumChildren: sql<number>`count(*) filter(where ${childPremium})::int`,
      })
      .from(s.children)
      .innerJoin(s.parents, eq(s.parents.id, s.children.parentId));
    const [grants] = await this.db
      .select({
        adminGrants: sql<number>`count(*) filter(where ${s.premiumGrants.endsAt} is null or ${s.premiumGrants.endsAt}>now())::int`,
      })
      .from(s.premiumGrants);
    return { ...families, ...children, ...grants };
  }
  async grant(input: unknown, name: string) {
    const b = z
      .object({
        childId: z.uuid(),
        durationDays: z.number().int().min(1).max(3650).nullable(),
        note: z.string().trim().max(200).default(''),
      })
      .parse(input);
    return this.db.transaction(async (tx) => {
      if (
        !(await tx.select().from(s.children).where(eq(s.children.id, b.childId)).for('update'))
          .length
      )
        missing();
      const rows = await tx
        .select()
        .from(s.premiumGrants)
        .where(eq(s.premiumGrants.childId, b.childId));
      if (rows.some((g) => !g.endsAt)) fail(409, 'CONFLICT', 'Anak sudah Premium selamanya.');
      const until = rows.reduce(
        (best, g) => (g.endsAt && (!best || g.endsAt > best) ? g.endsAt : best),
        null as Date | null,
      );
      const endsAt =
        b.durationDays === null
          ? null
          : new Date(extendPremium(iso(until), b.durationDays, Date.now()));
      const [g] = await tx
        .insert(s.premiumGrants)
        .values({ childId: b.childId, endsAt, note: b.note, grantedBy: name })
        .returning();
      return {
        ...g,
        source: 'admin',
        createdAt: iso(g!.createdAt),
        endsAt: iso(g!.endsAt),
        live: true,
      };
    });
  }
}
