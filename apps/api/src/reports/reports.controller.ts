import { Controller, Get, Inject, Param, Query } from '@nestjs/common';
import { desc } from 'drizzle-orm';
import { z } from 'zod';
import { Roles } from '../auth/decorators.js';
import { ReportsService } from './reports.service.js';
import { DB, type Db } from '../db/db.module.js';
import * as s from '../db/schema.js';
@Controller('admin')
@Roles('admin')
export class ReportsController {
  constructor(
    private reports: ReportsService,
    @Inject(DB) private db: Db,
  ) {}
  @Get('insights') insights(@Query('range') range?: string) {
    return this.reports.insights(range);
  }
  @Get('dashboard') dashboard(@Query('range') range?: string) {
    return this.reports.dashboard(range);
  }
  @Get('overview') overview() {
    return this.reports.overview();
  }
  @Get('reports/levels') levels() {
    return this.reports.levelStats();
  }
  @Get('children') children() {
    return this.reports.children();
  }
  @Get('children/:id/report') child(@Param('id') id: string) {
    return this.reports.childReport(z.uuid().parse(id));
  }
  @Get('notifications') async notifications() {
    const [parents, children, orders, certs] = await Promise.all([
      this.db.select().from(s.parents).orderBy(desc(s.parents.createdAt)).limit(30),
      this.db
        .select({
          id: s.children.id,
          nickname: s.children.nickname,
          createdAt: s.children.createdAt,
        })
        .from(s.children)
        .orderBy(desc(s.children.createdAt))
        .limit(30),
      this.db
        .select({
          id: s.orders.id,
          number: s.orders.number,
          total: s.orders.total,
          createdAt: s.orders.createdAt,
          proofAt: s.orders.proofAt,
        })
        .from(s.orders)
        .orderBy(desc(s.orders.createdAt))
        .limit(30),
      this.db.select().from(s.certificates).orderBy(desc(s.certificates.issuedAt)).limit(30),
    ]);
    const items = [
      ...parents.map((p) => ({
        key: `parent-${p.id}`,
        kind: 'parent',
        at: p.createdAt.toISOString(),
        title: 'Keluarga baru',
        detail: p.name,
        amount: null,
        href: '/admin/keluarga',
      })),
      ...children.map((c) => ({
        key: `child-${c.id}`,
        kind: 'child',
        at: c.createdAt.toISOString(),
        title: 'Profil anak baru',
        detail: c.nickname,
        amount: null,
        href: '/admin/keluarga',
      })),
      ...orders.flatMap((o) => [
        {
          key: `order-${o.id}`,
          kind: 'order_created',
          at: o.createdAt.toISOString(),
          title: 'Pesanan baru',
          detail: o.number,
          amount: o.total,
          href: '/admin/transaksi',
        },
        ...(o.proofAt
          ? [
              {
                key: `proof-${o.id}`,
                kind: 'order_proof',
                at: o.proofAt.toISOString(),
                title: 'Bukti transfer diterima',
                detail: o.number,
                amount: o.total,
                href: '/admin/transaksi',
              },
            ]
          : []),
      ]),
      ...certs.map((c) => ({
        key: `cert-${c.id}`,
        kind: 'certificate',
        at: c.issuedAt.toISOString(),
        title: 'Sertifikat terbit',
        detail: c.bookTitle,
        amount: null,
        href: '/admin/sertifikat',
      })),
    ]
      .sort((a, b) => b.at.localeCompare(a.at))
      .slice(0, 30);
    return { items };
  }
}
