import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { eq } from 'drizzle-orm';
import { setup } from './e2e-setup.js';
import {
  affiliateAccounts,
  affiliateClickDays,
  affiliateLedger,
  commissionPayouts,
  emailOutbox,
  referrals,
} from '../src/db/schema.js';

describe('alur afiliasi', () => {
  let ctx: Awaited<ReturnType<typeof setup>>;
  let referrer = '';
  let referee = '';
  let admin = '';
  let refereeId = '';
  let code = '';
  const http = () => request(ctx.app.getHttpServer());
  beforeAll(async () => {
    ctx = await setup();
    const first = await http()
      .post('/auth/parent/register')
      .send({
        name: 'Nadia Pratama',
        email: 'nadia@example.test',
        password: 'sandi-demo-123',
        consent: true,
      })
      .expect(201);
    referrer = `Bearer ${first.body.token}`;
    const overview = await http()
      .get('/parent/affiliate')
      .set('Authorization', referrer)
      .expect(200);
    code = overview.body.code;
    const staff = await http()
      .post('/auth/staff/login')
      .send({ email: 'admin@udakids.local', password: 'tes-admin-aman-123' })
      .expect(201);
    admin = `Bearer ${staff.body.token}`;
  });
  afterAll(async () => {
    if (ctx) await ctx.close();
  });

  it('tautan tervalidasi dan klik ganda hanya dihitung sekali', async () => {
    const preview = await http().get(`/referral/${code}`).expect(200);
    expect(preview.body).toEqual({ valid: true, name: 'Na*** Pr***' });
    await http().post(`/referral/${code}/click`).expect(201);
    await http().post(`/referral/${code}/click`).expect(201);
    const overview = await http()
      .get('/parent/affiliate')
      .set('Authorization', referrer)
      .expect(200);
    expect(overview.body.counts.clicks).toBe(1);
    expect(await ctx.db.select().from(affiliateClickDays)).toHaveLength(1);
    await http()
      .get('/referral/XXXXXX')
      .expect(200)
      .then((r) => expect(r.body.valid).toBe(false));
  });

  it('pendaftar baru tercatat satu tingkat dan bonus menunggu anak aktif', async () => {
    await http()
      .post('/auth/parent/register')
      .send({
        name: 'Kode Salah',
        email: 'salah@example.test',
        password: 'sandi-demo-123',
        consent: true,
        referralCode: 'XXXXXX',
      })
      .expect(400);
    const second = await http()
      .post('/auth/parent/register')
      .send({
        name: 'Budi Santoso',
        email: 'budi@example.test',
        password: 'sandi-demo-123',
        consent: true,
        referralCode: code,
      })
      .expect(201);
    referee = `Bearer ${second.body.token}`;
    refereeId = second.body.user.id;
    const member = await http()
      .get('/parent/affiliate/members')
      .set('Authorization', referrer)
      .expect(200);
    expect(member.body.total).toBe(1);
    expect(member.body.items[0].name).toBe('Bu*** Sa***');
    expect((await ctx.db.select().from(referrals)).length).toBe(1);
    const bonus = (await ctx.db.select().from(affiliateLedger))[0];
    expect(bonus?.type).toBe('signup_bonus');
    expect(bonus?.state).toBe('pending');
    await http()
      .get('/parent/affiliate')
      .set('Authorization', referee)
      .expect(200)
      .then((r) => expect(r.body.counts.signups).toBe(0));
    await http().get('/parent/affiliate').expect(401);
  });

  it('persetujuan pesanan mencatat komisi sekali walau tombol admin ditekan dua kali', async () => {
    const settings = await http()
      .get('/admin/affiliate/settings')
      .set('Authorization', admin)
      .expect(200);
    await http()
      .put('/admin/affiliate/settings')
      .set('Authorization', admin)
      .send({ ...settings.body, holdDays: 0, accountCooldownDays: 0, minPayout: 1000 })
      .expect(200);
    const billing = await http().get('/parent/billing').set('Authorization', referee).expect(200);
    const order = await http()
      .post('/parent/orders')
      .set('Authorization', referee)
      .send({ packageId: billing.body.packages[0].id, methodId: billing.body.methods[0].id })
      .expect(201);
    await http()
      .post(`/admin/orders/${order.body.id}/approve`)
      .set('Authorization', admin)
      .expect(201);
    await http()
      .post(`/admin/orders/${order.body.id}/approve`)
      .set('Authorization', admin)
      .expect(201);
    const ledger = await ctx.db
      .select()
      .from(affiliateLedger)
      .where(eq(affiliateLedger.orderId, order.body.id));
    expect(ledger).toHaveLength(1);
    expect(ledger[0]?.amount).toBeGreaterThan(0);
    expect(ledger[0]?.state).toBe('available');
    const summary = await http()
      .get('/parent/affiliate')
      .set('Authorization', referrer)
      .expect(200);
    expect(summary.body.balance.available).toBe(ledger[0]?.amount);
  });

  it('rekening butuh kode email, nomor tetap terenkripsi, pencairan hanya sekali', async () => {
    await http().post('/parent/affiliate/account/code').set('Authorization', referrer).expect(201);
    const mail = (await ctx.db.select().from(emailOutbox)).find(
      (m) => m.kind === 'affiliate_account_code',
    );
    const otp = mail?.text?.match(/\b\d{6}\b/)?.[0];
    expect(otp).toMatch(/^\d{6}$/);
    const body = {
      providerId: 'bca',
      accountNumber: '1234567890',
      holderName: 'Nadia Pratama',
      code: otp,
    };
    await http()
      .put('/parent/affiliate/account')
      .set('Authorization', referrer)
      .send({ ...body, code: '000000' })
      .expect(400);
    await http()
      .put('/parent/affiliate/account')
      .set('Authorization', referrer)
      .send(body)
      .expect(200);
    await http()
      .put('/parent/affiliate/account')
      .set('Authorization', referrer)
      .send(body)
      .expect(400);
    const [account] = await ctx.db.select().from(affiliateAccounts);
    expect(account?.accountEncrypted).not.toContain(body.accountNumber);
    const overview = await http()
      .get('/parent/affiliate')
      .set('Authorization', referrer)
      .expect(200);
    const amount = Math.min(overview.body.balance.available, 1500);
    const first = await http()
      .post('/parent/affiliate/payouts')
      .set('Authorization', referrer)
      .send({ amount })
      .expect(201);
    await http()
      .post('/parent/affiliate/payouts')
      .set('Authorization', referrer)
      .send({ amount })
      .expect(400);
    const revealed = await http()
      .get(`/admin/affiliate/payouts/${first.body.id}/account`)
      .set('Authorization', admin)
      .expect(200);
    expect(revealed.body.accountNumber).toBe(body.accountNumber);
    await http()
      .get(`/admin/affiliate/payouts/${first.body.id}/account`)
      .set('Authorization', referrer)
      .expect(403);
    await http()
      .post(`/admin/affiliate/payouts/${first.body.id}/paid`)
      .set('Authorization', admin)
      .send({ transferRef: 'TRX-123' })
      .expect(201);
    await http()
      .post(`/admin/affiliate/payouts/${first.body.id}/paid`)
      .set('Authorization', admin)
      .send({ transferRef: 'TRX-123' })
      .expect(409);
    expect(await ctx.db.select().from(commissionPayouts)).toHaveLength(1);
    expect(
      (await ctx.db.select().from(affiliateLedger)).filter((e) => e.type === 'payout'),
    ).toHaveLength(1);
    const after = await http().get('/parent/affiliate').set('Authorization', referrer).expect(200);
    expect(after.body.balance.paid).toBe(amount);
    expect(after.body.balance.available).toBe(overview.body.balance.available - amount);
    expect(refereeId).toBeTruthy();
  });

  it('admin melihat analisis, memeriksa afiliator, dan koreksi saldo tercatat sekali', async () => {
    const analytics = await http()
      .get('/admin/affiliate/analytics')
      .set('Authorization', admin)
      .expect(200);
    expect(analytics.body.funnel.signups).toBe(1);
    expect(analytics.body.referredRevenue).toBeGreaterThan(0);
    const list = await http()
      .get('/admin/affiliate/affiliates')
      .set('Authorization', admin)
      .expect(200);
    const parentId = list.body.find((item: { code: string }) => item.code === code)?.id;
    expect(parentId).toBeTruthy();
    const detail = await http()
      .get(`/admin/affiliate/affiliates/${parentId}`)
      .set('Authorization', admin)
      .expect(200);
    expect(detail.body.members.total).toBe(1);
    expect(detail.body.ledger.some((row: { refereeId?: string }) => row.refereeId)).toBe(false);
    const adjusted = await http()
      .post(`/admin/affiliate/affiliates/${parentId}/adjust`)
      .set('Authorization', admin)
      .send({ amount: 500, note: 'Koreksi pengujian' })
      .expect(201);
    expect(adjusted.body.amount).toBe(500);
    await http()
      .post(`/admin/affiliate/affiliates/${parentId}/adjust`)
      .set('Authorization', referrer)
      .send({ amount: 500, note: 'Tidak berhak' })
      .expect(403);
    const bonus = (await ctx.db.select().from(affiliateLedger)).find(
      (row) => row.type === 'signup_bonus',
    );
    expect(bonus).toBeTruthy();
    await http()
      .post(`/admin/affiliate/ledger/${bonus!.id}/void`)
      .set('Authorization', admin)
      .send({ note: 'Pendaftaran belum memenuhi syarat' })
      .expect(201);
    await http()
      .post(`/admin/affiliate/ledger/${bonus!.id}/void`)
      .set('Authorization', admin)
      .send({ note: 'Pendaftaran belum memenuhi syarat' })
      .expect(409);
    const parentLedger = await http()
      .get('/parent/affiliate/ledger')
      .set('Authorization', referrer)
      .expect(200);
    expect(parentLedger.body.items.some((row: { refereeId?: string }) => row.refereeId)).toBe(
      false,
    );
  });
});
