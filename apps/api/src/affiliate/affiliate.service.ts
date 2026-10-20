import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  randomInt,
} from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, inArray, isNull, sql } from 'drizzle-orm';
import {
  DEFAULT_AFFILIATE_SETTINGS,
  affiliateSettingsSchema,
  isReferralCode,
  maskAffiliateName,
  payoutAccountInputSchema,
  payoutBlock,
  payoutNameMatches,
  REFERRAL_ALPHABET,
  type AffiliateSettings,
} from '@udakids/engine';
import { DB, type Db } from '../db/db.module.js';
import * as s from '../db/schema.js';
import { fail, missing } from '../common/errors.js';
import { jwtSecret } from '../common/config.js';
import { hashSecret, randomCode, verifySecret } from '../common/crypto.js';
import { RateLimiter } from '../common/rate-limit.js';
import { SettingsService } from '../settings/settings.service.js';
import { MailService } from '../mail/mail.service.js';
import { template } from '../mail/templates.js';

const key = () => createHash('sha256').update(jwtSecret()).digest();
const accountHash = (number: string) => createHmac('sha256', key()).update(number).digest('hex');
const seal = (value: string) => {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(), iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString('base64url');
};
const open = (value: string) => {
  const data = Buffer.from(value, 'base64url');
  const decipher = createDecipheriv('aes-256-gcm', key(), data.subarray(0, 12));
  decipher.setAuthTag(data.subarray(12, 28));
  return Buffer.concat([decipher.update(data.subarray(28)), decipher.final()]).toString('utf8');
};
const sum = (value: unknown) => Number(value ?? 0);

@Injectable()
export class AffiliateService {
  private clickLimit = new RateLimiter(30, 60_000);
  private codeLimit = new RateLimiter(5, 15 * 60_000);
  constructor(
    @Inject(DB) private db: Db,
    private settings: SettingsService,
    private mail: MailService,
  ) {}

  async rules(): Promise<AffiliateSettings> {
    const stored = await this.settings.value('affiliate');
    const parsed = affiliateSettingsSchema.safeParse(stored);
    if (parsed.success) return parsed.data;
    const legacy = stored as { enabled?: boolean; percent?: number } | null;
    return {
      ...DEFAULT_AFFILIATE_SETTINGS,
      enabled: legacy?.enabled ?? true,
      commissionBp:
        typeof legacy?.percent === 'number'
          ? legacy.percent * 100
          : DEFAULT_AFFILIATE_SETTINGS.commissionBp,
    };
  }

  async ensureCode(parentId: string): Promise<string> {
    const [parent] = await this.db
      .select({ code: s.parents.referralCode })
      .from(s.parents)
      .where(eq(s.parents.id, parentId));
    if (!parent) missing();
    if (parent.code) return parent.code;
    for (let attempt = 0; attempt < 20; attempt++) {
      const code = randomCode(6, REFERRAL_ALPHABET);
      const [exists] = await this.db
        .select({ id: s.parents.id, email: s.parents.email })
        .from(s.parents)
        .where(eq(s.parents.referralCode, code));
      if (exists) continue;
      const [saved] = await this.db
        .update(s.parents)
        .set({ referralCode: code })
        .where(and(eq(s.parents.id, parentId), isNull(s.parents.referralCode)))
        .returning({ code: s.parents.referralCode });
      if (saved?.code) return saved.code;
      const [current] = await this.db
        .select({ code: s.parents.referralCode })
        .from(s.parents)
        .where(eq(s.parents.id, parentId));
      if (current?.code) return current.code;
    }
    fail(409, 'CONFLICT', 'Kode afiliasi belum bisa dibuat. Coba lagi.');
  }

  async seedDemoPayouts(parents: { id: string; name: string }[], adminId: string) {
    const accountNames = [
      'Bank Central Asia',
      'Bank Mandiri',
      'Bank Negara Indonesia',
      'Bank Rakyat Indonesia',
      'Bank Syariah Indonesia',
      'Bank Central Asia',
      'Bank Mandiri',
      'DANA',
      'Bank Negara Indonesia',
      'Bank Rakyat Indonesia',
      'Bank Central Asia',
      'GoPay',
    ];
    const accountIds = [
      'bca',
      'mandiri',
      'bni',
      'bri',
      'bsi',
      'bca',
      'mandiri',
      'dana',
      'bni',
      'bri',
      'bca',
      'gopay',
    ];
    const accountStatuses = [
      'verified',
      'verified',
      'verified',
      'verified',
      'verified',
      'verified',
      'verified',
      'verified',
      'pending',
      'pending',
      'rejected',
      'rejected',
    ] as const;
    const accountNotes = [
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      'Menunggu pemeriksaan data rekening.',
      'Menunggu pemeriksaan data rekening.',
      'Nama pemilik rekening perlu diperbaiki.',
      'Data rekening belum sesuai.',
    ];

    for (const [index, parent] of parents.slice(0, 12).entries()) {
      const number = String(880_000_000_000 + index * 1_234_567);
      const status = accountStatuses[index]!;
      await this.db
        .insert(s.affiliateAccounts)
        .values({
          parentId: parent.id,
          providerId: accountIds[index]!,
          providerName: accountNames[index]!,
          kind: index === 7 || index === 11 ? 'ewallet' : 'bank',
          accountEncrypted: seal(number),
          accountHash: accountHash(number),
          accountLast4: number.slice(-4),
          holderName: parent.name,
          status,
          reviewNote: accountNotes[index] ?? null,
          changedAt: new Date(Date.now() - 14 * 86_400_000),
        })
        .onConflictDoNothing();
    }

    const samples = [
      {
        parentIndex: 0,
        amount: 15_000,
        status: 'requested' as const,
        note: 'Menunggu pemeriksaan admin.',
      },
      {
        parentIndex: 1,
        amount: 20_000,
        status: 'paid' as const,
        note: 'Pencairan telah diproses.',
      },
      {
        parentIndex: 2,
        amount: 15_000,
        status: 'rejected' as const,
        note: 'Contoh penolakan; saldo dikembalikan.',
      },
      {
        parentIndex: 3,
        amount: 15_000,
        status: 'cancelled' as const,
        note: 'Contoh pembatalan; saldo dikembalikan.',
      },
      {
        parentIndex: 4,
        amount: 25_000,
        status: 'requested' as const,
        note: 'Menunggu pemeriksaan admin.',
      },
    ];

    for (const [sampleIndex, sample] of samples.entries()) {
      const parent = parents[sample.parentIndex]!;
      await this.db.transaction(async (tx) => {
        const [existing] = await tx
          .select({ id: s.affiliatePayoutRequests.id })
          .from(s.affiliatePayoutRequests)
          .where(eq(s.affiliatePayoutRequests.parentId, parent.id));
        if (existing) return;

        const [account] = await tx
          .select()
          .from(s.affiliateAccounts)
          .where(eq(s.affiliateAccounts.parentId, parent.id));
        if (!account || account.status !== 'verified') return;

        const [balance] = await tx
          .select({ amount: sql<number>`coalesce(sum(${s.affiliateLedger.amount}), 0)::int` })
          .from(s.affiliateLedger)
          .where(
            and(
              eq(s.affiliateLedger.parentId, parent.id),
              eq(s.affiliateLedger.state, 'available'),
            ),
          );
        const shortfall = sample.amount - Number(balance?.amount ?? 0);
        if (shortfall > 0)
          await tx.insert(s.affiliateLedger).values({
            parentId: parent.id,
            type: 'adjustment',
            state: 'available',
            amount: shortfall,
            note: 'Saldo contoh untuk simulasi pencairan.',
          });

        const requestedAt = new Date(Date.now() - (samples.length - sampleIndex) * 86_400_000);
        const [payout] = await tx
          .insert(s.affiliatePayoutRequests)
          .values({
            parentId: parent.id,
            amount: sample.amount,
            providerName: account.providerName,
            accountLast4: account.accountLast4,
            accountEncrypted: account.accountEncrypted,
            holderName: account.holderName,
            status: sample.status,
            note: sample.note,
            transferRef: sample.status === 'paid' ? 'TRF-2026-00128' : null,
            reviewedBy: sample.status === 'requested' ? null : adminId,
            requestedAt,
            reviewedAt: sample.status === 'requested' ? null : requestedAt,
          })
          .returning({ id: s.affiliatePayoutRequests.id });
        await tx.insert(s.affiliateLedger).values({
          parentId: parent.id,
          type: 'payout',
          state: 'available',
          amount: -sample.amount,
          payoutId: payout!.id,
          note: 'Pengajuan pencairan',
          createdAt: requestedAt,
        });
        if (sample.status === 'rejected' || sample.status === 'cancelled')
          await tx.insert(s.affiliateLedger).values({
            parentId: parent.id,
            type: 'payout_return',
            state: 'available',
            amount: sample.amount,
            payoutId: payout!.id,
            note: sample.note,
            createdAt: requestedAt,
          });
        if (sample.status === 'paid')
          await tx.insert(s.commissionPayouts).values({
            parentId: parent.id,
            amount: sample.amount,
            note: 'Pencairan komisi',
            createdBy: adminId,
            createdAt: requestedAt,
          });
      });
    }
  }

  async preview(raw: string) {
    const code = raw.trim().toUpperCase();
    if (!isReferralCode(code)) return { valid: false };
    const [parent] = await this.db
      .select({ name: s.parents.name })
      .from(s.parents)
      .where(and(eq(s.parents.referralCode, code), eq(s.parents.active, true)));
    return parent ? { valid: true, name: maskAffiliateName(parent.name) } : { valid: false };
  }

  async click(raw: string, ip: string) {
    const code = raw.trim().toUpperCase();
    if (!isReferralCode(code)) missing();
    this.clickLimit.take(`${ip}:${code}`);
    const [parent] = await this.db
      .select({ id: s.parents.id })
      .from(s.parents)
      .where(and(eq(s.parents.referralCode, code), eq(s.parents.active, true)));
    if (!parent) missing();
    // Satu pengunjung dihitung paling banyak sekali per kode per hari; fingerprint tidak disimpan.
    const day = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Jakarta',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
    const fingerprint = createHmac('sha256', key()).update(`${ip}:${code}:${day}`).digest('hex');
    if (this.seenClicks.has(fingerprint)) return;
    this.seenClicks.set(fingerprint, Date.now());
    if (this.seenClicks.size > 5000) {
      for (const [id, at] of this.seenClicks)
        if (Date.now() - at > 86_400_000) this.seenClicks.delete(id);
    }
    await this.db
      .insert(s.affiliateClickDays)
      .values({ parentId: parent.id, day, clicks: 1 })
      .onConflictDoUpdate({
        target: [s.affiliateClickDays.parentId, s.affiliateClickDays.day],
        set: { clicks: sql`${s.affiliateClickDays.clicks} + 1` },
      });
  }
  private seenClicks = new Map<string, number>();

  async release(parentId?: string) {
    const rules = await this.rules();
    const mine = parentId ? sql`and l.parent_id = ${parentId}` : sql``;
    await this.db.execute(sql`update affiliate_ledger l set state='available', note=null
      where l.type='commission' and l.state='pending' and l.available_at <= now() ${mine}`);
    await this.db.execute(sql`update affiliate_ledger l set state='available', note=null
      from parents p where l.type='signup_bonus' and l.state='pending' and l.referee_id=p.id
      and p.email_verified_at is not null and p.active ${mine}
      and (select count(*) from quiz_results q join children c on c.id=q.child_id
        where c.parent_id=p.id and q.finished_at >= p.created_at and q.finished_at <= l.available_at) >= ${rules.qualifyRounds}`);
    await this.db
      .execute(sql`update affiliate_ledger l set state='void', note='Masa bonus ajakan berakhir'
      where l.type='signup_bonus' and l.state='pending' and l.available_at <= now() ${mine}`);
  }

  async balance(parentId: string) {
    const [row] = await this.db
      .select({
        available: sql<number>`coalesce(sum(${s.affiliateLedger.amount}) filter(where ${s.affiliateLedger.state}='available'),0)::int`,
        pending: sql<number>`coalesce(sum(${s.affiliateLedger.amount}) filter(where ${s.affiliateLedger.state}='pending'),0)::int`,
        earned: sql<number>`coalesce(sum(${s.affiliateLedger.amount}) filter(where ${s.affiliateLedger.type} in ('signup_bonus','commission') and ${s.affiliateLedger.state}<>'void'),0)::int`,
      })
      .from(s.affiliateLedger)
      .where(eq(s.affiliateLedger.parentId, parentId));
    const [paid] = await this.db
      .select({ n: sql<number>`coalesce(sum(${s.commissionPayouts.amount}),0)::int` })
      .from(s.commissionPayouts)
      .where(eq(s.commissionPayouts.parentId, parentId));
    return {
      available: sum(row?.available),
      pending: sum(row?.pending),
      earned: sum(row?.earned),
      paid: sum(paid?.n),
    };
  }

  async account(parentId: string) {
    const [row] = await this.db
      .select()
      .from(s.affiliateAccounts)
      .where(eq(s.affiliateAccounts.parentId, parentId));
    return row
      ? {
          providerId: row.providerId,
          providerName: row.providerName,
          kind: row.kind,
          last4: row.accountLast4,
          holderName: row.holderName,
          status: row.status,
          reviewNote: row.reviewNote,
          changedAt: row.changedAt,
        }
      : null;
  }

  async overview(parentId: string, origin: string) {
    await this.release(parentId);
    const code = await this.ensureCode(parentId);
    const [rules, balance, account, members, clicks, payouts] = await Promise.all([
      this.rules(),
      this.balance(parentId),
      this.account(parentId),
      this.members(parentId),
      this.db
        .select({ n: sql<number>`coalesce(sum(${s.affiliateClickDays.clicks}),0)::int` })
        .from(s.affiliateClickDays)
        .where(eq(s.affiliateClickDays.parentId, parentId)),
      this.payouts(parentId),
    ]);
    return {
      enabled: rules.enabled,
      code,
      link: `${origin.replace(/\/$/, '')}/r/${code}`,
      rules,
      providers: rules.providers,
      balance,
      counts: {
        clicks: sum(clicks[0]?.n),
        signups: members.total,
        verified: members.items.filter((m) => m.verified).length,
        active: members.items.filter((m) => m.active).length,
        subscribers: members.items.filter((m) => m.paidOrders > 0).length,
      },
      account,
      openPayout: payouts.find((p) => p.status === 'requested') ?? null,
      recent: (await this.ledger(parentId)).items.slice(0, 8),
    };
  }

  async members(parentId: string) {
    const rules = await this.rules();
    const rows = await this.db
      .select({
        referral: s.referrals,
        name: s.parents.name,
        verifiedAt: s.parents.emailVerifiedAt,
        createdAt: s.parents.createdAt,
      })
      .from(s.referrals)
      .innerJoin(s.parents, eq(s.parents.id, s.referrals.refereeId))
      .where(eq(s.referrals.referrerId, parentId))
      .orderBy(desc(s.referrals.createdAt))
      .limit(500);
    const items = await Promise.all(
      rows.map(async ({ referral, name, verifiedAt, createdAt }) => {
        const [rounds] = await this.db
          .select({ n: sql<number>`count(*)::int` })
          .from(s.quizResults)
          .innerJoin(s.children, eq(s.children.id, s.quizResults.childId))
          .where(
            and(
              eq(s.children.parentId, referral.refereeId),
              sql`${s.quizResults.finishedAt} >= ${createdAt}`,
              sql`${s.quizResults.finishedAt} <= ${new Date(createdAt.getTime() + rules.qualifyDays * 86_400_000)}`,
            ),
          );
        const [orders] = await this.db
          .select({ n: sql<number>`count(*)::int` })
          .from(s.orders)
          .where(and(eq(s.orders.parentId, referral.refereeId), eq(s.orders.status, 'paid')));
        return {
          name: maskAffiliateName(name),
          joinedAt: createdAt,
          verified: !!verifiedAt,
          active: !!verifiedAt && sum(rounds?.n) >= rules.qualifyRounds,
          paidOrders: sum(orders?.n),
          rounds: sum(rounds?.n),
          earned: referral.commission,
          status: referral.status,
        };
      }),
    );
    return { total: items.length, items };
  }

  async analytics(parentId: string) {
    const clicks = await this.db
      .select()
      .from(s.affiliateClickDays)
      .where(eq(s.affiliateClickDays.parentId, parentId))
      .orderBy(s.affiliateClickDays.day);
    const ledger = await this.db
      .select({
        amount: s.affiliateLedger.amount,
        type: s.affiliateLedger.type,
        state: s.affiliateLedger.state,
        createdAt: s.affiliateLedger.createdAt,
      })
      .from(s.affiliateLedger)
      .where(eq(s.affiliateLedger.parentId, parentId));
    return {
      clicks,
      earnings: ledger.filter(
        (v) => v.state !== 'void' && (v.type === 'commission' || v.type === 'signup_bonus'),
      ),
    };
  }

  async ledger(parentId: string) {
    const items = await this.db
      .select({
        id: s.affiliateLedger.id,
        type: s.affiliateLedger.type,
        state: s.affiliateLedger.state,
        amount: s.affiliateLedger.amount,
        availableAt: s.affiliateLedger.availableAt,
        note: s.affiliateLedger.note,
        createdAt: s.affiliateLedger.createdAt,
      })
      .from(s.affiliateLedger)
      .where(eq(s.affiliateLedger.parentId, parentId))
      .orderBy(desc(s.affiliateLedger.createdAt))
      .limit(200);
    return { total: items.length, items };
  }

  async requestAccountCode(parentId: string) {
    this.codeLimit.take(parentId);
    const [parent] = await this.db
      .select({ email: s.parents.email })
      .from(s.parents)
      .where(eq(s.parents.id, parentId));
    if (!parent) missing();
    const code = String(randomInt(100_000, 1_000_000));
    await this.db.insert(s.affiliateActionCodes).values({
      parentId,
      codeHash: await hashSecret(code),
      expiresAt: new Date(Date.now() + 15 * 60_000),
    });
    await this.mail.enqueue(
      parent.email,
      template(
        'Kode verifikasi rekening afiliasi',
        `Kode Anda: ${code}. Berlaku 15 menit. Jangan bagikan kode ini.`,
      ),
      'affiliate_account_code',
      parentId,
    );
    return { sent: true };
  }

  async saveAccount(parentId: string, input: unknown) {
    const body = payoutAccountInputSchema.parse(input);
    const rules = await this.rules();
    const provider = rules.providers.find((v) => v.id === body.providerId);
    if (!provider) fail(400, 'VALIDATION', 'Bank atau e-wallet tidak tersedia.');
    const [openPayout] = await this.db
      .select({ id: s.affiliatePayoutRequests.id })
      .from(s.affiliatePayoutRequests)
      .where(
        and(
          eq(s.affiliatePayoutRequests.parentId, parentId),
          eq(s.affiliatePayoutRequests.status, 'requested'),
        ),
      );
    if (openPayout) fail(409, 'CONFLICT', 'Rekening tidak bisa diubah selama pencairan diproses.');
    const [code] = await this.db
      .select()
      .from(s.affiliateActionCodes)
      .where(
        and(
          eq(s.affiliateActionCodes.parentId, parentId),
          sql`${s.affiliateActionCodes.consumedAt} is null`,
        ),
      )
      .orderBy(desc(s.affiliateActionCodes.createdAt))
      .limit(1);
    if (
      !code ||
      code.expiresAt < new Date() ||
      code.attempts >= 5 ||
      !(await verifySecret(body.code, code.codeHash))
    ) {
      if (code)
        await this.db
          .update(s.affiliateActionCodes)
          .set({ attempts: code.attempts + 1 })
          .where(eq(s.affiliateActionCodes.id, code.id));
      fail(400, 'VALIDATION', 'Kode verifikasi salah atau kedaluwarsa.');
    }
    await this.db
      .update(s.affiliateActionCodes)
      .set({ consumedAt: new Date() })
      .where(eq(s.affiliateActionCodes.id, code.id));
    const [parent] = await this.db
      .select({ name: s.parents.name })
      .from(s.parents)
      .where(eq(s.parents.id, parentId));
    if (!parent) missing();
    const hash = accountHash(body.accountNumber);
    const [shared] = await this.db
      .select({ parentId: s.affiliateAccounts.parentId })
      .from(s.affiliateAccounts)
      .where(
        and(
          eq(s.affiliateAccounts.accountHash, hash),
          sql`${s.affiliateAccounts.parentId} <> ${parentId}`,
        ),
      );
    const matching = payoutNameMatches(parent.name, body.holderName);
    const values = {
      providerId: provider.id,
      providerName: provider.name,
      kind: provider.kind,
      accountEncrypted: seal(body.accountNumber),
      accountHash: hash,
      accountLast4: body.accountNumber.slice(-4),
      holderName: body.holderName,
      status: matching && !shared ? ('verified' as const) : ('pending' as const),
      reviewNote: shared ? 'Rekening dipakai akun lain' : matching ? null : 'Nama rekening berbeda',
      changedAt: new Date(),
    };
    await this.db
      .insert(s.affiliateAccounts)
      .values({ parentId, ...values })
      .onConflictDoUpdate({ target: s.affiliateAccounts.parentId, set: values });
    return this.account(parentId);
  }

  payouts(parentId: string) {
    return this.db
      .select({
        id: s.affiliatePayoutRequests.id,
        amount: s.affiliatePayoutRequests.amount,
        providerName: s.affiliatePayoutRequests.providerName,
        last4: s.affiliatePayoutRequests.accountLast4,
        status: s.affiliatePayoutRequests.status,
        note: s.affiliatePayoutRequests.note,
        transferRef: s.affiliatePayoutRequests.transferRef,
        requestedAt: s.affiliatePayoutRequests.requestedAt,
      })
      .from(s.affiliatePayoutRequests)
      .where(eq(s.affiliatePayoutRequests.parentId, parentId))
      .orderBy(desc(s.affiliatePayoutRequests.requestedAt))
      .limit(100);
  }

  async requestPayout(parentId: string, amount: number) {
    await this.release(parentId);
    const rules = await this.rules();
    return this.db.transaction(async (tx) => {
      const [parent] = await tx
        .select({ id: s.parents.id, email: s.parents.email })
        .from(s.parents)
        .where(eq(s.parents.id, parentId))
        .for('update');
      if (!parent) missing();
      const [acc] = await tx
        .select()
        .from(s.affiliateAccounts)
        .where(eq(s.affiliateAccounts.parentId, parentId));
      const [openPayout] = await tx
        .select({ id: s.affiliatePayoutRequests.id })
        .from(s.affiliatePayoutRequests)
        .where(
          and(
            eq(s.affiliatePayoutRequests.parentId, parentId),
            eq(s.affiliatePayoutRequests.status, 'requested'),
          ),
        );
      const [balance] = await tx
        .select({ n: sql<number>`coalesce(sum(${s.affiliateLedger.amount}),0)::int` })
        .from(s.affiliateLedger)
        .where(
          and(eq(s.affiliateLedger.parentId, parentId), eq(s.affiliateLedger.state, 'available')),
        );
      const blocked = payoutBlock({
        settings: rules,
        available: sum(balance?.n),
        amount,
        account: acc ? { verified: acc.status === 'verified', changedAt: acc.changedAt } : null,
        openRequest: !!openPayout,
        now: new Date(),
      });
      if (blocked) fail(400, 'VALIDATION', `Pencairan belum bisa diajukan: ${blocked}`);
      const [row] = await tx
        .insert(s.affiliatePayoutRequests)
        .values({
          parentId,
          amount,
          providerName: acc!.providerName,
          accountLast4: acc!.accountLast4,
          accountEncrypted: acc!.accountEncrypted,
          holderName: acc!.holderName,
        })
        .returning();
      await tx.insert(s.affiliateLedger).values({
        parentId,
        type: 'payout',
        state: 'available',
        amount: -amount,
        payoutId: row!.id,
        note: 'Pengajuan pencairan',
      });
      await this.mail.notify(
        parent.email,
        template(
          'Pengajuan pencairan afiliasi',
          `Pengajuan Rp${amount.toLocaleString('id-ID')} telah diterima dan menunggu pemeriksaan.`,
        ),
        'affiliate_payout_requested',
        row!.id,
        tx,
      );
      return { id: row!.id, amount, status: row!.status };
    });
  }

  async closePayout(
    id: string,
    status: 'paid' | 'rejected' | 'cancelled',
    actorId: string,
    note = '',
  ) {
    return this.db.transaction(async (tx) => {
      const [row] = await tx
        .select()
        .from(s.affiliatePayoutRequests)
        .where(eq(s.affiliatePayoutRequests.id, id))
        .for('update');
      if (!row) missing();
      if (status === 'cancelled' && actorId !== row.parentId) missing();
      if (row.status !== 'requested') fail(409, 'CONFLICT', 'Pengajuan sudah diproses.');
      await tx
        .update(s.affiliatePayoutRequests)
        .set({
          status,
          note,
          reviewedAt: new Date(),
          reviewedBy: status === 'cancelled' ? null : actorId,
        })
        .where(eq(s.affiliatePayoutRequests.id, id));
      if (status !== 'paid')
        await tx.insert(s.affiliateLedger).values({
          parentId: row.parentId,
          type: 'payout_return',
          state: 'available',
          amount: row.amount,
          payoutId: id,
          note: note || 'Saldo dikembalikan',
        });
      if (status === 'paid')
        await tx.insert(s.commissionPayouts).values({
          parentId: row.parentId,
          amount: row.amount,
          note: `Afiliasi ${id}`,
          createdBy: actorId,
        });
      if (status !== 'cancelled') {
        const [parent] = await tx
          .select({ email: s.parents.email })
          .from(s.parents)
          .where(eq(s.parents.id, row.parentId));
        if (parent)
          await this.mail.enqueue(
            parent.email,
            template(
              status === 'paid' ? 'Pencairan afiliasi selesai' : 'Pengajuan pencairan ditolak',
              status === 'paid'
                ? `Pencairan Rp${row.amount.toLocaleString('id-ID')} telah diproses. ${note}`
                : `Pengajuan Rp${row.amount.toLocaleString('id-ID')} ditolak dan saldo dikembalikan. ${note}`,
            ),
            `affiliate_payout_${status}`,
            id,
            tx,
          );
      }
      return { id, status };
    });
  }

  async adminOverview() {
    const [members] = await this.db
      .select({ n: sql<number>`count(*)::int` })
      .from(s.parents)
      .where(sql`${s.parents.referralCode} is not null`);
    const [payouts] = await this.db
      .select({ n: sql<number>`count(*)::int` })
      .from(s.affiliatePayoutRequests)
      .where(eq(s.affiliatePayoutRequests.status, 'requested'));
    const [accounts] = await this.db
      .select({ n: sql<number>`count(*)::int` })
      .from(s.affiliateAccounts)
      .where(eq(s.affiliateAccounts.status, 'pending'));
    const [earnings] = await this.db
      .select({ n: sql<number>`coalesce(sum(${s.affiliateLedger.amount}),0)::int` })
      .from(s.affiliateLedger)
      .where(
        and(
          sql`${s.affiliateLedger.type} in ('signup_bonus','commission')`,
          sql`${s.affiliateLedger.state} <> 'void'`,
        ),
      );
    return {
      affiliates: sum(members?.n),
      pendingPayouts: sum(payouts?.n),
      pendingAccounts: sum(accounts?.n),
      earned: sum(earnings?.n),
    };
  }

  async adminAffiliates() {
    const rows = await this.db
      .select({
        id: s.parents.id,
        name: s.parents.name,
        email: s.parents.email,
        code: s.parents.referralCode,
      })
      .from(s.parents)
      .limit(500);
    return Promise.all(
      rows.map(async (parent) => ({
        ...parent,
        members: (await this.members(parent.id)).total,
        balance: await this.balance(parent.id),
      })),
    );
  }

  async adminAffiliate(parentId: string) {
    const [parent] = await this.db
      .select({
        id: s.parents.id,
        name: s.parents.name,
        email: s.parents.email,
        code: s.parents.referralCode,
      })
      .from(s.parents)
      .where(eq(s.parents.id, parentId));
    if (!parent) missing();
    await this.release(parentId);
    const [balance, members, account, ledger] = await Promise.all([
      this.balance(parentId),
      this.members(parentId),
      this.account(parentId),
      this.ledger(parentId),
    ]);
    const [secondLevel] = await this.db
      .select({ n: sql<number>`count(*)::int` })
      .from(s.referrals)
      .where(
        sql`${s.referrals.referrerId} in (select referee_id from referrals where referrer_id = ${parentId})`,
      );
    return {
      ...parent,
      balance,
      members,
      secondLevel: sum(secondLevel?.n),
      account,
      ledger: ledger.items,
    };
  }

  async adjust(parentId: string, amount: number, note: string, adminId: string) {
    if (!Number.isInteger(amount) || amount === 0 || Math.abs(amount) > 10_000_000)
      fail(400, 'VALIDATION', 'Jumlah koreksi tidak valid.');
    return this.db.transaction(async (tx) => {
      const [parent] = await tx
        .select({ id: s.parents.id })
        .from(s.parents)
        .where(eq(s.parents.id, parentId))
        .for('update');
      if (!parent) missing();
      const [balance] = await tx
        .select({ n: sql<number>`coalesce(sum(${s.affiliateLedger.amount}),0)::int` })
        .from(s.affiliateLedger)
        .where(
          and(eq(s.affiliateLedger.parentId, parentId), eq(s.affiliateLedger.state, 'available')),
        );
      if (amount < 0 && sum(balance?.n) + amount < 0)
        fail(400, 'VALIDATION', 'Koreksi melebihi saldo tersedia.');
      const [row] = await tx
        .insert(s.affiliateLedger)
        .values({
          parentId,
          type: 'adjustment',
          state: 'available',
          amount,
          note: `${note} (admin ${adminId})`,
        })
        .returning();
      return row;
    });
  }

  async voidEntry(id: string, note: string, adminId: string) {
    const [row] = await this.db
      .update(s.affiliateLedger)
      .set({ state: 'void', note: `${note} (admin ${adminId})` })
      .where(
        and(
          eq(s.affiliateLedger.id, id),
          eq(s.affiliateLedger.state, 'pending'),
          inArray(s.affiliateLedger.type, ['signup_bonus', 'commission']),
        ),
      )
      .returning();
    if (!row) fail(409, 'CONFLICT', 'Hanya bonus atau komisi tertahan yang dapat dibatalkan.');
    return row;
  }

  async adminAnalytics() {
    const result = await this.db.execute(sql`
      select to_char(created_at at time zone 'Asia/Jakarta', 'YYYY-MM') as month,
        coalesce(sum(amount) filter (where type = 'signup_bonus' and state <> 'void'), 0)::int as bonus,
        coalesce(sum(amount) filter (where type = 'commission' and state <> 'void'), 0)::int as commission
      from affiliate_ledger where created_at >= now() - interval '12 months'
      group by 1 order by 1`);
    const [clicks] = await this.db
      .select({ n: sql<number>`coalesce(sum(${s.affiliateClickDays.clicks}),0)::int` })
      .from(s.affiliateClickDays);
    const [signups] = await this.db.select({ n: sql<number>`count(*)::int` }).from(s.referrals);
    const [verified] = await this.db
      .select({ n: sql<number>`count(*)::int` })
      .from(s.referrals)
      .innerJoin(s.parents, eq(s.parents.id, s.referrals.refereeId))
      .where(sql`${s.parents.emailVerifiedAt} is not null`);
    const [active] = await this.db
      .select({ n: sql<number>`count(*)::int` })
      .from(s.affiliateLedger)
      .where(
        and(eq(s.affiliateLedger.type, 'signup_bonus'), eq(s.affiliateLedger.state, 'available')),
      );
    const [subscribers] = await this.db
      .select({ n: sql<number>`count(distinct ${s.referrals.refereeId})::int` })
      .from(s.referrals)
      .innerJoin(s.orders, eq(s.orders.parentId, s.referrals.refereeId))
      .where(eq(s.orders.status, 'paid'));
    const [revenue] = await this.db
      .select({ n: sql<number>`coalesce(sum(${s.orders.price}),0)::int` })
      .from(s.orders)
      .innerJoin(s.referrals, eq(s.referrals.refereeId, s.orders.parentId))
      .where(eq(s.orders.status, 'paid'));
    return {
      months: (result as { rows: Record<string, unknown>[] }).rows.map((r) => ({
        month: String(r.month),
        bonus: sum(r.bonus),
        commission: sum(r.commission),
      })),
      funnel: {
        clicks: sum(clicks?.n),
        signups: sum(signups?.n),
        verified: sum(verified?.n),
        active: sum(active?.n),
        subscribers: sum(subscribers?.n),
      },
      referredRevenue: sum(revenue?.n),
    };
  }

  adminPayouts() {
    return this.db
      .select({
        request: {
          id: s.affiliatePayoutRequests.id,
          parentId: s.affiliatePayoutRequests.parentId,
          amount: s.affiliatePayoutRequests.amount,
          providerName: s.affiliatePayoutRequests.providerName,
          accountLast4: s.affiliatePayoutRequests.accountLast4,
          holderName: s.affiliatePayoutRequests.holderName,
          status: s.affiliatePayoutRequests.status,
          requestedAt: s.affiliatePayoutRequests.requestedAt,
          note: s.affiliatePayoutRequests.note,
        },
        name: s.parents.name,
      })
      .from(s.affiliatePayoutRequests)
      .innerJoin(s.parents, eq(s.parents.id, s.affiliatePayoutRequests.parentId))
      .orderBy(desc(s.affiliatePayoutRequests.requestedAt))
      .limit(200);
  }

  async payoutAccount(id: string) {
    const [row] = await this.db
      .select()
      .from(s.affiliatePayoutRequests)
      .where(eq(s.affiliatePayoutRequests.id, id));
    if (!row || row.status !== 'requested') missing();
    return {
      accountNumber: open(row.accountEncrypted),
      holderName: row.holderName,
      providerName: row.providerName,
    };
  }

  adminAccounts() {
    return this.db
      .select({
        account: {
          parentId: s.affiliateAccounts.parentId,
          providerName: s.affiliateAccounts.providerName,
          accountLast4: s.affiliateAccounts.accountLast4,
          holderName: s.affiliateAccounts.holderName,
          status: s.affiliateAccounts.status,
          reviewNote: s.affiliateAccounts.reviewNote,
        },
        name: s.parents.name,
      })
      .from(s.affiliateAccounts)
      .innerJoin(s.parents, eq(s.parents.id, s.affiliateAccounts.parentId))
      .limit(200);
  }

  async reviewAccount(parentId: string, approved: boolean, note: string) {
    return this.db.transaction(async (tx) => {
      const [row] = await tx
        .update(s.affiliateAccounts)
        .set({ status: approved ? 'verified' : 'rejected', reviewNote: note })
        .where(
          and(
            eq(s.affiliateAccounts.parentId, parentId),
            eq(s.affiliateAccounts.status, 'pending'),
          ),
        )
        .returning();
      if (!row) fail(409, 'CONFLICT', 'Rekening sudah diperiksa atau tidak ditemukan.');
      const [parent] = await tx
        .select({ email: s.parents.email })
        .from(s.parents)
        .where(eq(s.parents.id, parentId));
      if (parent)
        await this.mail.enqueue(
          parent.email,
          template(
            approved ? 'Rekening afiliasi disetujui' : 'Rekening afiliasi perlu diperbaiki',
            approved
              ? 'Rekening pencairan Anda sudah disetujui.'
              : `Rekening belum dapat disetujui. ${note}`,
          ),
          'affiliate_account_review',
          parentId,
          tx,
        );
      return { parentId, status: row.status };
    });
  }
}
