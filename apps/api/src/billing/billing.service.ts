import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { and, desc, eq, gt, inArray, or, sql, getTableColumns } from 'drizzle-orm';
import {
  createOrderBodySchema,
  effectiveStatus,
  extendPremium,
  FOREVER_ISO,
  needsAction,
  orderAmounts,
  orderNumber,
  packageInputSchema,
  paymentMethodInputSchema,
  uniqueCodeFor,
  UNIQUE_CODE_MAX,
  uploadProofBodySchema,
  type OrderStatus,
  DEFAULT_AFFILIATE_SETTINGS,
  affiliateSettingsSchema,
  commissionFor,
} from '@udakids/engine';
import { DB, type Db, type Executor } from '../db/db.module.js';
import * as s from '../db/schema.js';
import { SettingsService } from '../settings/settings.service.js';
import { iso, jakartaDate } from '../common/dates.js';
import { fail, missing } from '../common/errors.js';
import { validateImage } from '../media/image.js';
import { MailService } from '../mail/mail.service.js';
import { template } from '../mail/templates.js';

type OrderRow = Omit<typeof s.orders.$inferSelect, 'proofData'> & { proofData?: Buffer | null };
const { proofData: _proofData, ...metadata } = getTableColumns(s.orders);
export const orderColumns = metadata;
export const pricing = (p: { listPrice: number; price: number }) => ({
  normal: p.listPrice,
  final: p.price,
  discount: Math.max(0, p.listPrice - p.price),
  discountActive: p.price < p.listPrice,
});
export const orderDto = (o: OrderRow) => {
  const { proofData: _data, ...safe } = o;
  const status = effectiveStatus(
    { status: o.status as OrderStatus, expiresAt: o.expiresAt.toISOString() },
    Date.now(),
  );
  return {
    ...safe,
    createdAt: o.createdAt.toISOString(),
    expiresAt: o.expiresAt.toISOString(),
    proofAt: iso(o.proofAt),
    paidAt: iso(o.paidAt),
    status,
    packageSnapshot: {
      name: o.packageName,
      scope: 'all' as const,
      books: [],
      durationDays: o.durationDays,
    },
    methodSnapshot: {
      kind: o.methodKind,
      provider: o.methodName,
      accountNumber: o.methodNumber,
      accountName: o.methodHolder,
      instructions: '',
    },
    priceNormal: o.listPrice,
    amount: o.total,
    note: o.rejectNote,
    reviewedAt: iso(o.paidAt),
    proofDataUrl: null,
  };
};
@Injectable()
export class BillingService {
  constructor(
    @Inject(DB) private db: Db,
    private settings: SettingsService,
    private mail: MailService,
  ) {}
  async packages(admin = false) {
    const rows = await this.db
      .select()
      .from(s.billingPackages)
      .where(admin ? undefined : eq(s.billingPackages.active, true))
      .orderBy(s.billingPackages.sort)
      .limit(100);
    const sold = await this.db
      .select({ id: s.orders.packageId, count: sql<number>`count(*)::int` })
      .from(s.orders)
      .where(eq(s.orders.status, 'paid'))
      .groupBy(s.orders.packageId);
    return rows.map((p) => ({
      ...p,
      pricing: pricing(p),
      scope: 'all',
      books: [],
      discountEndsAt: null,
      sold: sold.find((r) => r.id === p.id)?.count ?? 0,
    }));
  }
  async methods(admin = false) {
    return (
      await this.db
        .select()
        .from(s.paymentMethods)
        .where(admin ? undefined : eq(s.paymentMethods.active, true))
        .orderBy(s.paymentMethods.sort)
        .limit(100)
    ).map((m) => ({ ...m, provider: m.name, accountNumber: m.number, accountName: m.holder }));
  }
  async row(id: string, parentId?: string, tx: Executor = this.db) {
    const [row] = await tx
      .select()
      .from(s.orders)
      .where(and(eq(s.orders.id, id), parentId ? eq(s.orders.parentId, parentId) : undefined));
    if (!row) missing();
    return row;
  }
  async list(parentId?: string, status?: string) {
    const rows = await this.db
      .select({ order: orderColumns, name: s.parents.name, email: s.parents.email })
      .from(s.orders)
      .innerJoin(s.parents, eq(s.parents.id, s.orders.parentId))
      .where(parentId ? eq(s.orders.parentId, parentId) : undefined)
      .orderBy(desc(s.orders.createdAt))
      .limit(500);
    return rows
      .map((r) => ({ ...orderDto(r.order), parentName: r.name, parentEmail: r.email }))
      .filter((o) => !status || o.status === status);
  }
  async create(parentId: string, input: unknown) {
    const body = createOrderBodySchema.parse(input);
    const settings = await this.settings.get();
    return this.db.transaction(async (tx) => {
      // Kode transfer harus unik terhadap total seluruh pesanan terbuka, termasuk antar paket.
      await tx.execute(sql`select pg_advisory_xact_lock(7177002)`);
      const [parent] = await tx
        .select()
        .from(s.parents)
        .where(eq(s.parents.id, parentId))
        .for('update');
      if (!parent) missing();
      const open = await tx
        .select({ total: s.orders.total, parentId: s.orders.parentId, status: s.orders.status })
        .from(s.orders)
        .where(
          or(
            and(eq(s.orders.status, 'awaiting_payment'), gt(s.orders.expiresAt, new Date())),
            inArray(s.orders.status, ['awaiting_review', 'rejected']),
          ),
        );
      if (
        open.filter((o) => o.parentId === parentId && o.status === 'awaiting_payment').length >= 3
      )
        fail(409, 'CONFLICT', 'Paling banyak tiga pesanan menunggu pembayaran.');
      const [pkg] = await tx
        .select()
        .from(s.billingPackages)
        .where(and(eq(s.billingPackages.id, body.packageId), eq(s.billingPackages.active, true)));
      const [method] = await tx
        .select()
        .from(s.paymentMethods)
        .where(and(eq(s.paymentMethods.id, body.methodId), eq(s.paymentMethods.active, true)));
      if (!pkg || !method) missing();
      const id = randomUUID();
      const initial = uniqueCodeFor(id);
      let code: number | null = null;
      const reserved = new Set(open.map((o) => o.total));
      for (let i = 0; i < UNIQUE_CODE_MAX; i++) {
        const candidate = ((initial - 1 + i) % UNIQUE_CODE_MAX) + 1;
        if (!reserved.has(pkg.price + candidate)) {
          code = candidate;
          break;
        }
      }
      if (code === null) fail(409, 'CONFLICT', 'Pesanan sedang ramai. Coba lagi nanti.');
      const [row] = await tx
        .insert(s.orders)
        .values({
          id,
          number: orderNumber(Date.now(), id),
          parentId,
          packageId: pkg.id,
          packageName: pkg.name,
          durationDays: pkg.durationDays,
          ...orderAmounts(pkg.listPrice, pkg.price, code),
          methodId: method.id,
          methodKind: method.kind,
          methodName: method.name,
          methodNumber: method.number,
          methodHolder: method.holder,
          expiresAt: new Date(Date.now() + settings.billing.orderExpiryHours * 3_600_000),
        })
        .returning();
      await this.mail.notify(
        parent.email,
        template(
          'Pesanan diterima',
          `${row!.number}\nTotal transfer: Rp${row!.total}\n${method.name} ${method.number}, atas nama ${method.holder}\nBatas pembayaran: ${row!.expiresAt.toISOString()}`,
        ),
        'order_received',
        id,
        tx,
      );
      return orderDto(row!);
    });
  }
  async upload(parentId: string, id: string, raw: unknown, mime?: string, json = false) {
    let image: ReturnType<typeof validateImage>;
    let fileName = 'bukti-transfer';
    if (json) {
      const body = uploadProofBodySchema.parse(raw);
      fileName = body.fileName;
      const prefix = `data:${body.mime};base64,`;
      if (!body.dataUrl.startsWith(prefix)) fail(400, 'VALIDATION', 'Format gambar belum tepat.');
      const data = Buffer.from(body.dataUrl.slice(prefix.length), 'base64');
      if (data.length !== body.size) fail(400, 'VALIDATION', 'Ukuran gambar belum sesuai.');
      image = validateImage(data, body.mime);
    } else image = validateImage(raw, mime);
    return this.db.transaction(async (tx) => {
      const [row] = await tx
        .select()
        .from(s.orders)
        .where(and(eq(s.orders.id, id), eq(s.orders.parentId, parentId)))
        .for('update');
      if (!row) missing();
      if (!needsAction(orderDto(row).status))
        fail(409, 'CONFLICT', 'Pesanan ini tidak menerima bukti baru.');
      const [saved] = await tx
        .update(s.orders)
        .set({
          proofData: image.data,
          proofMime: image.mime,
          proofName: fileName.replace(/[^\w. -]/g, '').slice(0, 100),
          proofAt: new Date(),
          status: 'awaiting_review',
          rejectNote: null,
        })
        .where(eq(s.orders.id, id))
        .returning();
      const [parent] = await tx.select().from(s.parents).where(eq(s.parents.id, parentId));
      await this.mail.notify(
        parent!.email,
        template('Bukti transfer diterima', `Bukti ${row.number} menunggu pemeriksaan admin.`),
        'proof_received',
        id,
        tx,
      );
      return orderDto(saved!);
    });
  }
  async cancel(parentId: string, id: string) {
    const row = await this.row(id, parentId);
    if (!needsAction(orderDto(row).status))
      fail(409, 'CONFLICT', 'Pesanan ini tidak bisa dibatalkan.');
    const [saved] = await this.db
      .update(s.orders)
      .set({ status: 'cancelled' })
      .where(
        and(
          eq(s.orders.id, id),
          eq(s.orders.parentId, parentId),
          inArray(s.orders.status, ['awaiting_payment', 'rejected']),
        ),
      )
      .returning();
    if (!saved) fail(409, 'CONFLICT', 'Status pesanan sudah berubah.');
    return orderDto(saved);
  }
  async review(id: string, adminId: string, approve: boolean, reason = '') {
    return this.db.transaction(async (tx) => {
      const [row] = await tx.select().from(s.orders).where(eq(s.orders.id, id)).for('update');
      if (!row) missing();
      if (approve && row.status === 'paid') return orderDto(row);
      if (
        !inArrayStatuses(
          row.status,
          approve
            ? ['awaiting_payment', 'awaiting_review', 'rejected', 'expired']
            : ['awaiting_payment', 'awaiting_review'],
        )
      )
        fail(409, 'CONFLICT', 'Status pesanan tidak bisa diubah.');
      const [parent] = await tx
        .select()
        .from(s.parents)
        .where(eq(s.parents.id, row.parentId))
        .for('update');
      if (!parent) missing();
      const [saved] = await tx
        .update(s.orders)
        .set({
          status: approve ? 'paid' : 'rejected',
          paidAt: approve ? new Date() : null,
          reviewedBy: adminId,
          rejectNote: approve ? null : reason,
        })
        .where(eq(s.orders.id, id))
        .returning();
      if (approve) {
        const until = extendPremium(iso(parent.premiumUntil), row.durationDays, Date.now());
        await tx
          .update(s.parents)
          .set({ premiumUntil: new Date(until) })
          .where(eq(s.parents.id, parent.id));
        await tx
          .insert(s.cashEntries)
          .values({
            day: jakartaDate(),
            kind: 'in',
            amount: row.total,
            category: 'paket',
            note: row.number,
            orderId: id,
            createdBy: adminId,
          })
          .onConflictDoNothing();
        const storedAffiliate = await this.settings.value('affiliate', tx);
        const parsedAffiliate = affiliateSettingsSchema.safeParse(storedAffiliate);
        const legacyAffiliate = storedAffiliate as { enabled?: boolean; percent?: number } | null;
        const affiliate = parsedAffiliate.success
          ? parsedAffiliate.data
          : {
              ...DEFAULT_AFFILIATE_SETTINGS,
              enabled: legacyAffiliate?.enabled ?? true,
              commissionBp:
                typeof legacyAffiliate?.percent === 'number'
                  ? legacyAffiliate.percent * 100
                  : DEFAULT_AFFILIATE_SETTINGS.commissionBp,
            };
        const [referral] = await tx
          .select()
          .from(s.referrals)
          .where(eq(s.referrals.refereeId, parent.id));
        if (referral && affiliate.enabled) {
          const commission = commissionFor(row.price, affiliate.commissionBp);
          if (commission > 0)
            await tx
              .insert(s.affiliateLedger)
              .values({
                parentId: referral.referrerId,
                refereeId: parent.id,
                orderId: id,
                type: 'commission',
                amount: commission,
                state: affiliate.holdDays ? 'pending' : 'available',
                availableAt: new Date(Date.now() + affiliate.holdDays * 86_400_000),
                note: affiliate.holdDays ? `Tertahan ${affiliate.holdDays} hari` : null,
              })
              .onConflictDoNothing();
        }
        if (referral?.status === 'registered')
          await tx
            .update(s.referrals)
            .set({
              status: 'paid',
              orderId: id,
              paidAt: new Date(),
              commission: affiliate.enabled ? commissionFor(row.price, affiliate.commissionBp) : 0,
            })
            .where(eq(s.referrals.id, referral.id));
      }
      await this.mail.notify(
        parent.email,
        template(
          approve ? 'Paket sudah aktif' : 'Bukti perlu diperiksa kembali',
          `${row.number}\n${approve ? 'Premium keluarga sudah aktif. Selamat belajar bersama Momo.' : reason}`,
        ),
        approve ? 'order_approved' : 'order_rejected',
        id,
        tx,
      );
      return orderDto(saved!);
    });
  }
  async overview(parentId: string) {
    const [parent] = await this.db.select().from(s.parents).where(eq(s.parents.id, parentId));
    if (!parent) missing();
    const until =
      parent.premiumUntil && parent.premiumUntil > new Date() ? parent.premiumUntil : null;
    const end = until?.toISOString() === FOREVER_ISO ? null : iso(until);
    return {
      packages: await this.packages(),
      methods: await this.methods(),
      entitlements: until
        ? [
            {
              id: `ent-${parentId}`,
              name: 'Premium',
              scope: 'all',
              books: [],
              startsAt: parent.createdAt.toISOString(),
              endsAt: end,
            },
          ]
        : [],
      access: { tier: until ? 'premium' : 'free', endsAt: end },
      settings: (await this.settings.get()).billing,
    };
  }
  async savePackage(id: string | null, input: unknown) {
    const current = id
      ? (await this.db.select().from(s.billingPackages).where(eq(s.billingPackages.id, id)))[0]
      : null;
    if (id && !current) missing();
    const body = packageInputSchema.parse({
      ...current,
      ...(typeof input === 'object' && input ? input : {}),
    });
    const key =
      id ??
      `${body.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')}-${randomUUID().slice(0, 6)}`;
    await this.db
      .insert(s.billingPackages)
      .values({ id: key, ...body })
      .onConflictDoUpdate({ target: s.billingPackages.id, set: body });
    return (await this.packages(true)).find((p) => p.id === key)!;
  }
  async deletePackage(id: string) {
    const used =
      (
        await this.db
          .select({ id: s.orders.id })
          .from(s.orders)
          .where(eq(s.orders.packageId, id))
          .limit(1)
      ).length > 0;
    if (used)
      await this.db
        .update(s.billingPackages)
        .set({ active: false })
        .where(eq(s.billingPackages.id, id));
    else if (
      !(await this.db.delete(s.billingPackages).where(eq(s.billingPackages.id, id)).returning())
        .length
    )
      missing();
    return { deleted: !used, deactivated: used };
  }
  async saveMethod(id: string | null, input: unknown) {
    const current = id
      ? (await this.db.select().from(s.paymentMethods).where(eq(s.paymentMethods.id, id)))[0]
      : null;
    if (id && !current) missing();
    const body = paymentMethodInputSchema.parse({
      ...current,
      ...(typeof input === 'object' && input ? input : {}),
    });
    const key = id ?? randomUUID();
    await this.db
      .insert(s.paymentMethods)
      .values({ id: key, ...body })
      .onConflictDoUpdate({ target: s.paymentMethods.id, set: body });
    return (await this.methods(true)).find((m) => m.id === key)!;
  }
}
const inArrayStatuses = (status: string, values: string[]) => values.includes(status);
