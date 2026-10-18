import { Body, Controller, Delete, Get, Inject, Param, Patch, Post, Query } from '@nestjs/common';
import { eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { emailSchema, passwordSchema, setPinBodySchema, pinSecret } from '@udakids/engine';
import { DB, type Db } from '../db/db.module.js';
import * as s from '../db/schema.js';
import { DirectoryService } from './directory.service.js';
import { DemoSeedService } from './demo-seed.service.js';
import { CurrentUser, Roles, type User } from '../auth/decorators.js';
import { AuthGuard } from '../auth/auth.guard.js';
import { hashSecret } from '../common/crypto.js';
import { fail, missing } from '../common/errors.js';
import { iso } from '../common/dates.js';
const staffView = (r: typeof s.staffUsers.$inferSelect) => ({
  id: r.id,
  name: r.name,
  email: r.email,
  active: r.active,
  createdAt: iso(r.createdAt),
});
@Controller('admin')
@Roles('admin')
export class UsersController {
  constructor(
    @Inject(DB) private db: Db,
    private directory: DirectoryService,
    private demo: DemoSeedService,
    private guard: AuthGuard,
  ) {}
  @Get('directory/summary') summary() {
    return this.directory.summary();
  }
  @Post('demo-data') seedDemo(@CurrentUser() u: User, @Body() body: unknown) {
    if (process.env.DATABASE_DRIVER !== 'pglite' || process.env.NODE_ENV === 'production')
      fail(403, 'FORBIDDEN', 'Data demo hanya tersedia pada PGlite lokal.');
    return this.demo.seed(body, u);
  }
  @Get('directory/families') families(@Query() q: unknown) {
    return this.directory.families(q);
  }
  @Get('directory/children') children(@Query() q: unknown) {
    return this.directory.children(q);
  }
  @Post('premium') grant(@CurrentUser() u: User, @Body() b: unknown) {
    return this.directory.grant(b, u.name);
  }
  @Delete('premium/:id') async revoke(@Param('id') id: string) {
    if (
      !(
        await this.db
          .delete(s.premiumGrants)
          .where(eq(s.premiumGrants.id, z.uuid().parse(id)))
          .returning()
      ).length
    )
      missing();
  }
  @Patch('parents/:id') async parent(@Param('id') raw: string, @Body() b: unknown) {
    const id = z.uuid().parse(raw);
    const v = z.strictObject({ active: z.boolean() }).parse(b);
    const [r] = await this.db.update(s.parents).set(v).where(eq(s.parents.id, id)).returning();
    if (!r) missing();
    this.guard.forget(id);
    for (const c of await this.db
      .select({ id: s.children.id })
      .from(s.children)
      .where(eq(s.children.parentId, id)))
      this.guard.forget(c.id);
    return (await this.directory.familyRows([r]))[0];
  }
  @Post('parents/:id/password') async password(@Param('id') raw: string, @Body() b: unknown) {
    const id = z.uuid().parse(raw);
    const v = z.object({ password: passwordSchema }).parse(b);
    const passwordHash = await hashSecret(v.password);
    if (
      !(
        await this.db
          .update(s.parents)
          .set({ passwordHash, passwordChangedAt: new Date() })
          .where(eq(s.parents.id, id))
          .returning()
      ).length
    )
      missing();
    this.guard.forget(id);
  }
  @Patch('children/:id') async child(@Param('id') raw: string, @Body() b: unknown) {
    const id = z.uuid().parse(raw);
    const v = z.strictObject({ active: z.boolean() }).parse(b);
    const [c] = await this.db.update(s.children).set(v).where(eq(s.children.id, id)).returning();
    if (!c) missing();
    this.guard.forget(id);
    const parents = c.parentId
      ? await this.db.select().from(s.parents).where(eq(s.parents.id, c.parentId))
      : [];
    return (await this.directory.childViews([c], parents))[0];
  }
  @Post('children/:id/pin') async pin(@Param('id') raw: string, @Body() b: unknown) {
    const id = z.uuid().parse(raw);
    const v = setPinBodySchema.parse(b);
    if (
      !(
        await this.db
          .update(s.children)
          .set({
            picturePinHash: await hashSecret(pinSecret(v.pin)),
            pinChangedAt: new Date(),
            failedPinAttempts: 0,
            pinLockCount: 0,
            pinLockedUntil: null,
          })
          .where(eq(s.children.id, id))
          .returning()
      ).length
    )
      missing();
    this.guard.forget(id);
  }
  @Get('staff') async staff() {
    return (
      await this.db.select().from(s.staffUsers).orderBy(s.staffUsers.createdAt).limit(500)
    ).map(staffView);
  }
  @Post('staff') async createStaff(@Body() b: unknown) {
    const v = z
      .strictObject({
        name: z.string().trim().min(2).max(60),
        email: emailSchema,
        password: passwordSchema,
      })
      .parse(b);
    const passwordHash = await hashSecret(v.password);
    return this.db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${v.email}))`);
      if ((await tx.select().from(s.parents).where(eq(s.parents.email, v.email))).length)
        fail(409, 'CONFLICT', 'Email sudah digunakan.');
      const [row] = await tx
        .insert(s.staffUsers)
        .values({ name: v.name, email: v.email, passwordHash })
        .returning();
      return staffView(row!);
    });
  }
  @Patch('staff/:id') async patchStaff(
    @CurrentUser() u: User,
    @Param('id') raw: string,
    @Body() b: unknown,
  ) {
    const id = z.uuid().parse(raw);
    const v = z
      .strictObject({ active: z.boolean().optional(), password: passwordSchema.optional() })
      .parse(b);
    if (id === u.id && v.active === false)
      fail(409, 'CONFLICT', 'Akun yang sedang dipakai tidak bisa dinonaktifkan.');
    const [row] = await this.db
      .update(s.staffUsers)
      .set({
        active: v.active,
        ...(v.password && {
          passwordHash: await hashSecret(v.password),
          passwordChangedAt: new Date(),
        }),
      })
      .where(eq(s.staffUsers.id, id))
      .returning();
    if (!row) missing();
    this.guard.forget(id);
    return staffView(row);
  }
}
