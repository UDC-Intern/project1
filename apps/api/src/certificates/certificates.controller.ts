import { Body, Controller, Delete, Get, Inject, Param, Post, Put, Req } from '@nestjs/common';
import type { Request } from 'express';
import { and, eq, sql } from 'drizzle-orm';
import { childPremium } from '../admin/directory.service.js';
import { z } from 'zod';
import { certificateDesignBodySchema, claimCertificateBodySchema } from '@udakids/engine';
import { DB, type Db } from '../db/db.module.js';
import * as s from '../db/schema.js';
import { LearningService } from '../catalog/learning.service.js';
import { ParentService } from '../parent/parent.service.js';
import { CurrentUser, Public, Roles, type User } from '../auth/decorators.js';
import { missing } from '../common/errors.js';
import { RateLimiter } from '../common/rate-limit.js';
@Controller()
export class CertificatesController {
  private limiter = new RateLimiter(60, 600_000);
  constructor(
    @Inject(DB) private db: Db,
    private learning: LearningService,
    private parent: ParentService,
  ) {}
  @Public() @Get('certificates/verify/:id') verify(@Param('id') id: string, @Req() req: Request) {
    this.limiter.take(req.ip ?? 'unknown');
    return this.learning.verify(
      z
        .string()
        .regex(/^CERT-[A-HJ-NP-Z2-9]{6}$/)
        .parse(id),
    );
  }
  @Roles('child') @Get('certificates') list(@CurrentUser() u: User) {
    return this.learning.certificateBooks(u.id);
  }
  @Roles('child') @Get('certificates/books/:slug') async book(
    @CurrentUser() u: User,
    @Param('slug') slug: string,
  ) {
    const book = (await this.learning.certificateBooks(u.id)).books.find(
      (b) => b.bookSlug === slug,
    );
    if (!book) missing();
    return book;
  }
  @Roles('child') @Post('certificates/books/:slug/claim') async claim(
    @CurrentUser() u: User,
    @Param('slug') slug: string,
  ) {
    await this.claimLocked(u.id, slug);
    return (await this.learning.certificateBooks(u.id)).books.find((b) => b.bookSlug === slug);
  }
  private claimLocked(id: string, slug: string) {
    return this.db.transaction(async (tx) => {
      await tx
        .select({ id: s.children.id })
        .from(s.children)
        .where(eq(s.children.id, id))
        .for('update');
      return this.learning.issue(id, slug, 'claim', tx);
    });
  }
  @Roles('parent') @Get('parent/certificates') async parentList(@CurrentUser() u: User) {
    return {
      children: await Promise.all(
        (await this.parent.children(u.id)).map(async (c) => ({
          ...this.learning.profileView(c),
          ...(await this.learning.certificateBooks(c.id)),
        })),
      ),
    };
  }
  @Roles('parent') @Get('parent/certificates/:id') async parentCert(
    @CurrentUser() u: User,
    @Param('id') id: string,
  ) {
    const [c] = await this.db
      .select({ cert: s.certificates })
      .from(s.certificates)
      .innerJoin(s.children, eq(s.children.id, s.certificates.childId))
      .where(and(eq(s.certificates.id, id), eq(s.children.parentId, u.id)));
    if (!c) missing();
    return { ...c.cert, issuedAt: c.cert.issuedAt.toISOString() };
  }
  @Roles('parent') @Post('parent/certificates') async parentClaim(
    @CurrentUser() u: User,
    @Body() b: unknown,
  ) {
    const v = claimCertificateBodySchema.extend({ childId: z.uuid() }).parse(b);
    await this.parent.owned(u.id, v.childId);
    return this.claimLocked(v.childId, v.bookSlug);
  }
  @Roles('admin') @Get('admin/certificates') async adminList() {
    const certs = await this.db
      .select({
        cert: s.certificates,
        parentName: s.parents.name,
        parentEmail: s.parents.email,
        nickname: s.children.nickname,
      })
      .from(s.certificates)
      .innerJoin(s.children, eq(s.children.id, s.certificates.childId))
      .innerJoin(s.parents, eq(s.parents.id, s.children.parentId))
      .limit(1000);
    const candidates = await this.db
      .select({
        childId: s.children.id,
        childName: s.children.nickname,
        parentName: s.parents.name,
        bookSlug: s.books.slug,
        bookTitle: s.books.title,
        hasPremium: childPremium,
        completedAt: sql<
          string | null
        >`(select max(p.first_passed_at)::text from level_progress p join levels l on l.id=p.level_id join topics t on t.id=l.topic_id where p.child_id=${s.children.id} and t.book_slug=${s.books.slug})`,
      })
      .from(s.children)
      .innerJoin(s.parents, eq(s.parents.id, s.children.parentId))
      .innerJoin(s.books, sql`true`)
      .where(
        sql`exists(select 1 from topics t join levels l on l.topic_id=t.id where t.book_slug=${s.books.slug}) and not exists(select 1 from topics t join levels l on l.topic_id=t.id where t.book_slug=${s.books.slug} and not exists(select 1 from level_progress p where p.child_id=${s.children.id} and p.level_id=l.id and p.passed)) and not exists(select 1 from certificates c where c.child_id=${s.children.id} and c.book_slug=${s.books.slug})`,
      )
      .limit(1000);
    return {
      design: (await this.learning.settings.value('certificateDesign')) ?? 'klasik',
      certificates: certs.map((r) => ({
        ...r.cert,
        issuedAt: r.cert.issuedAt.toISOString(),
        parentName: r.parentName,
        parentEmail: r.parentEmail,
        nickname: r.nickname,
      })),
      candidates,
    };
  }
  @Roles('admin') @Put('admin/certificates/design') async design(@Body() b: unknown) {
    const v = certificateDesignBodySchema.parse(b);
    await this.learning.settings.put('certificateDesign', v.design);
    return v;
  }
  @Roles('admin') @Post('admin/certificates') async issue(@Body() b: unknown) {
    const v = claimCertificateBodySchema.extend({ childId: z.uuid() }).parse(b);
    return this.db.transaction(async (tx) => {
      await tx
        .select({ id: s.children.id })
        .from(s.children)
        .where(eq(s.children.id, v.childId))
        .for('update');
      return this.learning.issue(v.childId, v.bookSlug, 'admin', tx);
    });
  }
  @Roles('admin') @Post('admin/certificates/:id/refresh') async refresh(@Param('id') id: string) {
    const [c] = await this.db.select().from(s.certificates).where(eq(s.certificates.id, id));
    if (!c) missing();
    const state = await this.learning.state(c.childId);
    const settings = await this.learning.settings.get();
    const [updated] = await this.db
      .update(s.certificates)
      .set({
        design: ((await this.learning.settings.value('certificateDesign')) as string) ?? 'klasik',
        childName:
          settings.certificate.useFullName && state.child.certificateName
            ? state.child.certificateName
            : state.child.nickname,
      })
      .where(eq(s.certificates.id, id))
      .returning();
    return updated;
  }
  @Roles('admin') @Delete('admin/certificates/:id') async remove(@Param('id') id: string) {
    if (!(await this.db.delete(s.certificates).where(eq(s.certificates.id, id)).returning()).length)
      missing();
  }
}
