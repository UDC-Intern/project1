import { Inject, Injectable } from '@nestjs/common';
import { randomInt } from 'node:crypto';
import { and, desc, eq, isNull, sql } from 'drizzle-orm';
import {
  emailChangeRequestSchema,
  emailChangeConfirmSchema,
  parentProfileSchema,
  passwordChangeSchema,
  changePasswordBodySchema,
} from '@udakids/engine';
import { DB, type Db } from '../db/db.module.js';
import { parents, staffUsers, emailVerifications } from '../db/schema.js';
import { hashSecret, verifySecret } from '../common/crypto.js';
import { fail, missing } from '../common/errors.js';
import { iso } from '../common/dates.js';
import { AuthService } from '../auth/auth.service.js';
import { AuthGuard } from '../auth/auth.guard.js';
import { MailService } from '../mail/mail.service.js';
import { template } from '../mail/templates.js';
import { RateLimiter } from '../common/rate-limit.js';

@Injectable()
export class AccountService {
  private limiter = new RateLimiter(10, 900_000);
  constructor(
    @Inject(DB) private db: Db,
    private auth: AuthService,
    private guard: AuthGuard,
    private mail: MailService,
  ) {}
  async row(id: string) {
    const [row] = await this.db.select().from(parents).where(eq(parents.id, id));
    if (!row) missing();
    return row;
  }
  async get(id: string) {
    const row = await this.row(id);
    return {
      name: row.name,
      email: row.email,
      familyCode: row.familyCode,
      passwordChangedAt: iso(row.passwordChangedAt),
      pendingEmail: row.pendingEmail,
      mustChangePassword: false,
    };
  }
  async name(id: string, input: unknown) {
    const body = parentProfileSchema.parse(input);
    await this.db.update(parents).set(body).where(eq(parents.id, id));
    this.guard.forget(id);
    return this.get(id);
  }
  async password(id: string, input: unknown, legacy = false) {
    const body = legacy
      ? (() => {
          const b = changePasswordBodySchema.parse(input);
          return { currentPassword: b.currentPassword, password: b.newPassword };
        })()
      : passwordChangeSchema.parse(input);
    const hash = await hashSecret(body.password);
    const updated = await this.db.transaction(async (tx) => {
      const [row] = await tx.select().from(parents).where(eq(parents.id, id)).for('update');
      if (!row) missing();
      if (!(await verifySecret(body.currentPassword, row.passwordHash)))
        fail(401, 'INVALID_CREDENTIALS', 'Kata sandi saat ini belum tepat.');
      const [next] = await tx
        .update(parents)
        .set({ passwordHash: hash, passwordChangedAt: new Date() })
        .where(eq(parents.id, id))
        .returning();
      await this.mail.enqueue(
        row.email,
        template(
          'Kata sandi diubah',
          'Kata sandi akun Anda sudah diubah. Hubungi pengelola bila bukan Anda yang mengubahnya.',
        ),
        'password_changed',
        id,
        tx,
      );
      return next!;
    });
    this.guard.forget(id);
    return this.auth.session(updated, 'parent');
  }
  async requestEmail(id: string, input: unknown) {
    const body = emailChangeRequestSchema.parse(input);
    this.limiter.take(id);
    const code = String(randomInt(1_000_000)).padStart(6, '0');
    const codeHash = await hashSecret(`email:${id}:${code}`);
    await this.db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${body.email}))`);
      const [row] = await tx.select().from(parents).where(eq(parents.id, id)).for('update');
      if (!row) missing();
      if (!(await verifySecret(body.currentPassword, row.passwordHash)))
        fail(401, 'INVALID_CREDENTIALS', 'Kata sandi saat ini belum tepat.');
      const [latest] = await tx
        .select()
        .from(emailVerifications)
        .where(and(eq(emailVerifications.parentId, id), eq(emailVerifications.purpose, 'email')))
        .orderBy(desc(emailVerifications.createdAt))
        .limit(1);
      if (latest && Date.now() - latest.createdAt.getTime() < 60_000)
        fail(429, 'RATE_LIMITED', 'Tunggu satu menit sebelum meminta kode lagi.');
      if (
        (await tx.select({ id: parents.id }).from(parents).where(eq(parents.email, body.email)))
          .length ||
        (
          await tx
            .select({ id: staffUsers.id })
            .from(staffUsers)
            .where(eq(staffUsers.email, body.email))
        ).length
      )
        fail(409, 'CONFLICT', 'Email sudah digunakan.');
      await tx
        .update(emailVerifications)
        .set({ consumedAt: new Date() })
        .where(
          and(
            eq(emailVerifications.parentId, id),
            eq(emailVerifications.purpose, 'email'),
            isNull(emailVerifications.consumedAt),
          ),
        );
      await tx.insert(emailVerifications).values({
        parentId: id,
        purpose: 'email',
        codeHash,
        newEmail: body.email,
        expiresAt: new Date(Date.now() + 900_000),
      });
      await tx.update(parents).set({ pendingEmail: body.email }).where(eq(parents.id, id));
      await this.mail.enqueue(
        body.email,
        template(
          'Kode penggantian email',
          `Kode Anda: ${code}. Berlaku 15 menit dan hanya dapat dipakai satu kali.`,
        ),
        'email_change',
        id,
        tx,
      );
    });
    return { pendingEmail: body.email };
  }
  async confirmEmail(id: string, input: unknown) {
    const body = emailChangeConfirmSchema.parse(input);
    this.limiter.take(`code:${id}`);
    const result = await this.db.transaction(async (tx) => {
      const [row] = await tx.select().from(parents).where(eq(parents.id, id)).for('update');
      if (!row) missing();
      const [v] = await tx
        .select()
        .from(emailVerifications)
        .where(
          and(
            eq(emailVerifications.parentId, id),
            eq(emailVerifications.purpose, 'email'),
            isNull(emailVerifications.consumedAt),
          ),
        )
        .orderBy(desc(emailVerifications.createdAt))
        .limit(1);
      if (!v || v.expiresAt < new Date() || v.attempts >= 5 || !v.newEmail) return false;
      if (!(await verifySecret(`email:${id}:${body.code}`, v.codeHash))) {
        await tx
          .update(emailVerifications)
          .set({ attempts: v.attempts + 1 })
          .where(eq(emailVerifications.id, v.id));
        return false;
      }
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${v.newEmail}))`);
      if (
        (await tx.select({ id: parents.id }).from(parents).where(eq(parents.email, v.newEmail)))
          .length ||
        (
          await tx
            .select({ id: staffUsers.id })
            .from(staffUsers)
            .where(eq(staffUsers.email, v.newEmail))
        ).length
      )
        fail(409, 'CONFLICT', 'Email sudah digunakan.');
      await tx
        .update(parents)
        .set({ email: v.newEmail, pendingEmail: null, emailVerifiedAt: new Date() })
        .where(eq(parents.id, id));
      await tx
        .update(emailVerifications)
        .set({ consumedAt: new Date() })
        .where(eq(emailVerifications.id, v.id));
      await this.mail.enqueue(
        row.email,
        template(
          'Email akun diubah',
          'Alamat email akun Anda sudah berubah. Hubungi pengelola bila bukan Anda yang mengubahnya.',
        ),
        'email_changed',
        id,
        tx,
      );
      return true;
    });
    if (!result) fail(400, 'VALIDATION', 'Kode belum tepat atau sudah kedaluwarsa.');
    this.guard.forget(id);
    return this.get(id);
  }
}
