import { Injectable, Inject } from '@nestjs/common';
import { and, eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import {
  emailSchema,
  generateRound,
  momoColorSchema,
  nicknameSchema,
  passwordSchema,
  pinSchema,
  pinSecret,
} from '@udakids/engine';
import { DB, type Db } from '../db/db.module.js';
import * as s from '../db/schema.js';
import { hashSecret, randomCode, verifySecret } from '../common/crypto.js';
import { jakartaDate } from '../common/dates.js';
import { PracticeService } from '../practice/practice.service.js';
import { BillingService } from '../billing/billing.service.js';
import { LearningService } from '../catalog/learning.service.js';
import { AuthGuard } from '../auth/auth.guard.js';

const demoParentEmail = /^demo\.keluarga(?:[1-9]|1\d|2[0-4])@example\.test$/;
const demoAdminEmail = /^demo\.admin[1-5]@example\.test$/;

const inputSchema = z.object({
  parents: z
    .array(
      z.object({
        name: z.string().trim().min(2).max(60),
        email: emailSchema,
        password: passwordSchema,
        children: z
          .array(
            z.object({
              nickname: nicknameSchema,
              momoColor: momoColorSchema,
              pin: pinSchema,
              correct: z.number().int().min(6).max(10),
            }),
          )
          .min(1)
          .max(10),
      }),
    )
    .min(24)
    .max(30),
  staff: z
    .array(
      z.object({
        name: z.string().trim().min(2).max(60),
        email: emailSchema,
        password: passwordSchema,
      }),
    )
    .length(5),
});

const levels = [
  'matematika-kelas-1:A:1',
  'matematika-kelas-2:A:1',
  'matematika-kelas-3:A:1',
  'matematika-kelas-4:A:1',
  'sains-kelas-1:A:1',
];
const proof = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScL/nwAAAABJRU5ErkJggg==',
  'base64',
);

@Injectable()
export class DemoSeedService {
  constructor(
    @Inject(DB) private db: Db,
    private practice: PracticeService,
    private billing: BillingService,
    private learning: LearningService,
    private guard: AuthGuard,
  ) {}

  private async code() {
    for (let attempt = 0; attempt < 20; attempt++) {
      const code = randomCode();
      if (
        !(
          await this.db
            .select({ id: s.parents.id })
            .from(s.parents)
            .where(eq(s.parents.familyCode, code))
        ).length
      )
        return code;
    }
    throw new Error('Kode keluarga demo belum bisa dibuat.');
  }

  private async oneRound(childId: string, correct: number, levelId: string, offset: number) {
    const opened = await this.practice.start(childId, levelId);
    const [round] = await this.db.select().from(s.rounds).where(eq(s.rounds.id, opened.roundId));
    const questions = generateRound(round!.generatorSnapshot, round!.seed);
    for (let index = 0; index < questions.length; index++) {
      const question = questions[index]!;
      const shouldBeCorrect = index < correct;
      const wrong =
        question.options?.find((option) => option !== question.answer) ??
        (question.type === 'number' ? String(Number(question.answer) + 1) : 'Belum tepat');
      const answer = shouldBeCorrect ? question.answer : wrong;
      const result = await this.practice.answer(childId, opened.roundId, {
        questionIndex: index,
        answer,
      });
      if (result.isCorrect !== shouldBeCorrect)
        throw new Error('Jawaban demo tidak sesuai dengan engine.');
    }
    const result = await this.practice.finish(childId, opened.roundId);
    if (result.correct !== correct) throw new Error('Nilai ronde demo tidak sesuai.');
    const finishedAt = new Date(Date.now() - offset * 86_400_000);
    await this.db
      .update(s.rounds)
      .set({
        startedAt: new Date(finishedAt.getTime() - 120_000),
        finishedAt,
      })
      .where(eq(s.rounds.id, opened.roundId));
    await this.db
      .update(s.quizResults)
      .set({ finishedAt })
      .where(eq(s.quizResults.roundId, opened.roundId));
  }

  async seed(input: unknown, admin: { id: string; name: string }) {
    const data = inputSchema.parse(input);
    const maxChildren = (await this.learning.settings.get()).family.maxChildren;
    for (const family of data.parents) {
      const [parent] = await this.db
        .select({ id: s.parents.id })
        .from(s.parents)
        .where(eq(s.parents.email, family.email));
      const existing = parent
        ? await this.db
            .select({ nickname: s.children.nickname })
            .from(s.children)
            .where(eq(s.children.parentId, parent.id))
        : [];
      const names = new Set(existing.map((child) => child.nickname));
      const newChildren = family.children.filter((child) => !names.has(child.nickname)).length;
      if (newChildren && existing.length + newChildren > maxChildren)
        throw new Error(`Data demo melebihi batas ${maxChildren} anak per keluarga.`);
    }
    let newRounds = 0;
    const familyAccess: {
      email: string;
      familyCode: string;
      children: { nickname: string; id: string }[];
    }[] = [];
    const childRows: (typeof s.children.$inferSelect)[] = [];
    const parentRows: (typeof s.parents.$inferSelect)[] = [];

    for (const person of data.staff) {
      const [existing] = await this.db
        .select()
        .from(s.staffUsers)
        .where(eq(s.staffUsers.email, person.email));
      if (existing && !(await verifySecret(person.password, existing.passwordHash))) {
        if (!demoAdminEmail.test(person.email))
          throw new Error(`Kata sandi admin demo ${person.email} tidak sesuai dengan database.`);
        await this.db
          .update(s.staffUsers)
          .set({ passwordHash: await hashSecret(person.password), passwordChangedAt: new Date() })
          .where(eq(s.staffUsers.id, existing.id));
        this.guard.forget(existing.id);
      }
      if (!existing)
        await this.db.insert(s.staffUsers).values({
          name: person.name,
          email: person.email,
          passwordHash: await hashSecret(person.password),
        });
    }

    for (let familyIndex = 0; familyIndex < data.parents.length; familyIndex++) {
      const family = data.parents[familyIndex]!;
      let [parent] = await this.db
        .select()
        .from(s.parents)
        .where(eq(s.parents.email, family.email));
      if (parent && !(await verifySecret(family.password, parent.passwordHash))) {
        if (!demoParentEmail.test(family.email))
          throw new Error(`Kata sandi keluarga demo ${family.email} tidak sesuai dengan database.`);
        [parent] = await this.db
          .update(s.parents)
          .set({ passwordHash: await hashSecret(family.password), passwordChangedAt: new Date() })
          .where(eq(s.parents.id, parent.id))
          .returning();
        this.guard.forget(parent!.id);
      }
      if (!parent) {
        [parent] = await this.db
          .insert(s.parents)
          .values({
            name: family.name,
            email: family.email,
            passwordHash: await hashSecret(family.password),
            familyCode: await this.code(),
            consentAt: new Date(),
            emailVerifiedAt: new Date(),
          })
          .returning();
      }
      parentRows.push(parent!);
      const children: { nickname: string; id: string }[] = [];
      for (const profile of family.children) {
        let [child] = await this.db
          .select()
          .from(s.children)
          .where(
            and(eq(s.children.parentId, parent!.id), eq(s.children.nickname, profile.nickname)),
          );
        if (child && !(await verifySecret(pinSecret(profile.pin), child.picturePinHash))) {
          if (!demoParentEmail.test(family.email))
            throw new Error(`Sandi gambar ${profile.nickname} tidak sesuai dengan database.`);
          [child] = await this.db
            .update(s.children)
            .set({
              picturePinHash: await hashSecret(pinSecret(profile.pin)),
              pinChangedAt: new Date(),
              failedPinAttempts: 0,
              pinLockCount: 0,
              pinLockedUntil: null,
            })
            .where(eq(s.children.id, child.id))
            .returning();
          this.guard.forget(child!.id);
        }
        if (!child) {
          [child] = await this.db
            .insert(s.children)
            .values({
              parentId: parent!.id,
              nickname: profile.nickname,
              momoColor: profile.momoColor,
              picturePinHash: await hashSecret(pinSecret(profile.pin)),
            })
            .returning();
        }
        childRows.push(child!);
        children.push({ nickname: child!.nickname, id: child!.id });
        const [played] = await this.db
          .select({ n: sql<number>`count(*)::int` })
          .from(s.quizResults)
          .where(eq(s.quizResults.childId, child!.id));
        if (!played!.n) {
          const index = childRows.length - 1;
          await this.oneRound(
            child!.id,
            profile.correct,
            levels[index % levels.length]!,
            index % 14,
          );
          newRounds++;
        }
      }
      familyAccess.push({ email: family.email, familyCode: parent!.familyCode, children });
    }

    const [firstPackage] = await this.db
      .select()
      .from(s.billingPackages)
      .where(eq(s.billingPackages.active, true));
    const [firstMethod] = await this.db
      .select()
      .from(s.paymentMethods)
      .where(eq(s.paymentMethods.active, true));
    if (!firstPackage || !firstMethod)
      throw new Error('Paket dan metode pembayaran awal belum tersedia.');

    for (let index = 0; index < parentRows.length; index++) {
      const parent = parentRows[index]!;
      if (
        index > 0 &&
        index % 3 === 0 &&
        !(
          await this.db
            .select({ id: s.referrals.id })
            .from(s.referrals)
            .where(eq(s.referrals.refereeId, parent.id))
        ).length
      )
        await this.db
          .insert(s.referrals)
          .values({ referrerId: parentRows[0]!.id, refereeId: parent.id });
      if (
        (
          await this.db
            .select({ id: s.orders.id })
            .from(s.orders)
            .where(eq(s.orders.parentId, parent.id))
        ).length
      )
        continue;
      const order = await this.billing.create(parent.id, {
        packageId: firstPackage.id,
        methodId: firstMethod.id,
      });
      const id = order.id;
      const status = index % 6;
      if (status === 1 || status === 0 || status === 3) {
        await this.db
          .update(s.orders)
          .set({
            proofName: 'bukti-demo.png',
            proofMime: 'image/png',
            proofData: proof,
            proofAt: new Date(),
            status: 'awaiting_review',
          })
          .where(eq(s.orders.id, id));
      }
      if (status === 0) await this.billing.review(id, admin.id, true);
      if (status === 3)
        await this.billing.review(id, admin.id, false, 'Contoh: nominal transfer belum sesuai.');
      if (status === 4) await this.billing.cancel(parent.id, id);
      if (status === 5)
        await this.db
          .update(s.orders)
          .set({
            expiresAt: new Date(Date.now() - 86_400_000),
          })
          .where(eq(s.orders.id, id));
    }

    for (let index = 0; index < childRows.length; index += 8) {
      const child = childRows[index]!;
      if (
        !(
          await this.db
            .select({ id: s.premiumGrants.id })
            .from(s.premiumGrants)
            .where(
              and(
                eq(s.premiumGrants.childId, child.id),
                eq(s.premiumGrants.note, 'Data demo lokal'),
              ),
            )
        ).length
      )
        await this.db
          .insert(s.premiumGrants)
          .values({ childId: child.id, note: 'Data demo lokal', grantedBy: admin.name });
    }

    const [book] = await this.db
      .select()
      .from(s.books)
      .where(eq(s.books.slug, 'matematika-kelas-1'));
    const bookLevels = await this.db
      .select({ id: s.levels.id })
      .from(s.levels)
      .innerJoin(s.topics, eq(s.topics.id, s.levels.topicId))
      .where(eq(s.topics.bookSlug, book!.slug));
    for (const child of childRows.slice(0, 3)) {
      const [existing] = await this.db
        .select({ id: s.certificates.id })
        .from(s.certificates)
        .where(and(eq(s.certificates.childId, child.id), eq(s.certificates.bookSlug, book!.slug)));
      if (existing) continue;
      for (const level of bookLevels) {
        await this.db
          .insert(s.levelProgress)
          .values({
            childId: child.id,
            levelId: level.id,
            bestScore: 80,
            passed: true,
            attempts: 1,
            firstPassedAt: new Date(),
          })
          .onConflictDoNothing();
      }
      await this.learning.issue(child.id, book!.slug, 'admin');
    }

    const [cash] = await this.db
      .select({ n: sql<number>`count(*)::int` })
      .from(s.cashEntries)
      .where(eq(s.cashEntries.note, 'Pengeluaran contoh demo'));
    for (let index = cash!.n; index < 6; index++)
      await this.db.insert(s.cashEntries).values({
        day: jakartaDate(new Date(Date.now() - index * 86_400_000)),
        kind: 'out',
        amount: 25_000 + index * 5_000,
        category: 'operasional',
        note: 'Pengeluaran contoh demo',
        createdBy: admin.id,
      });

    const [illustration] = await this.db
      .select({ n: sql<number>`count(*)::int` })
      .from(s.illustrations)
      .where(eq(s.illustrations.engine, 'Data demo lokal'));
    for (let index = illustration!.n; index < 12; index++)
      await this.db.insert(s.illustrations).values({
        kind: 'object',
        subject: ['apel', 'bintang', 'bola', 'ikan'][index % 4]!,
        theme: 'classroom',
        count: (index % 5) + 1,
        withMomo: index % 2 === 0,
        momoColor: 'blue',
        variant: 1,
        status: (['review', 'approved', 'rejected'] as const)[index % 3]!,
        engine: 'Data demo lokal',
        prompt: 'Ilustrasi contoh untuk presentasi.',
        createdBy: admin.name,
        reviewedAt: index % 3 === 0 ? null : new Date(),
      });
    await this.db
      .update(s.illustrations)
      .set({ kind: 'object', theme: 'classroom' })
      .where(eq(s.illustrations.engine, 'Data demo lokal'));

    const counts = await Promise.all(
      [
        s.parents,
        s.children,
        s.staffUsers,
        s.quizResults,
        s.orders,
        s.certificates,
        s.illustrations,
      ].map(
        async (table) =>
          (await this.db.select({ n: sql<number>`count(*)::int` }).from(table))[0]!.n,
      ),
    );
    return {
      families: counts[0],
      children: counts[1],
      admins: counts[2],
      rounds: counts[3],
      orders: counts[4],
      certificates: counts[5],
      illustrations: counts[6],
      newRounds,
      familyAccess,
    };
  }
}
