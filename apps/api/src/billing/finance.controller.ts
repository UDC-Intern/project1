import { Body, Controller, Delete, Get, Inject, Param, Post, Query } from '@nestjs/common';
import { and, desc, eq, gte, lte, sql } from 'drizzle-orm';
import { z } from 'zod';
import { CurrentUser, Roles, type User } from '../auth/decorators.js';
import { DB, type Db } from '../db/db.module.js';
import * as s from '../db/schema.js';
import { SettingsService } from '../settings/settings.service.js';
import { fail, missing } from '../common/errors.js';
@Controller('admin')
@Roles('admin')
export class FinanceController {
  constructor(
    @Inject(DB) private db: Db,
    private settings: SettingsService,
  ) {}
  @Get('finance/cash') async cash(@Query() raw: unknown) {
    const q = z.object({ from: z.iso.date().optional(), to: z.iso.date().optional() }).parse(raw);
    const where = and(
      q.from ? gte(s.cashEntries.day, q.from) : undefined,
      q.to ? lte(s.cashEntries.day, q.to) : undefined,
    );
    const items = await this.db
      .select()
      .from(s.cashEntries)
      .where(where)
      .orderBy(desc(s.cashEntries.day))
      .limit(500);
    const [totals] = await this.db
      .select({
        income: sql<number>`coalesce(sum(${s.cashEntries.amount}) filter(where ${s.cashEntries.kind}='in'),0)::float8`,
        expense: sql<number>`coalesce(sum(${s.cashEntries.amount}) filter(where ${s.cashEntries.kind}='out'),0)::float8`,
      })
      .from(s.cashEntries)
      .where(where);
    return { items, ...totals, balance: totals!.income - totals!.expense };
  }
  @Post('finance/cash') async createCash(@CurrentUser() u: User, @Body() input: unknown) {
    const b = z
      .strictObject({
        day: z.iso.date(),
        kind: z.enum(['in', 'out']),
        amount: z.number().int().min(1).max(100_000_000),
        category: z.string().trim().min(1).max(40),
        note: z.string().trim().max(200).default(''),
      })
      .parse(input);
    const [row] = await this.db
      .insert(s.cashEntries)
      .values({ ...b, createdBy: u.id })
      .returning();
    return row;
  }
  @Delete('finance/cash/:id') async removeCash(@Param('id') raw: string) {
    const id = z.uuid().parse(raw);
    const [row] = await this.db.select().from(s.cashEntries).where(eq(s.cashEntries.id, id));
    if (!row) missing();
    if (row.orderId) fail(409, 'CONFLICT', 'Pemasukan dari pesanan tidak bisa dihapus.');
    await this.db.delete(s.cashEntries).where(eq(s.cashEntries.id, id));
  }
  @Get('affiliate') async affiliate() {
    return this.db
      .select({
        parentId: s.parents.id,
        name: s.parents.name,
        registered: sql<number>`(select count(*) from referrals r where r.referrer_id=${s.parents.id})::int`,
        paid: sql<number>`(select count(*) from referrals r where r.referrer_id=${s.parents.id} and r.status='paid')::int`,
        earned: sql<number>`coalesce((select sum(r.commission) from referrals r where r.referrer_id=${s.parents.id}),0)::int`,
        balance: sql<number>`(coalesce((select sum(r.commission) from referrals r where r.referrer_id=${s.parents.id}),0)-coalesce((select sum(p.amount) from commission_payouts p where p.parent_id=${s.parents.id}),0))::int`,
      })
      .from(s.parents)
      .where(sql`exists(select 1 from referrals r where r.referrer_id=${s.parents.id})`)
      .limit(500);
  }
  @Post('affiliate/payouts') async payout(@CurrentUser() u: User, @Body() input: unknown) {
    const b = z
      .strictObject({
        parentId: z.uuid(),
        amount: z.number().int().min(1),
        note: z.string().trim().max(200).default(''),
      })
      .parse(input);
    return this.db.transaction(async (tx) => {
      if (
        !(await tx.select().from(s.parents).where(eq(s.parents.id, b.parentId)).for('update'))
          .length
      )
        missing();
      const [earned] = await tx
        .select({ n: sql<number>`coalesce(sum(${s.referrals.commission}),0)::int` })
        .from(s.referrals)
        .where(eq(s.referrals.referrerId, b.parentId));
      const [paid] = await tx
        .select({ n: sql<number>`coalesce(sum(${s.commissionPayouts.amount}),0)::int` })
        .from(s.commissionPayouts)
        .where(eq(s.commissionPayouts.parentId, b.parentId));
      if (b.amount > earned!.n - paid!.n) fail(409, 'CONFLICT', 'Jumlah melebihi saldo komisi.');
      const [row] = await tx
        .insert(s.commissionPayouts)
        .values({ ...b, createdBy: u.id })
        .returning();
      return row;
    });
  }
}
