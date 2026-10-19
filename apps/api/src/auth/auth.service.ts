import { Inject, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { and, eq, sql } from 'drizzle-orm';
import {
  pinSecret,
  pinLockMs,
  PIN_MAX_ATTEMPTS,
  type RegisterParentBody,
  type LoginBody,
  type ChildLoginBody,
} from '@udakids/engine';
import { DB, type Db } from '../db/db.module.js';
import { children, parents, staffUsers, referrals } from '../db/schema.js';
import { hashSecret, verifySecret, randomCode, ipHash } from '../common/crypto.js';
import { randomBytes } from 'node:crypto';
import { fail, missing } from '../common/errors.js';
import { TOKEN_TTL } from '../common/config.js';
import { RateLimiter } from '../common/rate-limit.js';
import { MailService } from '../mail/mail.service.js';
import { template } from '../mail/templates.js';
import { VerificationService } from './verification.service.js';
import { GoogleVerifier } from './google.js';

@Injectable()
export class AuthService {
  private dummy = hashSecret('tidak-ada-akun-ini');
  private loginLimit = new RateLimiter(10, 900_000);
  private ipLimit = new RateLimiter(30, 900_000);
  private signupLimit = new RateLimiter(10, 3_600_000);
  constructor(
    @Inject(DB) private db: Db,
    private jwt: JwtService,
    private mail: MailService,
    readonly verification: VerificationService,
    private google: GoogleVerifier,
  ) {}
  async session(
    row: { id: string; name: string; passwordChangedAt?: Date | null; familyCode?: string },
    role: 'admin' | 'parent',
  ) {
    return {
      token: await this.jwt.signAsync(
        { sub: row.id, role, name: row.name, v: row.passwordChangedAt?.getTime() ?? 0 },
        { expiresIn: TOKEN_TTL[role === 'admin' ? 'staff' : 'parent'] },
      ),
      user: { id: row.id, role, name: row.name, familyCode: row.familyCode ?? null },
    };
  }
  async register(body: RegisterParentBody, ip: string) {
    this.signupLimit.take(ip);
    const passwordHash = await hashSecret(body.password);
    return this.db.transaction(async (tx) => {
      // Satu kunci email juga dipakai oleh pembuatan staf dan penggantian email.
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${body.email}))`);
      if (
        (
          await tx
            .select({ id: staffUsers.id })
            .from(staffUsers)
            .where(eq(staffUsers.email, body.email))
        ).length
      )
        fail(409, 'CONFLICT', 'Email sudah digunakan.');
      const [row] = await tx
        .insert(parents)
        .values({
          name: body.name,
          email: body.email,
          passwordHash,
          familyCode: randomCode(),
          consentAt: new Date(),
          emailVerifiedAt: process.env.EMAIL_VERIFICATION === 'on' ? null : new Date(),
          signupIpHash: ipHash(ip),
        })
        .onConflictDoNothing()
        .returning();
      if (!row) fail(409, 'CONFLICT', 'Email sudah digunakan.');
      if (body.referralCode) {
        const [referrer] = await tx
          .select()
          .from(parents)
          .where(eq(parents.familyCode, body.referralCode));
        if (referrer && referrer.id !== row.id)
          await tx.insert(referrals).values({ referrerId: referrer.id, refereeId: row.id });
      }
      if (process.env.EMAIL_VERIFICATION === 'on') {
        await this.verification.issue(row.id, row.email, tx);
        return { verificationRequired: true, email: row.email };
      }
      await this.mail.enqueue(
        row.email,
        template(
          'Selamat datang di UdaKids',
          `Halo ${row.name}. Kode keluarga: ${row.familyCode}. Atur profil dan sandi gambar anak di area orang tua.`,
        ),
        'welcome',
        row.id,
        tx,
      );
      return this.session(row, 'parent');
    });
  }
  async login(body: LoginBody, kind: 'parent' | 'staff', ip: string) {
    const key = `${kind}:${body.email}`;
    this.loginLimit.check(key);
    this.ipLimit.check(ip);
    const row =
      kind === 'parent'
        ? (await this.db.select().from(parents).where(eq(parents.email, body.email)))[0]
        : (await this.db.select().from(staffUsers).where(eq(staffUsers.email, body.email)))[0];
    const ok = await verifySecret(body.password, row?.passwordHash ?? (await this.dummy));
    if (!row || !ok) {
      this.loginLimit.fail(key);
      this.ipLimit.fail(ip);
      fail(401, 'INVALID_CREDENTIALS', 'Email atau kata sandi belum tepat.');
    }
    this.loginLimit.reset(key);
    if (!row.active || ('role' in row && row.role !== 'admin'))
      fail(403, 'FORBIDDEN', 'Akun tidak aktif. Hubungi admin.');
    if (kind === 'parent') {
      if (
        process.env.EMAIL_VERIFICATION === 'on' &&
        'emailVerifiedAt' in row &&
        !row.emailVerifiedAt
      )
        fail(403, 'FORBIDDEN', 'Verifikasi email terlebih dahulu.', {
          reason: 'email_not_verified',
        });
      await this.db.update(parents).set({ lastLoginAt: new Date() }).where(eq(parents.id, row.id));
    }
    return this.session(row, kind === 'staff' ? 'admin' : 'parent');
  }
  async parentGoogle(input: { credential: string; consent?: boolean; name?: string }, ip: string) {
    this.ipLimit.check(ip);
    const profile = await this.google.verify(input.credential).catch((error: unknown) => {
      this.ipLimit.fail(ip);
      throw error;
    });
    const [existing] = await this.db.select().from(parents).where(eq(parents.email, profile.email));
    if (existing) {
      if (!existing.active) fail(403, 'FORBIDDEN', 'Akun tidak aktif. Hubungi admin.');
      await this.db
        .update(parents)
        .set({ emailVerifiedAt: existing.emailVerifiedAt ?? new Date(), lastLoginAt: new Date() })
        .where(eq(parents.id, existing.id));
      return this.session(existing, 'parent');
    }
    if (input.consent !== true)
      return { needsConsent: true as const, email: profile.email, name: profile.name };
    this.signupLimit.take(ip);
    const [created] = await this.db
      .insert(parents)
      .values({
        name: input.name?.trim().slice(0, 60) || profile.name,
        email: profile.email,
        passwordHash: await hashSecret(randomBytes(32).toString('base64url')),
        familyCode: randomCode(),
        consentAt: new Date(),
        emailVerifiedAt: new Date(),
        signupIpHash: ipHash(ip),
        lastLoginAt: new Date(),
      })
      .onConflictDoNothing()
      .returning();
    if (!created) fail(409, 'CONFLICT', 'Email sudah terdaftar. Silakan masuk.');
    await this.mail.enqueue(
      created.email,
      template(
        'Selamat datang di UdaKids',
        `Halo ${created.name}. Kode keluarga: ${created.familyCode}.`,
      ),
      'welcome',
      created.id,
    );
    return this.session(created, 'parent');
  }
  async family(code: string, ip: string) {
    this.ipLimit.check(ip);
    const key = `family:${code}`;
    this.loginLimit.check(key);
    const [parent] = await this.db
      .select()
      .from(parents)
      .where(and(eq(parents.familyCode, code.toUpperCase()), eq(parents.active, true)));
    if (!parent) {
      this.loginLimit.fail(key);
      this.ipLimit.fail(ip);
      missing();
    }
    const profiles = await this.db
      .select({
        id: children.id,
        nickname: children.nickname,
        momoColor: children.momoColor,
        picturePinHash: children.picturePinHash,
      })
      .from(children)
      .where(and(eq(children.parentId, parent.id), eq(children.active, true)));
    return {
      profiles: profiles.map(({ picturePinHash, ...c }) => ({ ...c, hasPin: !!picturePinHash })),
    };
  }
  async childLogin(body: ChildLoginBody, ip: string) {
    this.ipLimit.check(ip);
    const result = await this.db.transaction(async (tx) => {
      const [child] = await tx
        .select()
        .from(children)
        .where(eq(children.id, body.childId))
        .for('update');
      if (!child) missing();
      const [parent] = child.parentId
        ? await tx.select().from(parents).where(eq(parents.id, child.parentId))
        : [];
      if (!child.active || !parent?.active || !child.picturePinHash)
        fail(403, 'FORBIDDEN', 'Profil belum bisa digunakan. Hubungi orang tua.');
      if (child.pinLockedUntil && child.pinLockedUntil > new Date())
        return { lockedUntil: child.pinLockedUntil };
      if (!(await verifySecret(pinSecret(body.pin), child.picturePinHash))) {
        this.ipLimit.fail(ip);
        const attempts = child.failedPinAttempts + 1;
        const lockedUntil =
          attempts >= PIN_MAX_ATTEMPTS
            ? new Date(Date.now() + pinLockMs(child.pinLockCount + 1))
            : null;
        await tx
          .update(children)
          .set({
            failedPinAttempts: lockedUntil ? 0 : attempts,
            pinLockCount: child.pinLockCount + (lockedUntil ? 1 : 0),
            pinLockedUntil: lockedUntil,
          })
          .where(eq(children.id, child.id));
        return lockedUntil ? { lockedUntil } : { attemptsLeft: PIN_MAX_ATTEMPTS - attempts };
      }
      await tx
        .update(children)
        .set({
          failedPinAttempts: 0,
          pinLockCount: 0,
          pinLockedUntil: null,
          lastActiveAt: new Date(),
        })
        .where(eq(children.id, child.id));
      return {
        child: { id: child.id, nickname: child.nickname, momoColor: child.momoColor },
        version: child.pinChangedAt?.getTime() ?? 0,
      };
    });
    if ('lockedUntil' in result)
      fail(423, 'TEMPORARILY_LOCKED', 'Istirahat sebentar, lalu coba lagi.', {
        lockedUntil: result.lockedUntil!.toISOString(),
      });
    if ('attemptsLeft' in result)
      fail(401, 'WRONG_PIN', 'Gambarnya belum tepat. Coba lagi, ya.', {
        attemptsLeft: result.attemptsLeft,
      });
    return {
      token: await this.jwt.signAsync(
        { sub: result.child.id, role: 'child', name: result.child.nickname, v: result.version },
        { expiresIn: TOKEN_TTL.child },
      ),
      child: result.child,
    };
  }
}
