import { Inject, Injectable } from '@nestjs/common';
import { randomInt } from 'node:crypto';
import { and, desc, eq, isNull } from 'drizzle-orm';
import { DB, type Db, type Executor } from '../db/db.module.js';
import { parents, emailVerifications } from '../db/schema.js';
import { hashSecret, verifySecret } from '../common/crypto.js';
import { MailService } from '../mail/mail.service.js';
import { template } from '../mail/templates.js';
import { RateLimiter } from '../common/rate-limit.js';
@Injectable()
export class VerificationService {
  private limiter = new RateLimiter(10, 900_000);
  constructor(
    @Inject(DB) private db: Db,
    private mail: MailService,
  ) {}
  async issue(id: string, email: string, tx: Executor) {
    const [latest] = await tx
      .select()
      .from(emailVerifications)
      .where(and(eq(emailVerifications.parentId, id), eq(emailVerifications.purpose, 'verify')))
      .orderBy(desc(emailVerifications.createdAt))
      .limit(1);
    if (latest && Date.now() - latest.createdAt.getTime() < 60_000) return;
    const code = String(randomInt(1_000_000)).padStart(6, '0');
    await tx
      .update(emailVerifications)
      .set({ consumedAt: new Date() })
      .where(
        and(
          eq(emailVerifications.parentId, id),
          eq(emailVerifications.purpose, 'verify'),
          isNull(emailVerifications.consumedAt),
        ),
      );
    await tx.insert(emailVerifications).values({
      parentId: id,
      purpose: 'verify',
      codeHash: await hashSecret(`verify:${id}:${code}`),
      expiresAt: new Date(Date.now() + 900_000),
    });
    await this.mail.enqueue(
      email,
      template(
        'Verifikasi email',
        `Kode Anda: ${code}. Berlaku 15 menit dan hanya bisa dipakai sekali.`,
      ),
      'verify',
      id,
      tx,
    );
  }
  async resend(email: string, ip: string) {
    this.limiter.take(`ip:${ip}`);
    this.limiter.take(email);
    await this.db.transaction(async (tx) => {
      const [p] = await tx.select().from(parents).where(eq(parents.email, email)).for('update');
      if (p && !p.emailVerifiedAt && p.active) await this.issue(p.id, p.email, tx);
    });
    return { ok: true };
  }
  async consume(email: string, code: string, ip: string) {
    this.limiter.take(`ip:${ip}`);
    this.limiter.take(email);
    return this.db.transaction(async (tx) => {
      const [parent] = await tx
        .select()
        .from(parents)
        .where(eq(parents.email, email))
        .for('update');
      if (!parent || !parent.active) return null;
      const [v] = await tx
        .select()
        .from(emailVerifications)
        .where(
          and(
            eq(emailVerifications.parentId, parent.id),
            eq(emailVerifications.purpose, 'verify'),
            isNull(emailVerifications.consumedAt),
          ),
        )
        .orderBy(desc(emailVerifications.createdAt))
        .limit(1);
      if (!v || v.expiresAt < new Date() || v.attempts >= 5) return null;
      if (!(await verifySecret(`verify:${parent.id}:${code}`, v.codeHash))) {
        await tx
          .update(emailVerifications)
          .set({ attempts: v.attempts + 1 })
          .where(eq(emailVerifications.id, v.id));
        return null;
      }
      await tx
        .update(emailVerifications)
        .set({ consumedAt: new Date() })
        .where(eq(emailVerifications.id, v.id));
      const [saved] = await tx
        .update(parents)
        .set({ emailVerifiedAt: new Date() })
        .where(eq(parents.id, parent.id))
        .returning();
      return saved!;
    });
  }
}
